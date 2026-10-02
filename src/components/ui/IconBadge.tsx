import type { ElementType, ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn";

export type IconBadgeVariant =
  | "emerald"
  | "indigo"
  | "purple"
  | "blue"
  | "amber"
  | "teal"
  | "sky"
  | "rose"
  | "violet"
  | "slate"
  | "neutral";

export type IconBadgeSize = "xs" | "sm" | "md" | "lg" | "xl";
export type IconBadgeShape = "squircle" | "rounded" | "circle";

const VARIANT_STYLES: Record<
  IconBadgeVariant,
  { container: string; icon: string; ring: string }
> = {
  emerald: {
    container: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/20",
  },
  indigo: {
    container: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
    icon: "text-indigo-600 dark:text-indigo-400",
    ring: "ring-indigo-500/20",
  },
  purple: {
    container: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    icon: "text-purple-600 dark:text-purple-400",
    ring: "ring-purple-500/20",
  },
  blue: {
    container: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    icon: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/20",
  },
  amber: {
    container: "bg-amber-500/10 text-amber-800 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/20",
  },
  teal: {
    container: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
    icon: "text-teal-600 dark:text-teal-400",
    ring: "ring-teal-500/20",
  },
  sky: {
    container: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    icon: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/20",
  },
  rose: {
    container: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    icon: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/20",
  },
  violet: {
    container: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    icon: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/20",
  },
  slate: {
    container: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    icon: "text-slate-600 dark:text-slate-300",
    ring: "ring-slate-500/20",
  },
  neutral: {
    container: "bg-neutral-900/[0.06] text-neutral-800 dark:text-neutral-200",
    icon: "text-neutral-700 dark:text-neutral-300",
    ring: "ring-neutral-900/10",
  },
};

const SIZE_STYLES: Record<
  IconBadgeSize,
  { container: string; icon: string }
> = {
  xs: {
    container: "h-6 w-6",
    icon: "h-3.5 w-3.5",
  },
  sm: {
    container: "h-8 w-8",
    icon: "h-4 w-4",
  },
  md: {
    container: "h-10 w-10",
    icon: "h-5 w-5",
  },
  lg: {
    container: "h-12 w-12",
    icon: "h-6 w-6",
  },
  xl: {
    container: "h-14 w-14",
    icon: "h-7 w-7",
  },
};

const SHAPE_STYLES: Record<IconBadgeShape, string> = {
  squircle: "rounded-xl",
  rounded: "rounded-2xl",
  circle: "rounded-full",
};

export interface IconBadgeProps extends ComponentPropsWithoutRef<"div"> {
  icon: ElementType;
  variant?: IconBadgeVariant;
  size?: IconBadgeSize;
  shape?: IconBadgeShape;
  weight?: "duotone" | "bold" | "fill" | "regular" | "light" | "thin";
  interactive?: boolean;
  iconClassName?: string;
}

export function IconBadge({
  icon: IconComponent,
  variant = "indigo",
  size = "md",
  shape = "squircle",
  weight = "duotone",
  interactive = false,
  className,
  iconClassName,
  ...rest
}: IconBadgeProps) {
  const variantStyle = VARIANT_STYLES[variant] ?? VARIANT_STYLES.indigo;
  const sizeStyle = SIZE_STYLES[size] ?? SIZE_STYLES.md;
  const shapeStyle = SHAPE_STYLES[shape] ?? SHAPE_STYLES.squircle;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center ring-1 ring-inset transition-all",
        sizeStyle.container,
        shapeStyle,
        variantStyle.container,
        variantStyle.ring,
        interactive &&
          "cursor-pointer hover:scale-105 hover:shadow-xs active:scale-95",
        className,
      )}
      {...rest}
    >
      <IconComponent
        weight={weight}
        className={cn(sizeStyle.icon, variantStyle.icon, iconClassName)}
        aria-hidden="true"
      />
    </div>
  );
}
