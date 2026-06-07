interface StampProps {
  size?: number;
  className?: string;
}

export function Stamp({ size = 108, className = "" }: StampProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`[filter:url(#rough)] [mix-blend-mode:multiply] [-rotate-8] ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="50" fill="none" stroke="#F4502B" strokeWidth="6" />
      <path
        d="M37 62 L53 79 L85 41"
        fill="none"
        stroke="#F4502B"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MiniStamp({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="#2A7E7B"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`[filter:url(#rough)] [mix-blend-mode:multiply] [-rotate-6] ${className}`}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}
