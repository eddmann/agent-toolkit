# Agent Toolkit

A collection of skills, extensions, and prompts that I use across different AI coding agent harnesses.

## Structure

### `skills/`

Reusable agent skills — self-contained prompt-based capabilities that can be plugged into compatible coding agents (e.g. Claude Code). Each skill lives in its own directory with a `SKILL.md` defining its behaviour.

### `pi-extensions/`

Extensions for the [Pi](https://github.com/mariozechner/pi-coding-agent) coding agent harness:

- **process-manager** — manage long-running background processes (dev servers, watchers, etc.) from within Pi
- **pi-voice** — hold-to-talk voice input using local or cloud Whisper
