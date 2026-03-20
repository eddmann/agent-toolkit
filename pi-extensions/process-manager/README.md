# process-manager — pi extension

Manage long-running background processes (dev servers, watchers, build pipelines, etc.) directly from within pi. Both **you** (via the `/processes` TUI) and the **agent** (via the `process_manager` tool) can start, stop, restart, and inspect logs for any process.

## Features

| Feature | Description |
|---------|-------------|
| **`/processes` TUI** | Full interactive panel — list, start/stop/restart, live log viewer |
| **`process_manager` tool** | LLM can manage processes autonomously |
| **Footer status** | `● 2  ✗ 1 procs` indicator while any processes are tracked |
| **System prompt injection** | Agent always sees current process status at the start of each turn |
| **Session persistence** | Process registry (names + commands) is saved and restored across pi restarts |
| **Graceful shutdown** | All running processes receive SIGTERM (→ SIGKILL after 5s) when pi exits |

## Installation

**Global (all projects):**
```bash
mkdir -p ~/.pi/agent/extensions/process-manager
cp /path/to/process-manager/index.ts ~/.pi/agent/extensions/process-manager/index.ts
# or symlink:
ln -s /path/to/process-manager ~/.pi/agent/extensions/process-manager
```

**Project-local:**
```bash
mkdir -p .pi/extensions
ln -s /path/to/process-manager .pi/extensions/process-manager
```

Then `/reload` in pi, or restart.

## Usage

### Agent tool: `process_manager`

The LLM can call `process_manager` with these actions:

| Action | Required params | Description |
|--------|----------------|-------------|
| `start` | `name`, `command` | Start a new process (or re-start a stopped/crashed one) |
| `stop` | `name` | Send SIGTERM (→ SIGKILL after 5s) |
| `restart` | `name` | Stop then start (optionally update `command`/`cwd`) |
| `list` | — | List all processes with status |
| `logs` | `name` | Return recent log output (`lines` param, default 50) |
| `status` | `name` | Detailed status: pid, uptime, exit code, log line count |
| `delete` | `name` | Remove a stopped/crashed process from the registry |

**Example prompts:**
- *"Start the dev server with `npm run dev`"*
- *"Restart the API server"*
- *"What does the dev server log say?"*
- *"Stop everything"*
- *"Is the dev server still running?"*

### `/processes` command

Opens an interactive TUI panel:

```
─── Process Manager ──────────────────────────────────────────────────────────

  NAME              STATUS          PID      UPTIME    COMMAND
  ──────────────────────────────────────────────────────────────────────────
▶ dev-server        ● running       84231    4m 12s    npm run dev
  api-server        ✗ crashed       —        —         node api.js
  db-watcher        ○ stopped       —        —         nodemon db/sync.js

  ↑↓ select   r start/restart   s stop   l logs   d delete   q/esc close
```

#### List view keys

| Key | Action |
|-----|--------|
| `↑` / `↓` (or `k`/`j`) | Navigate processes |
| `r` | Start or restart selected process |
| `s` | Stop selected process (SIGTERM) |
| `l` | Open live log viewer for selected process |
| `d` | Delete selected process (must be stopped first) |
| `q` / `Esc` | Close panel |

#### Log viewer

```
─── Logs: dev-server ● running ───────────────────────────────────────────────

  [14:23:01.123] > npm run dev  (cwd: /home/user/myapp, pid: 84231)
  [14:23:02.456]   VITE v5.0.0  ready in 312ms
  [14:23:02.789]   ➜  Local:   http://localhost:5173/
  ...

  lines 45–67 of 67  [following]

  ↑↓ scroll   f toggle follow   b/esc back   q close
```

| Key | Action |
|-----|--------|
| `↑` / `↓` (or `k`/`j`) | Scroll logs (disables follow) |
| `PgUp` / `PgDn` | Scroll a page at a time |
| `f` | Toggle auto-follow (tails new output) |
| `b` / `Esc` | Back to process list |
| `q` | Close panel entirely |

## Notes

- **Processes are module-scoped**: they keep running across session branches and `/tree` navigation. Process state is NOT branch-aware (it's infrastructure, not conversation history).
- **Log buffer**: last 2000 lines per process (oldest dropped). The agent can read up to 2000 via the `logs` action.
- **stderr** lines are prefixed with `[err]` and highlighted in the log viewer.
- On pi restart, all processes show as `stopped` (they were killed when the old pi instance exited).
