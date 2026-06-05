import { useRef, type ChangeEvent } from "react";

interface CaptureProps {
  onFile: (file: File) => void;
}

export function Capture({ onFile }: CaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = ""; // allow picking the same file again
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-10 text-center">
      <div>
        <h2 className="text-2xl font-semibold">Capture an event</h2>
        <p className="mt-2 text-sm text-gray-400">
          Snap a poster or upload a PDF / screenshot. Calendrino reads the date and
          drops it into Google Calendar.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-4">
        <button
          onClick={() => cameraRef.current?.click()}
          className="flex items-center justify-center gap-3 rounded-2xl bg-indigo-500 px-6 py-5 text-lg font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400"
        >
          <span className="text-2xl">📷</span> Take a photo
        </button>
        <button
          onClick={() => uploadRef.current?.click()}
          className="flex items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-6 py-5 text-lg font-semibold transition hover:bg-white/10"
        >
          <span className="text-2xl">📄</span> Upload a file
        </button>
        <button
          disabled
          title="Coming in a later version"
          className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 px-6 py-4 text-base font-medium text-gray-500"
        >
          <span className="text-xl">🎤</span> Voice (soon)
        </button>
      </div>

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
    </div>
  );
}
