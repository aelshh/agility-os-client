import { Handle, Position } from "@xyflow/react";

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

/**
 * Custom React Flow node for an employee. Exactly fills the declared
 * 208×96 node box so no transparent wrapper ghost exists. When the
 * person manages others a chevron + click appears for one-level expansion.
 */
export function EmployeeNode({ id, data, selected }: EmployeeNodeProps) {
  const { name, email, designation, department, role, isRoot, hasChildren, collapsed, toggleCollapse } = data;

  return (
    <div
      role={hasChildren ? "button" : undefined}
      tabIndex={hasChildren ? 0 : undefined}
      onClick={hasChildren ? () => toggleCollapse?.(id) : undefined}
      onKeyDown={
        hasChildren
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleCollapse?.(id);
              }
            }
          : undefined
      }
      className={cn(
        "flex h-24 w-52 flex-col justify-center rounded-xl border bg-white px-4 transition-colors select-none",
        hasChildren && "cursor-pointer",
        isRoot
          ? "border-neutral-900 shadow-lg shadow-neutral-900/10"
          : "border-neutral-300 hover:border-neutral-500",
        selected && "ring-2 ring-neutral-950 ring-offset-2",
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

      {/* row 4 — email */}
      {email && (
        <p className="mt-0.5 truncate text-[10px] text-neutral-400">{email}</p>
      )}
    </div>
  );
}
