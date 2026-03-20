/**
 * Local Whisper transcription via sherpa-onnx (in-process).
 *
 * Loads ONNX Whisper models directly into the extension process
 * via sherpa-onnx-node N-API bindings. Zero network, fully offline.
 *
 * Supported models: Whisper (tiny/small/medium/turbo/large-v3)
 *
 * Model catalog:
 *   whisper-small  — 375 MB, 57 languages, good balance of speed and accuracy
 *   whisper-tiny   — 77 MB,  57 languages, fastest, lowest accuracy
 *   whisper-medium — 946 MB, 57 languages, better accuracy, medium speed
 *   whisper-turbo  — 1.0 GB, 57 languages, good accuracy, faster than medium
 *   whisper-large  — 1.8 GB, 57 languages, best accuracy, slow on CPU
 */

import * as os from "node:os";
import * as path from "node:path";
import { ensureModelDownloaded } from "./model-download";

// ─── Model catalog ───────────────────────────────────────────────────────────

const HF = "https://huggingface.co/csukuangfj";

export interface WhisperModelInfo {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  notes: string;
  accuracy: 1 | 2 | 3 | 4 | 5;
  speed: 1 | 2 | 3 | 4 | 5;
  files: Record<string, string>;
}

export const WHISPER_MODELS: WhisperModelInfo[] = [
  {
    id: "whisper-small", name: "Whisper Small", size: "~375 MB", sizeBytes: 393_216_000,
    notes: "57 languages, fast, good balance", accuracy: 3, speed: 4,
    files: {
      encoder: `${HF}/sherpa-onnx-whisper-small/resolve/main/small-encoder.int8.onnx`,
      decoder: `${HF}/sherpa-onnx-whisper-small/resolve/main/small-decoder.int8.onnx`,
      tokens: `${HF}/sherpa-onnx-whisper-small/resolve/main/small-tokens.txt`,
    },
  },
  {
    id: "whisper-tiny", name: "Whisper Tiny", size: "~77 MB", sizeBytes: 80_740_352,
    notes: "57 languages, fastest, lowest accuracy", accuracy: 1, speed: 5,
    files: {
      encoder: `${HF}/sherpa-onnx-whisper-tiny/resolve/main/tiny-encoder.int8.onnx`,
      decoder: `${HF}/sherpa-onnx-whisper-tiny/resolve/main/tiny-decoder.int8.onnx`,
      tokens: `${HF}/sherpa-onnx-whisper-tiny/resolve/main/tiny-tokens.txt`,
    },
  },
  {
    id: "whisper-medium", name: "Whisper Medium", size: "~946 MB", sizeBytes: 991_952_896,
    notes: "57 languages, good accuracy, medium speed", accuracy: 4, speed: 3,
    files: {
      encoder: `${HF}/sherpa-onnx-whisper-medium/resolve/main/medium-encoder.int8.onnx`,
      decoder: `${HF}/sherpa-onnx-whisper-medium/resolve/main/medium-decoder.int8.onnx`,
      tokens: `${HF}/sherpa-onnx-whisper-medium/resolve/main/medium-tokens.txt`,
    },
  },
  {
    id: "whisper-turbo", name: "Whisper Turbo", size: "~1.0 GB", sizeBytes: 1_087_373_312,
    notes: "57 languages, good accuracy, faster than medium", accuracy: 4, speed: 2,
    files: {
      encoder: `${HF}/sherpa-onnx-whisper-turbo/resolve/main/turbo-encoder.int8.onnx`,
      decoder: `${HF}/sherpa-onnx-whisper-turbo/resolve/main/turbo-decoder.int8.onnx`,
      tokens: `${HF}/sherpa-onnx-whisper-turbo/resolve/main/turbo-tokens.txt`,
    },
  },
  {
    id: "whisper-large", name: "Whisper Large v3", size: "~1.8 GB", sizeBytes: 1_863_319_552,
    notes: "57 languages, best accuracy, slow on CPU", accuracy: 4, speed: 1,
    files: {
      encoder: `${HF}/sherpa-onnx-whisper-large-v3/resolve/main/large-v3-encoder.int8.onnx`,
      decoder: `${HF}/sherpa-onnx-whisper-large-v3/resolve/main/large-v3-decoder.int8.onnx`,
      tokens: `${HF}/sherpa-onnx-whisper-large-v3/resolve/main/large-v3-tokens.txt`,
    },
  },
];

// ─── sherpa-onnx module management ───────────────────────────────────────────

let sherpaModule: any = null;
let sherpaInitialized = false;
let sherpaError: string | null = null;

