import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { cn } from "../lib/cn";
import { EASE } from "../lib/animation";

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const triggerBase =
  "w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-4 py-2.5 text-sm text-neutral-950 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10";

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.015, delayChildren: 0.02 } },
};

const optionVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE } },
};

const CHECK_ICON = (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    className="h-4 w-4"
  >
    <path
      fillRule="evenodd"
      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
      clipRule="evenodd"
    />
  </svg>
);

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchable = false,
  searchPlaceholder = "Search…",
  emptyMessage = "No results found.",
  disabled = false,
  ariaLabel,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(-1);
  const [placement, setPlacement] = useState<"down" | "left" | "right">("down");
  const [panelMaxH, setPanelMaxH] = useState<number | undefined>(undefined);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  // Decide where the panel can open without leaving the nearest clipping
  // container (marked with `data-dropdown-bound`; falls back to the viewport).
  // Defaults to below the field; when there isn't enough room below, the panel
  // slides in beside the field (right or left) and clamps its height.
  function openDropdown() {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const holder = containerRef.current?.closest("[data-dropdown-bound]");
    const bounds = holder
      ? holder.getBoundingClientRect()
      : {
          top: 0,
          left: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
        };

    const searchH = searchable ? 62 : 0;
    const panelEst = Math.min(Math.max(options.length, 1) * 36 + 4, 256) + searchH;
    const width = triggerRect.width;

    const spaceBelow = bounds.bottom - triggerRect.bottom - 8;
    const spaceRight = bounds.right - triggerRect.right - 8;
    const spaceLeft = triggerRect.left - bounds.left - 8;

    let next: "down" | "left" | "right" = "down";
    let nextMaxH: number | undefined;

    if (spaceBelow >= panelEst) {
      next = "down";
    } else {
      // Not enough room below — slide in beside the input instead. Prefer the
      // side that fits; otherwise the roomier one.
      next =
        spaceRight >= width && spaceRight >= spaceLeft
          ? "right"
          : spaceLeft >= width
            ? "left"
            : spaceRight >= spaceLeft
              ? "right"
              : "left";
      nextMaxH = Math.max(80, Math.round(bounds.bottom - triggerRect.top - 8));
    }

    setPlacement(next);
    setPanelMaxH(nextMaxH);
    setOpen(true);
  }

  // Reset query + highlight the current value on every open.
  useLayoutEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlighted((prev) =>
      prev >= 0
        ? Math.min(prev, Math.max(filtered.length - 1, 0))
        : Math.max(
            0,
            filtered.findIndex((o) => o.value === value),
          ),
    );
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    return () => setQuery("");
  }, [open, searchable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the highlighted option in view while navigating.
  useLayoutEffect(() => {
    if (!open || highlighted < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted]);

  // Close on outside pointer press.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  // Close on Escape (works even when focus is elsewhere in the panel).
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function selectOption(option: DropdownOption) {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerClick() {
    if (open) setOpen(false);
    else openDropdown();
  }

  function handleTriggerKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openDropdown();
    }
  }

  function handleListKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[highlighted];
      if (option) selectOption(option);
    }
  }

  function moveHighlight(value: string) {
    setQuery(value);
    setHighlighted(0);
  }

  const display = selected?.label ?? (value || placeholder);

  const panelPosition = {
    down: "inset-x-0 top-full mt-2",
    left: "right-full top-0 mr-2 w-full",
    right: "left-full top-0 ml-2 w-full",
  }[placement];

  const panelOrigin = {
    down: "top",
    left: "right",
    right: "left",
  }[placement];

  const panelInitial = {
    down: { opacity: 0, y: -6, scale: 0.98 },
    left: { opacity: 0, x: -6, scale: 0.98 },
    right: { opacity: 0, x: 6, scale: 0.98 },
  }[placement];

  const panelExit = {
    down: {
      opacity: 0,
      y: -6,
      scale: 0.98,
      transition: { duration: 0.15, ease: EASE },
    },
    left: {
      opacity: 0,
      x: -6,
      scale: 0.98,
      transition: { duration: 0.15, ease: EASE },
    },
    right: {
      opacity: 0,
      x: 6,
      scale: 0.98,
      transition: { duration: 0.15, ease: EASE },
    },
  }[placement];

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          triggerBase,
          "flex items-center justify-between gap-3 text-left",
          disabled && "cursor-not-allowed opacity-60",
          open && "border-neutral-900 bg-white ring-2 ring-neutral-900/10",
          className,
        )}
      >
        <span
          className={cn(
            "truncate",
            !selected && "text-neutral-500",
          )}
        >
          {display}
        </span>

        <motion.svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden="true"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="h-4 w-4 shrink-0 text-neutral-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m5 7.5 5 5 5-5"
          />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={panelInitial}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={panelExit}
            transition={{ duration: 0.18, ease: EASE }}
            style={{ transformOrigin: panelOrigin }}
            className={cn(
              "absolute z-30 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/10",
              panelPosition,
            )}
          >
            {searchable && (
              <div className="border-b border-neutral-100 p-2">
                <input
                  ref={searchRef}
                  type="text"
                  autoComplete="off"
                  role="searchbox"
                  aria-label={searchPlaceholder}
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => moveHighlight(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-950 outline-none transition-all placeholder:text-neutral-500 focus:border-neutral-900 focus:bg-white"
                />
              </div>
            )}

            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              onKeyDown={handleListKeyDown}
              style={panelMaxH ? { maxHeight: panelMaxH } : undefined}
              className="max-h-64 overflow-y-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {filtered.length === 0 ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, ease: EASE }}
                  className="px-3 py-6 text-center text-sm text-neutral-500"
                >
                  {emptyMessage}
                </motion.p>
              ) : (
                <motion.div
                  variants={listVariants}
                  initial="hidden"
                  animate="show"
                  className="flex flex-col"
                >
                  {filtered.map((option, index) => {
                    const isSelected = option.value === value;
                    const isHighlighted = index === highlighted;
                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        variants={optionVariants}
                        role="option"
                        aria-selected={isSelected}
                        data-index={index}
                        onMouseEnter={() => setHighlighted(index)}
                        onClick={() => selectOption(option)}
                        whileTap={{ scale: 0.99 }}
                        transition={{ duration: 0.15, ease: EASE }}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors",
                          isHighlighted
                            ? "bg-neutral-100 text-neutral-950"
                            : "text-neutral-700",
                        )}
                      >
                        <span className="truncate">{option.label}</span>
                        <AnimatePresence>
                          {isSelected && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              transition={{ duration: 0.15, ease: EASE }}
                              className="shrink-0"
                            >
                              {CHECK_ICON}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}