import { Icon } from "./riso/Icon";

interface ProcessingProps {
  label: string;
  onCancel: () => void;
}

export function Processing({ label, onCancel }: ProcessingProps) {
  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-6">
      {/* Duotone halftone thumbnail with scan sweep */}
      <div
        aria-hidden="true"
        data-testid="riso-thumb"
        className="relative overflow-hidden rounded-[14px] border-2 border-ink"
        style={{ height: 150, background: "var(--paper-2)" }}
      >
        {/* Stylised flyer content: red sun + teal/ink bars */}
        <div className="absolute inset-0">
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{ top: 18, width: 54, height: 54, background: "var(--red)", mixBlendMode: "multiply" }}
          />
          <div
            className="absolute left-[18px] rounded-[3px]"
            style={{ bottom: 46, width: "64%", height: 9, background: "var(--teal)", mixBlendMode: "multiply" }}
          />
          <div
            className="absolute left-[18px] rounded-[3px]"
            style={{ bottom: 30, width: "42%", height: 9, background: "var(--ink)", mixBlendMode: "multiply" }}
          />
          <div
            className="absolute left-[18px] rounded-[3px]"
            style={{ bottom: 14, width: "54%", height: 9, background: "var(--teal)", mixBlendMode: "multiply" }}
          />
        </div>
        {/* Halftone dots */}
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.45,
            mixBlendMode: "multiply",
            backgroundImage: "radial-gradient(rgba(35,32,28,.5) 1px,transparent 1.5px)",
            backgroundSize: "5px 5px",
          }}
        />
        {/* Scan sweep */}
        <div
          data-testid="riso-scan"
          className="riso-scan absolute left-0 right-0"
          style={{ height: "38%" }}
        />
      </div>

      {/* Spark + label */}
      <div className="flex items-center gap-[9px] font-display font-bold" style={{ fontSize: 14, color: "var(--teal-d)" }}>
        <Icon
          name="sparkle"
          size={18}
          className="riso-spark text-red [mix-blend-mode:multiply]"
          aria-hidden
        />
        <span data-testid="processing-label">{label}</span>
      </div>

      {/* Skeleton rows */}
      <div className="flex flex-col gap-[10px]" aria-label="Extracting event data" aria-busy="true">
        {([72, 92, 58, 80] as const).map((w, i) => (
          <div
            key={i}
            data-testid="riso-skel"
            className="riso-skel relative overflow-hidden rounded-[4px] border border-line"
            style={{ height: 13, width: `${w}%`, background: "var(--paper-3)" }}
          />
        ))}
      </div>

      {/* Cancel */}
      <div className="mt-auto flex justify-center">
        <button
          onClick={onCancel}
          className="min-h-[44px] px-4 font-mono text-[12px] text-ink-soft transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
