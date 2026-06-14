import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { TranscriptChunk } from "../lib/transcript";
import { Processing } from "./Processing";

const transcript: TranscriptChunk[] = [
  { kind: "status", text: "Preparing the capture for extraction." },
  { kind: "found", text: "Found event: Board meeting" },
];

function renderProcessing(overrides: Partial<ComponentProps<typeof Processing>> = {}) {
  return render(
    <Processing
      previewUrl="blob:preview"
      mediaType="image/png"
      transcript={transcript}
      onCancel={vi.fn()}
      {...overrides}
    />,
  );
}

describe("Processing", () => {
  it("renders the agent working header", () => {
    renderProcessing();
    expect(screen.getByTestId("processing-label")).toHaveTextContent("Agent is working");
  });

  it("renders transcript lines for streamed chunks", () => {
    renderProcessing();
    const log = screen.getByTestId("agent-transcript");
    expect(log).toHaveTextContent("status / Preparing the capture for extraction.");
    expect(log).toHaveTextContent("found / Found event: Board meeting");
    expect(log).toHaveAttribute("aria-busy", "true");
  });

  it("renders the preview in the shared frame", () => {
    renderProcessing({ mediaType: "application/pdf", previewUrl: "data:image/png;base64,preview" });
    const frame = screen.getByTestId("riso-thumb");
    expect(frame.className).toContain("h-[clamp(300px,62dvh,560px)]");
    expect(frame.className).not.toContain("min-h-[360px]");
    expect(frame).toHaveClass("border-2");
    expect(frame).toHaveAccessibleName("Processing PDF capture");
    expect(screen.getByTestId("processing-preview")).toHaveStyle({
      backgroundImage: 'url("data:image/png;base64,preview")',
    });
  });

  it("renders the scan sweep element", () => {
    renderProcessing();
    expect(screen.getByTestId("riso-scan")).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderProcessing({ onCancel });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("Cancel button has sufficient touch target (min-h-44px class)", () => {
    renderProcessing();
    const btn = screen.getByRole("button", { name: "Cancel" });
    expect(btn.className).toContain("min-h-[44px]");
  });
});
