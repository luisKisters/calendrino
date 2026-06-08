import { useState, type ReactNode } from "react";
import type { CalendarEvent } from "../lib/schema";
import { parseLocal, toDateInput, toDateTimeLocalInput } from "../lib/datetime";
import { Icon } from "./riso/Icon";
import { RisoButton } from "./riso/RisoButton";

interface EventCardProps {
  event: CalendarEvent;
  onChange: (next: CalendarEvent) => void;
  onAdd: () => void;
  added: boolean;
}

const editInputCls =
  "w-full rounded-[9px] border-2 border-ink bg-paper-2 px-[11px] py-[10px] text-[13.5px] font-semibold text-ink outline-none focus:border-teal";

export function EventCard({ event, onChange, onAdd, added }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);

  function set<K extends keyof CalendarEvent>(key: K, value: CalendarEvent[K]) {
    onChange({ ...event, [key]: value } as CalendarEvent);
  }

  const startDate = parseLocal(event.start);
  const dateStr = startDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = startDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      data-testid="riso-event-card"
      className="flex flex-col gap-3 rounded-[14px] border-2 border-ink bg-paper-2 p-4"
    >
      {/* Editable title field */}
      <RisoFieldWrap label="Title" icon="title">
        <input
          value={event.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Event title"
          aria-label="Event title"
          className="flex-1 bg-transparent text-[13.5px] font-semibold text-ink outline-none placeholder:text-ink-soft"
        />
        <span className="flex-none text-ink-soft" aria-hidden="true">
          <Icon name="edit" size={14} aria-hidden />
        </span>
      </RisoFieldWrap>

      {/* Date / Time row */}
      <div className="flex gap-[10px]">
        <div className="flex-1">
          <RisoFieldWrap label="Date" icon="calendar">
            <span className="flex-1 text-[13.5px] font-semibold text-ink">{dateStr}</span>
          </RisoFieldWrap>
        </div>
        {!event.allDay && (
          <div className="flex-1">
            <RisoFieldWrap label="Time" icon="clock">
              <span className="flex-1 text-[13.5px] font-semibold text-ink">{timeStr}</span>
            </RisoFieldWrap>
          </div>
        )}
      </div>

      {/* Location field */}
      {event.location && (
        <RisoFieldWrap label="Location" icon="pin">
          <span className="flex-1 text-[13.5px] font-semibold text-ink">{event.location}</span>
          <span className="flex-none text-ink-soft" aria-hidden="true">
            <Icon name="edit" size={14} aria-hidden />
          </span>
        </RisoFieldWrap>
      )}

      {/* All-day toggle + edit details */}
      <div className="flex items-center gap-3">
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-soft">
          <input
            type="checkbox"
            checked={event.allDay}
            onChange={(e) => set("allDay", e.target.checked)}
            className="h-4 w-4 accent-teal"
          />
          All day
        </label>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto min-h-[44px] font-mono text-[9.5px] uppercase tracking-[0.1em] text-teal transition hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-1"
        >
          {expanded ? "Hide details" : "Edit details"}
        </button>
      </div>

      {/* Expanded edit fields */}
      {expanded && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex gap-[10px]">
            <EditField label="Start" className="flex-1">
              {event.allDay ? (
                <input
                  type="date"
                  value={toDateInput(event.start)}
                  onChange={(e) => set("start", e.target.value)}
                  aria-label="Start date"
                  className={editInputCls}
                />
              ) : (
                <input
                  type="datetime-local"
                  value={toDateTimeLocalInput(event.start)}
                  onChange={(e) => set("start", e.target.value)}
                  aria-label="Start date and time"
                  className={editInputCls}
                />
              )}
            </EditField>
            <EditField label="End" className="flex-1">
              {event.allDay ? (
                <input
                  type="date"
                  value={event.end ? toDateInput(event.end) : ""}
                  onChange={(e) => set("end", e.target.value || null)}
                  aria-label="End date"
                  className={editInputCls}
                />
              ) : (
                <input
                  type="datetime-local"
                  value={event.end ? toDateTimeLocalInput(event.end) : ""}
                  onChange={(e) => set("end", e.target.value || null)}
                  aria-label="End date and time"
                  className={editInputCls}
                />
              )}
            </EditField>
          </div>
          <EditField label="Location">
            <input
              value={event.location ?? ""}
              onChange={(e) => set("location", e.target.value || null)}
              aria-label="Location"
              className={editInputCls}
              placeholder="Optional"
            />
          </EditField>
          <EditField label="Notes">
            <textarea
              value={event.description ?? ""}
              onChange={(e) => set("description", e.target.value || null)}
              aria-label="Notes"
              className={`${editInputCls} min-h-16 resize-y`}
              placeholder="Optional"
            />
          </EditField>
        </div>
      )}

      {/* Add to Google Calendar */}
      <RisoButton
        onClick={onAdd}
        variant={added ? "secondary" : "primary"}
        className="w-full"
      >
        <Icon name="calendar-check" size={18} aria-hidden />
        {added ? "Opened — open again" : "Add to Google Calendar"}
      </RisoButton>
    </div>
  );
}

function RisoFieldWrap({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: "calendar" | "clock" | "pin" | "title";
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[5px]">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-soft">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-[11px] border-2 border-ink bg-paper-2 px-[11px] py-[10px]">
        {icon && (
          <span className="flex-none text-teal">
            <Icon name={icon} size={15} aria-hidden />
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

function EditField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-[5px] ${className}`}>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-soft">
        {label}
      </span>
      {children}
    </div>
  );
}
