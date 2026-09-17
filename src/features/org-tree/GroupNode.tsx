import { Handle, Position } from "@xyflow/react";

import { cn } from "../../lib/cn";
import type { OrgGroupNodeData } from "./buildTreeData";

interface GroupNodeProps {
  id: string;
  data: OrgGroupNodeData;
  selected?: boolean;
}

/**
 * Department group node — dark capsule that exactly fills the declared
 * node box so no transparent ghost region exists. Clicking toggles
 * expansion of the department's direct children (one level down).
 */
export function GroupNode({ id, data, selected }: GroupNodeProps) {
  const { label, members, isRoot, collapsed, toggleCollapse } = data;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => toggleCollapse?.(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleCollapse?.(id);
        }
      }}
      className={cn(
        "flex h-14 w-52 cursor-pointer items-center gap-2 rounded-full px-3 py-0 shadow-sm transition-colors select-none",
        isRoot
          ? "bg-neutral-950 text-white"
          : "bg-neutral-800 text-white hover:bg-neutral-700",
        selected && "ring-2 ring-neutral-950 ring-offset-2",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-0 !w-0 !min-h-0 !min-w-0 !border-0 !bg-transparent"
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-0 !w-0 !min-h-0 !min-w-0 !border-0 !bg-transparent"
        isConnectable={false}
      />

      <svg
        className="h-4 w-4 shrink-0 text-white/60"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 17.5v-9a2 2 0 0 0-2-2h-3.5a.5.5 0 0 1-.4-.2l-2-2.6A.5.5 0 0 0 10.8 3.5H3a2 2 0 0 0-2 2v12a1 1 0 0 0 1 1h17a1 1 0 0 0 0-1z" />
        <path d="M6 9.5h8M6 12.5h8M6 15.5h5" />
      </svg>

      <div className="min-w-0 flex-1">
        <p className="text-[8px] font-bold uppercase tracking-wider text-white/50">
          Department
        </p>
        <p className="truncate text-xs font-semibold leading-snug text-white">
          {label}
        </p>
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none",
          isRoot ? "bg-white text-neutral-950" : "bg-white/15 text-white",
        )}
      >
        {members}
      </span>

      <svg
        className={cn(
          "h-3.5 w-3.5 shrink-0 text-white/60 transition-transform duration-200",
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
    </div>
  );
}
