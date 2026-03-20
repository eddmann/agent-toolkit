/**
 * Voice config — loading, saving, and types.
 *
 * Settings are stored in Pi's settings files under the "voice" key:
 *   Global:  ~/.pi/agent/settings.json
 *   Project: <project>/.pi/settings.json
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VoiceBackend = "openai" | "whisper";
export type VoiceScope = "global" | "project";

export interface VoiceConfig {
  enabled: boolean;
  language: string;
  backend: VoiceBackend;
  /** OpenAI API key — prefer env var OPENAI_API_KEY */
  openaiApiKey?: string;
  /** Whisper model ID (e.g. "whisper-small", "whisper-turbo") */
  whisperModel: string;
  /** Where settings are saved */
  scope: VoiceScope;
  /** First-run completed */
  setupCompleted: boolean;
}

export const DEFAULT_CONFIG: VoiceConfig = {
  enabled: true,
  language: "en",
  backend: "whisper",
  openaiApiKey: undefined,
  whisperModel: "whisper-small",
  scope: "global",
  setupCompleted: false,
};

// ─── Paths ───────────────────────────────────────────────────────────────────

function getGlobalSettingsPath(): string {
  return path.join(os.homedir(), ".pi", "agent", "settings.json");
}

function getProjectSettingsPath(cwd: string): string {
  return path.join(cwd, ".pi", "settings.json");
}

function readJsonFile(filePath: string): Record<string, unknown> {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

// ─── Loading ─────────────────────────────────────────────────────────────────

export function loadConfig(cwd: string): { config: VoiceConfig; source: VoiceScope | "default" } {
  // Project settings take precedence
  const projectPath = getProjectSettingsPath(cwd);
  const projectVoice = readJsonFile(projectPath).voice as any;
  if (projectVoice && typeof projectVoice === "object") {
    return { config: migrateConfig(projectVoice, "project"), source: "project" };
  }

  const globalPath = getGlobalSettingsPath();
  const globalVoice = readJsonFile(globalPath).voice as any;
  if (globalVoice && typeof globalVoice === "object") {
    return { config: migrateConfig(globalVoice, "global"), source: "global" };
  }

  return { config: structuredClone(DEFAULT_CONFIG), source: "default" };
}

function migrateConfig(raw: any, scope: VoiceScope): VoiceConfig {
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_CONFIG.enabled,
    language: typeof raw.language === "string" ? raw.language : DEFAULT_CONFIG.language,
    backend: raw.backend === "openai" ? "openai" : "whisper",
    openaiApiKey: typeof raw.openaiApiKey === "string" ? raw.openaiApiKey : undefined,
    whisperModel: typeof raw.whisperModel === "string" ? raw.whisperModel : DEFAULT_CONFIG.whisperModel,
    scope,
    setupCompleted: typeof raw.setupCompleted === "boolean" ? raw.setupCompleted : false,
  };
}

// ─── Saving ──────────────────────────────────────────────────────────────────

export function saveConfig(config: VoiceConfig, scope: VoiceScope, cwd: string): string {
  const settingsPath = scope === "project"
    ? getProjectSettingsPath(cwd)
    : getGlobalSettingsPath();

  const settings = readJsonFile(settingsPath);

  // Never persist API keys into project config
  const toSave = { ...config };
  if (scope === "project") {
    delete toSave.openaiApiKey;
  }

  settings.voice = toSave;
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

  // Atomic write: temp file + rename
  const tmpPath = `${settingsPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2) + "\n");
    fs.renameSync(tmpPath, settingsPath);
  } finally {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
  }

  return settingsPath;
}

// ─── API key resolution ──────────────────────────────────────────────────────

export function resolveOpenAIKey(config: VoiceConfig): string | null {
  return process.env.OPENAI_API_KEY || config.openaiApiKey || null;
}
