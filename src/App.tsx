import { useEffect, useRef, useState } from "react";
import { Header } from "./components/Header";
import { Settings } from "./components/Settings";
import { Capture } from "./components/Capture";
import { Processing } from "./components/Processing";
import { Review } from "./components/Review";
import { Success } from "./components/Success";
import { ErrorView } from "./components/ErrorView";
import { emptyAiSettings, getAiSettings, setAiSettings, type AiSettings } from "./lib/store";
import { nowContext } from "./lib/datetime";
import { streamExtraction } from "./lib/ai";
import { buildGCalUrl } from "./lib/gcal";
import { openExternal } from "./lib/platform";
import type { CalendarEvent } from "./lib/schema";
import { getProviderConfig } from "./lib/aiProviders";
import { imagePreviewUrl, renderPdfFirstPage } from "./lib/pdfPreview";
import type { TranscriptChunk } from "./lib/transcript";

type Screen =
  | { name: "loading" }
  | { name: "settings" }
  | { name: "capture" }
  | { name: "processing"; previewUrl: string; mediaType: string; transcript: TranscriptChunk[] }
  | { name: "review"; events: CalendarEvent[] }
  | { name: "success"; event: CalendarEvent }
  | { name: "error"; message: string; detail?: string };

export default function App() {
  const [settings, setSettings] = useState<AiSettings>(emptyAiSettings());
  const [screen, setScreen] = useState<Screen>({ name: "loading" });
  const [oneTimeInstruction, setOneTimeInstruction] = useState("");
  const activeRunIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    getAiSettings().then((next) => {
      setSettings(next);
      const providerSettings = next.providers[next.selectedProvider];
      setScreen(providerSettings?.apiKey ? { name: "capture" } : { name: "settings" });
    });
  }, []);

  useEffect(() => {
    return () => {
      activeRunIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      revokeActiveObjectUrl();
    };
  }, []);

  async function handleSaveSettings(next: AiSettings) {
    await setAiSettings(next);
    setSettings(next);
    // Delay navigation so the "Saved" stamp in Settings has time to render.
    setTimeout(() => setScreen({ name: "capture" }), 900);
  }

  async function handleSaveGeneralInstructions(instructions: string) {
    const trimmed = instructions.trim();
    const next = {
      ...settings,
      customInstructions: trimmed || undefined,
    };
    await setAiSettings(next);
    setSettings(next);
  }

  async function handleFile(file: File) {
    const provider = settings.selectedProvider;
    const config = getProviderConfig(provider);
    const providerSettings = settings.providers[provider];
    if (!providerSettings?.apiKey) {
      setScreen({ name: "settings" });
      return;
    }

    const mediaType = mediaTypeFor(file);
    const runId = activeRunIdRef.current + 1;
    activeRunIdRef.current = runId;
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;
    revokeActiveObjectUrl();

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const previewUrl = await previewUrlFor(file, mediaType, bytes);
      if (!isActiveRun(runId, abortController)) return;

      setScreen({
        name: "processing",
        previewUrl,
        mediaType,
        transcript: [{ kind: "status", text: "Preparing the capture preview." }],
      });

      const instructions = buildInstructions(settings.customInstructions, oneTimeInstruction);
      let finished = false;
      for await (const chunk of streamExtraction({
        bytes,
        mediaType,
        provider,
        apiKey: providerSettings.apiKey,
        model: providerSettings.model,
        instructions,
        now: nowContext(),
      }, abortController.signal)) {
        if (!isActiveRun(runId, abortController)) return;

        if (chunk.kind === "done") {
          finished = true;
          await handleExtractedEvents(chunk.events);
          return;
        }

        if (chunk.kind === "error") {
          finished = true;
          throw new Error(chunk.message);
        }

        appendTranscript(chunk);
      }

      if (!finished) {
        throw new Error("AI extraction stream ended before returning events.");
      }
    } catch (err) {
      if (!isActiveRun(runId, abortController)) return;
      setScreen(classifyError(err, config.label));
    } finally {
      if (isActiveRun(runId, abortController)) {
        abortRef.current = null;
        setOneTimeInstruction("");
        revokeActiveObjectUrl();
      }
    }
  }

  async function handleExtractedEvents(events: CalendarEvent[]) {
    // A single event is the common case: open Google Calendar straight away so
    // the user doesn't have to tap "Add". Best-effort — on web a popup blocker
    // may swallow it after the await, so we still land on the review screen,
    // where the same event is one tap away as a fallback.
    if (events.length === 1) {
      try { await openExternal(buildGCalUrl(events[0])); } catch { /* fall through */ }
    }
    setScreen({ name: "review", events });
  }

  function handleCancelProcessing() {
    activeRunIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    revokeActiveObjectUrl();
    setScreen({ name: "capture" });
  }

  function appendTranscript(chunk: TranscriptChunk) {
    setScreen((current) => {
      if (current.name !== "processing") return current;
      return { ...current, transcript: [...current.transcript, chunk] };
    });
  }

  function isActiveRun(runId: number, abortController: AbortController) {
    return activeRunIdRef.current === runId && !abortController.signal.aborted;
  }

  async function previewUrlFor(file: File, mediaType: string, bytes: Uint8Array): Promise<string> {
    if (mediaType === "application/pdf") {
      return renderPdfFirstPage(bytes);
    }

    const previewUrl = imagePreviewUrl(file);
    activeObjectUrlRef.current = previewUrl;
    return previewUrl;
  }

  function revokeActiveObjectUrl() {
    if (!activeObjectUrlRef.current) return;
    URL.revokeObjectURL?.(activeObjectUrlRef.current);
    activeObjectUrlRef.current = null;
  }

  async function handleAdd(event: CalendarEvent) {
    try {
      await openExternal(buildGCalUrl(event));
      // Only transition to success for single-event reviews; multi-event stays on
      // the review screen so remaining events can be added one at a time.
      if (screen.name === "review" && screen.events.length === 1) {
        setScreen({ name: "success", event });
      }
    } catch (err) {
      setScreen(classifyError(err, getProviderConfig(settings.selectedProvider).label));
    }
  }

  function render() {
    switch (screen.name) {
      case "loading":
        return <div className="flex flex-1 items-center justify-center text-ink-soft">Loading…</div>;
      case "settings": {
        const hasKey = Object.values(settings.providers).some((provider) => !!provider?.apiKey);
        return (
          <Settings
            initialSettings={settings}
            hasExistingKey={hasKey}
            onSave={handleSaveSettings}
            onClose={hasKey ? () => setScreen({ name: "capture" }) : undefined}
          />
        );
      }
      case "capture":
        return (
          <Capture
            onFile={handleFile}
            generalInstructions={settings.customInstructions}
            onSaveGeneralInstructions={handleSaveGeneralInstructions}
            onOpenSettings={() => setScreen({ name: "settings" })}
            oneTimeInstruction={oneTimeInstruction}
            onOneTimeInstructionChange={setOneTimeInstruction}
          />
        );
      case "processing":
        return (
          <Processing
            previewUrl={screen.previewUrl}
            mediaType={screen.mediaType}
            transcript={screen.transcript}
            onCancel={handleCancelProcessing}
          />
        );
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

function buildInstructions(generalInstructions: string | undefined, oneTimeInstruction: string): string | undefined {
  const general = generalInstructions?.trim() ?? "";
  const oneTime = oneTimeInstruction.trim();

  if (!general) return oneTime || undefined;
  if (!oneTime) return general;

  const existingLines = general.split(/\r?\n/).map((line) => line.trim());
  return existingLines.includes(oneTime) ? general : `${general}\n${oneTime}`;
}

function mediaTypeFor(file: File): string {
  if (file.type) return file.type;
  return file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg";
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
