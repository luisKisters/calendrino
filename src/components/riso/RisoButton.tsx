import type { ReactNode, ButtonHTMLAttributes } from "react";

interface RisoButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  children: ReactNode;
}

export function RisoButton({
  variant = "primary",
  children,
  className = "",
  ...rest
}: RisoButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[14px] border-2 border-ink px-4 py-[14px] font-display text-[14.5px] font-extrabold leading-none min-h-[44px] cursor-pointer transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40";

  const variants: Record<string, string> = {
    primary: "bg-teal text-paper [mix-blend-mode:multiply]",
    secondary: "bg-paper text-ink",
    danger: "bg-red text-paper [mix-blend-mode:multiply]",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
