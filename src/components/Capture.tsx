import { useRef, type ChangeEvent } from "react";
import { Icon } from "./riso/Icon";
import { RisoButton } from "./riso/RisoButton";
import { Halftone } from "./riso/Halftone";
import { CaptureFrame } from "./riso/CaptureFrame";

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
      <CaptureFrame>
        <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
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
      </CaptureFrame>

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
