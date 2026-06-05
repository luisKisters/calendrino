import { useState } from "react";
import { openExternal } from "../lib/platform";

interface SettingsProps {
  initialKey: string;
  hasExistingKey: boolean;
  onSave: (key: string) => Promise<void> | void;
  onClose?: () => void;
}

export function Settings({ initialKey, hasExistingKey, onSave, onClose }: SettingsProps) {
  const [key, setKey] = useState(initialKey);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await onSave(key.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-8">
      <h2 className="mb-2 text-xl font-semibold">
        {hasExistingKey ? "Settings" : "Welcome to Calendrino"}
      </h2>
      <p className="mb-6 text-sm leading-relaxed text-gray-400">
        Calendrino turns a photo or document into a calendar event using Google Gemini.
        Paste your own Gemini API key — it is stored only on this device and sent
        straight to Google, never to us.
      </p>

      <label className="mb-2 text-sm font-medium text-gray-300" htmlFor="apiKey">
        Gemini API key
      </label>
      <input
        id="apiKey"
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="AIza…"
        autoComplete="off"
        spellCheck={false}
        className="mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base outline-none focus:border-indigo-400"
      />
      <button
        type="button"
        onClick={() => openExternal("https://aistudio.google.com/apikey")}
        className="mb-8 self-start text-sm text-indigo-400 hover:underline"
      >
        Get a free Gemini API key →
      </button>

      <div className="mt-auto flex flex-col gap-3">
        <button
          onClick={handleSave}
          disabled={!key.trim() || saving}
          className="w-full rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save key"}
        </button>
        {hasExistingKey && onClose && (
          <button
            onClick={onClose}
            className="w-full rounded-xl px-4 py-3 text-gray-400 transition hover:text-white"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
