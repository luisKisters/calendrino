import { z } from "zod";
import { zAiProviderId } from "./aiProviders.js";
import { EventSchema, type CalendarEvent } from "./schema.js";
import type { NowContext } from "./datetime.js";

export const ExtractRequestPayloadSchema = z.object({
  mediaBase64: z.string().min(1),
  mediaType: z.string().min(1),
  provider: zAiProviderId,
  apiKey: z.string().min(1),
  model: z.string().optional(),
  instructions: z.string().optional(),
  now: z.object({
    isoDate: z.string(),
    weekday: z.string(),
    tz: z.string(),
  }),
});

export const ExtractResponsePayloadSchema = z.object({
  events: z.array(EventSchema),
});

export interface ExtractRequestPayload {
  mediaBase64: string;
  mediaType: string;
  provider: z.infer<typeof zAiProviderId>;
  apiKey: string;
  model?: string;
  instructions?: string;
  now: NowContext;
}

export interface ExtractResponsePayload {
  events: CalendarEvent[];
}
