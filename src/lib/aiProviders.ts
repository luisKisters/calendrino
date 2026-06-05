export type AiProviderId = "gemini" | "anthropic" | "openai" | "openrouter";

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
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    apiKeyLabel: "Anthropic API key",
    apiKeyPlaceholder: "sk-ant-...",
    defaultModel: "claude-sonnet-4-5-20250929",
    supportsImages: true,
    supportsPdfs: false,
    keyHelpUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    apiKeyLabel: "OpenAI API key",
    apiKeyPlaceholder: "sk-...",
    defaultModel: "gpt-4.1",
    supportsImages: true,
    supportsPdfs: false,
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
};

export const AI_PROVIDER_ORDER: AiProviderId[] = ["gemini", "anthropic", "openai", "openrouter"];

export function getProviderConfig(provider: AiProviderId): AiProviderConfig {
  return AI_PROVIDERS[provider];
}

export function isAiProviderId(value: string): value is AiProviderId {
  return value in AI_PROVIDERS;
}
