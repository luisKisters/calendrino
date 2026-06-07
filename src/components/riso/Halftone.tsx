interface HalftoneProps {
  className?: string;
}

export function Halftone({ className = "" }: HalftoneProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 opacity-50 [mix-blend-mode:multiply] ${className}`}
      style={{
        backgroundImage:
          "radial-gradient(var(--color-line, #C9BC9E) 1.1px, transparent 1.4px)",
        backgroundSize: "7px 7px",
      }}
    />
  );
}