/** Cached recognizer instance (model loading is expensive). */
let cachedRecognizer: { modelId: string; language: string; recognizer: any } | null = null;

export async function initSherpa(): Promise<boolean> {
  if (sherpaInitialized) return !sherpaError;
  if (sherpaError) return false;

  try {
    if (process.arch === "arm") {
      throw new Error("ARM32 not supported by sherpa-onnx-node. Use OpenAI backend.");
    }
    sherpaModule = await import("sherpa-onnx-node");
    sherpaInitialized = true;
    return true;
  } catch (err: any) {
    sherpaError = err?.message || String(err);
    sherpaInitialized = true;
    return false;
  }
}

export function isSherpaAvailable(): boolean {
  return sherpaInitialized && !sherpaError && sherpaModule != null;
}

export function getSherpaError(): string | null {
  return sherpaError;
}

export function clearRecognizerCache(): void {
  cachedRecognizer = null;
}

// ─── Recognizer ──────────────────────────────────────────────────────────────

function getOrCreateRecognizer(model: WhisperModelInfo, modelDir: string, language: string): any {
  if (!sherpaModule) throw new Error("sherpa-onnx not initialized. Call initSherpa() first.");

  const baseLang = language.split("-")[0] || language;

  if (cachedRecognizer && cachedRecognizer.modelId === model.id && cachedRecognizer.language === baseLang) {
    return cachedRecognizer.recognizer;
  }

  clearRecognizerCache();

  const recognizer = new sherpaModule.OfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      whisper: {
        encoder: path.join(modelDir, path.basename(new URL(model.files.encoder!).pathname)),
        decoder: path.join(modelDir, path.basename(new URL(model.files.decoder!).pathname)),
        language: baseLang,
        task: "transcribe",
      },
      tokens: path.join(modelDir, path.basename(new URL(model.files.tokens!).pathname)),
      numThreads: getNumThreads(),
      provider: "cpu",
    },
  });

  cachedRecognizer = { modelId: model.id, language: baseLang, recognizer };
  return recognizer;
}

// ─── Transcription ───────────────────────────────────────────────────────────

/**
 * Transcribe PCM audio using local Whisper model.
 * Auto-downloads the model on first use.
 *
 * @param pcmData - Raw 16-bit signed LE PCM at 16kHz mono
 * @param modelId - Model identifier (e.g. "whisper-small")
 * @param language - ISO 639-1 language code
 * @param onDownloadProgress - Optional callback for model download progress
 */
export async function transcribeLocal(
  pcmData: Buffer,
  modelId: string,
  language: string,
  onDownloadProgress?: (msg: string) => void,
): Promise<{ text: string; hadAudio: boolean; hadSpeech: boolean }> {
  if (pcmData.length === 0) {
    return { text: "", hadAudio: false, hadSpeech: false };
  }

  // Initialize sherpa
  if (!isSherpaAvailable()) {
    const ok = await initSherpa();
    if (!ok) {
      throw new Error(`sherpa-onnx not available: ${getSherpaError()}. Switch to OpenAI backend.`);
    }
  }

  // Find model
  const model = WHISPER_MODELS.find(m => m.id === modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  // Ensure model is downloaded
  const modelDir = await ensureModelDownloaded(
    model.id,
    model.files,
    model.sizeBytes,
    (progress) => {
      onDownloadProgress?.(`Downloading ${model.name}… ${progress.percent}%`);
    },
  );

  // Create recognizer and transcribe
  const recognizer = getOrCreateRecognizer(model, modelDir, language);

  // Convert 16-bit PCM to Float32Array
  const numSamples = Math.floor(pcmData.length / 2);
  const float32 = new Float32Array(numSamples);
  if ((pcmData.byteOffset & 1) !== 0) {
    for (let i = 0; i < numSamples; i++) float32[i] = pcmData.readInt16LE(i * 2) / 32768.0;
  } else {
    const int16 = new Int16Array(pcmData.buffer, pcmData.byteOffset, numSamples);
    for (let i = 0; i < numSamples; i++) float32[i] = int16[i]! / 32768.0;
  }

  // Run inference (async to keep event loop free)
  const stream = recognizer.createStream();
  stream.acceptWaveform({ sampleRate: 16000, samples: float32 });
  await recognizer.decodeAsync(stream);

  const result = recognizer.getResult(stream);
  const text = (result?.text || "").trim();

  return { text, hadAudio: true, hadSpeech: text.length > 0 };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNumThreads(): number {
  const cpus = os.cpus().length || 2;
  if (cpus <= 2) return 1;
  if (cpus <= 4) return 2;
  return Math.min(4, cpus - 2);
}
