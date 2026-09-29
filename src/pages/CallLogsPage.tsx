import { useEffect, useState } from "react";
import type { CourseEnrollment } from "../api/courses";
import { CourseCallDetailModal } from "../features/courses/CourseCallDetailModal";

type CallLog = CourseEnrollment & {
  type: "course" | "checkin";
  title: string | null;
  telenowSessionId: string | null;
};

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function CallLogsPage() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CourseEnrollment | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/calls", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch calls");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setCalls(data as CallLog[]);
      })
      .catch((err) => {
        console.error("Failed to load calls:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 bg-neutral-50 min-h-screen px-4 py-6 sm:px-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Call Logs</h1>
          <p className="text-sm text-neutral-500">
            View all calls placed by the Telenow AI agent for courses and check-ins. Click any call to inspect recording and AI scorecard.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                <th className="p-4 font-medium">User</th>
                <th className="p-4 font-medium">Context</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Score</th>
                <th className="p-4 font-medium">Duration</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-500">
                    Loading calls...
                  </td>
                </tr>
              ) : calls?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-500">
                    No calls recorded yet.
                  </td>
                </tr>
              ) : (
                calls?.map((call) => (
                  <tr
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className="hover:bg-neutral-50 cursor-pointer transition-colors"
                  >
                    <td className="p-4">
                      <div className="font-medium text-neutral-900">
                        {call.userName || "Unknown"}
                      </div>
                      <div className="text-xs text-neutral-500">{call.userEmail || call.userPhone}</div>
                    </td>
                    <td className="p-4 text-neutral-700 font-medium">
                      {call.title || "Unknown"}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 capitalize">
                        {call.type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ${
                          call.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : call.status === "answered"
                              ? "bg-blue-100 text-blue-700"
                              : call.status === "no_answer"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {call.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-semibold text-neutral-800">
                      {call.score !== null ? `${call.score}%` : "—"}
                    </td>
                    <td className="p-4 font-mono text-xs text-neutral-600">
                      {formatDuration(call.durationSecs)}
                    </td>
                    <td className="p-4 text-neutral-500 whitespace-nowrap text-xs">
                      {formatDate(call.calledAt)}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCall(call);
                        }}
                        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-100 transition-all"
                      >
                        Inspect &rarr;
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <CourseCallDetailModal
        enrollment={selectedCall}
        onClose={() => setSelectedCall(null)}
      />
    </div>
  );
}

