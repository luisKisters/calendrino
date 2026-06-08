import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { Settings } from "./components/Settings";
import { Capture } from "./components/Capture";
import { Processing } from "./components/Processing";
import { Review } from "./components/Review";
import { Success } from "./components/Success";
import { ErrorView } from "./components/ErrorView";
import { emptyAiSettings, getAiSettings, setAiSettings, type AiSettings } from "./lib/store";
import { nowContext } from "./lib/datetime";
import { extractEvents } from "./lib/ai";
import { buildGCalUrl } from "./lib/gcal";
import { openExternal } from "./lib/platform";
import type { CalendarEvent } from "./lib/schema";
import { getProviderConfig } from "./lib/aiProviders";

type Screen =
  | { name: "loading" }
  | { name: "settings" }
  | { name: "capture" }
  | { name: "processing"; label: string }
  | { name: "review"; events: CalendarEvent[] }
  | { name: "success"; event: CalendarEvent }
  | { name: "error"; message: string; detail?: string };

export default function App() {
  const [settings, setSettings] = useState<AiSettings>(emptyAiSettings());
  const [screen, setScreen] = useState<Screen>({ name: "loading" });

  useEffect(() => {
    getAiSettings().then((next) => {
      setSettings(next);
      const providerSettings = next.providers[next.selectedProvider];
      setScreen(providerSettings?.apiKey ? { name: "capture" } : { name: "settings" });
    });
  }, []);

  async function handleSaveSettings(next: AiSettings) {
    await setAiSettings(next);
    setSettings(next);
    setScreen({ name: "capture" });
  }

  async function handleFile(file: File) {
    const provider = settings.selectedProvider;
    const config = getProviderConfig(provider);
    const providerSettings = settings.providers[provider];
    if (!providerSettings?.apiKey) {
      setScreen({ name: "settings" });
      return;
    }
    const isPdf = file.type === "application/pdf";
    if (isPdf && !config.supportsPdfs) {
      setScreen({
        name: "error",
        message: "PDFs are not supported for this provider",
        detail: `${config.label} does not support PDFs in Calendrino yet. Use Gemini, OpenRouter, or Weights & Biases for PDFs.`,
      });
      return;
    }
    setScreen({ name: "processing", label: isPdf ? "Reading your document…" : "Reading your photo…" });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const events = await extractEvents({
        bytes,
        mediaType: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
        provider,
        apiKey: providerSettings.apiKey,
        model: providerSettings.model,
        now: nowContext(),
      });
      // A single event is the common case: open Google Calendar straight away so
      // the user doesn't have to tap "Add". Best-effort — on web a popup blocker
      // may swallow it after the await, so we still land on the review screen,
      // where the same event is one tap away as a fallback.
      if (events.length === 1) {
        await openExternal(buildGCalUrl(events[0]));
      }
      setScreen({ name: "review", events });
    } catch (err) {
      setScreen(classifyError(err, config.label));
    }
  }

  async function handleAdd(event: CalendarEvent) {
    await openExternal(buildGCalUrl(event));
    setScreen({ name: "success", event });
  }

  function render() {
    switch (screen.name) {
      case "loading":
        return <div className="flex flex-1 items-center justify-center text-gray-500">Loading…</div>;
      case "settings":
        return (
          <Settings
            initialSettings={settings}
            hasExistingKey={Object.values(settings.providers).some((provider) => !!provider?.apiKey)}
            onSave={handleSaveSettings}
            onClose={Object.values(settings.providers).some((provider) => !!provider?.apiKey) ? () => setScreen({ name: "capture" }) : undefined}
          />
        );
      case "capture":
        return <Capture onFile={handleFile} />;
      case "processing":
        return <Processing label={screen.label} onCancel={() => setScreen({ name: "capture" })} />;
      case "review":
        return (
          <Review events={screen.events} onAdd={handleAdd} onRestart={() => setScreen({ name: "capture" })} />
        );
      case "success":
        return <Success event={screen.event} onRestart={() => setScreen({ name: "capture" })} />;
      case "error":
        return (
          <ErrorView
            message={screen.message}
            detail={screen.detail}
            onRetry={() => setScreen({ name: "capture" })}
            onSettings={() => setScreen({ name: "settings" })}
          />
        );
    }
  }

  const showSettingsButton = screen.name === "capture" || screen.name === "review";

  return (
    <>
      <svg aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <defs>
          <filter id="rough">
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="5" />
          </filter>
        </defs>
      </svg>
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
        <Header onSettings={() => setScreen({ name: "settings" })} showSettings={showSettingsButton} />
        {render()}
      </main>
    </>
  );
}

function classifyError(err: unknown, providerLabel: string): Screen {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes("api key") ||
    lower.includes("api_key") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("permission denied")
  ) {
    return {
      name: "error",
      message: "Couldn't authenticate",
      detail: `Your ${providerLabel} API key may be invalid or missing. Check it in settings.`,
    };
  }
  if (
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("timeout") ||
    lower.includes("connection")
  ) {
    return {
      name: "error",
      message: "Network problem",
      detail: `Couldn't reach ${providerLabel}. Check your connection and try again.`,
    };
  }
  return { name: "error", message: "Something went wrong", detail: msg };
}
