import { Icon } from "./riso/Icon";
import { RisoButton } from "./riso/RisoButton";

interface ErrorViewProps {
  message: string;
  detail?: string;
  onRetry?: () => void;
  onSettings?: () => void;
}

export function ErrorView({ message, detail, onRetry, onSettings }: ErrorViewProps) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center"
      data-testid="riso-error"
    >
      {/* Warning icon — red, riso style */}
      <div
        className="flex items-center justify-center rounded-full border-2 border-ink"
        style={{ width: 64, height: 64, color: "var(--red)" }}
        aria-hidden="true"
      >
        <Icon name="warning" size={30} aria-hidden />
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-display text-[18px] font-extrabold leading-snug text-ink">{message}</p>
        {detail && (
          <p className="max-w-xs break-words font-mono text-[12px] leading-relaxed text-ink-soft">
            {detail}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-[240px]">
        {onRetry && (
          <RisoButton variant="danger" onClick={onRetry} className="w-full">
            <Icon name="arrow-left" size={16} aria-hidden />
            Try again
          </RisoButton>
        )}
        {onSettings && (
          <RisoButton variant="secondary" onClick={onSettings} className="w-full">
            <Icon name="gear" size={16} aria-hidden />
            Open settings
          </RisoButton>
        )}
      </div>
    </div>
  );
}
