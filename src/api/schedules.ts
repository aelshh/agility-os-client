/**
 * Course Schedule API layer.
 * Allows content curators and architects to schedule courses for specific dates or recurring days,
 * configure calling windows, prior WhatsApp reminders, and manage calendar events.
 */

import { apiFetch } from "./client";

export type CourseScheduleType = "one_time" | "recurring";
export type CourseScheduleStatus =
  | "scheduled"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type CourseScheduleRunStatus =
  | "scheduled"
  | "notified"
  | "calling"
  | "completed"
  | "failed"
  | "skipped";

export type CourseScheduleNotificationStatus =
  | "queued"
  | "sent"
  | "failed"
  | "skipped";

export type CourseSchedule = {
  id: string;
  orgId: string;
  courseId: string;
  title: string;
  description: string | null;
  scheduleType: CourseScheduleType;
  startDate: string;
  endDate: string | null;
  daysOfWeek: number[];
  timeWindowStart: string;
  timeWindowEnd: string;
  timezone: string;
  notifyWhatsappPrior: boolean;
  notifyMinutesBefore: number;
  customMessage: string | null;
  status: CourseScheduleStatus;
  audienceType: "course_default" | "custom";
  audienceIds: string[];
  lastRunDate: string | null;
  lastNotificationSentAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  enrolledCount?: number;
  course?: {
    id: string;
    title: string;
    description: string;
    status: string;
  };
  creator?: {
    id: string;
    name: string | null;
    email: string | null;
  };
  runs?: CourseScheduleRun[];
  recentNotifications?: CourseScheduleNotification[];
};

export type CourseScheduleRun = {
  id: string;
  orgId: string;
  scheduleId: string;
  courseId: string;
  runDate: string;
  status: CourseScheduleRunStatus;
  telenowCampaignId: string | null;
  notifiedCount: number;
  targetsCount: number;
  completedCount: number;
  startedAt: string | null;
  endedAt: string | null;
  error: string | null;
  createdAt: string;
};

export type CourseScheduleNotification = {
  id: string;
  orgId: string;
  scheduleId: string;
  runId: string | null;
  userId: string;
  phone: string;
  status: CourseScheduleNotificationStatus;
  wamid: string | null;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
  };
};

export type CalendarEventItem = {
  id: string;
  scheduleId: string;
  eventType?: "course" | "checkin";
  courseId?: string;
  courseTitle?: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  status: CourseScheduleStatus;
  scheduleType: CourseScheduleType;
  notifyWhatsappPrior?: boolean;
  notifyMinutesBefore?: number;
  ownerName?: string;
  ownerId?: string;
  targetCount?: number;
  questionScript?: string | null;
  voice?: string;
  voiceProvider?: string;
  phoneNumber?: string | null;
};

export type CreateCourseScheduleInput = {
  courseId: string;
  title: string;
  description?: string | null;
  scheduleType: CourseScheduleType;
  startDate: string;
  endDate?: string | null;
  daysOfWeek?: number[];
  timeWindowStart: string;
  timeWindowEnd: string;
  timezone?: string;
  notifyWhatsappPrior?: boolean;
  notifyMinutesBefore?: number;
  customMessage?: string | null;
  audienceType?: "course_default" | "custom";
  audienceIds?: string[];
};

export type UpdateCourseScheduleInput = Partial<CreateCourseScheduleInput> & {
  status?: CourseScheduleStatus;
};

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = await res.json();
      message = data.message || data.error || message;
    } catch {
      // Ignore JSON parse errors on non-200 responses
    }
    throw new Error(message);
  }
  return res.json();
}

export async function apiListCourseSchedules(filters?: {
  courseId?: string;
  status?: string;
}): Promise<CourseSchedule[]> {
  const params = new URLSearchParams();
  if (filters?.courseId) params.set("courseId", filters.courseId);
  if (filters?.status) params.set("status", filters.status);

  const res = await apiFetch(`/api/drills/schedules?${params.toString()}`);
  const data = await handleResponse<{ schedules: CourseSchedule[] }>(res);
  return data.schedules;
}

export async function apiGetCalendarEvents(
  from: string,
  to: string,
  courseId?: string,
): Promise<CalendarEventItem[]> {
  const params = new URLSearchParams({ from, to });
  if (courseId) params.set("courseId", courseId);

  const res = await apiFetch(`/api/drills/schedules/calendar/events?${params.toString()}`);
  const data = await handleResponse<{ events: CalendarEventItem[] }>(res);
  return data.events;
}

export async function apiGetCourseSchedule(id: string): Promise<CourseSchedule> {
  const res = await apiFetch(`/api/drills/schedules/${id}`);
  const data = await handleResponse<{ schedule: CourseSchedule }>(res);
  return data.schedule;
}

export async function apiCreateCourseSchedule(
  input: CreateCourseScheduleInput,
): Promise<CourseSchedule> {
  const res = await apiFetch("/api/drills/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await handleResponse<{ schedule: CourseSchedule }>(res);
  return data.schedule;
}

export async function apiUpdateCourseSchedule(
  id: string,
  input: UpdateCourseScheduleInput,
): Promise<CourseSchedule> {
  const res = await apiFetch(`/api/drills/schedules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await handleResponse<{ schedule: CourseSchedule }>(res);
  return data.schedule;
}

export async function apiDeleteCourseSchedule(id: string): Promise<void> {
  const res = await apiFetch(`/api/drills/schedules/${id}`, {
    method: "DELETE",
  });
  await handleResponse<{ success: boolean }>(res);
}

export async function apiNotifyCourseScheduleNow(
  id: string,
): Promise<{ sentCount: number; failedCount: number; message: string }> {
  const res = await apiFetch(`/api/drills/schedules/${id}/notify-now`, {
    method: "POST",
  });
  return handleResponse<{ sentCount: number; failedCount: number; message: string }>(res);
}

export async function apiRunCourseScheduleNow(
  id: string,
): Promise<{ success: boolean; message: string; run: CourseScheduleRun }> {
  const res = await apiFetch(`/api/drills/schedules/${id}/run-now`, {
    method: "POST",
  });
  return handleResponse<{ success: boolean; message: string; run: CourseScheduleRun }>(res);
}
