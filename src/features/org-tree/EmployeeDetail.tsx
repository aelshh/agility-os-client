import { useMemo } from "react";

import { Button } from "../../components";
import { cn } from "../../lib/cn";
import { ROLE_LABELS } from "./buildTreeData";
import type { OrgTreeData, OrgTreeNode } from "../../api/hrms";

interface EmployeeDetailProps {
  employee: OrgTreeNode;
  orgTree: OrgTreeData;
  viewerIsAdmin: boolean;
  viewerId: string | null;
  onOpenInvite: (id: string) => void;
  onOpenAdmin: (id: string) => void;
  onNavigate: (externalHrmsId: string) => void;
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
    return { label: "Invite sent", className: "bg-amber-100 text-amber-700" };
  if (userStatus === "active")
    return {
      label: "Active",
      className: "bg-emerald-100 text-emerald-700",
    };
  if (userStatus === "invited")
    return {
      label: "Needs invite",
      className: "bg-neutral-100 text-neutral-600",
    };
  return null;
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-right text-sm font-medium text-neutral-900">
        {value}
      </span>
    </div>
  );
}

export function EmployeeDetail({
  employee,
  orgTree,
  viewerIsAdmin,
  viewerId,
  onOpenInvite,
  onOpenAdmin,
  onNavigate,
}: EmployeeDetailProps) {
  const { employees, teams, reportingEdges } = orgTree;
  const isSelf = viewerId === employee.userId;

  const employeeById = useMemo(
    () => new Map(employees.map((e) => [e.externalHrmsId, e])),
    [employees],
  );

  const userByUserId = useMemo(
    () =>
      new Map(
        employees.filter((e) => e.userId).map((e) => [e.userId!, e] as const),
      ),
    [employees],
  );

  const teamName = useMemo(() => {
    if (!employee.teamId) return null;
    return teams.find((t) => t.id === employee.teamId)?.name ?? null;
  }, [employee, teams]);

  const manager = useMemo(() => {
    if (!employee.externalManagerId) return null;
    return employeeById.get(employee.externalManagerId) ?? null;
  }, [employee, employeeById]);

  const directReports = useMemo(() => {
    if (!employee.userId) return [];
    return reportingEdges
      .filter((e) => e.managerUserId === employee.userId)
      .map((e) => userByUserId.get(e.reportUserId))
      .filter((e): e is OrgTreeNode => !!e);
  }, [employee, reportingEdges, userByUserId]);

  const badge = statusBadge(employee.userStatus, employee.hasPendingInvite);

  const canInvite =
    viewerIsAdmin &&
    !isSelf &&
    !!employee.userId &&
    employee.userStatus === "invited" &&
    !!employee.email;
  const canToggleAdmin =
    viewerIsAdmin &&
    !isSelf &&
    !!employee.userId &&
    employee.userStatus === "active";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "h-3 w-3 shrink-0 rounded-full",
            ROLE_DOT_COLORS[employee.role] ?? "bg-neutral-400",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-950">
            {employee.name}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            employee.role === "architect"
              ? "bg-neutral-950 text-white"
              : "bg-neutral-100 text-neutral-600",
          )}
        >
          {ROLE_LABELS[employee.role] ?? employee.role}
        </span>
      </div>

      {/* Status + Sales badge */}
      <div className="flex items-center gap-2">
        {badge && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              badge.className,
            )}
          >
            {badge.label}
          </span>
        )}
        {employee.isSales && (
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
            Sales
          </span>
        )}
      </div>

      {/* Info */}
      <div className="divide-y divide-neutral-100">
        <InfoRow label="Email" value={employee.email} />
        <InfoRow label="Phone" value={employee.phone} />
        <InfoRow label="Designation" value={employee.designation} />
        <InfoRow label="Department" value={employee.department} />
        <InfoRow label="Region" value={employee.region} />
        <InfoRow label="Team" value={teamName} />
        <InfoRow label="Hire date" value={employee.hireDate} />
      </div>

      {/* Manager */}
      {manager && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Reports to
          </p>
          <button
            type="button"
            onClick={() => onNavigate(manager.externalHrmsId)}
            className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                ROLE_DOT_COLORS[manager.role] ?? "bg-neutral-400",
              )}
            />
            <span className="truncate text-sm font-medium text-neutral-900">
              {manager.name}
            </span>
            <span className="ml-auto text-[10px] text-neutral-400">
              {ROLE_LABELS[manager.role] ?? manager.role}
            </span>
          </button>
        </div>
      )}

      {/* Direct reports */}
      {directReports.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Direct reports ({directReports.length})
          </p>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 p-1.5">
            {directReports.map((r) => (
              <button
                key={r.externalHrmsId}
                type="button"
                onClick={() => onNavigate(r.externalHrmsId)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-neutral-50"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    ROLE_DOT_COLORS[r.role] ?? "bg-neutral-400",
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-800">
                  {r.name}
                </span>
                <span className="shrink-0 text-[10px] text-neutral-400">
                  {ROLE_LABELS[r.role] ?? r.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {(canInvite || canToggleAdmin) && (
        <div className="flex gap-2 pt-1">
          {canInvite && (
            <Button
              size="sm"
              onClick={() => onOpenInvite(employee.externalHrmsId)}
            >
              {employee.hasPendingInvite ? "Resend invite" : "Invite"}
            </Button>
          )}
          {canToggleAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenAdmin(employee.externalHrmsId)}
            >
              {employee.isAdmin ? "Remove admin" : "Grant admin"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
