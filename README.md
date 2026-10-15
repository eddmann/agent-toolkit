# Agent Toolkit

A collection of skills, extensions, and prompts that I use across different AI coding agent harnesses.

## Installation

**Claude Code:** Run `./claude-code-install.sh` to fetch third-party skills and symlink everything into `~/.claude/skills/`. Safe to re-run — only touches skills it manages.

**Codex:** Run `./codex-install.sh` to fetch third-party skills and symlink everything into `$CODEX_HOME/skills/` (defaults to `~/.codex/skills/`). Safe to re-run — only touches skills it manages and preserves Codex's built-in `.system` skills.

**Other harnesses:** Run `./third-party-skills/install.sh` to fetch third-party skills into `third-party-skills/installed/`, then point your harness at `skills/` and `third-party-skills/installed/` directly.

## Structure

### `skills/`

Reusable agent skills — self-contained prompt-based capabilities that can be plugged into compatible coding agents (e.g. Claude Code). Each skill lives in its own directory with a `SKILL.md` defining its behaviour.

**[review-loop](skills/review-loop/SKILL.md)** gets an independent review from Claude Code
while working in Codex, or from Codex while working in Claude Code. It reuses the toolkit's
shared review guidelines, supports assessment-only and authorized review-fix-review work,
and stops after three external review attempts by default. The host coordinates fixes and
tests; a Python runner handles read-only CLI calls, structured findings, round history and
checks that the reviewed code has not changed.

For example, ask: `Review-loop our changes with Claude Opus at high effort. Fix confirmed
issues and repeat up to three rounds.` Or use `reviewer=codex model=<model-id> effort=high
rounds=3` with a branch/PR target and `report findings only`. Per-run options override saved
review preferences, then the external CLI's defaults; they do not change the host's model.

Requires Python 3.10+, Git, and the selected reviewer CLI installed and authenticated where
the skill runs. You can stay in your desktop app or IDE; the second GUI is not used.
Both installers above discover the new skill automatically. See the
[protocol](skills/review-loop/references/review-protocol.md) for saved preferences, runner
commands, boundaries and tests.

### `third-party-skills/`

Third-party skills managed via `manifest.json`. Each skill is pinned to a specific commit for reproducibility. The `installed/` directory is gitignored — only the manifest is tracked.

Current third-party skills:

| Skill | Source | Description |
|-------|--------|-------------|
| **composition-patterns** | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | React composition patterns — compound components, scalable APIs |
| **react-best-practices** | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | React and Next.js performance optimization guidelines |
| **remotion** | [remotion-dev/skills](https://github.com/remotion-dev/skills) | Best practices for Remotion video creation in React |
| **web-design-guidelines** | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | Review UI code against Web Interface Guidelines |

### `pi-extensions/`

Extensions for the [Pi](https://github.com/mariozechner/pi-coding-agent) coding agent harness:

- **process-manager** — manage long-running background processes (dev servers, watchers, etc.) from within Pi
- **pi-voice** — hold-to-talk voice input using local or cloud Whisper
