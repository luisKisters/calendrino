import { z } from "zod";
import { EventSchema } from "./schema.js";

export const TranscriptChunkSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("status"), text: z.string() }),
  z.object({ kind: z.literal("found"), text: z.string() }),
  z.object({ kind: z.literal("done"), events: z.array(EventSchema) }),
  z.object({ kind: z.literal("error"), message: z.string() }),
]);

export type TranscriptChunk = z.infer<typeof TranscriptChunkSchema>;

export function parseTranscriptChunk(value: unknown): TranscriptChunk {
  return TranscriptChunkSchema.parse(value);
}
