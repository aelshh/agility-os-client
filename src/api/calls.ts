import { apiFetch } from "./client";
import type { CourseEnrollment } from "./courses";

export type CallLogType = "course" | "checkin";

export type CallLog = CourseEnrollment & {
  type: CallLogType;
  title: string | null;
  telenowSessionId: string | null;
  createdAt?: string | null;
};

export type CallLogStats = {
  totalCalls: number;
  completedCalls: number;
  avgScore: number | null;
  totalDurationSecs: number;
};

export type CallLogsFilter = {
  startDate?: string;
  endDate?: string;
  type?: "all" | "course" | "checkin";
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type CallLogsResponse = {
  calls: CallLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: CallLogStats;
};

export async function apiGetCallLogs(filter: CallLogsFilter = {}): Promise<CallLogsResponse> {
  const params = new URLSearchParams();
  if (filter.startDate) params.set("startDate", filter.startDate);
  if (filter.endDate) params.set("endDate", filter.endDate);
  if (filter.type && filter.type !== "all") params.set("type", filter.type);
  if (filter.status && filter.status !== "all") params.set("status", filter.status);
  if (filter.search?.trim()) params.set("search", filter.search.trim());
  if (filter.page) params.set("page", String(filter.page));
  if (filter.pageSize) params.set("pageSize", String(filter.pageSize));

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await apiFetch(`/api/calls${query}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || "Failed to fetch call logs");
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return {
      calls: data,
      total: data.length,
      page: 1,
      pageSize: data.length,
      totalPages: 1,
      stats: {
        totalCalls: data.length,
        completedCalls: data.filter((c: CallLog) => c.status === "completed").length,
        avgScore: null,
        totalDurationSecs: 0,
      },
    };
  }
  return data as CallLogsResponse;
}
