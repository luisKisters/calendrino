import { useRef, useState } from "react";
import { openExternal } from "../lib/platform";
import { AI_PROVIDER_ORDER, getProviderConfig, type AiProviderId } from "../lib/aiProviders";
import type { AiSettings } from "../lib/store";
import { RisoButton } from "./riso/RisoButton";
import { RisoField } from "./riso/RisoField";
import { MiniStamp } from "./riso/Stamp";
import { Icon } from "./riso/Icon";

interface SettingsProps {
  initialSettings: AiSettings;
  hasExistingKey: boolean;
  onSave: (settings: AiSettings) => Promise<void> | void;
  onClose?: () => void;
}

// Tappable snippets that append to the custom-instructions box, so the field is
// useful without having to type from scratch. Tailored to schedule captures.
const INSTRUCTION_PRESETS = [
  "Assume the Europe/Berlin timezone.",
  "Keep event titles in German.",
  "This is a rehearsal plan (Probenplan) — each entry is a rehearsal.",
  "Ignore any dates in the past.",
];

export function Settings({ initialSettings, hasExistingKey, onSave, onClose }: SettingsProps) {
  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>(initialSettings.selectedProvider);
  const [providers, setProviders] = useState<AiSettings["providers"]>(initialSettings.providers);
  const [customInstructions, setCustomInstructions] = useState(initialSettings.customInstructions ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const providerBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const config = getProviderConfig(selectedProvider);
  const selectedSettings = providers[selectedProvider];
  const key = selectedSettings?.apiKey ?? "";
  const model = selectedSettings?.model ?? config.defaultModel;

  function updateSelected(next: { apiKey?: string; model?: string }) {
    setSaved(false);
    setProviders((prev) => ({
      ...prev,
      [selectedProvider]: {
        apiKey: next.apiKey ?? prev[selectedProvider]?.apiKey ?? "",
        model: next.model ?? prev[selectedProvider]?.model,
      },
    }));
  }

  function handleProviderChange(provider: AiProviderId) {
    setSaved(false);
    setSelectedProvider(provider);
  }

  async function handleSave() {
    if (!key.trim()) return;
    setSaving(true);
    setSaved(false);
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
        customInstructions: customInstructions.trim() || undefined,
      });
      setSaved(true);
    } catch {
      // onSave failure (e.g. store write error) — leave saved=false so the stamp
      // does not appear and the user can retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-8">
      {/* Back button row */}
      {hasExistingKey && onClose && (
        <button
          onClick={onClose}
          className="mb-4 flex items-center gap-1 self-start text-[13px] font-bold text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded min-h-[44px]"
        >
          <Icon name="arrow-left" size={15} aria-hidden={true} />
          Back
        </button>
      )}

      <h2 className="mb-6 font-display text-[22px] font-extrabold leading-tight text-ink">
        {hasExistingKey ? "Settings" : "Welcome to Calendrino"}
      </h2>

      {/* Provider segmented control */}
      <span className="mb-[6px] font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-soft">
        AI provider
      </span>
      <div
        className="mb-5 flex overflow-hidden rounded-[12px] border-2 border-ink"
        role="radiogroup"
        aria-label="AI provider"
      >
        {AI_PROVIDER_ORDER.map((provider, i) => {
          const isSelected = provider === selectedProvider;
          return (
            <button
              key={provider}
              type="button"
              role="radio"
              onClick={() => handleProviderChange(provider)}
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              ref={(el) => { providerBtnRefs.current[i] = el; }}
              onKeyDown={(e) => {
                const len = AI_PROVIDER_ORDER.length;
                let next = -1;
                if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % len;
                else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + len) % len;
                if (next >= 0) {
                  e.preventDefault();
                  handleProviderChange(AI_PROVIDER_ORDER[next]);
                  providerBtnRefs.current[next]?.focus();
                }
              }}
              className={[
                "flex-1 py-[9px] px-1 font-display text-[11px] font-bold leading-none text-center transition",
                i < AI_PROVIDER_ORDER.length - 1 ? "border-r-[1.5px] border-ink" : "",
                isSelected
                  ? "bg-teal text-paper [mix-blend-mode:multiply]"
                  : "bg-paper text-ink hover:bg-paper-2",
              ].join(" ")}
            >
              {getProviderConfig(provider).label}
            </button>
          );
        })}
      </div>

      {/* API key field */}
      <div className="mb-4">
        <RisoField
          id="apiKey"
          label={config.apiKeyLabel}
          type="password"
          value={key}
          onChange={(e) => updateSelected({ apiKey: e.target.value })}
          placeholder={config.apiKeyPlaceholder}
          autoComplete="off"
          spellCheck={false}
          leadingIcon={<Icon name="shield" size={15} aria-hidden={true} />}
        />
        <button
          type="button"
          onClick={() => openExternal(config.keyHelpUrl)}
          className="mt-2 min-h-[44px] text-[12px] font-semibold text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded"
        >
          Get a {config.label} API key →
        </button>
      </div>

      {/* Model field */}
      <div className="mb-6">
        <RisoField
          id="model"
          label="Model"
          value={model}
          onChange={(e) => updateSelected({ model: e.target.value })}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => updateSelected({ model: config.defaultModel })}
          className="mt-2 min-h-[44px] text-[12px] font-semibold text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded"
        >
          Reset to default
        </button>
      </div>

      {/* Custom instructions (optional) */}
      <div className="mb-6">
        <label
          htmlFor="customInstructions"
          className="mb-[5px] block font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-soft"
        >
          Custom instructions (optional)
        </label>
        <p className="mb-2 text-[12px] leading-relaxed text-ink-soft">
          Extra guidance sent with every capture — a default timezone, a language, or how to read
          your schedules. Tap a suggestion to add it.
        </p>
        <textarea
          id="customInstructions"
          value={customInstructions}
          onChange={(e) => {
            setCustomInstructions(e.target.value);
            setSaved(false);
          }}
          rows={3}
          placeholder="e.g. Assume Europe/Berlin and keep titles in German."
          spellCheck={false}
          className="w-full resize-y rounded-[11px] border-2 border-ink bg-paper-2 px-[11px] py-[10px] text-[13.5px] font-semibold text-ink outline-none placeholder:text-ink-soft"
        />
        <div className="mt-2 flex flex-wrap gap-[6px]">
          {INSTRUCTION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setSaved(false);
                setCustomInstructions((prev) => {
                  if (prev.includes(preset)) return prev;
                  const trimmed = prev.trimEnd();
                  return trimmed ? `${trimmed}\n${preset}` : preset;
                });
              }}
              className="rounded-full border-2 border-ink bg-paper px-[10px] py-[5px] font-display text-[11px] font-bold text-ink transition hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              + {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Save button + saved indicator */}
      <div className="mt-auto flex flex-col gap-3">
        {saved && (
          <div className="flex items-center gap-2 text-[12px] font-bold text-teal">
            <MiniStamp />
            Saved on this device only
          </div>
        )}
        <RisoButton
          onClick={handleSave}
          disabled={!key.trim() || saving}
          className="w-full"
        >
          {saving ? "Saving…" : "Save"}
        </RisoButton>
      </div>

      {/* Privacy footer */}
      <div className="mt-4 flex items-center gap-2 text-[11px] text-ink-soft">
        <Icon name="shield" size={14} className="text-teal" aria-hidden={true} />
        Keys never leave your device
      </div>
    </div>
  );
}
