/**
 * Lightweight className merger.
 * Filters out falsy values and joins with a space.
 * Drop-in for simple use-cases without needing clsx/tailwind-merge.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
