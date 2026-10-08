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

export interface WhatsAppChannelsResponse {
  channels: WhatsAppChannel[];
  defaultChannelId: string | null;
}

export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  const clean = phone.trim();
  if (!clean) return "";

  const digits = clean.replace(/[^\d]/g, "");
  if (clean.startsWith("+1") && digits.length === 11) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (clean.startsWith("+91") && digits.length === 12) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (clean.startsWith("+44") && digits.length === 12) {
    return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  if (clean.startsWith("+") && digits.length >= 8 && digits.length <= 15) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  return clean;
}

export function formatChannelLabel(channel: WhatsAppChannel): string {
  const cleanPhone = channel.phone?.trim();
  const formattedPhone = formatPhoneNumber(cleanPhone);
  const cleanName = channel.name?.trim();
  if (cleanPhone && cleanName && cleanName !== cleanPhone && !cleanName.includes(cleanPhone)) {
    return `${cleanName} (${formattedPhone || cleanPhone})`;
  }
  return cleanName || formattedPhone || cleanPhone || channel.id;
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
export async function apiListWhatsAppChannels(): Promise<WhatsAppChannelsResponse> {
  const res = await apiFetch("/api/org/whatsapp/channels", {
    method: "GET",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to fetch WhatsApp channels.");
  }

  const data = await res.json();
  return {
    channels: Array.isArray(data.channels) ? data.channels : [],
    defaultChannelId: data.defaultChannelId ?? null,
  };
}

/**
 * Sets the organization default WhatsApp sending channel.
 */
export async function apiSetDefaultWhatsAppChannel(channelId: string): Promise<void> {
  const res = await apiFetch("/api/org/whatsapp/default-channel", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channelId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to set default WhatsApp channel.");
  }
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
  template?: string;
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
