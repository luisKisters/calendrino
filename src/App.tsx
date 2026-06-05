import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { Settings } from "./components/Settings";
import { Capture } from "./components/Capture";
import { Processing } from "./components/Processing";
import { Review } from "./components/Review";
import { ErrorView } from "./components/ErrorView";
import { getApiKey, setApiKey } from "./lib/store";
import { nowContext } from "./lib/datetime";
import { extractEvents } from "./lib/ai";
import { buildGCalUrl } from "./lib/gcal";
import { openExternal } from "./lib/platform";
import type { CalendarEvent } from "./lib/schema";

type Screen =
  | { name: "loading" }
  | { name: "settings" }
  | { name: "capture" }
  | { name: "processing"; label: string }
  | { name: "review"; events: CalendarEvent[] }
  | { name: "error"; message: string; detail?: string };

export default function App() {
  const [apiKey, setKey] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "loading" });

  useEffect(() => {
    getApiKey().then((k) => {
      setKey(k);
      setScreen(k ? { name: "capture" } : { name: "settings" });
    });
  }, []);

  async function handleSaveKey(key: string) {
    await setApiKey(key);
    setKey(key);
    setScreen({ name: "capture" });
  }

  async function handleFile(file: File) {
    if (!apiKey) {
      setScreen({ name: "settings" });
      return;
    }
    const isPdf = file.type === "application/pdf";
    setScreen({ name: "processing", label: isPdf ? "Reading your document…" : "Reading your photo…" });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const events = await extractEvents({
        bytes,
        mediaType: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
        apiKey,
        now: nowContext(),
      });
      setScreen({ name: "review", events });
    } catch (err) {
      setScreen(classifyError(err));
    }
  }

  async function handleAdd(event: CalendarEvent) {
    await openExternal(buildGCalUrl(event));
  }

  function render() {
    switch (screen.name) {
      case "loading":
        return <div className="flex flex-1 items-center justify-center text-gray-500">Loading…</div>;
      case "settings":
        return (
          <Settings
            initialKey={apiKey ?? ""}
            hasExistingKey={!!apiKey}
            onSave={handleSaveKey}
            onClose={apiKey ? () => setScreen({ name: "capture" }) : undefined}
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <Header onSettings={() => setScreen({ name: "settings" })} showSettings={showSettingsButton} />
      {render()}
    </main>
  );
}

function classifyError(err: unknown): Screen {
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
      detail: "Your Gemini API key may be invalid or missing. Check it in settings.",
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
      detail: "Couldn't reach Gemini. Check your connection and try again.",
    };
  }
  return { name: "error", message: "Something went wrong", detail: msg };
}
