import { useState } from "react";
import type { CalendarEvent } from "../lib/schema";
import { EventCard } from "./EventCard";
import { RisoButton } from "./riso/RisoButton";
import { Icon } from "./riso/Icon";

interface ReviewProps {
  events: CalendarEvent[];
  onAdd: (event: CalendarEvent) => void;
  onRestart: () => void;
}

export function Review({ events, onAdd, onRestart }: ReviewProps) {
  const [list, setList] = useState<CalendarEvent[]>(events);
  const [added, setAdded] = useState<Record<number, boolean>>({});

  function update(i: number, next: CalendarEvent) {
    setList((prev) => prev.map((e, idx) => (idx === i ? next : e)));
  }

  function handleAdd(i: number) {
    onAdd(list[i]);
    setAdded((prev) => ({ ...prev, [i]: true }));
  }

  if (list.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        {/* No-events illustration */}
        <svg
          viewBox="0 0 80 80"
          width="80"
          height="80"
          aria-hidden="true"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect
            x="8"
            y="14"
            width="64"
            height="54"
            rx="8"
            fill="var(--paper-2)"
            stroke="var(--ink)"
            strokeWidth="2.2"
          />
          <path d="M8 27h64" stroke="var(--ink)" strokeWidth="2.2" />
          <path d="M24 8v12M56 8v12" stroke="var(--ink)" strokeWidth="2.2" />
          <path d="M30 45h20M30 54h14" stroke="var(--line)" strokeWidth="2" />
          <circle cx="56" cy="56" r="13" fill="var(--paper)" stroke="var(--red)" strokeWidth="2.2" />
          <path d="M51 51l10 10M61 51l-10 10" stroke="var(--red)" strokeWidth="2.2" />
        </svg>

        <div>
          <p className="font-display text-[17px] font-bold text-ink">No events found</p>
          <p className="mt-1 max-w-xs text-[13px] text-ink-soft">
            Calendrino couldn&apos;t spot a date or event in that capture. Try a clearer photo or a
            different file.
          </p>
        </div>

        <RisoButton variant="secondary" onClick={onRestart}>
          <Icon name="camera" size={16} aria-hidden />
          Try again
        </RisoButton>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[17px] font-bold text-ink">
          {list.length === 1 ? "Review event" : `${list.length} events found`}
        </h2>
        <button
          onClick={onRestart}
          className="min-h-[44px] font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-soft transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-1"
        >
          New capture
        </button>
      </div>

      {/* Event cards */}
      <div className="flex flex-col gap-4">
        {list.map((ev, i) => (
          <EventCard
            key={i}
            event={ev}
            added={!!added[i]}
            onChange={(next) => update(i, next)}
            onAdd={() => handleAdd(i)}
          />
        ))}
      </div>
    </div>
  );
}
