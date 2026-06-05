import { useState, type ReactNode } from "react";
import type { CalendarEvent } from "../lib/schema";
import { formatHuman, toDateInput, toDateTimeLocalInput } from "../lib/datetime";

interface EventCardProps {
  event: CalendarEvent;
  onChange: (next: CalendarEvent) => void;
  onAdd: () => void;
  added: boolean;
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-400";

export function EventCard({ event, onChange, onAdd, added }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);

  function set<K extends keyof CalendarEvent>(key: K, value: CalendarEvent[K]) {
    onChange({ ...event, [key]: value } as CalendarEvent);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <input
        value={event.title}
        onChange={(e) => set("title", e.target.value)}
        className="w-full bg-transparent text-lg font-semibold outline-none"
        placeholder="Event title"
      />
      <p className="mt-1 text-sm text-gray-400">{formatHuman(event)}</p>

      <div className="mt-3 flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={event.allDay}
            onChange={(e) => set("allDay", e.target.checked)}
          />
          All day
        </label>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto text-xs text-indigo-400 hover:underline"
        >
          {expanded ? "Hide details" : "Edit details"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3">
          <Field label="Start">
            {event.allDay ? (
              <input
                type="date"
                value={toDateInput(event.start)}
                onChange={(e) => set("start", e.target.value)}
                className={inputCls}
              />
            ) : (
              <input
                type="datetime-local"
                value={toDateTimeLocalInput(event.start)}
                onChange={(e) => set("start", e.target.value)}
                className={inputCls}
              />
            )}
          </Field>
          <Field label="End">
            {event.allDay ? (
              <input
                type="date"
                value={event.end ? toDateInput(event.end) : ""}
                onChange={(e) => set("end", e.target.value || null)}
                className={inputCls}
              />
            ) : (
              <input
                type="datetime-local"
                value={event.end ? toDateTimeLocalInput(event.end) : ""}
                onChange={(e) => set("end", e.target.value || null)}
                className={inputCls}
              />
            )}
          </Field>
          <Field label="Location">
            <input
              value={event.location ?? ""}
              onChange={(e) => set("location", e.target.value || null)}
              className={inputCls}
              placeholder="Optional"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={event.description ?? ""}
              onChange={(e) => set("description", e.target.value || null)}
              className={`${inputCls} min-h-16 resize-y`}
              placeholder="Optional"
            />
          </Field>
        </div>
      )}

      <button
        onClick={onAdd}
        className={
          "mt-4 w-full rounded-xl px-4 py-3 font-semibold transition " +
          (added
            ? "bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
            : "bg-indigo-500 text-white hover:bg-indigo-400")
        }
      >
        {added ? "Opened ✓ — open again" : "Add to Google Calendar"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-400">
      {label}
      {children}
    </label>
  );
}
