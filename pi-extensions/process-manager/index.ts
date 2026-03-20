/**
 * Process Manager Extension for pi
 *
 * Manages long-running background processes (dev servers, watchers, build pipelines, etc.)
 * directly from within pi. Both the user (via /processes TUI) and the agent (via the
 * process_manager tool) can start, stop, restart, and inspect logs for any process.
 *
 * Features:
 *   - LLM tool: process_manager (start/stop/restart/list/logs/status/delete)
 *   - /processes command: interactive TUI for managing processes
 *   - Footer status indicator: shows running/crashed process count
 *   - System prompt injection: agent always knows which processes are active
 *   - Session persistence: process registry survives session navigation
 *   - Graceful shutdown: all processes receive SIGTERM on pi exit
 *
 * Installation:
 *   cp -r . ~/.pi/agent/extensions/process-manager
 *   # or symlink:
 *   ln -s $(pwd) ~/.pi/agent/extensions/process-manager
 */

import { spawn, type ChildProcess } from "node:child_process";
import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { matchesKey, Text, truncateToWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum log lines buffered per process (oldest lines are dropped) */
const LOG_BUFFER_LINES = 2000;

/** Visible log lines in the TUI log view (fixed height) */
const LOG_VIEW_HEIGHT = 22;

/** ms to wait for SIGTERM before sending SIGKILL */
const STOP_TIMEOUT_MS = 5000;

// ── Types ──────────────────────────────────────────────────────────────────────

type ProcessStatus = "stopped" | "running" | "crashed";

interface ProcessConfig {
	name: string;
	command: string;
	cwd?: string;
}

interface ProcessEntry {
	config: ProcessConfig;
	pid?: number;
	status: ProcessStatus;
	logs: string[];
	startedAt?: number;
	stoppedAt?: number;
	exitCode?: number | null;
	child?: ChildProcess;
	/** Set by the TUI log viewer to get live re-renders */
	onNewLog?: () => void;
}

interface PersistedState {
	processes: ProcessConfig[];
}

// ── Tool parameter schema ──────────────────────────────────────────────────────

const ProcParams = Type.Object({
	action: StringEnum(["start", "stop", "restart", "list", "logs", "status", "delete"] as const),
	name: Type.Optional(
		Type.String({
			description: "Process name identifier (required for all actions except list)",
		}),
	),
	command: Type.Optional(
		Type.String({
			description: "Shell command to run (required for start if process is new)",
		}),
	),
	cwd: Type.Optional(
		Type.String({
			description: "Working directory override (optional for start/restart; defaults to session cwd)",
		}),
	),
	lines: Type.Optional(
		Type.Number({
			description: "Number of log lines to return for the 'logs' action (default: 50)",
		}),
	),
});

// ── Extension ──────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	/** In-memory process registry. Survives session navigation; resets on pi restart. */
	const registry = new Map<string, ProcessEntry>();

	/** Stored UI reference for updating footer status from async process callbacks */
	type UIRef = {
		setStatus: (id: string, text: string) => void;
		notify: (message: string, type: "info" | "success" | "warning" | "error") => void;
		theme: ExtensionContext["ui"]["theme"];
	};
	let ui: UIRef | null = null;

	// ── Helpers ──────────────────────────────────────────────────────────────────

	function formatUptime(startedAt: number): string {
		const s = Math.floor((Date.now() - startedAt) / 1000);
		if (s < 60) return `${s}s`;
		if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
		return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
	}

	function addLog(entry: ProcessEntry, line: string) {
		const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
		entry.logs.push(`[${ts}] ${line}`);
		if (entry.logs.length > LOG_BUFFER_LINES) entry.logs.shift();
		entry.onNewLog?.();
	}

	function refreshFooter() {
		if (!ui) return;
		const entries = [...registry.values()];
		if (entries.length === 0) {
			ui.setStatus("proc-mgr", "");
			return;
		}
		const running = entries.filter((e) => e.status === "running").length;
		const crashed = entries.filter((e) => e.status === "crashed").length;
		const th = ui.theme;
		let status = "";
		if (running > 0) status += th.fg("success", `● ${running}`);
		if (crashed > 0) status += (status ? " " : "") + th.fg("error", `✗ ${crashed}`);
		if (!status) status = th.fg("dim", `○ ${entries.length}`);
		ui.setStatus("proc-mgr", status + th.fg("dim", " procs"));
	}

	// ── Process lifecycle ─────────────────────────────────────────────────────────

	function spawnProcess(entry: ProcessEntry, sessionCwd: string): void {
		const { config } = entry;
		const cwd = config.cwd || sessionCwd;

		const child = spawn("sh", ["-c", config.command], {
			cwd,
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		entry.child = child;
		entry.pid = child.pid;
		entry.status = "running";
		entry.startedAt = Date.now();
		entry.stoppedAt = undefined;
		entry.exitCode = undefined;
		entry.logs = [];

		addLog(entry, `> ${config.command}  (cwd: ${cwd}, pid: ${child.pid})`);

		child.stdout?.setEncoding("utf-8");
		child.stderr?.setEncoding("utf-8");

		let stdoutBuf = "";
		child.stdout?.on("data", (chunk: string) => {
			stdoutBuf += chunk;
			const lines = stdoutBuf.split("\n");
			stdoutBuf = lines.pop() ?? "";
			for (const l of lines) if (l) addLog(entry, l);
		});

		let stderrBuf = "";
		child.stderr?.on("data", (chunk: string) => {
			stderrBuf += chunk;
			const lines = stderrBuf.split("\n");
			stderrBuf = lines.pop() ?? "";
			for (const l of lines) if (l) addLog(entry, `[err] ${l}`);
		});

		child.on("exit", (code, signal) => {
			// Flush buffered partial lines
			if (stdoutBuf) {
				addLog(entry, stdoutBuf);
				stdoutBuf = "";
			}
			if (stderrBuf) {
				addLog(entry, `[err] ${stderrBuf}`);
				stderrBuf = "";
			}
			entry.status = code === 0 ? "stopped" : "crashed";
			entry.pid = undefined;
			entry.stoppedAt = Date.now();
			entry.exitCode = code;
			entry.child = undefined;
			addLog(entry, `Process exited — code: ${code ?? "?"}, signal: ${signal ?? "none"}`);
			refreshFooter();
		});

		refreshFooter();
	}

	async function terminateProcess(entry: ProcessEntry): Promise<void> {
		if (!entry.child || entry.status !== "running") return;
		const child = entry.child;
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				addLog(entry, "SIGTERM timeout — sending SIGKILL");
				child.kill("SIGKILL");
				resolve();
			}, STOP_TIMEOUT_MS);
			child.once("exit", () => {
				clearTimeout(timer);
				resolve();
			});
			addLog(entry, "Sent SIGTERM...");
			child.kill("SIGTERM");
		});
	}

	// ── Session persistence ───────────────────────────────────────────────────────

	function persistConfigs() {
		const processes: ProcessConfig[] = [...registry.values()].map((e) => e.config);
		pi.appendEntry<PersistedState>("proc-manager", { processes });
	}

	function restoreFromSession(ctx: ExtensionContext) {
		// Only restore if the registry is empty (i.e. fresh pi start, not a tree navigation)
		if (registry.size > 0) return;
		let lastState: PersistedState | null = null;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === "proc-manager") {
				lastState = entry.data as PersistedState;
			}
		}
		if (!lastState) return;
		for (const config of lastState.processes) {
			if (!registry.has(config.name)) {
				registry.set(config.name, { config, status: "stopped", logs: [] });
			}
		}
	}

	// ── Session events ────────────────────────────────────────────────────────────

	pi.on("session_start", async (_event, ctx) => {
		ui = ctx.ui;
		restoreFromSession(ctx);
		refreshFooter();
	});

	pi.on("session_switch", async (_event, ctx) => {
		ui = ctx.ui;
		refreshFooter();
	});

	pi.on("session_fork", async (_event, ctx) => {
		ui = ctx.ui;
	});

	pi.on("session_tree", async (_event, ctx) => {
		ui = ctx.ui;
	});

	pi.on("session_shutdown", async (_event, _ctx) => {
		// Clear live-log callbacks before stopping processes (avoids TUI-after-destroy calls)
		for (const entry of registry.values()) entry.onNewLog = undefined;
		const stops = [...registry.values()]
			.filter((e) => e.status === "running")
			.map((e) => terminateProcess(e));
		await Promise.all(stops);
	});

	// ── Inject current process status into system prompt each turn ────────────────

	pi.on("before_agent_start", async (event, _ctx) => {
		if (registry.size === 0) return;
		const lines: string[] = ["Currently registered background processes:"];
		for (const entry of registry.values()) {
			const { config, status, pid, startedAt, exitCode } = entry;
			const icon = status === "running" ? "●" : status === "crashed" ? "✗" : "○";
			let line = `  ${icon} ${config.name} [${status}]: ${config.command}`;
			if (config.cwd) line += ` (cwd: ${config.cwd})`;
			if (status === "running" && startedAt && pid)
				line += `  — pid ${pid}, uptime ${formatUptime(startedAt)}`;
			else if (status === "crashed" && exitCode !== undefined) line += `  — exit code ${exitCode}`;
			lines.push(line);
		}
		return { systemPrompt: event.systemPrompt + "\n\n" + lines.join("\n") };
	});

	// ── Tool ──────────────────────────────────────────────────────────────────────

	pi.registerTool({
		name: "process_manager",
		label: "Process Manager",
		description: `Manage long-running background processes (dev servers, watchers, etc.).

Actions:
  start   — start a named process (requires: name, command; optional: cwd)
  stop    — gracefully stop a running process (SIGTERM → SIGKILL after 5s)
  restart — stop then re-start a process (can update command/cwd)
  list    — list all registered processes with status
  logs    — return recent log output (optional: lines, default 50)
  status  — detailed status for one process
  delete  — remove a stopped/crashed process from the registry`,
		promptSnippet: "Start, stop, restart, list or inspect logs of background processes",
		parameters: ProcParams,

		async execute(_id, params, _signal, _onUpdate, ctx) {
			const { action, name, command, cwd, lines: lineCount = 50 } = params;

			switch (action) {
				// ── list ──────────────────────────────────────────────────────────────
				case "list": {
					if (registry.size === 0) {
						return {
							content: [{ type: "text", text: "No processes registered. Use the start action to add one." }],
							details: { action, processes: [] },
						};
					}
					const rows = [...registry.values()].map((e) => {
						const { config: c, status, pid, startedAt, exitCode } = e;
						const icon = status === "running" ? "●" : status === "crashed" ? "✗" : "○";
						let row = `${icon} ${c.name} [${status}]: ${c.command}`;
						if (c.cwd) row += ` (cwd: ${c.cwd})`;
						if (status === "running" && startedAt) row += `  — uptime ${formatUptime(startedAt)}, pid ${pid}`;
						if (status === "crashed") row += `  — exit code ${exitCode ?? "?"}`;
						return row;
					});
					return {
						content: [{ type: "text", text: rows.join("\n") }],
						details: { action, count: rows.length, processes: rows },
					};
				}

				// ── start ─────────────────────────────────────────────────────────────
				case "start": {
					if (!name) throw new Error("'name' is required for start");

					let entry = registry.get(name);

					if (entry?.status === "running") {
						return {
							content: [{ type: "text", text: `'${name}' is already running (pid: ${entry.pid})` }],
							details: { action, name, status: "running", pid: entry.pid },
						};
					}

					if (!entry) {
						if (!command) throw new Error("'command' is required when starting a new process");
						entry = { config: { name, command, cwd }, status: "stopped", logs: [] };
						registry.set(name, entry);
					} else {
						if (command) entry.config.command = command;
						if (cwd !== undefined) entry.config.cwd = cwd;
					}

					spawnProcess(entry, ctx.cwd);
					persistConfigs();

					return {
						content: [{ type: "text", text: `Started '${name}' — pid: ${entry.pid}\n> ${entry.config.command}` }],
						details: { action, name, pid: entry.pid, status: "running" },
					};
				}

				// ── stop ──────────────────────────────────────────────────────────────
				case "stop": {
					if (!name) throw new Error("'name' is required for stop");
					const entry = registry.get(name);
					if (!entry) throw new Error(`Unknown process: '${name}'`);
					if (entry.status !== "running") {
						return {
							content: [{ type: "text", text: `'${name}' is not running (status: ${entry.status})` }],
							details: { action, name, status: entry.status },
						};
					}
					await terminateProcess(entry);
					return {
						content: [{ type: "text", text: `Stopped '${name}' (exit code: ${entry.exitCode ?? "?"})` }],
						details: { action, name, status: entry.status, exitCode: entry.exitCode },
					};
				}

				// ── restart ───────────────────────────────────────────────────────────
				case "restart": {
					if (!name) throw new Error("'name' is required for restart");
					let entry = registry.get(name);
					if (!entry) {
						if (!command) throw new Error(`Unknown process '${name}'. Provide 'command' to create it.`);
						entry = { config: { name, command, cwd }, status: "stopped", logs: [] };
						registry.set(name, entry);
					} else {
						if (command) entry.config.command = command;
						if (cwd !== undefined) entry.config.cwd = cwd;
					}
					if (entry.status === "running") await terminateProcess(entry);
					spawnProcess(entry, ctx.cwd);
					persistConfigs();
					return {
						content: [{ type: "text", text: `Restarted '${name}' — pid: ${entry.pid}` }],
						details: { action, name, pid: entry.pid, status: "running" },
					};
				}

				// ── logs ──────────────────────────────────────────────────────────────
				case "logs": {
					if (!name) throw new Error("'name' is required for logs");
					const entry = registry.get(name);
					if (!entry) throw new Error(`Unknown process: '${name}'`);

					const tail = Math.min(Math.max(1, lineCount), LOG_BUFFER_LINES);
					const slice = entry.logs.slice(-tail);
					const total = entry.logs.length;

					let text = slice.join("\n") || "(no logs yet)";
					if (total > tail) text = `[Last ${tail} of ${total} lines]\n\n${text}`;

					return {
						content: [{ type: "text", text }],
						details: { action, name, status: entry.status, shownLines: slice.length, totalLines: total },
					};
				}

				// ── status ────────────────────────────────────────────────────────────
				case "status": {
					if (!name) throw new Error("'name' is required for status");
					const entry = registry.get(name);
					if (!entry) throw new Error(`Unknown process: '${name}'`);

					const { config: c, status, pid, startedAt, stoppedAt, exitCode } = entry;
					const info = [
						`name:    ${c.name}`,
						`status:  ${status}`,
						`command: ${c.command}`,
					];
					if (c.cwd) info.push(`cwd:     ${c.cwd}`);
					if (pid) info.push(`pid:     ${pid}`);
					if (startedAt)
						info.push(`started: ${new Date(startedAt).toLocaleTimeString()}  (${formatUptime(startedAt)} ago)`);
					if (stoppedAt) info.push(`stopped: ${new Date(stoppedAt).toLocaleTimeString()}`);
					if (exitCode !== undefined && exitCode !== null) info.push(`exit:    ${exitCode}`);
					info.push(`logs:    ${entry.logs.length} lines buffered`);

					return {
						content: [{ type: "text", text: info.join("\n") }],
						details: { action, name, status, pid, startedAt, exitCode },
					};
				}

				// ── delete ────────────────────────────────────────────────────────────
				case "delete": {
					if (!name) throw new Error("'name' is required for delete");
					const entry = registry.get(name);
					if (!entry) throw new Error(`Unknown process: '${name}'`);
					if (entry.status === "running")
						throw new Error(`Stop '${name}' before deleting it.`);
					registry.delete(name);
					persistConfigs();
					refreshFooter();
					return {
						content: [{ type: "text", text: `Deleted '${name}' from the registry` }],
						details: { action, name },
					};
				}

				default:
					throw new Error(`Unknown action: ${action}`);
			}
		},

		renderCall(args, theme) {
			const colors: Record<string, string> = {
				start: "success",
				stop: "error",
				restart: "warning",
				list: "accent",
				logs: "muted",
				status: "dim",
				delete: "error",
			};
			let text = theme.fg("toolTitle", theme.bold("process_manager "));
			text += theme.fg((colors[args.action] ?? "muted") as never, args.action);
			if (args.name) text += " " + theme.fg("accent", args.name);
			if (args.command) text += " " + theme.fg("dim", `"${args.command}"`);
			if (args.cwd) text += " " + theme.fg("muted", `in ${args.cwd}`);
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as Record<string, unknown> | undefined;
			const firstContent = result.content[0];
			const rawText = firstContent?.type === "text" ? firstContent.text : "";

			if (!details) return new Text(rawText, 0, 0);

			const action = details.action as string;
			const status = details.status as ProcessStatus | undefined;

			const statusColor = (s: ProcessStatus | undefined) =>
				s === "running" ? "success" : s === "crashed" ? "error" : ("muted" as never);

			if (action === "list") {
				const procs = details.processes as string[];
				if (!procs?.length) return new Text(theme.fg("dim", "No processes"), 0, 0);
				if (!expanded) return new Text(theme.fg("muted", `${procs.length} process(es) listed`), 0, 0);
				return new Text(procs.join("\n"), 0, 0);
			}

			if (action === "logs") {
				if (!expanded) {
					const shown = details.shownLines as number;
					const total = details.totalLines as number;
					return new Text(theme.fg("muted", `${shown}/${total} log lines — ${details.name}`), 0, 0);
				}
				return new Text(rawText, 0, 0);
			}

			// Generic: show first line coloured by status
			const summary = rawText.split("\n")[0] ?? "";
			return new Text(theme.fg(statusColor(status), summary), 0, 0);
		},
	});

	// ── /processes TUI command ────────────────────────────────────────────────────

	pi.registerCommand("processes", {
		description: "Open the interactive process manager (start/stop/restart/view logs)",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				// Fallback for print/RPC mode
				if (registry.size === 0) {
					ctx.ui.notify("No processes registered", "info");
					return;
				}
				for (const entry of registry.values()) {
					const icon = entry.status === "running" ? "●" : entry.status === "crashed" ? "✗" : "○";
					ctx.ui.notify(`${icon} ${entry.config.name}: ${entry.status}  — ${entry.config.command}`, "info");
				}
				return;
			}

			const sessionCwd = ctx.cwd;

			await ctx.ui.custom<void>((tui, theme, _kb, done) => {
				let view: "list" | "logs" = "list";
				let selectedIdx = 0;
				let logTarget: string | null = null;
				let logScrollOffset = 0;
				let followLog = true;

				// ── Helpers ────────────────────────────────────────────────────────────

				function entries(): ProcessEntry[] {
					return [...registry.values()];
				}

				function statusColor(s: ProcessStatus): "success" | "error" | "muted" {
					return s === "running" ? "success" : s === "crashed" ? "error" : "muted";
				}

				function statusIcon(s: ProcessStatus): string {
					return s === "running" ? "●" : s === "crashed" ? "✗" : "○";
				}

				function openLogs(name: string) {
					logTarget = name;
					const entry = registry.get(name);
					followLog = true;
					logScrollOffset = Math.max(0, (entry?.logs.length ?? 0) - LOG_VIEW_HEIGHT);
					view = "logs";
					if (entry) {
						entry.onNewLog = () => {
							if (followLog) {
								logScrollOffset = Math.max(0, entry.logs.length - LOG_VIEW_HEIGHT);
							}
							tui.requestRender();
						};
					}
				}

				function closeLogsView() {
					if (logTarget) {
						const entry = registry.get(logTarget);
						if (entry) entry.onNewLog = undefined;
					}
					logTarget = null;
					view = "list";
				}

				// ── Renderer ───────────────────────────────────────────────────────────

				function renderListView(width: number): string[] {
					const th = theme;
					const lines: string[] = [];
					const titleText = " Process Manager ";
					const borderRight = Math.max(0, width - titleText.length - 4);
					lines.push("");
					lines.push(
						truncateToWidth(
							th.fg("borderMuted", "───") + th.fg("accent", titleText) + th.fg("borderMuted", "─".repeat(borderRight)),
							width,
						),
					);
					lines.push("");

					const all = entries();

					if (all.length === 0) {
						lines.push(truncateToWidth("  " + th.fg("dim", "No processes registered."), width));
						lines.push(
							truncateToWidth(
								"  " + th.fg("dim", 'Ask the agent: "start the dev server"'),
								width,
							),
						);
					} else {
						// Compute column widths dynamically
						const maxNameLen = Math.max(8, ...all.map((e) => e.config.name.length));
						const nameW = Math.min(maxNameLen, 20) + 2;
						const statusW = 14;
						const pidW = 8;
						const uptimeW = 10;

						// Header
						lines.push(
							truncateToWidth(
								"  " +
									th.fg("dim", "NAME".padEnd(nameW)) +
									th.fg("dim", "STATUS".padEnd(statusW)) +
									th.fg("dim", "PID".padEnd(pidW)) +
									th.fg("dim", "UPTIME".padEnd(uptimeW)) +
									th.fg("dim", "COMMAND"),
								width,
							),
						);
						lines.push(truncateToWidth("  " + th.fg("borderMuted", "─".repeat(width - 4)), width));

						all.forEach((entry, i) => {
							const isSelected = i === selectedIdx;
							const { config: c, status, pid, startedAt } = entry;
							const prefix = isSelected ? th.fg("accent", "▶ ") : "  ";
							const nameStr = isSelected
								? th.fg("accent", c.name.padEnd(nameW))
								: th.fg("text", c.name.padEnd(nameW));
							const statusStr = th.fg(statusColor(status), (statusIcon(status) + " " + status).padEnd(statusW));
							const pidStr = th.fg("dim", (pid?.toString() ?? "—").padEnd(pidW));
							const uptime = status === "running" && startedAt ? formatUptime(startedAt) : "—";
							const uptimeStr = th.fg("dim", uptime.padEnd(uptimeW));
							const cmdStr = th.fg("muted", c.command + (c.cwd ? ` (${c.cwd})` : ""));
							lines.push(truncateToWidth(prefix + nameStr + statusStr + pidStr + uptimeStr + cmdStr, width));
						});
					}

					lines.push("");
					const hints = [
						th.fg("dim", "↑↓") + " " + th.fg("muted", "select"),
						th.fg("dim", "r") + " " + th.fg("muted", "start/restart"),
						th.fg("dim", "s") + " " + th.fg("muted", "stop"),
						th.fg("dim", "l") + " " + th.fg("muted", "logs"),
						th.fg("dim", "d") + " " + th.fg("muted", "delete"),
						th.fg("dim", "q/esc") + " " + th.fg("muted", "close"),
					];
					lines.push(truncateToWidth("  " + hints.join("   "), width));
					lines.push("");
					return lines;
				}

				function renderLogView(width: number): string[] {
					const th = theme;
					const entry = logTarget ? registry.get(logTarget) : null;
					const lines: string[] = [];

					const statusPart = entry ? ` ${statusIcon(entry.status)} ${entry.status}` : "";
					const titleText = ` Logs: ${logTarget}${statusPart} `;
					const borderRight = Math.max(0, width - titleText.length - 4);
					lines.push("");
					lines.push(
						truncateToWidth(
							th.fg("borderMuted", "───") + th.fg("accent", titleText) + th.fg("borderMuted", "─".repeat(borderRight)),
							width,
						),
					);
					lines.push("");

					if (!entry) {
						lines.push(truncateToWidth("  " + th.fg("error", "Process not found"), width));
					} else {
						const logLines = entry.logs;
						const total = logLines.length;
						const start = followLog
							? Math.max(0, total - LOG_VIEW_HEIGHT)
							: Math.max(0, Math.min(logScrollOffset, Math.max(0, total - LOG_VIEW_HEIGHT)));

						const visible = logLines.slice(start, start + LOG_VIEW_HEIGHT);

						if (visible.length === 0) {
							lines.push(truncateToWidth("  " + th.fg("dim", "(no logs yet)"), width));
						} else {
							for (const logLine of visible) {
								const isErr = logLine.includes("[err]");
								const colored = isErr ? th.fg("warning", logLine) : th.fg("muted", logLine);
								lines.push(truncateToWidth("  " + colored, width));
							}
						}

						if (total > LOG_VIEW_HEIGHT) {
							const end = Math.min(start + LOG_VIEW_HEIGHT, total);
							const scrollInfo = `  lines ${start + 1}–${end} of ${total}`;
							const followInfo = followLog ? " " + th.fg("success", "[following]") : " " + th.fg("dim", "[paused]");
							lines.push("");
							lines.push(truncateToWidth(th.fg("dim", scrollInfo) + followInfo, width));
						}
					}

					lines.push("");
					const hints = [
						th.fg("dim", "↑↓") + " " + th.fg("muted", "scroll"),
						th.fg("dim", "f") + " " + th.fg("muted", "toggle follow"),
						th.fg("dim", "b/esc") + " " + th.fg("muted", "back"),
						th.fg("dim", "q") + " " + th.fg("muted", "close"),
					];
					lines.push(truncateToWidth("  " + hints.join("   "), width));
					lines.push("");
					return lines;
				}

				// ── Input handler ──────────────────────────────────────────────────────

				function handleListInput(data: string) {
					const all = entries();

					if (matchesKey(data, "escape") || matchesKey(data, "q") || matchesKey(data, "ctrl+c")) {
						done();
						return;
					}
					if (matchesKey(data, "up") || matchesKey(data, "k")) {
						selectedIdx = Math.max(0, selectedIdx - 1);
						tui.requestRender();
						return;
					}
					if (matchesKey(data, "down") || matchesKey(data, "j")) {
						selectedIdx = Math.min(Math.max(0, all.length - 1), selectedIdx + 1);
						tui.requestRender();
						return;
					}

					const selected = all[selectedIdx];
					if (!selected) return;

					if (matchesKey(data, "l")) {
						openLogs(selected.config.name);
						tui.requestRender();
						return;
					}
					if (matchesKey(data, "r")) {
						(async () => {
							if (selected.status === "running") await terminateProcess(selected);
							spawnProcess(selected, sessionCwd);
							tui.requestRender();
						})();
						return;
					}
					if (matchesKey(data, "s")) {
						if (selected.status === "running") {
							terminateProcess(selected).then(() => tui.requestRender());
						} else {
							ctx.ui.notify(`'${selected.config.name}' is not running`, "info");
						}
						return;
					}
					if (matchesKey(data, "d")) {
						if (selected.status === "running") {
							ctx.ui.notify(`Stop '${selected.config.name}' first (press s)`, "warning");
							return;
						}
						registry.delete(selected.config.name);
						selectedIdx = Math.max(0, Math.min(selectedIdx, registry.size - 1));
						persistConfigs();
						refreshFooter();
						tui.requestRender();
						return;
					}
				}

				function handleLogInput(data: string) {
					const entry = logTarget ? registry.get(logTarget) : null;
					const total = entry?.logs.length ?? 0;
					const maxOffset = Math.max(0, total - LOG_VIEW_HEIGHT);

					if (matchesKey(data, "q") || matchesKey(data, "ctrl+c")) {
						closeLogsView();
						done();
						return;
					}
					if (matchesKey(data, "b") || matchesKey(data, "escape")) {
						closeLogsView();
						tui.requestRender();
						return;
					}
					if (matchesKey(data, "f")) {
						followLog = !followLog;
						if (followLog) logScrollOffset = maxOffset;
						tui.requestRender();
						return;
					}
					if (matchesKey(data, "up") || matchesKey(data, "k")) {
						followLog = false;
						logScrollOffset = Math.max(0, logScrollOffset - 1);
						tui.requestRender();
						return;
					}
					if (matchesKey(data, "down") || matchesKey(data, "j")) {
						logScrollOffset = Math.min(maxOffset, logScrollOffset + 1);
						if (logScrollOffset >= maxOffset) followLog = true;
						tui.requestRender();
						return;
					}
					if (matchesKey(data, "pageup")) {
						followLog = false;
						logScrollOffset = Math.max(0, logScrollOffset - LOG_VIEW_HEIGHT);
						tui.requestRender();
						return;
					}
					if (matchesKey(data, "pagedown")) {
						logScrollOffset = Math.min(maxOffset, logScrollOffset + LOG_VIEW_HEIGHT);
						if (logScrollOffset >= maxOffset) followLog = true;
						tui.requestRender();
						return;
					}
				}

				// ── Component ──────────────────────────────────────────────────────────

				return {
					render(width: number): string[] {
						return view === "list" ? renderListView(width) : renderLogView(width);
					},
					handleInput(data: string) {
						if (view === "list") handleListInput(data);
						else handleLogInput(data);
					},
					invalidate() {
						/* no caching */
					},
				};
			});
		},
	});
}
