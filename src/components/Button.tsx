import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import type { HTMLMotionProps } from "framer-motion";

import { cn } from "../lib/cn";
import { EASE } from "../lib/animation";
import { ButtonSpinner } from "./ui/Spinner";
import type { SpinnerSize } from "./ui/Spinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "link";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<
  HTMLMotionProps<"button">,
  "children" | "onClick"
> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  href?: string;
  onClick?: (
    e: MouseEvent<HTMLButtonElement | HTMLAnchorElement>,
  ) => void | Promise<unknown>;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-neutral-950 text-white shadow-sm hover:bg-neutral-800 disabled:bg-neutral-900 disabled:opacity-80",
  secondary:
    "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400",
  outline:
    "border border-neutral-300 bg-white text-neutral-900 shadow-sm hover:border-neutral-900 hover:bg-neutral-50 disabled:border-neutral-200 disabled:text-neutral-400",
  ghost:
    "text-neutral-800 hover:bg-neutral-100 hover:text-neutral-950 disabled:text-neutral-400",
  link: "bg-transparent border-0 p-0 font-semibold text-neutral-950 underline underline-offset-4 decoration-neutral-400 hover:decoration-neutral-950 shadow-none hover:text-neutral-800 disabled:text-neutral-400",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-base rounded-2xl gap-2.5",
};

const spinnerSizeMap: Record<ButtonSize, SpinnerSize> = {
  sm: "sm",
  md: "md",
  lg: "lg",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  icon,
  className,
  href,
  onClick,
  type = "button",
  whileHover,
  whileTap,
  ...props
}: ButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = loading ?? internalLoading;
  const isInteractive = !disabled && !isLoading;

  const handleClick = async (
    e: MouseEvent<HTMLButtonElement | HTMLAnchorElement>,
  ) => {
    if (isLoading || disabled) {
      e.preventDefault();
      return;
    }

    // Show spinner immediately before browser navigates away
    if (href) setInternalLoading(true);

    if (onClick) {
      const result = onClick(e);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        try {
          setInternalLoading(true);
          await result;
        } finally {
          setInternalLoading(false);
        }
      }
    }
  };

  const isLink = variant === "link";

  const baseClasses = isLink
    ? "relative inline-flex items-center justify-center font-medium transition-colors"
    : cn(
        "relative inline-flex items-center justify-center font-medium transition-colors overflow-hidden select-none",
        sizeClasses[size],
      );

  const classes = cn(
    baseClasses,
    variantClasses[variant],
    disabled || isLoading ? "cursor-not-allowed" : "cursor-pointer",
    className,
  );

  const defaultWhileHover = isInteractive
    ? { scale: isLink ? 1.03 : 1.02 }
    : undefined;
  const defaultWhileTap = isInteractive
    ? { scale: isLink ? 0.97 : 0.98 }
    : undefined;

  const content = (
    <>
      <motion.span
        animate={{
          opacity: isLoading ? 0 : 1,
          y: isLoading ? -12 : 0,
          scale: isLoading ? 0.9 : 1,
        }}
        transition={{ duration: 0.2, ease: EASE }}
        className="flex items-center justify-center gap-2"
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </motion.span>

      <AnimatePresence>
        {isLoading && <ButtonSpinner size={spinnerSizeMap[size]} />}
      </AnimatePresence>
    </>
  );

  if (href) {
    return (
      <motion.a
        href={href}
        onClick={handleClick}
        whileHover={whileHover ?? defaultWhileHover}
        whileTap={whileTap ?? defaultWhileTap}
        transition={{ duration: 0.15, ease: EASE }}
        className={classes}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      type={type}
      disabled={disabled || isLoading}
      onClick={handleClick}
      whileHover={whileHover ?? defaultWhileHover}
      whileTap={whileTap ?? defaultWhileTap}
      transition={{ duration: 0.15, ease: EASE }}
      className={classes}
      {...props}
    >
      {content}
    </motion.button>
  );
}
