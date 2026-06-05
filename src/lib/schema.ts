import { z } from "zod";

/** A single calendar event extracted from a capture. */
export const EventSchema = z.object({
  title: z.string().describe("Concise event title"),
  /**
   * Local wall-clock ISO 8601 with NO timezone suffix, e.g. "2026-06-12T19:30:00".
   * For all-day events this may be a date only, e.g. "2026-06-12".
   */
  start: z.string().describe("ISO 8601 local start (no Z / no offset)"),
  /** Local end; null means unknown -> default to start +1h (timed) or +1 day (all-day). */
  end: z.string().nullable().describe("ISO 8601 local end, or null"),
  allDay: z.boolean().describe("True for date-only events with no specific time"),
  location: z.string().nullable().describe("Location, or null"),
  description: z.string().nullable().describe("Extra details / notes, or null"),
  /** IANA tz only if the source explicitly implies one (flight, webinar); else null -> device tz. */
  timezone: z.string().nullable().describe("IANA timezone e.g. Europe/Berlin, or null"),
  confidence: z.number().min(0).max(1).describe("0..1 confidence this is a real event"),
});

export const EventsSchema = z.object({
  events: z.array(EventSchema),
});

/** Named CalendarEvent to avoid clashing with the global DOM `Event` type. */
export type CalendarEvent = z.infer<typeof EventSchema>;
