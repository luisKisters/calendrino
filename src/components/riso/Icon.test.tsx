import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders an svg element", () => {
    const { container } = render(<Icon name="camera" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.tagName.toLowerCase()).toBe("svg");
  });

  it("is aria-hidden when no aria-label is provided", () => {
    const { container } = render(<Icon name="gear" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("exposes accessible name via aria-label", () => {
    render(<Icon name="shield" aria-label="Privacy shield" />);
    expect(screen.getByRole("img", { name: "Privacy shield" })).toBeInTheDocument();
  });

  it("is aria-hidden when aria-hidden prop is explicitly set", () => {
    const { container } = render(<Icon name="check" aria-hidden={true} aria-label="Check" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("respects the size prop", () => {
    const { container } = render(<Icon name="clock" size={32} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
  });

  it("applies className prop", () => {
    const { container } = render(<Icon name="sparkle" className="text-red" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("text-red");
  });

  it("gear renders an svg with a circle and path child elements", () => {
    const { container } = render(<Icon name="gear" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.querySelector("circle")).not.toBeNull();
    expect(svg?.querySelector("path")).not.toBeNull();
  });

  it("renders all icon variants without throwing", () => {
    const icons = [
      "camera", "upload", "calendar", "calendar-check", "clock",
      "pin", "gear", "check", "sparkle", "shield", "mic",
      "arrow-left", "edit", "warning", "title",
    ] as const;

    for (const name of icons) {
      const { container } = render(<Icon name={name} />);
      expect(container.querySelector("svg")).not.toBeNull();
    }
  });
});
