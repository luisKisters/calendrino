import { isTauri } from "./platform";
import type { Store } from "@tauri-apps/plugin-store";
import { AI_PROVIDERS, isAiProviderId, type AiProviderId } from "./aiProviders";

const STORE_FILE = "settings.json";
const LEGACY_API_KEY = "geminiApiKey";
const AI_SETTINGS = "aiSettings.v1";

export interface ProviderSettings {
  apiKey: string;
  model?: string;
}

export interface AiSettings {
  selectedProvider: AiProviderId;
  providers: Partial<Record<AiProviderId, ProviderSettings>>;
  /** Optional free-text guidance appended to the extraction prompt for every capture. */
  customInstructions?: string;
}

let storePromise: Promise<Store> | null = null;
async function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = import("@tauri-apps/plugin-store").then((m) =>
      m.load(STORE_FILE, { autoSave: true, defaults: {} }),
    );
  }
  return storePromise;
}

async function readValue(key: string): Promise<unknown> {
  if (isTauri()) {
    const s = await getStore();
    return await s.get(key);
  }
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function writeValue(key: string, value: unknown): Promise<void> {
  if (isTauri()) {
    const s = await getStore();
    await s.set(key, value);
    await s.save();
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

async function deleteValue(key: string): Promise<void> {
  if (isTauri()) {
    const s = await getStore();
    await s.delete(key);
    await s.save();
  } else {
    localStorage.removeItem(key);
  }
}

function normalizeSettings(value: unknown): AiSettings | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AiSettings>;
  const selectedProvider =
    typeof candidate.selectedProvider === "string" && isAiProviderId(candidate.selectedProvider)
      ? candidate.selectedProvider
      : "gemini";
  const providers: AiSettings["providers"] = {};
  if (candidate.providers && typeof candidate.providers === "object") {
    for (const id of Object.keys(AI_PROVIDERS) as AiProviderId[]) {
      const saved = candidate.providers[id];
      if (!saved || typeof saved !== "object" || typeof saved.apiKey !== "string") continue;
      providers[id] = {
        apiKey: saved.apiKey,
        model: typeof saved.model === "string" && saved.model.trim() ? saved.model : undefined,
      };
    }
  }
  const customInstructions =
    typeof candidate.customInstructions === "string" && candidate.customInstructions.trim()
      ? candidate.customInstructions
      : undefined;
  return { selectedProvider, providers, customInstructions };
}

export function emptyAiSettings(): AiSettings {
  return { selectedProvider: "gemini", providers: {} };
}

export async function getAiSettings(): Promise<AiSettings> {
  const saved = normalizeSettings(await readValue(AI_SETTINGS));
  if (saved) return saved;

  const legacy = await readValue(LEGACY_API_KEY);
  if (typeof legacy === "string" && legacy.trim()) {
    const migrated: AiSettings = {
      selectedProvider: "gemini",
      providers: { gemini: { apiKey: legacy.trim() } },
    };
    await setAiSettings(migrated);
    return migrated;
  }

  return emptyAiSettings();
}

export async function setAiSettings(settings: AiSettings): Promise<void> {
  await writeValue(AI_SETTINGS, settings);
}

export async function clearAiSettings(): Promise<void> {
  await deleteValue(AI_SETTINGS);
}
