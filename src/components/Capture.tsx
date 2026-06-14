import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Icon } from "./riso/Icon";
import { RisoButton } from "./riso/RisoButton";
import { Halftone } from "./riso/Halftone";
import { CaptureFrame } from "./riso/CaptureFrame";
import { Sheet } from "./riso/Sheet";
import { RisoTextarea } from "./riso/RisoField";

interface CaptureProps {
  onFile: (file: File) => void;
  generalInstructions?: string;
  onSaveGeneralInstructions?: (instructions: string) => Promise<void> | void;
  onOpenSettings?: () => void;
  oneTimeInstruction?: string;
  onOneTimeInstructionChange?: (instruction: string) => void;
}

type CameraState = "idle" | "starting" | "ready" | "fallback";
const HAVE_CURRENT_DATA = 2;

function appendUniqueInstruction(existing: string | undefined, note: string): string {
  const trimmedExisting = existing?.trim() ?? "";
  const trimmedNote = note.trim();
  if (!trimmedNote) return trimmedExisting;
  if (!trimmedExisting) return trimmedNote;

  const lines = trimmedExisting.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes(trimmedNote)) return trimmedExisting;
  return `${trimmedExisting}\n${trimmedNote}`;
}

export function Capture({
  onFile,
  generalInstructions,
  onSaveGeneralInstructions,
  onOpenSettings,
  oneTimeInstruction = "",
  onOneTimeInstructionChange,
}: CaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>(() =>
    canUseCameraStream() ? "idle" : "fallback",
  );
  const [videoReady, setVideoReady] = useState(false);
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [saveToGeneral, setSaveToGeneral] = useState(false);
  const activeNote = oneTimeInstruction.trim();

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!streamRef.current || !videoRef.current) return;

    videoRef.current.srcObject = streamRef.current;
    if (hasVideoFrame(videoRef.current)) setVideoReady(true);
    const playResult = videoRef.current.play();
    if (playResult) {
      playResult.catch(() => undefined);
    }
  }, [cameraState]);

  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  }

  function openNoteSheet() {
    setDraftNote(oneTimeInstruction);
    setSaveToGeneral(false);
    setNoteSheetOpen(true);
  }

  async function saveNote() {
    const trimmedNote = draftNote.trim();
    if (saveToGeneral && trimmedNote && onSaveGeneralInstructions) {
      await onSaveGeneralInstructions(appendUniqueInstruction(generalInstructions, trimmedNote));
    }
    onOneTimeInstructionChange?.(trimmedNote);
    setNoteSheetOpen(false);
  }

  function editGeneralInstructions() {
    setNoteSheetOpen(false);
    onOpenSettings?.();
  }

  function replaceStream(nextStream: MediaStream | null) {
    stopStream(streamRef.current);
    streamRef.current = nextStream;
    setVideoReady(false);
  }

  async function enableCamera() {
    if (!canUseCameraStream()) {
      setCameraState("fallback");
      cameraRef.current?.click();
      return;
    }

    setCameraState("starting");
    try {
      const nextStream = await requestCameraStream({
        video: { facingMode: "environment" },
      });
      if (!mountedRef.current) {
        stopStream(nextStream);
        return;
      }
      replaceStream(nextStream);
      setCameraState("ready");
    } catch {
      if (!mountedRef.current) return;
      replaceStream(null);
      setCameraState("fallback");
      cameraRef.current?.click();
    }
  }

  async function handleShutter() {
    if (cameraState === "starting") return;
    if (cameraState === "fallback") {
      cameraRef.current?.click();
      return;
    }
    if (cameraState !== "ready") {
      await enableCamera();
      return;
    }

    const captured = await captureVideoFrame(videoRef.current);
    if (captured) {
      onFile(captured);
      return;
    }
    replaceStream(null);
    setCameraState("fallback");
  }

  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3">
      {/* capture zone */}
      <CaptureFrame>
        {cameraState === "ready" ? (
          <video
            ref={videoRef}
            data-testid="camera-preview"
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            playsInline
            onLoadedData={() => setVideoReady(true)}
            onCanPlay={() => setVideoReady(true)}
          />
        ) : (
          <StaticCaptureArt busy={cameraState === "starting"} />
        )}
        <button
          type="button"
          aria-label="Take photo"
          onClick={handleShutter}
          disabled={cameraState === "starting" || (cameraState === "ready" && !videoReady)}
          className="absolute bottom-4 left-1/2 z-20 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full border-2 border-ink bg-paper text-ink shadow-[0_3px_0_var(--ink)] [mix-blend-mode:multiply] transition-transform hover:-translate-y-0.5 hover:shadow-[0_4px_0_var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            className={[
              "grid h-11 w-11 place-items-center rounded-full border-2 border-ink",
              cameraState === "ready" ? "bg-red text-paper" : "bg-teal text-paper",
            ].join(" ")}
          >
            <Icon name="camera" size={21} aria-hidden={true} />
          </span>
        </button>
      </CaptureFrame>

      <div className="flex flex-col gap-2">
        {activeNote ? (
          <div className="flex items-center gap-2 rounded-full border-2 border-teal bg-paper px-3 py-1 text-ink">
            <Icon name="edit" size={15} className="flex-none text-teal" aria-hidden={true} />
            <span className="min-w-0 flex-1 truncate text-[12px] font-bold">
              {activeNote}
            </span>
            <button
              type="button"
              onClick={() => onOneTimeInstructionChange?.("")}
              aria-label="Remove note for this scan"
              className="min-h-[44px] rounded px-1 text-[11px] font-bold text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              Remove
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={openNoteSheet}
          className="min-h-[44px] self-start rounded px-1 text-[12px] font-bold text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          + Add a note for this scan
        </button>
      </div>

      <RisoButton
        variant="secondary"
        onClick={() => uploadRef.current?.click()}
        className="w-full"
      >
        <Icon name="upload" size={18} aria-hidden={true} />
        Upload file
      </RisoButton>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePick}
        className="hidden"
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handlePick}
        className="hidden"
      />

      <Sheet
        open={noteSheetOpen}
        title="Note for this scan"
        onClose={() => setNoteSheetOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <RisoTextarea
            id="scan-note"
            label="Note for this scan"
            value={draftNote}
            onChange={(event) => setDraftNote(event.target.value)}
            rows={4}
            placeholder="e.g. Only include the highlighted rehearsal row."
            spellCheck={false}
          />
          <label className="flex min-h-[44px] items-center gap-3 rounded-[12px] border-2 border-ink bg-paper-2 px-3 py-2 text-[12.5px] font-bold text-ink">
            <input
              type="checkbox"
              checked={saveToGeneral}
              onChange={(event) => setSaveToGeneral(event.target.checked)}
              className="h-5 w-5 accent-teal"
            />
            Also save to my general instructions
          </label>
          <button
            type="button"
            onClick={editGeneralInstructions}
            className="min-h-[44px] self-start rounded text-[12px] font-bold text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            Edit general instructions →
          </button>
          <div className="flex gap-2 pt-1">
            <RisoButton
              type="button"
              variant="secondary"
              onClick={() => setNoteSheetOpen(false)}
              className="flex-1"
            >
              Cancel
            </RisoButton>
            <RisoButton
              type="button"
              onClick={saveNote}
              className="flex-1"
            >
              Save note
            </RisoButton>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function StaticCaptureArt({ busy }: { busy: boolean }) {
  return (
    <div
      data-testid="camera-fallback-art"
      className="flex h-full flex-col items-center justify-center gap-3 p-5 pb-24 text-center"
    >
      <Halftone />
      {/* red camera blob */}
      <div
        aria-hidden="true"
        className="relative z-10 grid place-items-center rounded-full bg-red text-paper [mix-blend-mode:multiply]"
        style={{ width: 62, height: 62 }}
      >
        <Icon name="camera" size={26} aria-hidden={true} />
      </div>
      <h2 className="relative z-10 font-display font-extrabold text-[20px] leading-[1.05] text-ink">
        {busy ? "Starting camera" : <>Snap or drop<br />anything</>}
      </h2>
      <p className="relative z-10 m-0 text-[12.5px] text-ink-soft">
        Poster · ticket · email · PDF
      </p>
    </div>
  );
}

function canUseCameraStream() {
  return Boolean(getCameraStreamSource());
}

function requestCameraStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
  const getUserMedia = getCameraStreamSource();
  if (!getUserMedia) {
    return Promise.reject(new DOMException("Camera unavailable", "NotFoundError"));
  }

  return getUserMedia(constraints);
}

function getCameraStreamSource() {
  if (typeof navigator === "undefined") return null;
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getUserMedia) return null;
  return mediaDevices.getUserMedia.bind(mediaDevices);
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function hasVideoFrame(video: HTMLVideoElement | null): video is HTMLVideoElement {
  if (!video) return false;
  return video.readyState >= HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0;
}

async function captureVideoFrame(video: HTMLVideoElement | null): Promise<File | null> {
  if (!hasVideoFrame(video)) return null;

  const width = video.videoWidth || video.clientWidth || 1280;
  const height = video.videoHeight || video.clientHeight || 720;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context || !canvas.toBlob) return null;

  try {
    context.drawImage(video, 0, 0, width, height);
  } catch {
    return null;
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.92);
  });
  if (!blob) return null;

  return new File([blob], `calendrino-photo-${Date.now()}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
