import type { ReactNode } from "react";

interface CaptureFrameProps {
  children: ReactNode;
  className?: string;
}

export function CaptureFrame({ children, className = "" }: CaptureFrameProps) {
  return (
    <div
      className={[
        "flex-1 overflow-hidden rounded-[18px] border-2 border-ink bg-paper-2 relative",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
