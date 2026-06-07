import { useRef, type ChangeEvent } from "react";
import { Icon } from "./riso/Icon";
import { RisoButton } from "./riso/RisoButton";
import { Halftone } from "./riso/Halftone";

interface CaptureProps {
  onFile: (file: File) => void;
}

export function Capture({ onFile }: CaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3">
      {/* capture zone */}
      <div
        className="relative flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-[18px] border-2 border-ink bg-paper-2 p-5 text-center"
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
          Snap or drop<br />anything
        </h2>
        <p className="relative z-10 m-0 text-[12.5px] text-ink-soft">
          Poster · ticket · email · PDF
        </p>
      </div>

      {/* action buttons */}
      <RisoButton
        variant="primary"
        onClick={() => cameraRef.current?.click()}
        className="w-full"
      >
        <Icon name="camera" size={18} aria-hidden={true} />
        Take photo
      </RisoButton>

      <RisoButton
        variant="secondary"
        onClick={() => uploadRef.current?.click()}
        className="w-full"
      >
        <Icon name="upload" size={18} aria-hidden={true} />
        Upload file
      </RisoButton>

      {/* privacy footer */}
      <footer className="flex items-center justify-center gap-2 mt-auto py-1 text-[11px] font-semibold text-ink-soft">
        <Icon name="shield" size={14} className="text-teal" aria-hidden={true} />
        Your key, on your device
      </footer>

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
