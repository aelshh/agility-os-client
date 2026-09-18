import { Handle, Position } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import type { MouseEvent } from "react";
import { useState } from "react";

import { EASE } from "../../lib/animation";
import { cn } from "../../lib/cn";
import { ROLE_LABELS } from "./buildTreeData";
import type { OrgEmployeeNodeData } from "./buildTreeData";

export type EmployeeNodeData = OrgEmployeeNodeData;

interface EmployeeNodeProps {
  id: string;
  data: EmployeeNodeData;
  selected?: boolean;
}

const ROLE_DOT_COLORS: Record<string, string> = {
  architect: "bg-neutral-950",
  strategist: "bg-emerald-500",
  quality_gate: "bg-amber-500",
  content_curator: "bg-sky-500",
  talent_steward: "bg-violet-500",
  field_coach: "bg-orange-500",
  practitioner: "bg-neutral-400",
};

/** Lifecycle badge for the linked account (null = not shown, e.g. churned). */
function statusBadge(userStatus: string | null, hasPendingInvite: boolean) {
  if (hasPendingInvite)
    return { label: "invite sent", className: "bg-amber-100 text-amber-700" };
  if (userStatus === "active")
    return { label: "active", className: "bg-emerald-100 text-emerald-700" };
  if (userStatus === "invited")
    return { label: "needs invite", className: "bg-neutral-100 text-neutral-600" };
  return null;
}

/**
 * Custom React Flow node for an employee. Exactly fills the declared
 * 208×96 node box so no transparent wrapper ghost exists. When the
 * person manages others a chevron + click appears for one-level expansion.
 *
 * For org admins, hovering the node reveals quick actions: send/resend the
 * email invite (pending invites) and grant/remove admin access.
 */
export function EmployeeNode({ id, data, selected }: EmployeeNodeProps) {
  const {
    name,
    email,
    designation,
    department,
    role,
    isRoot,
    hasChildren,
    collapsed,
    highlighted,
    toggleCollapse,
    userStatus,
    hasPendingInvite,
    isAdmin,
    isSelf,
    viewerIsAdmin,
    onInvite,
    onToggleAdmin,
    onSelectNode,
    onPanelOpenChange,
  } = data;

  const badge = statusBadge(userStatus, hasPendingInvite);

  const canInvite =
    viewerIsAdmin && !isSelf && !!data.userId && userStatus === "invited" && !!email;
  const canToggleAdmin =
    viewerIsAdmin && !isSelf && !!data.userId && userStatus === "active";

  const [hovered, setHovered] = useState(false);

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        toggleCollapse?.(id);
        onSelectNode?.(id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleCollapse?.(id);
          onSelectNode?.(id);
        }
      }}
      onMouseEnter={() => {
        setHovered(true);
        onPanelOpenChange?.(id, true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        onPanelOpenChange?.(id, false);
      }}
      className={cn(
        "group relative flex h-24 w-52 flex-col justify-center rounded-xl border bg-white px-4 transition-colors select-none",
        hasChildren && "cursor-pointer",
        isRoot
          ? "border-neutral-900 shadow-lg shadow-neutral-900/10"
          : "border-neutral-300 hover:border-neutral-500",
        selected && "ring-2 ring-neutral-950 ring-offset-2",
        highlighted && "ring-2 ring-blue-500 ring-offset-2",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-1.5 !w-1.5 !min-h-0 !min-w-0 !rounded-full !border-0 !bg-transparent"
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1.5 !w-1.5 !min-h-0 !min-w-0 !rounded-full !border-0 !bg-transparent"
        isConnectable={false}
      />

      {/* row 1 — name + optional chevron */}
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            ROLE_DOT_COLORS[role] ?? "bg-neutral-400",
          )}
        />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-neutral-950">
          {name}
        </p>
        {hasChildren && (
          <svg
            className={cn(
              "h-3 w-3 shrink-0 text-neutral-400 transition-transform duration-200",
              !collapsed && "rotate-90",
            )}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m8 5 5 5-5 5" />
          </svg>
        )}
      </div>

      {/* row 2 — designation */}
      <p className="mt-0.5 truncate text-[11px] font-medium text-neutral-500">
        {designation || role}
      </p>

      {/* row 3 — department + role badge */}
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[10px] text-neutral-400">
          {department || "—"}
        </p>
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
            isRoot
              ? "bg-neutral-950 text-white"
              : "bg-neutral-100 text-neutral-600",
          )}
        >
          {ROLE_LABELS[role] ?? role}
        </span>
      </div>

      {/* row 4 — email + lifecycle badge */}
      {(email || badge) && (
        <div className="mt-0.5 flex items-center justify-between gap-1">
          {email && (
            <p className="min-w-0 flex-1 truncate text-[10px] text-neutral-400">
              {email}
            </p>
          )}
          {badge && (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                badge.className,
              )}
            >
              {badge.label}
            </span>
          )}
        </div>
      )}

      {/* hover actions (admins only) — float to the left of the card */}
      <AnimatePresence>
        {hovered && (canInvite || canToggleAdmin) && (
          <motion.div
            initial={{ opacity: 0, x: 6, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE }}
            style={{ transformOrigin: "left" }}
            className="absolute left-full top-0 z-30 ml-2 flex w-44 flex-col gap-0.5 rounded-xl border border-neutral-200 bg-white p-1 shadow-xl shadow-neutral-900/10"
          >
            {canInvite && (
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  onInvite?.(id);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                <svg
                  className="h-3 w-3 shrink-0"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="14" height="12" rx="2" />
                  <path d="m3 6 7 5 7-5" />
                </svg>
                {hasPendingInvite ? "Resend invite" : "Invite"}
              </button>
            )}
            {canToggleAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  onToggleAdmin?.(id);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border-t border-neutral-100 px-2 py-1.5 text-[11px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                <svg
                  className="h-3 w-3 shrink-0"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 2a5 5 0 0 1 4.9 6.2 7.5 7.5 0 0 1 3.1 6.3v.8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-.8a7.5 7.5 0 0 1 3.1-6.3A5 5 0 0 1 10 2z" />
                  <circle cx="10" cy="7" r="2" />
                </svg>
                {isAdmin ? "Remove admin" : "Grant admin"}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}