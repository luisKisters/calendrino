import { useState } from "react";
import type { CalendarEvent } from "../lib/schema";
import { EventCard } from "./EventCard";

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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-4xl">🤔</span>
        <p className="text-lg font-medium">No events found</p>
        <p className="max-w-xs text-sm text-gray-400">
          Calendrino couldn&apos;t spot a date or event in that capture. Try a
          clearer photo or a different file.
        </p>
        <button
          onClick={onRestart}
          className="mt-2 rounded-xl bg-indigo-500 px-5 py-3 font-semibold text-white hover:bg-indigo-400"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {list.length === 1 ? "Confirm event" : `${list.length} events found`}
        </h2>
        <button onClick={onRestart} className="text-sm text-gray-400 transition hover:text-white">
          New capture
        </button>
      </div>
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
