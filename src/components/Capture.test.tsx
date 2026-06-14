import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Capture } from "./Capture";

interface ControlledCaptureProps {
  onFile?: (file: File) => void;
  initialNote?: string;
  generalInstructions?: string;
  onSaveGeneralInstructions?: (instructions: string) => Promise<void> | void;
  onOpenSettings?: () => void;
  onNoteChange?: (instruction: string) => void;
}

function ControlledCapture({
  onFile = vi.fn(),
  initialNote = "",
  generalInstructions,
  onSaveGeneralInstructions,
  onOpenSettings,
  onNoteChange,
}: ControlledCaptureProps) {
  const [note, setNote] = useState(initialNote);

  return (
    <Capture
      onFile={onFile}
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

const originalMediaDevices = navigator.mediaDevices;
const originalPlay = HTMLMediaElement.prototype.play;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;

function setMediaDevices(value: MediaDevices | undefined) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value,
  });
}

function mockCameraStream() {
  const stop = vi.fn();
  const stream = {
    getTracks: () => [{ stop }],
  } as unknown as MediaStream;
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  setMediaDevices({ getUserMedia } as unknown as MediaDevices);
  return { getUserMedia, stop };
}

describe("Capture", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setMediaDevices(undefined);
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      value: 480,
    });
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    });
    HTMLCanvasElement.prototype.toBlob = vi.fn(function toBlob(callback: BlobCallback, type?: string) {
      callback(new Blob(["frame"], { type: type ?? "image/png" }));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    setMediaDevices(originalMediaDevices);
    HTMLMediaElement.prototype.play = originalPlay;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  });

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

  it("shows a live video preview and captures the shutter frame", async () => {
    const user = userEvent.setup();
    const onFile = vi.fn();
    const { getUserMedia, stop } = mockCameraStream();

    const { unmount } = render(<ControlledCapture onFile={onFile} />);

    await user.click(screen.getByRole("button", { name: /take photo/i }));

    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "environment" },
    });
    expect(await screen.findByTestId("camera-preview")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /take photo/i }));

    await waitFor(() => expect(onFile).toHaveBeenCalledWith(expect.any(File)));
    const captured = onFile.mock.calls[0][0] as File;
    expect(captured.name).toMatch(/^calendrino-photo-\d+\.jpg$/);
    expect(captured.type).toBe("image/jpeg");

    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("stops a camera stream that resolves after unmount", async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    let resolveStream: ((stream: MediaStream) => void) | undefined;
    const stream = {
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveStream = resolve;
        }),
    );
    setMediaDevices({ getUserMedia } as unknown as MediaDevices);

    const { unmount } = render(<ControlledCapture />);

    await user.click(screen.getByRole("button", { name: /take photo/i }));
    unmount();
    resolveStream?.(stream);

    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
  });

  it("falls back to the native capture input when camera access stalls", async () => {
    vi.useFakeTimers();
    const getUserMedia = vi.fn(() => new Promise<MediaStream>(() => undefined));
    setMediaDevices({ getUserMedia } as unknown as MediaDevices);

    render(<ControlledCapture />);

    fireEvent.click(screen.getByRole("button", { name: /take photo/i }));
    expect(screen.getByRole("heading", { name: /starting camera/i })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(screen.getByTestId("camera-fallback-art")).toBeInTheDocument();
    expect(screen.getByText(/Snap or drop/)).toBeInTheDocument();
  });

  it("falls back to the native capture input when camera access is rejected", async () => {
    const user = userEvent.setup();
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    setMediaDevices({ getUserMedia } as unknown as MediaDevices);

    const { container } = render(<ControlledCapture />);
    const nativeCaptureInput = container.querySelector(
      'input[accept="image/*"][capture="environment"]',
    ) as HTMLInputElement;
    const clickNativeCapture = vi.spyOn(nativeCaptureInput, "click").mockImplementation(() => undefined);

    await user.click(screen.getByRole("button", { name: /take photo/i }));

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("camera-fallback-art")).toBeInTheDocument();
    expect(screen.getByText(/Snap or drop/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /take photo/i }));

    expect(clickNativeCapture).toHaveBeenCalledTimes(1);
  });
});
