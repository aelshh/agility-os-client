import type { ComponentType } from "react";
import { cn } from "../../lib/cn";

export type TabItem = {
  id: string;
  label: string;
  count?: number;
  icon?: ComponentType<{ className?: string; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone" }>;
};

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ items, active, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex w-full flex-wrap gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === active;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150",
              selected
                ? "bg-neutral-900 text-white shadow-xs"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-105",
                  selected ? "text-white" : "text-neutral-400 group-hover:text-neutral-700",
                )}
                weight={selected ? "fill" : "duotone"}
              />
            )}
            <span>{item.label}</span>
            {typeof item.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-xs font-semibold tabular-nums",
                  selected
                    ? "bg-white/20 text-white"
                    : "bg-neutral-100 text-neutral-600 group-hover:bg-neutral-200/80",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}