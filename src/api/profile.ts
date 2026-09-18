/**
 * Profile API layer.
 * All network calls for the profile page live here.
 */

import type { AuthUser, AuthErrorPayload } from "../features/auth/auth-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProfileOrg = {
  id: string;
  name: string;
  timezone: string;
  language: string;
  defaultRegion: string;
};

export type ProfileEmployee = {
  designation: string | null;
  department: string | null;
  region: string | null;
  hireDate: string | null;
  hireReason: string | null;
  isSales: boolean;
  source: "hrms" | "csv" | "manual";
  status: "active" | "terminated";
};

export type SignInMethod = "password" | "google" | null;

export type ProfileData = {
  user: AuthUser;
  org: ProfileOrg | null;
  isAdmin: boolean;
  signInMethod: SignInMethod;
  employee: ProfileEmployee | null;
  team: { name: string } | null;
  manager: {
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
};

export type ProfileUpdateInput = {
  name?: string;
  phone?: string | null;
  languagePref?: string;
  region?: string | null;
  image?: string | null;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseJson(res: Response): Promise<unknown> {
  return res.json().catch(() => ({}));
}

function jsonRequest(
  url: string,
  method: string,
  body: unknown,
): Promise<Response> {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function apiGetProfile(): Promise<ProfileData> {
  const res = await fetch("/api/profile", { credentials: "include" });
  if (!res.ok) {
    throw (await parseJson(res)) as AuthErrorPayload;
  }
  return (await parseJson(res)) as ProfileData;
}

export async function apiUpdateProfile(
  patch: ProfileUpdateInput,
): Promise<AuthUser> {
  const res = await jsonRequest("/api/profile", "PATCH", patch);
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
  return (data as { user: AuthUser }).user;
}

export async function apiChangePassword(
  input: ChangePasswordInput,
): Promise<void> {
  const res = await jsonRequest("/api/profile/password", "POST", input);
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
}