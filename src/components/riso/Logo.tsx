interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 26, className = "" }: LogoProps) {
  return (
    <span
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* teal layer — calendar body with lightning bolt */}
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        style={{ position: "absolute", inset: 0, color: "var(--teal, #2A7E7B)", mixBlendMode: "multiply" }}
      >
        <rect x="22" y="32" width="76" height="74" rx="10" fill="currentColor" />
        <path d="M64 46 L50 72 L60 72 L55 92 L73 64 L63 64 Z" fill="#F3E9D2" />
      </svg>
      {/* red layer — misregistered outline + tabs */}
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        style={{
          position: "absolute",
          inset: 0,
          color: "var(--red, #F4502B)",
          mixBlendMode: "multiply",
          transform: "translate(3px, 2.5px) rotate(-2deg)",
        }}
      >
        <rect x="22" y="32" width="76" height="74" rx="10" fill="none" stroke="currentColor" strokeWidth="8" />
      </svg>
      {/* invisible spacer to hold layout */}
      <span style={{ visibility: "hidden", display: "inline-block", width: size, height: size }} />
    </span>
  );
}
