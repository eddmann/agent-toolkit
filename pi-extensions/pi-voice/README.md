# pi-voice

**Hold-to-talk voice input for [Pi](https://github.com/mariozechner/pi-coding-agent).** Local Whisper (offline) or OpenAI Whisper API (cloud).

## Setup

```bash
# Install into Pi (from this directory)
pi -e ./extensions/voice.ts

# Or copy to global extensions
cp -r extensions/voice* ~/.pi/agent/extensions/
```

### Audio capture

pi-voice auto-detects your audio tool. Install one if you don't have it:

| Tool | Install |
|------|---------|
| **SoX** (recommended) | `brew install sox` / `apt install sox` |
| **ffmpeg** | `brew install ffmpeg` / `apt install ffmpeg` |
| **arecord** | Pre-installed on Linux (ALSA) |

### Choose backend

**Local Whisper (default)** — fully offline, no API key. Model auto-downloads on first use (~375 MB for whisper-small).

**OpenAI API** — cloud, needs `OPENAI_API_KEY`. Faster, higher accuracy.

```bash
export OPENAI_API_KEY="sk-..."   # add to ~/.zshrc
```

Run `/voice backend` inside Pi to switch.

## Usage

### Recording

| Action | Key | Notes |
|--------|-----|-------|
| **Record** | Hold `SPACE` ≥1.2s | Release to transcribe |
| **Toggle** | `Ctrl+Shift+V` | Press to start, press to stop |
| **Cancel** | `Escape` | During recording, restores editor |
| **Clear** | `Escape` × 2 | Double-tap to clear editor |

### How it works

```
Hold SPACE → warmup countdown (1.2s)
               ↓ audio capture starts immediately
Recording → waveform widget + audio level meter
               ↓
Release SPACE → 1.5s tail recording (catches last words)
               ↓
Finalizing → audio sent to backend (local Whisper or OpenAI)
               ↓
Transcript inserted into editor
```

### Terminal compatibility

**Kitty protocol** (Ghostty Linux, Kitty, WezTerm): True key release events. SPACE press → warmup immediately. Release cancels if < 300ms (types a space).

**Non-Kitty** (macOS Terminal, Ghostty macOS): No release events. Detects holding via rapid key-repeat counting (6 presses). Gap > 250ms during recording = released.

### Commands

| Command | Description |
|---------|-------------|
| `/voice` | Toggle on/off |
| `/voice on` / `off` | Enable/disable |
| `/voice backend` | Switch local/OpenAI |
| `/voice model` | Choose Whisper model |
| `/voice language` | Change language |
| `/voice settings` | Show current config |
| `/voice test` | Full diagnostics |
| `/voice dictate` | Continuous mode (no hold) |
| `/voice stop` | Stop active recording |

## Models

| Model | Size | Accuracy | Speed | Notes |
|-------|------|----------|-------|-------|
| **Whisper Small** | ~375 MB | ●●●○○ | ●●●●○ | Default. Good balance. |
| **Whisper Tiny** | ~77 MB | ●○○○○ | ●●●●● | Fastest, lowest quality. |
| **Whisper Medium** | ~946 MB | ●●●●○ | ●●●○○ | Better accuracy. |
| **Whisper Turbo** | ~1.0 GB | ●●●●○ | ●●○○○ | Good accuracy, fast. |
| **Whisper Large v3** | ~1.8 GB | ●●●●○ | ●○○○○ | Best accuracy, slow on CPU. |

All models support 57 languages. Models auto-download on first use to `~/.pi/models/`.

## Architecture

```
extensions/voice.ts              Main extension — state machine, hold-to-talk, UI
extensions/voice/config.ts       Config loading/saving, types
extensions/voice/audio.ts        Audio capture (sox/ffmpeg/arecord), WAV encoding, level meter
extensions/voice/openai-backend.ts  OpenAI Whisper API transcription
extensions/voice/whisper-backend.ts Local Whisper via sherpa-onnx (in-process)
extensions/voice/model-download.ts  Model download manager (resume, progress, dedup)
```

## Config

Stored in `~/.pi/agent/settings.json` under `voice`:

```json
{
  "voice": {
    "enabled": true,
    "backend": "whisper",
    "whisperModel": "whisper-small",
    "language": "en",
    "scope": "global",
    "setupCompleted": true
  }
}
```
