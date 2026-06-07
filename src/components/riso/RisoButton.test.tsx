import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RisoButton } from "./RisoButton";

describe("RisoButton", () => {
  it("renders children", () => {
    render(<RisoButton>Take photo</RisoButton>);
    expect(screen.getByRole("button", { name: "Take photo" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<RisoButton onClick={onClick}>Click me</RisoButton>);
    await user.click(screen.getByRole("button", { name: "Click me" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<RisoButton disabled onClick={onClick}>Disabled</RisoButton>);
    await user.click(screen.getByRole("button", { name: "Disabled" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders as disabled when disabled prop is set", () => {
    render(<RisoButton disabled>Disabled</RisoButton>);
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
  });

  it("renders primary variant by default", () => {
    const { container } = render(<RisoButton>Primary</RisoButton>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("bg-teal");
  });

  it("renders secondary variant", () => {
    const { container } = render(<RisoButton variant="secondary">Secondary</RisoButton>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("bg-paper");
  });

  it("renders danger variant", () => {
    const { container } = render(<RisoButton variant="danger">Danger</RisoButton>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("bg-red");
  });

  it("accepts additional className", () => {
    const { container } = render(<RisoButton className="w-full">Full width</RisoButton>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("w-full");
  });

  it("passes through additional html button attributes", () => {
    render(<RisoButton type="submit" aria-label="Submit form">Submit</RisoButton>);
    const btn = screen.getByRole("button", { name: "Submit form" });
    expect(btn).toHaveAttribute("type", "submit");
  });
});
