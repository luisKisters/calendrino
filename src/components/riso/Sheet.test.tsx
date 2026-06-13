import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("renders only when open and closes from Escape or backdrop", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Sheet open={false} title="Scan note" onClose={onClose}>
        <button type="button">Inside</button>
      </Sheet>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <Sheet open title="Scan note" onClose={onClose}>
        <button type="button">Inside</button>
      </Sheet>,
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(screen.getByTestId("riso-sheet"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps toggle and link callbacks interactive inside the sheet", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onLink = vi.fn();

    render(
      <Sheet open title="Scan note" onClose={onClose}>
        <label>
          <input type="checkbox" />
          Also save to my general instructions
        </label>
        <button type="button" onClick={onLink}>
          Edit general instructions →
        </button>
      </Sheet>,
    );

    await user.click(screen.getByLabelText(/also save/i));
    expect(screen.getByLabelText(/also save/i)).toBeChecked();

    await user.click(screen.getByRole("button", { name: /edit general instructions/i }));
    expect(onLink).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("wraps focus within the panel", () => {
    render(
      <Sheet open title="Scan note" onClose={vi.fn()}>
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Sheet>,
    );

    const last = screen.getByRole("button", { name: "Last action" });
    const close = screen.getByRole("button", { name: "Close" });
    last.focus();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
    expect(close).toHaveFocus();
  });
});
