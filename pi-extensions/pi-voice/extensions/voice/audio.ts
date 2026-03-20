/**
 * Audio capture — detect and use sox/ffmpeg/arecord for mic input.
 *
 * Captures raw 16-bit signed LE PCM at 16kHz mono.
 * Tries tools in order: sox (rec) → ffmpeg → arecord (Linux).
 */

import { spawnSync } from "node:child_process";

export const SAMPLE_RATE = 16000;
export const CHANNELS = 1;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AudioCaptureTool {
  name: string;
  cmd: string;
  args: string[];
}

// ─── Command detection (cached) ──────────────────────────────────────────────

const _cmdCache = new Map<string, boolean>();

function commandExists(cmd: string): boolean {
  const cached = _cmdCache.get(cmd);
  if (cached !== undefined) return cached;
  const which = process.platform === "win32" ? "where" : "which";
  const ok = spawnSync(which, [cmd], { stdio: "pipe", timeout: 3000 }).status === 0;
  _cmdCache.set(cmd, ok);
  return ok;
}

// ─── Windows DirectShow device detection ─────────────────────────────────────

function detectWindowsAudioDevice(): string | null {
  try {
    const result = spawnSync("ffmpeg", ["-f", "dshow", "-list_devices", "true", "-i", "dummy"], {
      timeout: 3000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"],
    });
    const match = (result.stderr || "").match(/"([^"]+)"\s*\(audio\)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

// ─── Tool detection ──────────────────────────────────────────────────────────

let _cached: AudioCaptureTool | null | undefined;

export function detectAudioTool(): AudioCaptureTool | null {
  if (_cached !== undefined) return _cached;

  // 1. SoX rec — purpose-built for recording
  if (commandExists("rec")) {
    _cached = {
      name: "sox",
      cmd: "rec",
      args: [
        "-q", "--buffer", "4096",
        "-c", String(CHANNELS), "-b", "16",
        "-e", "signed-integer", "-t", "raw", "-",
        "rate", String(SAMPLE_RATE),
      ],
    };
    return _cached;
  }

  // 2. ffmpeg — widely available
  if (commandExists("ffmpeg")) {
    const isMac = process.platform === "darwin";
    const isLinux = process.platform === "linux";
    const isWin = process.platform === "win32";

    let inputArgs: string[];
    if (isMac) {
      inputArgs = ["-f", "avfoundation", "-i", ":default"];
    } else if (isLinux) {
      inputArgs = ["-f", "pulse", "-i", "default"];
    } else if (isWin) {
      const dev = detectWindowsAudioDevice();
      inputArgs = dev
        ? ["-f", "dshow", "-i", `audio=${dev}`]
        : ["-f", "dshow", "-i", "audio=Microphone"];
    } else {
      inputArgs = ["-f", "pulse", "-i", "default"];
    }

    _cached = {
      name: "ffmpeg",
      cmd: "ffmpeg",
      args: [
        ...inputArgs,
        "-ac", String(CHANNELS), "-ar", String(SAMPLE_RATE),
        "-sample_fmt", "s16", "-f", "s16le",
        "-loglevel", "error", "pipe:1",
      ],
    };
    return _cached;
  }

  // 3. arecord — Linux ALSA, pre-installed
  if (process.platform === "linux" && commandExists("arecord")) {
    _cached = {
      name: "arecord",
      cmd: "arecord",
      args: ["-q", "-f", "S16_LE", "-r", String(SAMPLE_RATE), "-c", String(CHANNELS), "-t", "raw"],
    };
    return _cached;
  }

  _cached = null;
  return null;
}

// ─── Audio level meter ───────────────────────────────────────────────────────

/** Shared audio levels — accessible globally for waveform widgets. */
let _audioLevel = 0;
let _audioLevelSmoothed = 0;

/** Get current audio level (0-1). */
export function getAudioLevel(): number { return _audioLevel; }
/** Get smoothed audio level (0-1). */
export function getAudioLevelSmoothed(): number { return _audioLevelSmoothed; }

export function updateAudioLevel(chunk: Buffer) {
  const len = chunk.length;
  if (len < 2) return;
  const samples = len >> 1;
  let sum = 0;

  if ((chunk.byteOffset & 1) === 0) {
    const view = new Int16Array(chunk.buffer, chunk.byteOffset, samples);
    for (let i = 0; i < view.length; i++) sum += view[i]! * view[i]!;
  } else {
    for (let i = 0; i < len - 1; i += 2) {
      const s = chunk.readInt16LE(i);
      sum += s * s;
    }
  }

  const rms = Math.sqrt(sum / samples);
  _audioLevel = Math.min(1, Math.pow(Math.min(rms / 2500, 1), 0.6));
  _audioLevelSmoothed = _audioLevel > _audioLevelSmoothed
    ? _audioLevelSmoothed * 0.35 + _audioLevel * 0.65
    : _audioLevelSmoothed * 0.75 + _audioLevel * 0.25;
}

export function resetAudioLevels() {
  _audioLevel = 0;
  _audioLevelSmoothed = 0;
}

// ─── WAV encoding ────────────────────────────────────────────────────────────

/** Create WAV file buffer from raw 16-bit signed LE PCM (16kHz mono). */
export function createWavBuffer(pcmData: Buffer): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcmData.length;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * CHANNELS * 2, 28);
  header.writeUInt16LE(CHANNELS * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}
