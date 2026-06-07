import type { ReactNode, InputHTMLAttributes } from "react";

interface RisoFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function RisoField({
  label,
  id,
  leadingIcon,
  trailingIcon,
  className = "",
  ...rest
}: RisoFieldProps) {
  return (
    <div className="flex flex-col gap-[5px]">
      <label
        htmlFor={id}
        className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-soft"
      >
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-[11px] border-2 border-ink bg-paper-2 px-[11px] py-[10px]">
        {leadingIcon && (
          <span className="flex-none text-teal">{leadingIcon}</span>
        )}
        <input
          id={id}
          className={`flex-1 bg-transparent text-[13.5px] font-semibold text-ink outline-none placeholder:text-ink-soft ${className}`}
          {...rest}
        />
        {trailingIcon && (
          <span className="flex-none text-ink-soft">{trailingIcon}</span>
        )}
      </div>
    </div>
  );
}

interface RisoStaticFieldProps {
  label: string;
  children: ReactNode;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function RisoStaticField({
  label,
  children,
  leadingIcon,
  trailingIcon,
}: RisoStaticFieldProps) {
  return (
    <div className="flex flex-col gap-[5px]">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-soft">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-[11px] border-2 border-ink bg-paper-2 px-[11px] py-[10px]">
        {leadingIcon && (
          <span className="flex-none text-teal">{leadingIcon}</span>
        )}
        <span className="flex-1 text-[13.5px] font-semibold text-ink">
          {children}
        </span>
        {trailingIcon && (
          <span className="flex-none text-ink-soft">{trailingIcon}</span>
        )}
      </div>
    </div>
  );
}
