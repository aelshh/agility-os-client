/**
 * Telenow Voice AI Integration API client.
 */

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
  const res = await fetch("/api/org/telenow", {
    method: "GET",
    credentials: "include",
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
  const res = await fetch("/api/org/telenow", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
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
  const res = await fetch("/api/org/telenow", {
    method: "DELETE",
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Failed to disconnect Telenow");
  }

  return data;
}
