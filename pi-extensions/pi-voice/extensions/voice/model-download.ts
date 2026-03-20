/**
 * Model download manager — download and cache sherpa-onnx Whisper models.
 *
 * Storage: ~/.pi/models/{modelId}/
 *
 * Features:
 * - Resume support (HTTP Range)
 * - Atomic writes (.tmp → rename)
 * - In-flight deduplication
 * - Progress callbacks
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { WhisperModelInfo } from "./whisper-backend";

// ─── Paths ───────────────────────────────────────────────────────────────────

export function getModelsDir(): string {
  return path.join(os.homedir(), ".pi", "models");
}

export function getModelDir(modelId: string): string {
  return path.join(getModelsDir(), modelId);
}

// ─── Status ──────────────────────────────────────────────────────────────────

export function isModelDownloaded(modelId: string, expectedFiles: Record<string, string>): boolean {
  const dir = getModelDir(modelId);
  if (!fs.existsSync(dir)) return false;
  for (const url of Object.values(expectedFiles)) {
    const filename = path.basename(new URL(url).pathname);
    if (!fs.existsSync(path.join(dir, filename))) return false;
  }
  return true;
}

export function getDownloadedModels(): { id: string; sizeMB: number }[] {
  const baseDir = getModelsDir();
  if (!fs.existsSync(baseDir)) return [];
  const results: { id: string; sizeMB: number }[] = [];
  try {
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const size = getDirSizeMB(path.join(baseDir, entry.name));
      results.push({ id: entry.name, sizeMB: size });
    }
  } catch {}
  return results;
}

export function deleteModel(modelId: string): boolean {
  const dir = getModelDir(modelId);
  if (!fs.existsSync(dir)) return false;
  try { fs.rmSync(dir, { recursive: true, force: true }); return true; } catch { return false; }
}

// ─── Download ────────────────────────────────────────────────────────────────

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  file: string;
  percent: number;
}

/**
 * Download all model files. Returns model directory path.
 * Supports resume via HTTP Range. Atomic writes via .tmp rename.
 */
async function downloadModel(
  modelId: string,
  files: Record<string, string>,
  totalSizeBytes: number,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<string> {
  const dir = getModelDir(modelId);
  fs.mkdirSync(dir, { recursive: true });

  let overallDownloaded = 0;

  for (const [role, url] of Object.entries(files)) {
    const filename = path.basename(new URL(url).pathname);
    const filePath = path.join(dir, filename);
    const tmpPath = filePath + ".tmp";

    // Skip if already downloaded
    if (fs.existsSync(filePath)) {
      overallDownloaded += fs.statSync(filePath).size;
      continue;
    }

    // Check for partial download (resume)
    let startByte = 0;
    if (fs.existsSync(tmpPath)) {
      startByte = fs.statSync(tmpPath).size;
      overallDownloaded += startByte;
    }

    const headers: Record<string, string> = {};
    if (startByte > 0) headers["Range"] = `bytes=${startByte}-`;

    const resp = await fetch(url, { headers, redirect: "follow" });
    if (!resp.ok && resp.status !== 206) {
      throw new Error(`Download failed: HTTP ${resp.status} for ${filename}`);
    }

    // If server returned full file despite Range request, reset
    if (startByte > 0 && resp.status === 200) {
      overallDownloaded -= startByte;
      startByte = 0;
    }

    if (!resp.body) throw new Error(`No response body for ${filename}`);

    const ws = fs.createWriteStream(tmpPath, { flags: startByte > 0 ? "a" : "w" });
    const reader = resp.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Handle backpressure
        if (!ws.write(value)) {
          await new Promise<void>((resolve, reject) => {
            const onDrain = () => { ws.removeListener("error", onError); resolve(); };
            const onError = (err: Error) => { ws.removeListener("drain", onDrain); reject(err); };
            ws.once("drain", onDrain);
            ws.once("error", onError);
          });
        }
        overallDownloaded += value.byteLength;

        onProgress?.({
          downloadedBytes: overallDownloaded,
          totalBytes: totalSizeBytes,
          file: filename,
          percent: Math.round((overallDownloaded / totalSizeBytes) * 100),
        });
      }
    } finally {
      ws.end();
      await new Promise<void>((resolve, reject) => {
        const onFinish = () => { ws.removeListener("error", onError); resolve(); };
        const onError = (err: Error) => { ws.removeListener("finish", onFinish); reject(err); };
        ws.once("finish", onFinish);
        ws.once("error", onError);
      });
    }

    // Atomic rename
    fs.renameSync(tmpPath, filePath);
  }

  return dir;
}

// ─── In-flight deduplication ─────────────────────────────────────────────────

const _inFlight = new Map<string, Promise<string>>();

/**
 * Ensure a model is downloaded. Deduplicates concurrent calls.
 */
export async function ensureModelDownloaded(
  modelId: string,
  files: Record<string, string>,
  totalSizeBytes: number,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<string> {
  if (isModelDownloaded(modelId, files)) {
    return getModelDir(modelId);
  }

  if (_inFlight.has(modelId)) return _inFlight.get(modelId)!;

  const promise = downloadModel(modelId, files, totalSizeBytes, onProgress)
    .finally(() => _inFlight.delete(modelId));

  _inFlight.set(modelId, promise);
  return promise;
}

// ─── Disk space ──────────────────────────────────────────────────────────────

export function getFreeDiskSpace(dirPath: string): number | null {
  try {
    const stats = fs.statfsSync(dirPath);
    return stats.bavail * stats.bsize;
  } catch {}
  try {
    const stats = fs.statfsSync(path.dirname(dirPath));
    return stats.bavail * stats.bsize;
  } catch {}
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDirSizeBytes(dirPath: string): number {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fp = path.join(dirPath, entry.name);
      if (entry.isFile()) total += fs.statSync(fp).size;
      else if (entry.isDirectory()) total += getDirSizeBytes(fp);
    }
  } catch {}
  return total;
}

function getDirSizeMB(dirPath: string): number {
  return Math.round(getDirSizeBytes(dirPath) / (1024 * 1024));
}
