import { fetch as tauriHttpFetch } from "@tauri-apps/plugin-http";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * `fetch` used for AI provider calls.
 * - Native (Tauri): route through the Rust HTTP plugin, which bypasses webview
 *   CORS so we can call Gemini directly from the client with the user's own key.
 * - Web / dev-browser: fall back to the platform fetch (CORS rules apply there).
 */
export const aiFetch: typeof fetch = isTauri()
  ? (tauriHttpFetch as unknown as typeof fetch)
  : globalThis.fetch.bind(globalThis);

/** Open an external URL (Google Calendar) in the OS browser / calendar app. */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
