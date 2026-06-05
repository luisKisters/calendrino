import { useState } from "react";
import { openExternal } from "../lib/platform";
import { AI_PROVIDER_ORDER, getProviderConfig, type AiProviderId } from "../lib/aiProviders";
import type { AiSettings } from "../lib/store";

interface SettingsProps {
  initialSettings: AiSettings;
  hasExistingKey: boolean;
  onSave: (settings: AiSettings) => Promise<void> | void;
  onClose?: () => void;
}

export function Settings({ initialSettings, hasExistingKey, onSave, onClose }: SettingsProps) {
  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>(initialSettings.selectedProvider);
  const [providers, setProviders] = useState<AiSettings["providers"]>(initialSettings.providers);
  const [saving, setSaving] = useState(false);
  const config = getProviderConfig(selectedProvider);
  const selectedSettings = providers[selectedProvider];
  const key = selectedSettings?.apiKey ?? "";
  const model = selectedSettings?.model ?? config.defaultModel;

  function updateSelected(next: { apiKey?: string; model?: string }) {
    setProviders((prev) => ({
      ...prev,
      [selectedProvider]: {
        apiKey: next.apiKey ?? prev[selectedProvider]?.apiKey ?? "",
        model: next.model ?? prev[selectedProvider]?.model,
      },
    }));
  }

  async function handleSave() {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await onSave({
        selectedProvider,
        providers: {
          ...providers,
          [selectedProvider]: {
            apiKey: key.trim(),
            model: model.trim() || config.defaultModel,
          },
        },
      });
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
        Calendrino turns a photo or document into a calendar event using your selected AI provider.
        Your key is stored only on this device and sent straight to that provider, never to us.
      </p>

      <label className="mb-2 text-sm font-medium text-gray-300" htmlFor="provider">
        AI provider
      </label>
      <select
        id="provider"
        value={selectedProvider}
        onChange={(e) => setSelectedProvider(e.target.value as AiProviderId)}
        className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base outline-none focus:border-indigo-400"
      >
        {AI_PROVIDER_ORDER.map((provider) => (
          <option key={provider} value={provider}>
            {getProviderConfig(provider).label}
          </option>
        ))}
      </select>

      <label className="mb-2 text-sm font-medium text-gray-300" htmlFor="apiKey">
        {config.apiKeyLabel}
      </label>
      <input
        id="apiKey"
        type="password"
        value={key}
        onChange={(e) => updateSelected({ apiKey: e.target.value })}
        placeholder={config.apiKeyPlaceholder}
        autoComplete="off"
        spellCheck={false}
        className="mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base outline-none focus:border-indigo-400"
      />
      <button
        type="button"
        onClick={() => openExternal(config.keyHelpUrl)}
        className="mb-5 self-start text-sm text-indigo-400 hover:underline"
      >
        Get a {config.label} API key →
      </button>

      <label className="mb-2 text-sm font-medium text-gray-300" htmlFor="model">
        Model
      </label>
      <input
        id="model"
        value={model}
        onChange={(e) => updateSelected({ model: e.target.value })}
        autoComplete="off"
        spellCheck={false}
        className="mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base outline-none focus:border-indigo-400"
      />
      <button
        type="button"
        onClick={() => updateSelected({ model: config.defaultModel })}
        className="mb-8 self-start text-sm text-indigo-400 hover:underline"
      >
        Reset to default
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
