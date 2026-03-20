/**
 * pi-voice — Hold-to-talk voice input for Pi.
 *
 * Two backends:
 *   - Local Whisper (offline, via sherpa-onnx) — default
 *   - OpenAI Whisper API (cloud, needs OPENAI_API_KEY)
 *
 * Both are batch mode: record complete audio, then transcribe.
 *
 * STATE MACHINE
 * ─────────────
 *   idle → warmup → recording → finalizing → idle
 *
 *   warmup:     User holds SPACE for ≥1.2s. Countdown shown.
 *               Audio capture starts immediately (pre-recording).
 *   recording:  Audio captured. Waveform widget shown.
 *               Release SPACE → tail recording (1.5s) → stop.
 *   finalizing: Audio sent to backend. Waiting for transcript.
 *
 * HOLD-TO-TALK DETECTION (two terminal modes)
 * ────────────────────────────────────────────
 *   A) Kitty protocol (Ghostty Linux, Kitty, WezTerm):
 *      True key-down/repeat/release events.
 *      Press → warmup. Release < 300ms → tap (type space).
 *      Held ≥ 1.2s → recording. Release → stop.
 *
 *   B) Non-Kitty (macOS Terminal, Ghostty macOS):
 *      No release events. Holding sends rapid presses (~30-90ms).
 *      6 rapid presses → hold confirmed → warmup.
 *      Gap > 500ms → released. Gap > 250ms during recording → released.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
} from "@mariozechner/pi-coding-agent";
import { isKeyRelease, isKeyRepeat, matchesKey } from "@mariozechner/pi-tui";
import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  type VoiceConfig, type VoiceBackend,
  DEFAULT_CONFIG, loadConfig, saveConfig, resolveOpenAIKey,
} from "./voice/config";
import {
  detectAudioTool, updateAudioLevel, resetAudioLevels,
  getAudioLevelSmoothed, createWavBuffer,
} from "./voice/audio";
import { transcribeWithOpenAI, validateOpenAIKey } from "./voice/openai-backend";
import {
  transcribeLocal, WHISPER_MODELS,
  initSherpa, isSherpaAvailable, getSherpaError, clearRecognizerCache,
} from "./voice/whisper-backend";
import { getDownloadedModels, deleteModel, formatBytes } from "./voice/model-download";

// ─── Types ───────────────────────────────────────────────────────────────────

type VoiceState = "idle" | "warmup" | "recording" | "finalizing";

// ─── Constants ───────────────────────────────────────────────────────────────

const HOLD_THRESHOLD_MS = 1200;          // Must hold 1.2s before voice activates
const RELEASE_DETECT_MS = 500;           // Gap = released (non-Kitty, pre-recording)
const RELEASE_DETECT_RECORDING_MS = 250; // Gap = released (non-Kitty, during recording)
const REPEAT_CONFIRM_COUNT = 6;          // Rapid presses to confirm "holding"
const REPEAT_CONFIRM_MS = 700;           // Max gap between rapid presses
const RECORDING_GRACE_MS = 800;          // Ignore release right after recording start
const TYPING_COOLDOWN_MS = 400;          // Ignore space after recent typing
const TAIL_RECORDING_MS = 1500;          // Keep recording 1.5s after release
const CORRUPTION_GUARD_MS = 200;         // Min gap between stop and restart
const MAX_RECORDING_SECS = 120;          // Max recording length

// ─── Debug ───────────────────────────────────────────────────────────────────

const DEBUG = !!process.env.PI_VOICE_DEBUG;
function dbg(...args: unknown[]) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().split("T")[1];
  process.stderr.write(`[voice ${ts}] ${args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")}\n`);
}

// ═════════════════════════════════════════════════════════════════════════════
// Extension
// ═════════════════════════════════════════════════════════════════════════════

export default function (pi: ExtensionAPI) {
  let config: VoiceConfig = structuredClone(DEFAULT_CONFIG);
  let currentCwd = process.cwd();
  let voiceState: VoiceState = "idle";
  let ctx: ExtensionContext | null = null;

  // Recording state
  let recordingStart = 0;
  let recordingStartedAt = 0;
  let statusTimer: ReturnType<typeof setInterval> | null = null;
  let terminalInputUnsub: (() => void) | null = null;
  let editorTextBeforeVoice = "";

  // Audio capture
  let recProcess: ChildProcess | null = null;
  let audioChunks: Buffer[] = [];

  // Hold-to-talk state
  let kittyReleaseDetected = false;
  let spaceDownTime: number | null = null;
  let holdActivationTimer: ReturnType<typeof setTimeout> | null = null;
  let spaceConsumed = false;
  let releaseDetectTimer: ReturnType<typeof setTimeout> | null = null;
  let warmupWidgetTimer: ReturnType<typeof setInterval> | null = null;
  let recWidgetAnimTimer: ReturnType<typeof setInterval> | null = null;
  let spacePressCount = 0;
  let lastSpacePressTime = 0;
  let holdConfirmed = false;
  let errorCooldownUntil = 0;
  let lastNonSpaceKeyTime = 0;
  let tailRecordingTimer: ReturnType<typeof setTimeout> | null = null;
  let lastEscapeTime = 0;
  let _startingRecording = false;

  // Dictation mode
  let dictationMode = false;

  // ─── Sound feedback (macOS) ────────────────────────────────────────────

  const _sounds: Record<string, string | null> = {};
  for (const [type, file] of Object.entries({
    start: "/System/Library/Sounds/Tink.aiff",
    stop: "/System/Library/Sounds/Pop.aiff",
    error: "/System/Library/Sounds/Basso.aiff",
  })) {
    _sounds[type] = fs.existsSync(file) ? file : null;
  }

  function playSound(type: "start" | "stop" | "error") {
    const file = _sounds[type];
    if (!file) return;
    try {
      const p = spawn("afplay", [file], { stdio: "ignore", detached: true });
      p.unref();
      p.on("error", () => {});
    } catch {}
  }

  // ─── State management ──────────────────────────────────────────────────

  function setVoiceState(newState: VoiceState) {
    const prev = voiceState;
    voiceState = newState;
    if (prev !== newState) dbg(`STATE: ${prev} → ${newState}`);
    updateStatus();
  }

  function updateStatus() {
    if (!ctx?.hasUI) return;
    switch (voiceState) {
      case "idle": {
        if (!config.enabled) { ctx.ui.setStatus("voice", undefined); break; }
        const tag = config.backend === "openai" ? "OPENAI" : "LOCAL";
        ctx.ui.setStatus("voice", `MIC ${tag}`);
        break;
      }
      case "warmup":
        ctx.ui.setStatus("voice", "MIC HOLD...");
        break;
      case "recording": {
        const secs = Math.round((Date.now() - recordingStart) / 1000);
        const meterLen = 4;
        const filled = Math.round(getAudioLevelSmoothed() * meterLen);
        ctx.ui.setStatus("voice", `REC ${secs}s ${"█".repeat(filled)}${"░".repeat(meterLen - filled)}`);
        break;
      }
      case "finalizing":
        ctx.ui.setStatus("voice", "STT...");
        break;
    }
  }

  // ─── Cleanup helpers ───────────────────────────────────────────────────

  function clearHoldTimer() {
    if (holdActivationTimer) { clearTimeout(holdActivationTimer); holdActivationTimer = null; }
  }
  function clearReleaseTimer() {
    if (releaseDetectTimer) { clearTimeout(releaseDetectTimer); releaseDetectTimer = null; }
  }
  function clearWarmupWidget() {
    if (warmupWidgetTimer) { clearInterval(warmupWidgetTimer); warmupWidgetTimer = null; }
  }
  function clearRecAnimTimer() {
    if (recWidgetAnimTimer) { clearInterval(recWidgetAnimTimer); recWidgetAnimTimer = null; }
  }
  function hideWidget() {
    if (ctx?.hasUI) ctx.ui.setWidget("voice-rec", undefined);
  }
  function cancelDelayedStop() {
    if (tailRecordingTimer) { clearTimeout(tailRecordingTimer); tailRecordingTimer = null; }
  }

  function resetHoldState(opts?: { cooldown?: number }) {
    spaceConsumed = false;
    spaceDownTime = null;
    spacePressCount = 0;
    holdConfirmed = false;
    clearHoldTimer();
    clearReleaseTimer();
    if (opts?.cooldown) errorCooldownUntil = Date.now() + opts.cooldown;
  }

  function killRecProcess() {
    if (recProcess) {
      try { recProcess.kill("SIGKILL"); } catch {}
      recProcess = null;
    }
  }

  function voiceCleanup() {
    if (statusTimer) { clearInterval(statusTimer); statusTimer = null; }
    cancelDelayedStop();
    clearWarmupWidget();
    clearRecAnimTimer();
    resetAudioLevels();
    killRecProcess();
    audioChunks = [];
    resetHoldState();
    _startingRecording = false;
    lastSpacePressTime = 0;
    lastNonSpaceKeyTime = 0;
    errorCooldownUntil = 0;
    editorTextBeforeVoice = "";
    dictationMode = false;
    recordingStart = 0;
    recordingStartedAt = 0;
    if (terminalInputUnsub) { terminalInputUnsub(); terminalInputUnsub = null; }
    hideWidget();
    setVoiceState("idle");
  }

  // ─── Waveform widget ──────────────────────────────────────────────────

  function buildMiniWave(level: number): string {
    const bars = "▁▂▃▄▅▆▇█";
    const len = 12;
    let out = "";
    const t = Date.now() / 1000;
    const energy = Math.pow(level, 0.7);
    for (let i = 0; i < len; i++) {
      const pos = i / len;
      const wave1 = Math.sin(t * 4.5 + i * 0.9) * 0.35;
      const wave2 = Math.sin(t * 7.2 + i * 1.4 + 2.0) * 0.15;
      const center = 1.0 - Math.abs(pos - 0.5) * 1.2;
      const base = 0.15 + energy * 0.85;
      const value = Math.max(0, Math.min(1, (wave1 + wave2 + 0.5) * base * center));
      const idx = Math.min(bars.length - 1, Math.round(value * (bars.length - 1)));
      out += bars[idx];
    }
    return out;
  }

  function getRecordDot(): string {
    const phase = (Math.sin(Date.now() / 600) + 1) / 2;
    return phase > 0.65 ? "●" : phase > 0.35 ? "◉" : "○";
  }

  function showWarmupWidget() {
    if (!ctx?.hasUI) return;
    const startTime = Date.now();

    const render = () => {
      if (!ctx?.hasUI) return;
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / HOLD_THRESHOLD_MS, 1);
      ctx.ui.setWidget("voice-rec", (_tui, theme) => ({
        invalidate() {},
        render(width: number): string[] {
          const meterLen = Math.max(4, Math.min(12, Math.floor(width * 0.15)));
          const filled = Math.round(progress * meterLen);
          const meter = "█".repeat(filled) + "░".repeat(meterLen - filled);
          const hint = progress < 1 ? "hold…" : "ready!";
          return [` ${theme.fg("accent", "🎤")} ${theme.fg("accent", meter)} ${theme.fg("dim", hint)}`];
        },
      }), { placement: "belowEditor" });
    };

    render();
    warmupWidgetTimer = setInterval(render, 90);
  }

  function showRecordingWidget() {
    if (!ctx?.hasUI) return;
    clearWarmupWidget();

    const render = () => {
      if (!ctx?.hasUI) return;
      ctx.ui.setWidget("voice-rec", (_tui, theme) => ({
        invalidate() {},
        render(_width: number): string[] {
          const elapsed = Math.round((Date.now() - recordingStart) / 1000);
          const mins = Math.floor(elapsed / 60);
          const secs = elapsed % 60;
          const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`;
          const wave = buildMiniWave(getAudioLevelSmoothed());
          const dot = theme.fg("error", getRecordDot());
          return [` ${dot} ${theme.fg("accent", wave)} ${theme.fg("muted", timeStr)} ${theme.fg("dim", "⌴ release")}`];
        },
      }), { placement: "belowEditor" });
    };

    render();
    recWidgetAnimTimer = setInterval(render, 150);
  }

  // ─── Recording: Start ──────────────────────────────────────────────────

  async function startRecording(): Promise<boolean> {
    dbg("startRecording", { voiceState, starting: _startingRecording });
    if (!ctx?.hasUI) return false;
    if (_startingRecording) return false;
    _startingRecording = true;

    try {
      // Corruption guard: abort stale session
      if (voiceState === "finalizing" || voiceState === "recording") {
        killRecProcess();
        audioChunks = [];
        clearRecAnimTimer();
        clearWarmupWidget();
        hideWidget();
        setVoiceState("idle");
        await new Promise(r => setTimeout(r, CORRUPTION_GUARD_MS));
      }

      recordingStart = Date.now();
      editorTextBeforeVoice = ctx.hasUI ? (ctx.ui.getEditorText() || "") : "";

      // Detect audio capture tool
      const audioTool = detectAudioTool();
      if (!audioTool) {
        ctx.ui.notify("No audio capture tool found. Install sox or ffmpeg.", "error");
        resetHoldState({ cooldown: 5000 });
        setVoiceState("idle");
        return false;
      }

      // Start audio capture
      audioChunks = [];
      recProcess = spawn(audioTool.cmd, audioTool.args, { stdio: ["pipe", "pipe", "pipe"] });

      recProcess.stdout?.on("data", (chunk: Buffer) => {
        audioChunks.push(chunk);
        updateAudioLevel(chunk);
      });

      recProcess.stderr?.on("data", (d: Buffer) => {
        const msg = d.toString().trim();
        if (msg.includes("buffer overrun") || msg.includes("Discarding")) return;
        dbg(`${audioTool.name} stderr:`, msg);
      });

      recProcess.on("error", (err) => {
        dbg("audio process error:", err.message);
        if (voiceState === "recording") {
          onRecordingError(`Audio capture error: ${err.message}`);
        }
      });

      setVoiceState("recording");
      recordingStartedAt = Date.now();

      // Status timer
      statusTimer = setInterval(() => {
        if (voiceState === "recording") {
          updateStatus();
          if ((Date.now() - recordingStart) / 1000 >= MAX_RECORDING_SECS) {
            stopRecording();
          }
        }
      }, 1000);

      showRecordingWidget();
      playSound("start");
      return true;
    } finally {
      _startingRecording = false;
    }
  }

  // ─── Recording: Stop & Transcribe ──────────────────────────────────────

  async function stopRecording() {
    cancelDelayedStop();
    dbg("stopRecording", { voiceState });
    if (voiceState !== "recording" || !ctx?.hasUI) return;
    if (statusTimer) { clearInterval(statusTimer); statusTimer = null; }

    setVoiceState("finalizing");
    clearRecAnimTimer();
    hideWidget();

    // Stop audio capture
    try { recProcess?.kill("SIGTERM"); } catch {}
    await new Promise(r => setTimeout(r, 200));

    const pcmData = Buffer.concat(audioChunks);
    audioChunks = [];
    recProcess = null;

    if (pcmData.length === 0) {
      ctx.ui.notify("Microphone captured no audio. Check mic permissions.", "error");
      playSound("error");
      resetHoldState({ cooldown: 3000 });
      setVoiceState("idle");
      return;
    }

    // Show transcribing message
    const backendLabel = config.backend === "openai" ? "OpenAI" : `${WHISPER_MODELS.find(m => m.id === config.whisperModel)?.name || config.whisperModel}`;
    ctx.ui.notify(`Transcribing with ${backendLabel}…`, "info");

    try {
      let text: string;

      if (config.backend === "openai") {
        const apiKey = resolveOpenAIKey(config);
        if (!apiKey) {
          ctx.ui.notify("OPENAI_API_KEY not set. Use /voice backend to switch, or set the env var.", "error");
          playSound("error");
          resetHoldState({ cooldown: 5000 });
          setVoiceState("idle");
          return;
        }

        // Transcribe with timeout
        const result = await Promise.race([
          transcribeWithOpenAI(pcmData, apiKey, config.language),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Transcription timed out (120s)")), 120_000)),
        ]);
        text = result.text;

        if (!result.hadSpeech) {
          ctx.ui.notify("No speech detected.", "warning");
          playSound("error");
          resetHoldState({ cooldown: 3000 });
          setVoiceState("idle");
          return;
        }
      } else {
        // Local whisper
        const result = await Promise.race([
          transcribeLocal(pcmData, config.whisperModel, config.language, (msg) => {
            ctx?.ui.notify(msg, "info");
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Transcription timed out (120s)")), 120_000)),
        ]);
        text = result.text;

        if (!result.hadSpeech) {
          ctx.ui.notify("No speech detected.", "warning");
          playSound("error");
          resetHoldState({ cooldown: 3000 });
          setVoiceState("idle");
          return;
        }
      }

      // Insert transcript into editor
      if (ctx.hasUI && text.trim()) {
        const prefix = editorTextBeforeVoice ? editorTextBeforeVoice + " " : "";
        ctx.ui.setEditorText(prefix + text);
        const elapsed = ((Date.now() - recordingStart) / 1000).toFixed(1);
        dbg(`Transcribed in ${elapsed}s: "${text.slice(0, 80)}"`);
      }

      playSound("stop");
      resetHoldState();
      setVoiceState("idle");

    } catch (err: any) {
      onRecordingError(err?.message || String(err));
    }
  }

  function onRecordingError(err: string) {
    killRecProcess();
    audioChunks = [];
    clearRecAnimTimer();
    if (statusTimer) { clearInterval(statusTimer); statusTimer = null; }
    hideWidget();
    resetHoldState({ cooldown: 5000 });
    clearWarmupWidget();
    ctx?.ui.notify(`Voice error: ${err}`, "error");
    playSound("error");
    setVoiceState("idle");
  }

  // ─── Tail recording ────────────────────────────────────────────────────

  function scheduleDelayedStop() {
    cancelDelayedStop();
    dbg("scheduleDelayedStop →", TAIL_RECORDING_MS, "ms");
    tailRecordingTimer = setTimeout(() => {
      tailRecordingTimer = null;
      dbg("tailRecordingTimer fired → stopping");
      stopRecording();
    }, TAIL_RECORDING_MS);
  }

  // ─── Hold-to-Talk: release detection ───────────────────────────────────

  function onSpaceReleaseDetected() {
    releaseDetectTimer = null;
    dbg("onSpaceReleaseDetected", { voiceState, holdConfirmed, spaceConsumed });

    // Never confirmed hold → was a tap
    if (!holdConfirmed && voiceState === "idle") {
      resetHoldState();
      clearWarmupWidget();
      hideWidget();
      return;
    }

    // Released during warmup
    if (voiceState === "warmup") {
      resetHoldState();
      clearWarmupWidget();
      hideWidget();
      setVoiceState("idle");
      ctx?.ui.notify("Hold SPACE longer to activate voice.", "info");
      return;
    }

    // Released during recording
    if (spaceConsumed && voiceState === "recording") {
      const elapsed = Date.now() - recordingStartedAt;
      dbg("release during recording", { elapsed, RECORDING_GRACE_MS });
      if (elapsed < RECORDING_GRACE_MS) {
        dbg("  → too soon, re-arming (grace period)");
        resetReleaseDetect();
        return;
      }
      dbg("  → scheduling delayed stop (tail recording)");
      resetHoldState();
      scheduleDelayedStop();
    }
  }

  function resetReleaseDetect() {
    clearReleaseTimer();
    if (voiceState === "warmup" || voiceState === "recording" || spaceDownTime || spaceConsumed || holdConfirmed) {
      const timeout = (voiceState === "recording" || spaceConsumed)
        ? RELEASE_DETECT_RECORDING_MS
        : RELEASE_DETECT_MS;
      releaseDetectTimer = setTimeout(onSpaceReleaseDetected, timeout);
    }
  }

  // ─── Hold activation (shared between Kitty and non-Kitty) ─────────────

  function startHoldActivation(remaining: number) {
    holdActivationTimer = setTimeout(() => {
      holdActivationTimer = null;
      if (voiceState === "warmup") {
        spaceConsumed = true;
        recordingStartedAt = Date.now();
        clearReleaseTimer();
        dbg("holdActivationTimer → starting recording");
        startRecording().then(ok => {
          if (!ok) { resetHoldState(); setVoiceState("idle"); }
        }).catch(err => {
          dbg("startRecording THREW", String(err));
          resetHoldState({ cooldown: 5000 });
          setVoiceState("idle");
        });
      } else {
        spaceDownTime = null;
        spaceConsumed = false;
        spacePressCount = 0;
        holdConfirmed = false;
      }
    }, remaining);
  }

  // ─── Hold-to-Talk: terminal input handler ──────────────────────────────

  function setupHoldToTalk() {
    if (!ctx?.hasUI) return;
    if (terminalInputUnsub) { terminalInputUnsub(); terminalInputUnsub = null; }

    terminalInputUnsub = ctx.ui.onTerminalInput((data: string) => {
      if (!config.enabled) return undefined;

      // Track non-space keys for typing cooldown
      if (!matchesKey(data, "space") && !isKeyRelease(data) && !isKeyRepeat(data)) {
        if (data.length > 0 && data.charCodeAt(0) >= 32) {
          lastNonSpaceKeyTime = Date.now();
        }
      }

      // ── SPACE handling ──
      if (matchesKey(data, "space")) {
        // Error cooldown
        if (errorCooldownUntil > Date.now()) return undefined;

        // Typing cooldown (don't activate when typing normally)
        if (voiceState === "idle" && !spaceConsumed &&
          lastNonSpaceKeyTime > 0 && (Date.now() - lastNonSpaceKeyTime) < TYPING_COOLDOWN_MS) {
          return undefined;
        }

        dbg("SPACE", {
          isRelease: isKeyRelease(data), isRepeat: isKeyRepeat(data),
          voiceState, kittyReleaseDetected, holdConfirmed, spaceConsumed, spacePressCount,
        });

        // ── Kitty key-release ──
        if (isKeyRelease(data)) {
          kittyReleaseDetected = true;
          clearReleaseTimer();

          if (voiceState === "warmup") {
            const holdDuration = spaceDownTime ? Date.now() - spaceDownTime : 0;
            resetHoldState();
            clearWarmupWidget();
            hideWidget();
            setVoiceState("idle");
            if (holdDuration < 300) {
              if (ctx?.hasUI) ctx.ui.setEditorText((ctx.ui.getEditorText() || "") + " ");
            } else {
              ctx?.ui.notify("Hold SPACE longer to activate voice.", "info");
            }
            return { consume: true };
          }

          if (spaceDownTime && !holdConfirmed && voiceState === "idle") {
            resetHoldState();
            if (ctx?.hasUI) ctx.ui.setEditorText((ctx.ui.getEditorText() || "") + " ");
            return { consume: true };
          }

          if (spaceConsumed && voiceState === "recording") {
            resetHoldState();
            scheduleDelayedStop();
            return { consume: true };
          }

          spaceDownTime = null;
          spaceConsumed = false;
          spacePressCount = 0;
          holdConfirmed = false;
          return undefined;
        }

        // ── Kitty key-repeat ──
        if (isKeyRepeat(data)) {
          if (voiceState === "recording" || voiceState === "finalizing" || spaceConsumed) {
            return { consume: true };
          }
          if (voiceState === "warmup") return { consume: true };

          // During hold detection: count repeats
          if (spaceDownTime && !holdConfirmed) {
            const now = Date.now();
            spacePressCount++;
            lastSpacePressTime = now;

            if (spacePressCount >= REPEAT_CONFIRM_COUNT) {
              holdConfirmed = true;
              setVoiceState("warmup");
              showWarmupWidget();

              const alreadyElapsed = now - (spaceDownTime || now);
              const remaining = Math.max(0, HOLD_THRESHOLD_MS - alreadyElapsed);
              startHoldActivation(remaining);
            }

            resetReleaseDetect();
            return { consume: true };
          }
          return { consume: true };
        }

        // === Key PRESS ===

        if (voiceState === "finalizing") return { consume: true };

        // Re-press during recording → cancel tail stop, keep recording
        if (voiceState === "recording") {
          cancelDelayedStop();
          spaceConsumed = true;
          spaceDownTime = Date.now();
          holdConfirmed = true;
          if (!kittyReleaseDetected) {
            resetReleaseDetect();
          }
          return { consume: true };
        }

        if (voiceState === "warmup") {
          if (!kittyReleaseDetected) resetReleaseDetect();
          return { consume: true };
        }

        if (spaceConsumed) {
          if (!kittyReleaseDetected) resetReleaseDetect();
          return { consume: true };
        }

        // ── PATH A: Kitty protocol ──
        if (kittyReleaseDetected) {
          if (voiceState === "idle") {
            spaceDownTime = Date.now();
            spaceConsumed = false;
            spacePressCount = 1;
            lastSpacePressTime = Date.now();
            holdConfirmed = true;

            setVoiceState("warmup");
            showWarmupWidget();
            startHoldActivation(HOLD_THRESHOLD_MS);

            return { consume: true };
          }
          return { consume: true };
        }

        // ── PATH B: Non-Kitty ──
        if (spaceDownTime) {
          const now = Date.now();
          const gap = now - lastSpacePressTime;

          if (gap < REPEAT_CONFIRM_MS) {
            spacePressCount++;
            lastSpacePressTime = now;

            if (spacePressCount >= REPEAT_CONFIRM_COUNT && !holdConfirmed) {
              holdConfirmed = true;
              setVoiceState("warmup");
              showWarmupWidget();

              const alreadyElapsed = now - spaceDownTime;
              const remaining = Math.max(0, HOLD_THRESHOLD_MS - alreadyElapsed);
              startHoldActivation(remaining);
            }

            resetReleaseDetect();
            return { consume: true };
          } else {
            // Gap too large → previous hold abandoned
            const wasInWarmup = (voiceState as VoiceState) === "warmup";
            resetHoldState();
            clearWarmupWidget();
            hideWidget();
            if (wasInWarmup) setVoiceState("idle");
            // Fall through to new first press
          }
        }

        // First SPACE press (non-Kitty) — let it pass through
        if (voiceState === "idle") {
          spaceDownTime = Date.now();
          spaceConsumed = false;
          spacePressCount = 1;
          lastSpacePressTime = Date.now();
          holdConfirmed = false;
          resetReleaseDetect();
          return undefined;
        }

        if (spaceConsumed) return { consume: true };
        return undefined;
      }

      // ── Non-space key → cancel potential hold ──
      if (spaceDownTime && !holdConfirmed && voiceState === "idle") {
        resetHoldState();
        return undefined;
      }

      if (voiceState === "warmup" && holdConfirmed && !spaceConsumed) {
        clearWarmupWidget();
        hideWidget();
        resetHoldState();
        setVoiceState("idle");
        return undefined;
      }

      // ── Escape → cancel recording or double-tap clear ──
      if (matchesKey(data, "escape") && !isKeyRelease(data) && !isKeyRepeat(data)) {
        if (voiceState === "recording" || voiceState === "warmup" || voiceState === "finalizing") {
          dbg("Escape → canceling voice");
          killRecProcess();
          audioChunks = [];
          clearRecAnimTimer();
          clearWarmupWidget();
          hideWidget();
          if (statusTimer) { clearInterval(statusTimer); statusTimer = null; }
          if (ctx?.hasUI) ctx.ui.setEditorText(editorTextBeforeVoice);
          resetHoldState();
          playSound("error");
          setVoiceState("idle");
          lastEscapeTime = Date.now();
          return { consume: true };
        }

        // Double-escape clears editor
        if (voiceState === "idle") {
          const now = Date.now();
          if (lastEscapeTime > 0 && (now - lastEscapeTime) < 500) {
            if (ctx?.hasUI) {
              const txt = ctx.ui.getEditorText() || "";
              if (txt.trim()) {
                ctx.ui.setEditorText("");
                lastEscapeTime = 0;
                return { consume: true };
              }
            }
          }
          lastEscapeTime = now;
        }
      }

      return undefined;
    });
  }

  // ─── Shortcuts ─────────────────────────────────────────────────────────

  pi.registerShortcut("ctrl+shift+v", {
    description: "Toggle voice recording (start/stop)",
    handler: async (handlerCtx) => {
      ctx = handlerCtx;
      if (!config.enabled) {
        handlerCtx.ui.notify("Voice disabled. Use /voice on", "warning");
        return;
      }
      if (dictationMode) {
        dictationMode = false;
        if (voiceState === "recording") await stopRecording();
        handlerCtx.ui.notify("Dictation stopped.", "info");
        return;
      }
      if (voiceState === "idle") {
        spaceConsumed = true;
        const ok = await startRecording();
        if (!ok) spaceConsumed = false;
      } else if (voiceState === "recording") {
        resetHoldState();
        await stopRecording();
      } else if (voiceState === "warmup") {
        clearWarmupWidget();
        hideWidget();
        resetHoldState();
        setVoiceState("idle");
      }
    },
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  pi.on("session_start", async (_event, startCtx) => {
    ctx = startCtx;
    currentCwd = startCtx.cwd;
    const loaded = loadConfig(currentCwd);
    config = loaded.config;

    // Auto-detect: if OPENAI_API_KEY is set but no local setup, suggest OpenAI
    const hasOpenAIKey = !!resolveOpenAIKey(config);

    if (config.enabled && config.setupCompleted) {
      updateStatus();
      setupHoldToTalk();
    } else if (!config.setupCompleted && startCtx.hasUI) {
      const audioTool = detectAudioTool();
      const backendLabel = config.backend === "openai"
        ? "OpenAI Whisper API (cloud)"
        : `Local Whisper: ${config.whisperModel} (offline)`;

      if (hasOpenAIKey || config.backend === "whisper") {
        // Auto-activate
        config.setupCompleted = true;
        if (hasOpenAIKey && config.backend !== "whisper") {
          config.backend = "openai";
        }
        saveConfig(config, config.scope, currentCwd);
        updateStatus();
        setupHoldToTalk();

        startCtx.ui.notify([
          "pi-voice ready!",
          "",
          "  Hold SPACE to record → release to transcribe",
          "  Ctrl+Shift+V to toggle recording",
          `  Backend: ${backendLabel}`,
          `  Audio: ${audioTool ? audioTool.name : "NONE — install sox or ffmpeg"}`,
          "",
          "  /voice settings  — change backend/model/language",
          "  /voice test      — verify setup",
        ].join("\n"), audioTool ? "info" : "warning");
      } else {
        startCtx.ui.notify([
          "pi-voice installed — voice input for Pi",
          "",
          "  Two backends:",
          "  • Local Whisper — fully offline, auto-downloads model",
          "  • OpenAI API — cloud, needs OPENAI_API_KEY",
          "",
          `  Audio: ${audioTool ? `${audioTool.name} ✓` : "not found — install sox or ffmpeg"}`,
          "",
          "  Run /voice settings to configure.",
        ].join("\n"), "info");
      }
    }
  });

  pi.on("session_shutdown", async () => {
    voiceCleanup();
    clearRecognizerCache();
    ctx = null;
  });

  pi.on("session_switch", async (_event, switchCtx) => {
    voiceCleanup();
    clearRecognizerCache();
    ctx = switchCtx;
    currentCwd = switchCtx.cwd;
    const loaded = loadConfig(currentCwd);
    config = loaded.config;
    if (config.enabled && config.setupCompleted) setupHoldToTalk();
    updateStatus();
  });

  // ─── /voice command ────────────────────────────────────────────────────

  pi.registerCommand("voice", {
    description: "Voice: /voice [on|off|stop|dictate|test|settings|backend|model|language]",
    handler: async (args, cmdCtx) => {
      ctx = cmdCtx;
      const sub = (args || "").trim().toLowerCase();

      // ── /voice on ──
      if (sub === "on") {
        config.enabled = true;
        config.setupCompleted = true;
        saveConfig(config, config.scope, currentCwd);
        updateStatus();
        setupHoldToTalk();
        const backendInfo = config.backend === "openai"
          ? "Voice enabled (OpenAI Whisper API)."
          : `Voice enabled (local: ${config.whisperModel}).`;
        cmdCtx.ui.notify([
          backendInfo,
          "",
          "  Hold SPACE → release to transcribe",
          "  Ctrl+Shift+V → toggle recording",
          "  /voice settings → configure",
        ].join("\n"), "info");
        return;
      }

      // ── /voice off ──
      if (sub === "off") {
        config.enabled = false;
        saveConfig(config, config.scope, currentCwd);
        voiceCleanup();
        cmdCtx.ui.setStatus("voice", undefined);
        cmdCtx.ui.notify("Voice disabled.", "info");
        return;
      }

      // ── /voice stop ──
      if (sub === "stop") {
        if (dictationMode) {
          dictationMode = false;
          if (voiceState === "recording") await stopRecording();
          cmdCtx.ui.notify("Dictation stopped.", "info");
        } else if (voiceState === "recording") {
          await stopRecording();
        } else if (voiceState === "warmup") {
          clearWarmupWidget(); hideWidget(); resetHoldState(); setVoiceState("idle");
        } else {
          cmdCtx.ui.notify("No recording in progress.", "info");
        }
        return;
      }

      // ── /voice dictate ──
      if (sub === "dictate") {
        if (!config.enabled) {
          cmdCtx.ui.notify("Voice disabled. Use /voice on", "warning");
          return;
        }
        dictationMode = true;
        editorTextBeforeVoice = ctx?.hasUI ? (ctx.ui.getEditorText() || "") : "";
        const ok = await startRecording();
        if (ok) {
          cmdCtx.ui.notify([
            "🎤 Continuous dictation active.",
            "  /voice stop or Ctrl+Shift+V to finish.",
          ].join("\n"), "info");
        } else {
          dictationMode = false;
        }
        return;
      }

      // ── /voice backend ──
      if (sub === "backend") {
        const choice = await cmdCtx.ui.select("Choose transcription backend:", [
          "Local Whisper — offline, no API key, models auto-download",
          "OpenAI API — cloud, needs OPENAI_API_KEY",
        ]);
        if (!choice) return;
        config.backend = choice.includes("Local") ? "whisper" : "openai";

        if (config.backend === "openai" && !resolveOpenAIKey(config)) {
          cmdCtx.ui.notify([
            "OPENAI_API_KEY not set.",
            "",
            "  export OPENAI_API_KEY=\"sk-...\"",
            "  Add to ~/.zshrc or ~/.bashrc for persistence.",
          ].join("\n"), "warning");
        }

        config.setupCompleted = true;
        saveConfig(config, config.scope, currentCwd);
        setupHoldToTalk();
        updateStatus();
        cmdCtx.ui.notify(`Backend: ${config.backend === "openai" ? "OpenAI API" : "Local Whisper"}`, "info");
        return;
      }

      // ── /voice model ──
      if (sub === "model") {
        const items = WHISPER_MODELS.map(m => {
          const acc = "●".repeat(m.accuracy) + "○".repeat(5 - m.accuracy);
          const spd = "●".repeat(m.speed) + "○".repeat(5 - m.speed);
          const current = m.id === config.whisperModel ? " ✓" : "";
          return `${m.name} — ${m.size} [acc:${acc} spd:${spd}]${current}`;
        });
        const choice = await cmdCtx.ui.select("Choose Whisper model:", items);
        if (!choice) return;
        const idx = items.indexOf(choice);
        const model = WHISPER_MODELS[idx];
        if (model) {
          config.whisperModel = model.id;
          config.setupCompleted = true;
          saveConfig(config, config.scope, currentCwd);
          clearRecognizerCache();
          updateStatus();
          cmdCtx.ui.notify(`Model: ${model.name} (${model.size}). Downloads on first use.`, "info");
        }
        return;
      }

      // ── /voice language ──
      if (sub === "language" || sub === "lang" || sub.startsWith("language ") || sub.startsWith("lang ")) {
        const langs = [
          "English (en)", "Hindi (hi)", "Spanish (es)", "French (fr)",
          "German (de)", "Portuguese (pt)", "Japanese (ja)", "Korean (ko)",
          "Chinese (zh)", "Arabic (ar)", "Russian (ru)", "Italian (it)",
          "Dutch (nl)", "Turkish (tr)", "Polish (pl)", "Swedish (sv)",
          "Ukrainian (uk)", "Vietnamese (vi)", "Thai (th)", "Indonesian (id)",
        ];
        const choice = await cmdCtx.ui.select(`Current: ${config.language}. Choose language:`, langs);
        if (!choice) return;
        const match = choice.match(/\(([^)]+)\)$/);
        if (match) {
          config.language = match[1]!;
          saveConfig(config, config.scope, currentCwd);
          clearRecognizerCache();
          cmdCtx.ui.notify(`Language: ${choice}`, "info");
        }
        return;
      }

      // ── /voice settings ──
      if (sub === "settings" || sub === "config" || sub === "setup") {
        const lines = [
          "pi-voice settings:",
          "",
          `  Backend:  ${config.backend === "openai" ? "OpenAI API" : "Local Whisper"}`,
          `  Model:    ${config.whisperModel}`,
          `  Language: ${config.language}`,
          `  Enabled:  ${config.enabled}`,
          `  Scope:    ${config.scope}`,
          "",
          "Commands:",
          "  /voice backend   — switch between local/OpenAI",
          "  /voice model     — choose Whisper model",
          "  /voice language  — change language",
          "  /voice on/off    — enable/disable",
          "  /voice test      — run diagnostics",
          "  /voice dictate   — continuous recording (no hold)",
        ];

        // Show downloaded models
        const downloaded = getDownloadedModels();
        if (downloaded.length > 0) {
          lines.push("");
          lines.push("Downloaded models:");
          for (const m of downloaded) {
            const info = WHISPER_MODELS.find(w => w.id === m.id);
            const active = m.id === config.whisperModel ? " ✓ active" : "";
            lines.push(`  ${info?.name || m.id} — ${m.sizeMB} MB${active}`);
          }
        }

        cmdCtx.ui.notify(lines.join("\n"), "info");
        return;
      }

      // ── /voice test ──
      if (sub === "test") {
        const tool = detectAudioTool();
        const apiKey = resolveOpenAIKey(config);
        const lines = [
          "Voice diagnostics:",
          "",
          `  Backend:      ${config.backend}`,
          `  Audio tool:   ${tool ? `${tool.name} (${tool.cmd})` : "NONE FOUND"}`,
        ];

        if (config.backend === "openai") {
          lines.push(`  OPENAI_API_KEY: ${apiKey ? "set (" + apiKey.slice(0, 8) + "…)" : "NOT SET"}`);
          if (apiKey) {
            const check = await validateOpenAIKey(apiKey);
            lines.push(`  API check:    ${check.ok ? "OK ✓" : `FAILED — ${check.error}`}`);
          }
        } else {
          lines.push(`  Model:        ${config.whisperModel}`);
          if (!isSherpaAvailable()) {
            const ok = await initSherpa();
            lines.push(`  sherpa-onnx:  ${ok ? "OK ✓" : `FAILED — ${getSherpaError()}`}`);
          } else {
            lines.push("  sherpa-onnx:  OK ✓");
          }
        }

        lines.push(`  Language:     ${config.language}`);
        lines.push(`  State:        ${voiceState}`);
        lines.push(`  Kitty proto:  ${kittyReleaseDetected ? "detected" : "not detected"}`);

        if (!tool) {
          lines.push("", "  Install audio tool:");
          lines.push("    brew install sox       # macOS");
          lines.push("    apt install sox        # Linux");
        }

        const ready = !!tool && (config.backend === "whisper" || !!apiKey);
        if (ready) {
          lines.push("", "  All checks passed — voice ready!");
          lines.push("  Hold SPACE to record.");
        }

        cmdCtx.ui.notify(lines.join("\n"), ready ? "info" : "warning");
        return;
      }

      // ── /voice (toggle) ──
      config.enabled = !config.enabled;
      if (!config.enabled) voiceCleanup();
      else { config.setupCompleted = true; setupHoldToTalk(); }
      saveConfig(config, config.scope, currentCwd);
      updateStatus();
      cmdCtx.ui.notify(`Voice ${config.enabled ? "enabled" : "disabled"}.`, "info");
    },
  });
}
