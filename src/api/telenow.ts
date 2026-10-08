/**
 * Telenow Voice AI Integration API client.
 */

import { apiFetch } from "./client";

export interface TelenowIntegrationStatus {
  configured: boolean;
  maskedKey: string | null;
  telenowOrgId: string | null;
  connectedAt: string | null;
  webhookRegistered: boolean;
}

export interface SaveTelenowKeyResponse extends TelenowIntegrationStatus {
  message: string;
}

export async function apiGetTelenowStatus(): Promise<TelenowIntegrationStatus> {
  const res = await apiFetch("/api/org/telenow", {
    method: "GET",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to fetch Telenow status");
  }

  return res.json();
}

export async function apiSaveTelenowKey(
  apiKey: string,
): Promise<SaveTelenowKeyResponse> {
  const res = await apiFetch("/api/org/telenow", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Failed to connect Telenow API key");
  }

  return data;
}

export async function apiDisconnectTelenow(): Promise<{
  message: string;
  configured: boolean;
}> {
  const res = await apiFetch("/api/org/telenow", {
    method: "DELETE",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Failed to disconnect Telenow");
  }

  return data;
}
