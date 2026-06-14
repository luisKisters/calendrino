import { useEffect, useRef } from "react";
import type { TranscriptChunk } from "../lib/transcript";
import { CaptureFrame } from "./riso/CaptureFrame";
import { Halftone } from "./riso/Halftone";
import { Icon } from "./riso/Icon";

interface ProcessingProps {
  previewUrl: string;
  mediaType: string;
  transcript: TranscriptChunk[];
  onCancel: () => void;
}

export function Processing({ previewUrl, mediaType, transcript, onCancel }: ProcessingProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const mediaLabel = mediaType === "application/pdf" ? "PDF" : "image";

  useEffect(() => {
    const transcriptEl = transcriptRef.current;
    if (!transcriptEl) return;
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }, [transcript]);

  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3">
      <CaptureFrame
        data-testid="riso-thumb"
        className="isolate"
        aria-label={`Processing ${mediaLabel} capture`}
      >
        <div className="absolute inset-0">
          <div
            data-testid="processing-preview"
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${previewUrl.replace(/"/g, '\\"')}")` }}
          />
          <div className="absolute inset-0 bg-ink opacity-55 [mix-blend-mode:multiply]" />
          <div className="absolute inset-0 bg-teal opacity-35 [mix-blend-mode:multiply]" />
          <Halftone className="opacity-45" />
          <div
            data-testid="riso-scan"
            className="riso-scan absolute left-0 right-0 z-10"
            style={{ height: "34%" }}
          />
        </div>

        <div className="absolute inset-x-4 top-4 z-20 flex items-center gap-2 font-display text-[15px] font-extrabold text-paper drop-shadow-[0_1px_0_var(--ink)]">
          <Icon
            name="sparkle"
            size={18}
            className="riso-spark flex-none text-yellow [mix-blend-mode:screen]"
            aria-hidden
          />
          <span data-testid="processing-label">Agent is working</span>
        </div>

        <div
          ref={transcriptRef}
          data-testid="agent-transcript"
          aria-label="Agent transcript"
          aria-busy="true"
          className="absolute inset-x-4 bottom-4 z-20 max-h-[58%] overflow-y-auto rounded-[10px] border-2 border-ink bg-paper/90 px-3 py-2 font-mono text-[11px] leading-[1.55] text-ink shadow-[0_3px_0_var(--ink)]"
        >
          {transcriptLines(transcript).map((line, index) => (
            <p key={`${index}-${line}`} className="m-0 break-words">
              {line}
            </p>
          ))}
        </div>
      </CaptureFrame>

      <div className="mt-auto flex justify-center">
        <button
          onClick={onCancel}
          className="min-h-[44px] px-4 font-mono text-[12px] text-ink-soft transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function transcriptLines(chunks: TranscriptChunk[]): string[] {
  const lines = chunks.flatMap((chunk) => {
    switch (chunk.kind) {
      case "status":
        return [`status / ${chunk.text}`];
      case "found":
        return [`found / ${chunk.text}`];
      case "done":
      case "error":
        return [];
    }
  });

  return lines.length ? lines : ["status / Preparing the capture."];
}
