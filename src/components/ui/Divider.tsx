interface DividerProps {
  label?: string;
}

/** Horizontal "or" divider used between auth options */
export function Divider({ label = "or" }: DividerProps) {
  return (
    <div
      className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wider text-neutral-500"
      role="separator"
      aria-label={label}
    >
      <span className="h-px flex-1 bg-neutral-200" aria-hidden="true" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-neutral-200" aria-hidden="true" />
    </div>
  );
}
