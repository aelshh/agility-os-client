/**
 * WhatsApp Integration API client for Telenow channels & QR sessions.
 */

import { apiFetch } from "./client";

export interface WhatsAppChannel {
  id: string;
  name: string;
  phone: string;
  status: string;
  qualityRating?: string;
}

export interface WhatsAppSession {
  sessionId: string;
  status: "created" | "qr_ready" | "connecting" | "connected" | "failed" | "expired" | string;
  qr?: string | null;
  phone?: string | null;
  channelId?: string | null;
}

export interface SendWhatsAppTestResponse {
  success: boolean;
  wamid: string;
  message: string;
}

/**
 * Fetches all active connected WhatsApp channels for the organization.
 */
export async function apiListWhatsAppChannels(): Promise<WhatsAppChannel[]> {
  const res = await apiFetch("/api/org/whatsapp/channels", {
    method: "GET",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to fetch WhatsApp channels.");
  }

  const data = await res.json();
  return Array.isArray(data.channels) ? data.channels : [];
}

/**
 * Initiates a new WhatsApp QR pairing session.
 */
export async function apiCreateWhatsAppSession(
  label?: string,
): Promise<WhatsAppSession> {
  const res = await apiFetch("/api/org/whatsapp/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to start WhatsApp pairing session.");
  }

  return res.json();
}

/**
 * Polls status and QR data for an active WhatsApp pairing session.
 */
export async function apiGetWhatsAppSession(
  sessionId: string,
): Promise<WhatsAppSession> {
  const res = await apiFetch(`/api/org/whatsapp/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to fetch WhatsApp session status.");
  }

  return res.json();
}

/**
 * Cancels or cleans up an active pairing session.
 */
export async function apiDeleteWhatsAppSession(
  sessionId: string,
): Promise<void> {
  const res = await apiFetch(`/api/org/whatsapp/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to delete WhatsApp session.");
  }
}

/**
 * Disconnects / unlinks an active WhatsApp channel.
 */
export async function apiDeleteWhatsAppChannel(
  channelId: string,
): Promise<void> {
  const res = await apiFetch(`/api/org/whatsapp/channels/${encodeURIComponent(channelId)}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to disconnect WhatsApp channel.");
  }
}

/**
 * Sends a test message to a specified recipient over the connected channel.
 */
export async function apiSendWhatsAppTest(input: {
  to: string;
  channelId?: string;
  message?: string;
}): Promise<SendWhatsAppTestResponse> {
  const res = await apiFetch("/api/org/whatsapp/test-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to send WhatsApp test message.");
  }

  return res.json();
}
