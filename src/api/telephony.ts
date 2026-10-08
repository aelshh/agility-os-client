/**
 * Telephony and Phone Numbers API layer.
 * All endpoints interface with the organisation's Voice AI workspace.
 */

import type { AuthErrorPayload } from "../features/auth/auth-context";

import { apiFetch } from "./client";

export type WorkspacePhoneNumber = {
  id: string;
  e164: string;
  provider: string;
  country: string;
  region: string | null;
  numberType: string;
  status: string;
  capabilities: { voice?: boolean; sms?: boolean; mms?: boolean };
  agentId: string | null;
  agentName: string | null;
  allocatedToMemberId: string | null;
  createdAt: string;
  assignedCourse?: {
    id: string;
    title: string;
    status: string;
    telenowAgentId: string | null;
  } | null;
  assignedCheckin?: {
    id: string;
    title: string;
    ownerName?: string | null;
  } | null;
};

export type ConnectionStatus = {
  id: string;
  e164: string;
  matches: boolean | null;
};

export class TelephonyApiError extends Error {
  readonly status?: number;

  constructor(
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "TelephonyApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    if (isJson) {
      const errPayload = (await res.json()) as AuthErrorPayload;
      throw new TelephonyApiError(
        errPayload.message ?? `Request failed with status ${res.status}`,
        res.status,
      );
    }
    const text = await res.text();
    throw new TelephonyApiError(
      text || `Request failed with status ${res.status}`,
      res.status,
    );
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return (await res.json()) as T;
}

/** Fetches all phone numbers configured in the organisation workspace. */
export async function apiGetNumbers(): Promise<{
  numbers: WorkspacePhoneNumber[];
  total: number;
}> {
  return request<{ numbers: WorkspacePhoneNumber[]; total: number }>(
    "/api/org/numbers",
  );
}

/** Assigns a phone number to a course agent. */
export async function apiAssignNumberToCourse(
  numberId: string,
  courseId: string,
): Promise<{
  success: boolean;
  message: string;
  numberId: string;
  phoneNumber: string;
  courseId: string;
  courseTitle: string;
}> {
  return request<{
    success: boolean;
    message: string;
    numberId: string;
    phoneNumber: string;
    courseId: string;
    courseTitle: string;
  }>(`/api/org/numbers/${numberId}/assign`, {
    method: "POST",
    body: JSON.stringify({ courseId }),
  });
}

/** Unassigns any agent from a phone number. */
export async function apiUnassignNumber(
  numberId: string,
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(
    `/api/org/numbers/${numberId}/agent`,
    {
      method: "DELETE",
    },
  );
}

/** Checks live connection health from carriers. */
export async function apiCheckNumberConnections(): Promise<{
  connections: ConnectionStatus[];
}> {
  return request<{ connections: ConnectionStatus[] }>(
    "/api/org/numbers/connection-status",
  );
}
