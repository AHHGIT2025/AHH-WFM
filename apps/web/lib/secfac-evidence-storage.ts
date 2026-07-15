import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface UploadResult {
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  storagePath: string;
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Validates file properties.
 * Returns null if valid, or an error string if invalid.
 */
export function validateEvidenceFile(
  mimeType: string,
  sizeBytes: number,
  originalName: string
): string | null {
  // Check MIME Type
  if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return `Invalid file type: ${mimeType}. Only JPG, PNG, and WebP images are allowed.`;
  }

  // Check file size
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return `File size exceeds the 5MB limit. Uploaded file is ${(sizeBytes / (1024 * 1024)).toFixed(2)}MB.`;
  }

  // Basic check for executable extensions in original filename
  const ext = path.extname(originalName).toLowerCase();
  const blockedExtensions = new Set([
    ".exe", ".bat", ".cmd", ".sh", ".js", ".ts", ".html", ".htm", ".php", ".py", ".rb", ".pl", ".vbs", ".ps1"
  ]);
  if (blockedExtensions.has(ext)) {
    return `File type is blocked: ${ext} is not allowed.`;
  }

  return null;
}

/**
 * Sanitizes the original filename to prevent directory traversal or malformed characters.
 */
export function sanitizeFilename(name: string): string {
  const parsed = path.parse(name);
  const safeName = parsed.name
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .substring(0, 100); // Truncate name part to 100 chars max
  const safeExt = parsed.ext.replace(/[^a-zA-Z0-9]/g, ""); // Remove special characters from extension
  return safeExt ? `${safeName}.${safeExt}` : safeName;
}

/**
 * Resolves the secure uploads directory path.
 */
export function getUploadDirectory(): string {
  return process.env.SECFAC_UPLOAD_DIR || path.join(process.cwd(), "uploads", "secfac-evidence");
}

/**
 * Saves a file buffer securely to the uploads directory.
 */
export async function saveEvidenceFile(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  const validationError = validateEvidenceFile(mimeType, fileBuffer.length, originalName);
  if (validationError) {
    throw new Error(validationError);
  }

  const uploadDir = getUploadDirectory();

  // Create directory recursively if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const uniqueName = `${crypto.randomUUID()}${ext}`;
  const targetPath = path.join(uploadDir, uniqueName);

  // Write file to target path
  fs.writeFileSync(targetPath, fileBuffer);

  return {
    fileName: uniqueName,
    originalName: sanitizeFilename(originalName),
    mimeType,
    fileSizeBytes: fileBuffer.length,
    storagePath: targetPath
  };
}
