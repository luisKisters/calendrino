import { isTauri } from "./platform";
import type { Store } from "@tauri-apps/plugin-store";

const STORE_FILE = "settings.json";
const API_KEY = "geminiApiKey";

let storePromise: Promise<Store> | null = null;
async function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = import("@tauri-apps/plugin-store").then((m) =>
      m.load(STORE_FILE, { autoSave: true, defaults: {} }),
    );
  }
  return storePromise;
}

/** Read the saved Gemini API key (Tauri store on native, localStorage on web). */
export async function getApiKey(): Promise<string | null> {
  if (isTauri()) {
    const s = await getStore();
    return (await s.get<string>(API_KEY)) ?? null;
  }
  return localStorage.getItem(API_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (isTauri()) {
    const s = await getStore();
    await s.set(API_KEY, trimmed);
    await s.save();
  } else {
    localStorage.setItem(API_KEY, trimmed);
  }
}

export async function clearApiKey(): Promise<void> {
  if (isTauri()) {
    const s = await getStore();
    await s.delete(API_KEY);
    await s.save();
  } else {
    localStorage.removeItem(API_KEY);
  }
}
