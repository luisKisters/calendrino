export interface NowContext {
  isoDate: string; // e.g. 2026-06-05
  weekday: string; // e.g. Friday
  tz: string; // IANA timezone
}

const pad = (n: number) => String(n).padStart(2, "0");

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function nowContext(): NowContext {
  const d = new Date();
  const isoDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  return { isoDate, weekday, tz: deviceTimeZone() };
}

/**
 * Parse a local wall-clock ISO string ("YYYY-MM-DD" or "YYYY-MM-DDTHH:MM[:SS]")
 * into a Date in the LOCAL timezone, avoiding JS's "date-only is parsed as UTC" pitfall.
 */
export function parseLocal(s: string): Date {
  const [datePart, timePartRaw] = s.split("T");
  const [y, m, d] = datePart.split("-").map((x) => parseInt(x, 10));
  let hh = 0;
  let mm = 0;
  let ss = 0;
  if (timePartRaw) {
    const t = timePartRaw.replace("Z", "").split(":");
    hh = parseInt(t[0] ?? "0", 10) || 0;
    mm = parseInt(t[1] ?? "0", 10) || 0;
    ss = parseInt((t[2] ?? "0").slice(0, 2), 10) || 0;
  }
  return new Date(y, (m || 1) - 1, d || 1, hh, mm, ss);
}

/** Google Calendar local datetime: YYYYMMDDTHHMMSS (no Z). */
export function gcalDateTime(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/** Google Calendar all-day date: YYYYMMDD. */
export function gcalDate(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** Value for an <input type="datetime-local">. */
export function toDateTimeLocalInput(s: string): string {
  const d = parseLocal(s);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Value for an <input type="date">. */
export function toDateInput(s: string): string {
  const d = parseLocal(s);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Human-friendly one-line summary for a card. */
export function formatHuman(ev: { start: string; end: string | null; allDay: boolean }): string {
  const s = parseLocal(ev.start);
  if (ev.allDay) {
    return s.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  const dateStr = s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const timeStr = s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  let out = `${dateStr} · ${timeStr}`;
  if (ev.end) {
    const e = parseLocal(ev.end);
    out += `–${e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  return out;
}
