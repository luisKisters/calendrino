import type { CalendarEvent } from "../lib/schema";
import { parseLocal } from "../lib/datetime";
import { Stamp } from "./riso/Stamp";
import { RisoButton } from "./riso/RisoButton";
import { Icon } from "./riso/Icon";

interface SuccessProps {
  event: CalendarEvent;
  onRestart: () => void;
}

export function Success({ event, onRestart }: SuccessProps) {
  const startDate = parseLocal(event.start);
  const dateStr = startDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = event.allDay
    ? "All day"
    : startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-8 text-center">
      <Stamp size={120} />

      <div>
        <h2 className="font-display text-[22px] font-extrabold leading-tight text-ink">
          Added to calendar
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-ink-soft">
          Your event is ready in Google Calendar
        </p>
      </div>

      <div
        data-testid="success-ticket"
        className="w-full max-w-[340px] overflow-hidden rounded-[14px] border-2 border-ink bg-paper-2"
      >
        <div
          aria-hidden="true"
          className="h-3 border-b-2 border-dashed border-line"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--color-paper, #F3E9D2) 5px, transparent 5px)",
            backgroundSize: "16px 100%",
            backgroundRepeat: "repeat-x",
            backgroundPosition: "8px center",
          }}
        />

        <div className="flex flex-col gap-2 px-5 py-4 text-left">
          <p className="font-display text-[15px] font-bold text-ink">{event.title}</p>
          <div className="flex flex-wrap gap-4">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">
              <Icon name="calendar" size={12} aria-hidden />
              {dateStr}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">
              <Icon name="clock" size={12} aria-hidden />
              {timeStr}
            </span>
          </div>
          {event.location && (
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">
              <Icon name="pin" size={12} aria-hidden />
              {event.location}
            </span>
          )}
        </div>

        <div
          aria-hidden="true"
          className="h-3 border-t-2 border-dashed border-line"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--color-paper, #F3E9D2) 5px, transparent 5px)",
            backgroundSize: "16px 100%",
            backgroundRepeat: "repeat-x",
            backgroundPosition: "8px center",
          }}
        />
      </div>

      <RisoButton variant="secondary" onClick={onRestart} className="w-full max-w-[340px]">
        <Icon name="camera" size={16} aria-hidden />
        Capture another
      </RisoButton>
    </div>
  );
}
