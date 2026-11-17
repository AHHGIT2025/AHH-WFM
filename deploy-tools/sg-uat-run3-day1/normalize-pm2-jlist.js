#!/usr/bin/env node
/**
 * AHH WFM — CL-5 Contract Conversion Release External PM2 JSON Normalizer
 * Reads raw `pm2 jlist` stdout from stdin or a file argument, strips any leading/trailing
 * PM2 banner lines (such as "[PM2] Spawning PM2 daemon..."), parses the JSON array, and
 * emits a clean, minimal JSON array for Windows PowerShell 5.1 ConvertFrom-Json.
 */
"use strict";

const fs = require("fs");

function extractJsonArray(rawText) {
  const text = String(rawText || "").trim();
  if (!text) {
    throw new Error("Empty input received from pm2 jlist.");
  }

  const lastBracket = text.lastIndexOf("]");
  if (lastBracket === -1) {
    throw new Error("Could not locate closing JSON array bracket in pm2 jlist output.");
  }

  const candidateRegex = /\[\s*(?:\{|\])/g;
  let match;
  let parsed = null;
  let lastErr = null;

  while ((match = candidateRegex.exec(text)) !== null) {
    const startIdx = match.index;
    if (startIdx > lastBracket) break;
    const candidateSlice = text.slice(startIdx, lastBracket + 1);
    try {
      const attempt = JSON.parse(candidateSlice);
      if (Array.isArray(attempt)) {
        parsed = attempt;
        break;
      }
    } catch (err) {
      lastErr = err;
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Failed to parse JSON array from pm2 jlist output" +
        (lastErr && lastErr.message ? ": " + lastErr.message : ".")
    );
  }

  return parsed.map((proc) => ({
    name: proc && proc.name ? String(proc.name) : "",
    pm_id: proc && typeof proc.pm_id === "number" ? proc.pm_id : null,
    pid: proc && typeof proc.pid === "number" ? proc.pid : 0,
    status:
      proc && proc.pm2_env && proc.pm2_env.status
        ? String(proc.pm2_env.status)
        : "unknown",
    restart_time:
      proc && proc.pm2_env && typeof proc.pm2_env.restart_time === "number"
        ? proc.pm2_env.restart_time
        : 0
  }));
}

function main() {
  try {
    const fileArg = process.argv[2];
    const raw = fileArg
      ? fs.readFileSync(fileArg, "utf8")
      : fs.readFileSync(0, "utf8");
    const normalized = extractJsonArray(raw);
    process.stdout.write(JSON.stringify(normalized, null, 2) + "\n");
  } catch (err) {
    process.stderr.write(
      "[normalize-pm2-jlist] ERROR: " + (err && err.message ? err.message : String(err)) + "\n"
    );
    process.exit(1);
  }
}

main();
