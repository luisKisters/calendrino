import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Processing } from "./Processing";

describe("Processing", () => {
  it("renders label text", () => {
    render(<Processing label="Reading your photo…" onCancel={vi.fn()} />);
    expect(screen.getByTestId("processing-label")).toHaveTextContent("Reading your photo…");
  });

  it("renders riso skeleton rows", () => {
    render(<Processing label="Reading your photo…" onCancel={vi.fn()} />);
    const skels = screen.getAllByTestId("riso-skel");
    expect(skels).toHaveLength(4);
  });

  it("renders the halftone thumbnail", () => {
    render(<Processing label="Reading your photo…" onCancel={vi.fn()} />);
    expect(screen.getByTestId("riso-thumb")).toBeInTheDocument();
  });

  it("renders the scan sweep element", () => {
    render(<Processing label="Reading your photo…" onCancel={vi.fn()} />);
    expect(screen.getByTestId("riso-scan")).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Processing label="Reading your photo…" onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("Cancel button has sufficient touch target (min-h-44px class)", () => {
    render(<Processing label="Reading your photo…" onCancel={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Cancel" });
    expect(btn.className).toContain("min-h-[44px]");
  });

  it("skeleton container has aria-busy", () => {
    render(<Processing label="Reading your photo…" onCancel={vi.fn()} />);
    const busy = screen.getByLabelText("Extracting event data");
    expect(busy).toHaveAttribute("aria-busy", "true");
  });
});
