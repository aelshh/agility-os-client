/**
 * Auth API layer.
 * All network calls related to authentication live here.
 * Components and providers consume these functions — never raw fetch.
 */

import type { AuthUser, AuthErrorPayload } from "../features/auth/auth-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApiResponse = AuthErrorPayload & { user?: AuthUser };

export type PublicOrg = {
  id: string;
  name: string;
  timezone: string;
  language: string;
  defaultRegion: string;
  telenowConfigured?: boolean;
  telenowConnectedAt?: string | null;
};

export type OrgBootstrapPayload = {
  adminName: string;
  adminEmail: string;
  adminPhone?: string;
  adminPassword: string;
  orgName: string;
  orgTimezone: string;
  orgLanguage: string;
  defaultRegion: string;
  emailVerificationToken: string;
};

export type OrgBootstrapResponse = {
  org: PublicOrg;
  user: AuthUser;
};

export type InvitePrefill = {
  name: string | null;
  email: string | null;
  role: string;
  org: PublicOrg;
  expiresAt: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseResponse(res: Response): Promise<ApiResponse> {
  return (await res.json().catch(() => ({}))) as ApiResponse;
}

function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function apiGetMe(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  const data = await parseResponse(res);
  return data.user ?? null;
}

export async function apiSignIn(
  email: string,
  password: string,
): Promise<AuthUser> {
  const res = await post("/api/auth/login", { email, password });
  const data = await parseResponse(res);
  if (!res.ok) throw data;
  return data.user!;
}

export async function apiSignOut(): Promise<void> {
  await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "include",
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Org Bootstrap
// ---------------------------------------------------------------------------

export async function apiBootstrapOrg(
  payload: OrgBootstrapPayload,
): Promise<OrgBootstrapResponse> {
  const res = await post("/api/orgs", payload);
  const data = (await res.json().catch(() => ({}))) as OrgBootstrapResponse &
    AuthErrorPayload;
  if (!res.ok) throw data;
  return data;
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export async function apiGetInvite(token: string): Promise<InvitePrefill> {
  const res = await fetch(`/api/invites/${token}`, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data as AuthErrorPayload;
  return data as InvitePrefill;
}

export async function apiAcceptInvite(
  token: string,
  password: string,
): Promise<AuthUser> {
  const res = await post(`/api/invites/${token}/accept`, { password });
  const data = await parseResponse(res);
  if (!res.ok) throw data;
  return data.user!;
}

// ---------------------------------------------------------------------------
// OTP Verification
// ---------------------------------------------------------------------------

export async function apiVerifyOtp(
  email: string,
  otp: string,
): Promise<AuthUser> {
  const res = await post("/api/verify/otp", { email, otp });
  const data = await parseResponse(res);
  if (!res.ok) throw data;
  return data.user!;
}

export async function apiResendOtp(email: string): Promise<void> {
  const res = await post("/api/verify/resend", { email });
  if (!res.ok) {
    const data = await parseResponse(res);
    throw data;
  }
}

// ---------------------------------------------------------------------------
// Pre-account Email Verification (org bootstrap step 0)
// ---------------------------------------------------------------------------

export async function apiSendOtpEmail(email: string): Promise<void> {
  const res = await post("/api/verify/send", { email });
  if (!res.ok) {
    const data = await parseResponse(res);
    throw data;
  }
}

export type PreverifyResult = { verified: boolean; token: string };

export async function apiPreverifyOtp(
  email: string,
  otp: string,
): Promise<PreverifyResult> {
  const res = await post("/api/verify/preverify", { email, otp });
  const data = (await parseResponse(res)) as unknown as PreverifyResult;
  if (!res.ok) throw data;
  return data;
}
