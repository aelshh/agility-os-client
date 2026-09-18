import { AnimatePresence, motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";

import { cn } from "../lib/cn";
import { useAppStore } from "../store/app.store";

function Spinner() {
  return (
    <motion.svg
      className="h-4 w-4 text-neutral-700"
      viewBox="0 0 16 16"
      fill="none"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
      aria-hidden
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

/**
 * Loading indicator shown while the router is resolving a navigation
 * (triggered the moment a nav link is clicked). Rendered inside the
 * AppShell content column so it only covers the page, never the sidebar.
 */
export function RouteLoadingOverlay() {
  const loading = useRouterState({
    select: (s) => s.status === "pending",
  });
  const { sidebarCollapsed } = useAppStore();
  const expanded = !sidebarCollapsed;

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="route-loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "fixed inset-y-0 right-0 left-0 z-50 flex items-center justify-center bg-neutral-50/70 backdrop-blur-sm",
            expanded ? "md:left-64" : "md:left-16",
          )}
        >
          <span className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-neutral-700">
            <Spinner />
            Loading&hellip;
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}