import { z } from "zod";

export type AiProviderId = "gemini" | "anthropic" | "openai" | "openrouter" | "deepseek";

export interface AiProviderConfig {
  id: AiProviderId;
  label: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  defaultModel: string;
  supportsImages: boolean;
  supportsPdfs: boolean;
  keyHelpUrl: string;
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderConfig> = {
  gemini: {
    id: "gemini",
    label: "Gemini",
    apiKeyLabel: "Gemini API key",
    apiKeyPlaceholder: "AIza...",
    defaultModel: "gemini-3.1-pro-preview",
    supportsImages: true,
    supportsPdfs: true,
    keyHelpUrl: "https://aistudio.google.com/apikey",
  },
  // Claude Haiku 4.5 is the cheapest Claude model ($1/$5 per 1M) and, like every
  // active Claude model, reads PDFs natively via document blocks — so it's the
  // cheap, PDF-capable default for the Anthropic provider.
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    apiKeyLabel: "Anthropic API key",
    apiKeyPlaceholder: "sk-ant-...",
    defaultModel: "claude-haiku-4-5",
    supportsImages: true,
    supportsPdfs: true,
    keyHelpUrl: "https://console.anthropic.com/settings/keys",
  },
  // The OpenAI provider sends PDFs as native `input_file` parts, which gpt-5.x
  // reads directly — no client-side conversion needed.
  openai: {
    id: "openai",
    label: "OpenAI",
    apiKeyLabel: "OpenAI API key",
    apiKeyPlaceholder: "sk-...",
    defaultModel: "gpt-5.4-mini",
    supportsImages: true,
    supportsPdfs: true,
    keyHelpUrl: "https://platform.openai.com/api-keys",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    apiKeyLabel: "OpenRouter API key",
    apiKeyPlaceholder: "sk-or-...",
    defaultModel: "moonshotai/kimi-k2.6",
    supportsImages: true,
    supportsPdfs: true,
    keyHelpUrl: "https://openrouter.ai/keys",
  },
  // Weights & Biases Inference serves Kimi K2 far faster and more reliably than
  // OpenRouter's other upstreams. It isn't a separately selectable provider —
  // instead OpenRouter is pinned to the W&B upstream automatically for Kimi
  // models (see openRouterProviderRouting in aiCore).
  deepseek: {
    id: "deepseek",
    // DeepSeek's chat API (incl. deepseek-v4-flash) accepts text only — it
    // rejects image/file message parts ("unknown variant image_url"). It's
    // wired up for when a vision model lands, but can't read captures yet.
    label: "DeepSeek",
    apiKeyLabel: "DeepSeek API key",
    apiKeyPlaceholder: "sk-...",
    defaultModel: "deepseek-v4-flash",
    supportsImages: false,
    supportsPdfs: false,
    keyHelpUrl: "https://platform.deepseek.com/api_keys",
  },
};

export const AI_PROVIDER_ORDER: AiProviderId[] = [
  "gemini",
  "anthropic",
  "openai",
  "openrouter",
  "deepseek",
];

export function getProviderConfig(provider: AiProviderId): AiProviderConfig {
  return AI_PROVIDERS[provider];
}

export function isAiProviderId(value: string): value is AiProviderId {
  return value in AI_PROVIDERS;
}

export const zAiProviderId = z.enum(["gemini", "anthropic", "openai", "openrouter", "deepseek"]);
