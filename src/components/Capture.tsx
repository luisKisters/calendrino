import { useRef, useState, type ChangeEvent } from "react";
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
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [saveToGeneral, setSaveToGeneral] = useState(false);
  const activeNote = oneTimeInstruction.trim();

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
