import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Capture } from "./Capture";

interface ControlledCaptureProps {
  initialNote?: string;
  generalInstructions?: string;
  onSaveGeneralInstructions?: (instructions: string) => Promise<void> | void;
  onOpenSettings?: () => void;
  onNoteChange?: (instruction: string) => void;
}

function ControlledCapture({
  initialNote = "",
  generalInstructions,
  onSaveGeneralInstructions,
  onOpenSettings,
  onNoteChange,
}: ControlledCaptureProps) {
  const [note, setNote] = useState(initialNote);

  return (
    <Capture
      onFile={vi.fn()}
      generalInstructions={generalInstructions}
      onSaveGeneralInstructions={onSaveGeneralInstructions}
      onOpenSettings={onOpenSettings}
      oneTimeInstruction={note}
      onOneTimeInstructionChange={(next) => {
        onNoteChange?.(next);
        setNote(next);
      }}
    />
  );
}

describe("Capture", () => {
  it("shows the scan note chip and clears it from the remove control", async () => {
    const user = userEvent.setup();
    const onNoteChange = vi.fn();

    render(
      <ControlledCapture
        initialNote="Only include the highlighted row."
        onNoteChange={onNoteChange}
      />,
    );

    expect(screen.getByText("Only include the highlighted row.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove note for this scan/i }));

    expect(onNoteChange).toHaveBeenCalledWith("");
    expect(screen.queryByText("Only include the highlighted row.")).not.toBeInTheDocument();
  });

  it("saves a one-time note and can append it to general instructions", async () => {
    const user = userEvent.setup();
    const onSaveGeneralInstructions = vi.fn();
    const onNoteChange = vi.fn();

    render(
      <ControlledCapture
        generalInstructions="Keep titles in German."
        onSaveGeneralInstructions={onSaveGeneralInstructions}
        onNoteChange={onNoteChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add a note for this scan/i }));
    await user.type(
      screen.getByRole("textbox", { name: "Note for this scan" }),
      "Only include morning sessions.",
    );
    await user.click(screen.getByLabelText(/also save to my general instructions/i));
    await user.click(screen.getByRole("button", { name: /save note/i }));

    await waitFor(() =>
      expect(onSaveGeneralInstructions).toHaveBeenCalledWith(
        "Keep titles in German.\nOnly include morning sessions.",
      ),
    );
    expect(onNoteChange).toHaveBeenCalledWith("Only include morning sessions.");
    expect(screen.getByText("Only include morning sessions.")).toBeInTheDocument();
  });

  it("opens settings from the note sheet link", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();

    render(<ControlledCapture onOpenSettings={onOpenSettings} />);

    await user.click(screen.getByRole("button", { name: /add a note for this scan/i }));
    await user.click(screen.getByRole("button", { name: /edit general instructions/i }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
