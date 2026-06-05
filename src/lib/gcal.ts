import type { CalendarEvent } from "./schema";
import { addDays, addMinutes, deviceTimeZone, gcalDate, gcalDateTime, parseLocal } from "./datetime";

const RENDER_BASE = "https://calendar.google.com/calendar/render";

/**
 * Build a Google Calendar "create event" URL that opens a PRE-FILLED form.
 * Cross-platform; on mobile this deep-links into the Google Calendar app.
 * Note: this does not silently create the event and cannot choose the target
 * calendar (that needs the Calendar API + OAuth, intentionally out of scope).
 */
export function buildGCalUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", ev.title || "Untitled event");

  if (ev.allDay) {
    const start = parseLocal(ev.start);
    // Google's all-day end date is EXCLUSIVE -> one day past the last day.
    const endExclusive = ev.end ? addDays(parseLocal(ev.end), 1) : addDays(start, 1);
    params.set("dates", `${gcalDate(start)}/${gcalDate(endExclusive)}`);
  } else {
    const start = parseLocal(ev.start);
    const end = ev.end ? parseLocal(ev.end) : addMinutes(start, 60);
    params.set("dates", `${gcalDateTime(start)}/${gcalDateTime(end)}`);
    const tz = ev.timezone || deviceTimeZone();
    if (tz) params.set("ctz", tz);
  }

  if (ev.location) params.set("location", ev.location);
  if (ev.description) params.set("details", ev.description);

  return `${RENDER_BASE}?${params.toString()}`;
}
