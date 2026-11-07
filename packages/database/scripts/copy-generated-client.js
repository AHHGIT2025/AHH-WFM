const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REQUIRED_CLIENT_FILES = [
  "index.js",
  "index.d.ts",
  "default.js",
  "default.d.ts",
  "package.json",
  "schema.prisma",
  path.join("runtime", "library.js")
];

function isTransientArtifact(fileName) {
  return (
    /\.tmp\d*$/i.test(fileName) ||
    /\.stage-\d+-\d+$/i.test(fileName) ||
    /\.old-\d+-\d+$/i.test(fileName) ||
    /\.bak-test$/i.test(fileName)
  );
}

function computeSha256(filePath) {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

function collectCanonicalFiles(rootDir, currentRelDir = "") {
  const fullDir = currentRelDir ? path.join(rootDir, currentRelDir) : rootDir;
  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (isTransientArtifact(entry.name)) {
      continue;
    }
    const relPath = currentRelDir ? path.join(currentRelDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...collectCanonicalFiles(rootDir, relPath));
    } else if (entry.isFile()) {
      files.push(relPath);
    }
  }

  return files;
}

function cleanupStaleTransientFiles(dstDir, currentRelDir = "") {
  if (!fs.existsSync(dstDir)) {
    return 0;
  }
  const fullDir = currentRelDir ? path.join(dstDir, currentRelDir) : dstDir;
  let cleaned = 0;

  let entries = [];
  try {
    entries = fs.readdirSync(fullDir, { withFileTypes: true });
  } catch (_) {
    return 0;
  }

  for (const entry of entries) {
    const fullPath = path.join(fullDir, entry.name);
    if (entry.isDirectory()) {
      cleaned += cleanupStaleTransientFiles(dstDir, currentRelDir ? path.join(currentRelDir, entry.name) : entry.name);
    } else if (entry.isFile() && isTransientArtifact(entry.name)) {
      try {
        fs.unlinkSync(fullPath);
        cleaned++;
      } catch (_) {
        // Leave locked retired binary until the holding process exits on a subsequent run
      }
    }
  }

  return cleaned;
}

function isWindowsSharingOrLockError(err) {
  if (!err) return false;
  const lockCodes = new Set(["EPERM", "EBUSY", "EACCES", "EPIPE"]);
  if (err.code && lockCodes.has(err.code)) {
    return true;
  }
  if (typeof err.errno === "number" && Math.abs(err.errno) === 32) {
    return true;
  }
  if (typeof err.message === "string" && /used by another process|sharing violation/i.test(err.message)) {
    return true;
  }
  return false;
}

function atomicUpdateFile(srcPath, dstPath, expectedSha256) {
  const parentDir = path.dirname(dstPath);
  fs.mkdirSync(parentDir, { recursive: true });

  const stagePath = `${dstPath}.stage-${process.pid}-${Date.now()}`;
  fs.copyFileSync(srcPath, stagePath);

  const stageSha256 = computeSha256(stagePath);
  if (stageSha256 !== expectedSha256) {
    try {
      fs.unlinkSync(stagePath);
    } catch (_) {}
    throw new Error(
      `Staged file SHA-256 mismatch for "${dstPath}": expected ${expectedSha256}, got ${stageSha256}`
    );
  }

  try {
    fs.renameSync(stagePath, dstPath);
    return "renamed";
  } catch (err) {
    if (!fs.existsSync(dstPath) || !isWindowsSharingOrLockError(err)) {
      try {
        fs.unlinkSync(stagePath);
      } catch (_) {}
      throw err;
    }

    // Windows PE image (SEC_IMAGE) fallback: an active process has mapped dstPath (e.g., query_engine-windows.dll.node)
    // via LoadLibraryExW, which blocks in-place write/truncation (Win32 error 32 / Node v24 EPIPE),
    // but NTFS permits renaming the mapped file aside in the same directory and moving the new staged file into place.
    const retiredPath = `${dstPath}.old-${process.pid}-${Date.now()}`;
    try {
      fs.renameSync(dstPath, retiredPath);
      fs.renameSync(stagePath, dstPath);
    } catch (fallbackErr) {
      if (!fs.existsSync(dstPath) && fs.existsSync(retiredPath)) {
        try {
          fs.renameSync(retiredPath, dstPath);
        } catch (_) {}
      }
      try {
        if (fs.existsSync(stagePath)) fs.unlinkSync(stagePath);
      } catch (_) {}
      throw fallbackErr;
    }

    try {
      fs.unlinkSync(retiredPath);
    } catch (_) {
      // Retired file remains mapped in the running process; cleanupStaleTransientFiles will remove it after process exit.
    }

    return "replaced-locked-binary";
  }
}

