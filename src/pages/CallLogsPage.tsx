import { useEffect, useState } from "react";
import { PhoneCall, Brain, ChatCenteredText, Eye } from "@phosphor-icons/react";
import type { CourseEnrollment } from "../api/courses";
import { CourseCallDetailModal } from "../features/courses/CourseCallDetailModal";
import { IconBadge } from "../components/ui/IconBadge";
import { Button } from "../components";
import { cn } from "../lib/cn";

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
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);

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
        <div className="flex items-start gap-3.5">
          <IconBadge
            icon={PhoneCall}
            variant="indigo"
            size="lg"
            weight="duotone"
          />
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 font-serif">Call Logs</h1>
            <p className="text-sm text-neutral-500">
              View all calls placed by the Telenow AI agent for courses and check-ins. Click any call to inspect recording and AI scorecard.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-neutral-500 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4 font-semibold">User</th>
                <th className="p-4 font-semibold">Context</th>
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Score</th>
                <th className="p-4 font-semibold">Duration</th>
                <th className="p-4 font-semibold">Date</th>
                <th className="p-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-neutral-500">
                    Loading calls...
                  </td>
                </tr>
              ) : calls?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-neutral-500">
                    <IconBadge
                      icon={PhoneCall}
                      variant="indigo"
                      size="xl"
                      weight="duotone"
                      className="mx-auto mb-3"
                    />
                    <p className="font-semibold text-neutral-800">No calls recorded yet</p>
                    <p className="text-xs text-neutral-400 mt-1">Practice and check-in calls will appear here once initiated.</p>
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-neutral-50/80 transition-colors cursor-pointer"
                    onClick={() => setSelectedCall(call)}
                  >
                    <td className="p-4">
                      <div className="font-semibold text-neutral-900">{call.userName || "Unknown"}</div>
                      <div className="text-xs text-neutral-500">{call.userEmail || "—"}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-neutral-900 max-w-[200px] truncate">
                        {call.title || "Untitled"}
                      </div>
                    </td>
                    <td className="p-4">
                      {call.type === "course" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
                          <Brain className="h-3.5 w-3.5" weight="duotone" />
                          Course
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200/60">
                          <ChatCenteredText className="h-3.5 w-3.5" weight="duotone" />
                          Check-in
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wider",
                          call.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : call.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : call.status === "calling" || call.status === "queued"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-neutral-100 text-neutral-700",
                        )}
                      >
                        {call.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-4">
                      {call.score !== null && call.score !== undefined ? (
                        <span className={cn(
                          "font-mono font-bold",
                          call.score >= 80 ? "text-emerald-600" : call.score >= 60 ? "text-amber-600" : "text-red-600"
                        )}>
                          {call.score}%
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="p-4 text-neutral-600 font-mono text-xs">
                      {formatDuration(call.durationSecs)}
                    </td>
                    <td className="p-4 text-neutral-500 text-xs">
                      {formatDate(call.calledAt || call.completedAt)}
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCall(call);
                        }}
                        className="h-8 px-2.5 text-xs font-semibold"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" weight="duotone" />
                        Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCall && (
        <CourseCallDetailModal
          enrollment={selectedCall}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </div>
  );
}
