/**
 * Invites + admin management API layer.
 * Org-tree invite flow: admins invite employees by email link, and manage
 * who holds admin access for the org.
 */

import type { AuthErrorPayload } from "../features/auth/auth-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InviteResultEntry = {
  userId: string;
  email?: string;
  reason?: string;
};

export type CreateInvitesResponse = {
  sent: InviteResultEntry[];
  skipped: InviteResultEntry[];
  failures: InviteResultEntry[];
  summary: {
    total: number;
    sent: number;
    skipped: number;
    failed: number;
  };
};

export type AdminListItem = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  grantedAt: string | null;
  grantedByName: string | null;
  isSelf: boolean;
};

export type ListAdminsResponse = {
  adminsCount: number;
  admins: AdminListItem[];
};

type ApiResponse = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseJson(res: Response): Promise<ApiResponse> {
  return (await res.json().catch(() => ({}))) as ApiResponse;
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export async function apiCreateInvites(
  userIds: string[],
): Promise<CreateInvitesResponse> {
  const res = await fetch("/api/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ userIds }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
  return data as unknown as CreateInvitesResponse;
}

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------

export async function apiListAdmins(): Promise<ListAdminsResponse> {
  const res = await fetch("/api/admins", { credentials: "include" });
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
  return data as unknown as ListAdminsResponse;
}

export async function apiGrantAdmin(userId: string): Promise<ApiResponse> {
  const res = await fetch("/api/admins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ userId }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
  return data;
}

export async function apiRevokeAdmin(userId: string): Promise<ApiResponse> {
  const res = await fetch(`/api/admins/${encodeURIComponent(userId)}/revoke`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
  return data;
}