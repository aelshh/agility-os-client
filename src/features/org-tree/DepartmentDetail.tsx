import { useMemo } from "react";

import { Button } from "../../components";
import { cn } from "../../lib/cn";
import { ROLE_LABELS } from "./buildTreeData";
import type { OrgTreeData } from "../../api/hrms";

interface DepartmentDetailProps {
  department: string;
  orgTree: OrgTreeData;
  viewerIsAdmin: boolean;
  viewerId: string | null;
  onNavigate: (externalHrmsId: string) => void;
  onInviteAll: (targets: { userId: string; name: string; email: string }[]) => void;
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

function statusBadge(userStatus: string | null, hasPendingInvite: boolean) {
  if (hasPendingInvite)
    return {
      label: "Invite sent",
      className: "bg-amber-100 text-amber-700",
    };
  if (userStatus === "active")
    return { label: "Active", className: "bg-emerald-100 text-emerald-700" };
  if (userStatus === "invited")
    return {
      label: "Needs invite",
      className: "bg-neutral-100 text-neutral-600",
    };
  return null;
}

export function DepartmentDetail({
  department,
  orgTree,
  viewerIsAdmin,
  viewerId,
  onNavigate,
  onInviteAll,
}: DepartmentDetailProps) {
  const { employees } = orgTree;

  const members = useMemo(
    () => employees.filter((e) => e.department === department),
    [employees, department],
  );

  const eligibleInvites = useMemo(() => {
    if (!viewerIsAdmin) return [];
    return members.filter(
      (m) =>
        m.userId &&
        m.userId !== viewerId &&
        m.userStatus === "invited" &&
        m.email,
    );
  }, [members, viewerIsAdmin, viewerId]);

  const activeCount = members.filter((m) => m.userStatus === "active").length;
  const invitedCount = members.filter(
    (m) => m.userStatus === "invited",
  ).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-4">
        <div>
          <p className="text-2xl font-semibold text-neutral-950">{members.length}</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
            Members
          </p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-emerald-600">{activeCount}</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
            Active
          </p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-amber-600">{invitedCount}</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
            Invited
          </p>
        </div>
      </div>

      {/* Members list */}
      <div className="space-y-0.5">
        {members.map((m) => {
          const badge = statusBadge(m.userStatus, m.hasPendingInvite);
          return (
            <button
              key={m.externalHrmsId}
              type="button"
              onClick={() => onNavigate(m.externalHrmsId)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-50"
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  ROLE_DOT_COLORS[m.role] ?? "bg-neutral-400",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {m.name}
                </p>
                <p className="truncate text-[11px] text-neutral-500">
                  {m.designation || ROLE_LABELS[m.role] || m.role}
                </p>
              </div>
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
            </button>
          );
        })}
      </div>

      {/* Invite all */}
      {viewerIsAdmin && eligibleInvites.length > 0 && (
        <Button
          size="sm"
          onClick={() =>
            onInviteAll(
              eligibleInvites.map((m) => ({
                userId: m.userId!,
                name: m.name,
                email: m.email!,
              })),
            )
          }
        >
          Invite all uninvited ({eligibleInvites.length})
        </Button>
      )}
    </div>
  );
}
