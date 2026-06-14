import type { HTMLAttributes, ReactNode } from "react";

interface CaptureFrameProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function CaptureFrame({ children, className = "", ...rest }: CaptureFrameProps) {
  return (
    <div
      className={[
        "flex-1 overflow-hidden rounded-[18px] border-2 border-ink bg-paper-2 relative",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
