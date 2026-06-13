import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

interface SheetProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.tabIndex >= 0 && element.getAttribute("aria-hidden") !== "true",
  );
}

export function Sheet({ open, title, children, onClose }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousActive =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const [firstFocusable] = getFocusable(panel);
      (firstFocusable ?? panel).focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusable = getFocusable(panel);
    if (focusable.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      data-testid="riso-sheet"
      className="fixed inset-0 z-40 flex items-end justify-center"
      onMouseDown={(event) => {
        if (!panelRef.current?.contains(event.target as Node)) onClose();
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-ink/40 [mix-blend-mode:multiply]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        className="relative z-10 max-h-[88dvh] w-full max-w-md translate-y-0 overflow-y-auto rounded-t-[18px] border-x-2 border-t-2 border-ink bg-paper px-5 pb-[calc(var(--safe-bottom)+1rem)] pt-4 shadow-[0_-7px_0_rgba(35,32,28,0.12)] transition-transform duration-200 ease-[var(--ease-riso)] motion-reduce:transform-none motion-reduce:transition-none"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            id={titleId}
            className="font-display text-[18px] font-extrabold leading-tight text-ink"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded px-2 text-[12px] font-bold text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
