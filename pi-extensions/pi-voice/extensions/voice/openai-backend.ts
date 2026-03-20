/**
 * OpenAI Whisper API transcription backend.
 *
 * Sends recorded WAV audio to OpenAI's /v1/audio/transcriptions endpoint.
 * Requires OPENAI_API_KEY env var or config.openaiApiKey.
 *
 * This is batch mode: audio is recorded fully, then sent for transcription.
 * Typical latency: 1-5 seconds depending on audio length.
 */

import { createWavBuffer, SAMPLE_RATE, CHANNELS } from "./audio";

const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";

export interface TranscriptionResult {
  text: string;
  hadAudio: boolean;
  hadSpeech: boolean;
}

/**
 * Transcribe PCM audio via OpenAI Whisper API.
 *
 * @param pcmData - Raw 16-bit signed LE PCM at 16kHz mono
 * @param apiKey - OpenAI API key
 * @param language - ISO 639-1 language code (e.g. "en")
 * @param model - OpenAI model name (default: "whisper-1")
 */
export async function transcribeWithOpenAI(
  pcmData: Buffer,
  apiKey: string,
  language: string,
  model = "whisper-1",
): Promise<TranscriptionResult> {
  if (pcmData.length === 0) {
    return { text: "", hadAudio: false, hadSpeech: false };
  }

  const wavBuffer = createWavBuffer(pcmData);

  // Build multipart form data manually (no external deps)
  const boundary = `----PiVoice${Date.now()}${Math.random().toString(36).slice(2)}`;
  const parts: Buffer[] = [];

  // file field
  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="recording.wav"\r\n` +
    `Content-Type: audio/wav\r\n\r\n`,
  ));
  parts.push(wavBuffer);
  parts.push(Buffer.from("\r\n"));

  // model field
  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="model"\r\n\r\n` +
    `${model}\r\n`,
  ));

  // language field
  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="language"\r\n\r\n` +
    `${language}\r\n`,
  ));

  // response_format field
  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
    `json\r\n`,
  ));

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  const resp = await fetch(OPENAI_TRANSCRIPTION_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
    signal: AbortSignal.timeout(120_000),
  });

  if (!resp.ok) {
    const errorBody = await resp.text().catch(() => "unknown");
    if (resp.status === 401) {
      throw new Error("Invalid OpenAI API key. Check OPENAI_API_KEY.");
    }
    if (resp.status === 429) {
      throw new Error("OpenAI rate limit exceeded. Try again in a moment.");
    }
    throw new Error(`OpenAI API error ${resp.status}: ${errorBody.slice(0, 200)}`);
  }

  const json = await resp.json() as { text?: string };
  const text = (json.text || "").trim();

  return {
    text,
    hadAudio: true,
    hadSpeech: text.length > 0,
  };
}

/**
 * Validate an OpenAI API key by making a lightweight request.
 */
export async function validateOpenAIKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) return { ok: true };
    if (resp.status === 401) return { ok: false, error: "Invalid API key" };
    return { ok: false, error: `HTTP ${resp.status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network error" };
  }
}
