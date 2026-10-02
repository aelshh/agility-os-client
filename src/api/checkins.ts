/**
 * Daily check-in API layer — non-practitioners schedule and review the daily
 * outbound voice check-in calls placed to their direct reports.
 */

import type { AuthErrorPayload } from "../features/auth/auth-context";
import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CheckinRunStatus =
  | "pending"
  | "provisioning"
  | "completed"
  | "failed"
  | "skipped";

export type CheckinStatus =
  | "pending"
  | "queued"
  | "calling"
  | "answered"
  | "no_answer"
  | "completed"
  | "failed"
  | "skipped";

export type CheckinQuestionAnswer = {
  question: string;
  answer: string;
};

export type CheckinSummary = {
  report?: string;
  priorities?: string;
  blockers?: string;
  suggestions?: string;
  updates?: string;
  sentiment?: "positive" | "neutral" | "needs_attention" | "blocked" | string;
  keyTakeaway?: string;
  answers?: CheckinQuestionAnswer[];
  raw?: string;
};

export type CheckinSchedule = {
  id: string;
  orgId: string;
  ownerUserId: string;
  title: string;
  timeLocal: string;
  enabled: boolean;
  questionScript: string;
  telenowAgentId: string | null;
  voice?: string | null;
  voiceProvider?: string | null;
  phoneNumberId?: string | null;
  phoneNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  /** People currently reporting to the owner in the org graph. */
  directReportCount: number;
  /** Subset of direct reports who can actually be called (active + phone). */
  callableCount: number;
  todayRunStatus: CheckinRunStatus | null;
  additionalUserIds?: string[];
};

export type CheckinScheduleList = {
  schedules: CheckinSchedule[];
  timezone: string | null;
  defaultScript: string;
};

export type CheckinRunListItem = {
  id: string;
  runDate: string;
  status: CheckinRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  counts: Record<string, number>;
};

export type CheckinRunDetail = {
  run: {
    id: string;
    runDate: string;
    status: CheckinRunStatus;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
  };
  schedule: {
    id: string;
    title: string;
    timeLocal: string;
    questionScript: string;
  };
  checkins: Array<{
    id: string;
    userId: string;
    status: CheckinStatus;
    summary: CheckinSummary | null;
    transcriptUrl: string | null;
    error: string | null;
    calledAt: string | null;
    completedAt: string | null;
    person: {
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }>;
};

export type CreateCheckinScheduleInput = {
  title: string;
  timeLocal: string;
  questionScript?: string;
  additionalUserIds?: string[];
  voice?: string | null;
  voiceProvider?: string | null;
  phoneNumberId?: string | null;
  phoneNumber?: string | null;
};

export type UpdateCheckinScheduleInput = {
  title?: string;
  timeLocal?: string;
  questionScript?: string;
  enabled?: boolean;
  additionalUserIds?: string[];
  voice?: string | null;
  voiceProvider?: string | null;
  phoneNumberId?: string | null;
  phoneNumber?: string | null;
};

type ApiResponse = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseJson(res: Response): Promise<ApiResponse> {
  return (await res.json().catch(() => ({}))) as ApiResponse;
}

function unwrap<T>(res: Response, data: ApiResponse): T {
  if (!res.ok) throw data as AuthErrorPayload;
  return data as unknown as T;
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export async function apiListCheckinSchedules(): Promise<CheckinScheduleList> {
  const res = await apiFetch("/api/checkins/schedule");
  return unwrap<CheckinScheduleList>(res, await parseJson(res));
}

export async function apiCreateCheckinSchedule(
  input: CreateCheckinScheduleInput,
): Promise<{ schedule: CheckinSchedule; defaultScript: string }> {
  const res = await apiFetch("/api/checkins/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return unwrap<{ schedule: CheckinSchedule; defaultScript: string }>(
    res,
    await parseJson(res),
  );
}

export async function apiUpdateCheckinSchedule(
  id: string,
  input: UpdateCheckinScheduleInput,
): Promise<{ schedule: CheckinSchedule }> {
  const res = await apiFetch(`/api/checkins/schedule/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return unwrap<{ schedule: CheckinSchedule }>(res, await parseJson(res));
}

export async function apiDeleteCheckinSchedule(id: string): Promise<void> {
  const res = await apiFetch(`/api/checkins/schedule/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw await parseJson(res);
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export async function apiRunCheckinNow(id: string): Promise<{
  run: { id: string; runDate: string; status: CheckinRunStatus };
  outcome: { ok: boolean; error?: string };
}> {
  const res = await apiFetch(`/api/checkins/schedule/${id}/run-now`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return unwrap(res, await parseJson(res));
}

export async function apiListCheckinRuns(
  scheduleId: string,
): Promise<CheckinRunListItem[]> {
  const res = await apiFetch(`/api/checkins/schedule/${scheduleId}/runs`);
  const data = unwrap<{ runs: CheckinRunListItem[] }>(res, await parseJson(res));
  return data.runs;
}

export async function apiGetCheckinRun(runId: string): Promise<CheckinRunDetail> {
  const res = await apiFetch(`/api/checkins/runs/${runId}`);
  return unwrap<CheckinRunDetail>(res, await parseJson(res));
}