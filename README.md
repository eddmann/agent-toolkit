# Agent Toolkit

A collection of skills, extensions, and prompts that I use across different AI coding agent harnesses.

## Structure

### `skills/`

Reusable agent skills — self-contained prompt-based capabilities that can be plugged into compatible coding agents (e.g. Claude Code). Each skill lives in its own directory with a `SKILL.md` defining its behaviour.

### `third-party-skills/`

Third-party skills managed via `manifest.json`. Run `./third-party-skills/install.sh` to fetch them into `third-party-skills/installed/`. Each skill is pinned to a specific commit for reproducibility. The `installed/` directory is gitignored — only the manifest is tracked.

Current third-party skills:

| Skill | Source | Description |
|-------|--------|-------------|
| **frontend-design** | [anthropics/skills](https://github.com/anthropics/skills) | Production-grade frontend interfaces with high design quality |
| **react-best-practices** | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | React and Next.js performance optimization guidelines |
| **remotion** | [remotion-dev/skills](https://github.com/remotion-dev/skills) | Best practices for Remotion video creation in React |
| **web-design-guidelines** | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | Review UI code against Web Interface Guidelines |

### `pi-extensions/`

Extensions for the [Pi](https://github.com/mariozechner/pi-coding-agent) coding agent harness:

- **process-manager** — manage long-running background processes (dev servers, watchers, etc.) from within Pi
- **pi-voice** — hold-to-talk voice input using local or cloud Whisper
