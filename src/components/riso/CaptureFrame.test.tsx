import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaptureFrame } from "./CaptureFrame";

describe("CaptureFrame", () => {
  it("renders children", () => {
    const { getByText } = render(
      <CaptureFrame>
        <span>hello</span>
      </CaptureFrame>
    );
    expect(getByText("hello")).toBeTruthy();
  });

  it("applies border and bg classes", () => {
    const { container } = render(<CaptureFrame>content</CaptureFrame>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("border-ink");
    expect(div.className).toContain("bg-paper-2");
    expect(div.className).toContain("rounded-[18px]");
  });

  it("applies border-2 class", () => {
    const { container } = render(<CaptureFrame>content</CaptureFrame>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("border-2");
  });

  it("applies flex-1 and overflow-hidden", () => {
    const { container } = render(<CaptureFrame>content</CaptureFrame>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("flex-1");
    expect(div.className).toContain("overflow-hidden");
  });

  it("applies relative positioning", () => {
    const { container } = render(<CaptureFrame>content</CaptureFrame>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("relative");
  });

  it("merges extra className", () => {
    const { container } = render(
      <CaptureFrame className="extra-class">content</CaptureFrame>
    );
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("extra-class");
    expect(div.className).toContain("border-ink");
  });

  it("renders multiple children", () => {
    const { getByText } = render(
      <CaptureFrame>
        <span>first</span>
        <span>second</span>
      </CaptureFrame>
    );
    expect(getByText("first")).toBeTruthy();
    expect(getByText("second")).toBeTruthy();
  });
});