function syncGeneratedClient({ srcDir, dstDir, label = "copy:client", silent = false }) {
  const resolvedSrc = path.resolve(srcDir);
  const resolvedDst = path.resolve(dstDir);

  if (!fs.existsSync(resolvedSrc)) {
    throw new Error(`[${label}] Source Prisma Client directory does not exist: ${resolvedSrc}`);
  }

  for (const requiredRel of REQUIRED_CLIENT_FILES) {
    const requiredPath = path.join(resolvedSrc, requiredRel);
    if (!fs.existsSync(requiredPath)) {
      throw new Error(`[${label}] Required generated Prisma Client file missing in source: ${requiredPath}`);
    }
  }

  const canonicalFiles = collectCanonicalFiles(resolvedSrc);
  if (canonicalFiles.length === 0) {
    throw new Error(`[${label}] No canonical generated Prisma Client files found in: ${resolvedSrc}`);
  }

  fs.mkdirSync(resolvedDst, { recursive: true });
  const cleanedTempCount = cleanupStaleTransientFiles(resolvedDst);

  const expectedHashes = new Map();
  let updatedCount = 0;
  let unchangedCount = 0;
  let lockedReplacedCount = 0;

  for (const relPath of canonicalFiles) {
    const srcPath = path.join(resolvedSrc, relPath);
    const dstPath = path.join(resolvedDst, relPath);

    const srcStat = fs.statSync(srcPath);
    const srcSha256 = computeSha256(srcPath);
    expectedHashes.set(relPath, srcSha256);

    let isIdentical = false;
    if (fs.existsSync(dstPath)) {
      try {
        const dstStat = fs.statSync(dstPath);
        if (dstStat.isFile() && dstStat.size === srcStat.size) {
          const dstSha256 = computeSha256(dstPath);
          if (dstSha256 === srcSha256) {
            isIdentical = true;
          }
        }
      } catch (_) {
        isIdentical = false;
      }
    }

    if (isIdentical) {
      unchangedCount++;
    } else {
      const mode = atomicUpdateFile(srcPath, dstPath, srcSha256);
      updatedCount++;
      if (mode === "replaced-locked-binary") {
        lockedReplacedCount++;
      }
    }
  }

  // Post-sync cryptographic verification gate: never allow silent skips or partial copies
  for (const [relPath, expectedSha256] of expectedHashes.entries()) {
    const dstPath = path.join(resolvedDst, relPath);
    if (!fs.existsSync(dstPath)) {
      throw new Error(`[${label}] Post-sync verification failed — missing destination file: ${dstPath}`);
    }
    const actualSha256 = computeSha256(dstPath);
    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `[${label}] Post-sync SHA-256 mismatch for "${relPath}": expected ${expectedSha256}, got ${actualSha256}`
      );
    }
  }

  if (!silent) {
    console.log(
      `[${label}] Verified ${canonicalFiles.length} Prisma Client files in ${dstDir} ` +
        `(updated: ${updatedCount}, unchanged SHA-256 match: ${unchangedCount}, ` +
        `locked-binary rename replacements: ${lockedReplacedCount}, stale temp cleaned: ${cleanedTempCount})`
    );
  }

  return {
    totalFiles: canonicalFiles.length,
    updatedCount,
    unchangedCount,
    lockedReplacedCount,
    cleanedTempCount
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const positional = args.filter(a => !a.startsWith("--"));
  const labelArg = args.find(a => a.startsWith("--label="));
  const label = labelArg ? labelArg.split("=")[1] : "copy:client";

  const srcDir = positional[0] || path.join("src", "generated", "client");
  const dstDir = positional[1] || path.join("dist", "generated", "client");

  try {
    syncGeneratedClient({ srcDir, dstDir, label });
  } catch (err) {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  }
}

module.exports = {
  syncGeneratedClient,
  computeSha256,
  collectCanonicalFiles,
  isTransientArtifact,
  isWindowsSharingOrLockError
};
