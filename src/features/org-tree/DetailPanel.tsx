import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { EASE } from "../../lib/animation";

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Right-side slide-in drawer for org tree node details.
 * Fixed to the right viewport edge, overlays the page. No backdrop —
 * the canvas stays interactive so clicking other nodes switches content.
 * Closes on Escape or the X button.
 */
export function DetailPanel({
  open,
  onClose,
  title,
  subtitle,
  children,
}: DetailPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label={title}
          initial={{ x: 480, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 480, opacity: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="fixed bottom-4 right-4 top-4 z-30 flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-neutral-900/10"
        >
          <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-serif text-base font-medium text-neutral-950">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="Close panel"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 5 5 15M5 5l10 10" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
