/**
 * HRMS API layer — manual CSV upload flow.
 * Client parses the CSV, uploads the normalized directory, and fetches the
 * resulting org tree for visualization.
 */

import type { AuthErrorPayload } from "../features/auth/auth-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CsvPlatform = "keka" | "darwinbox" | "peoplehr";

export type HrmsStatus = {
  connected: boolean;
  employeeCount: number;
  platform: CsvPlatform | null;
};

export type NormalizedEmployee = {
  externalHrmsId: string;
  externalManagerId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  hireDate: string | null;
  /** 1-indexed CSV row (incl. header) for row-level error attribution. */
  rowNumber?: number;
};

export type CsvRowError = {
  rowNumber: number;
  message: string;
};

export type CsvUploadSummary = {
  employeesFetched: number;
  inserted: number;
  updated: number;
  terminated: number;
};

export type TreeBuildSummary = {
  teamsCreated: number;
  teamsLinked: number;
  usersProvisioned: number;
  usersUpdated: number;
  usersFailed: number;
  edgesCreated: number;
  edgesClosed: number;
  managersAssigned: number;
  unresolvedManagerRefs: string[];
};

export type CsvUploadResponse = {
  platform: CsvPlatform;
  status: "success";
  summary: CsvUploadSummary;
  tree: TreeBuildSummary;
  errors: CsvRowError[];
};

export type OrgTreeNode = {
  id: string;
  externalHrmsId: string;
  externalManagerId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  department: string | null;
  region: string | null;
  role: string;
  teamId: string | null;
  hireDate: string | null;
  isSales: boolean;
  status: string;
  /** Linked app user id if this employee has a provisioned account. */
  userId: string | null;
  /** Lifecycle of the provisioned account: invited | active | churned | null. */
  userStatus: string | null;
  hasPendingInvite: boolean;
  isAdmin: boolean;
};

export type OrgTreeTeam = {
  id: string;
  name: string;
  parentTeamId: string | null;
  hrmsDepartment: string | null;
};

export type OrgTreeEdge = {
  managerUserId: string;
  reportUserId: string;
  validTo: string | null;
};

export type OrgTreeData = {
  employees: OrgTreeNode[];
  teams: OrgTreeTeam[];
  reportingEdges: OrgTreeEdge[];
  userRolesById: Record<string, string>;
  /** Whether the viewer is a currently active org admin. */
  viewerIsAdmin: boolean;
};

type ApiResponse = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseJson(res: Response): Promise<ApiResponse> {
  return (await res.json().catch(() => ({}))) as ApiResponse;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export async function apiGetHrmsStatus(): Promise<HrmsStatus> {
  const res = await fetch("/api/hrms/status", { credentials: "include" });
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
  return data as unknown as HrmsStatus;
}

// ---------------------------------------------------------------------------
// Upload (persist parsed directory + build tree)
// ---------------------------------------------------------------------------

export async function apiUploadCsv(
  platform: CsvPlatform,
  employees: NormalizedEmployee[],
  errors: CsvRowError[],
): Promise<CsvUploadResponse> {
  const res = await fetch("/api/hrms/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ platform, employees, errors }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
  return data as unknown as CsvUploadResponse;
}

// ---------------------------------------------------------------------------
// Org tree
// ---------------------------------------------------------------------------

export async function apiGetOrgTree(): Promise<OrgTreeData> {
  const res = await fetch("/api/hrms/tree", { credentials: "include" });
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
  return data as unknown as OrgTreeData;
}