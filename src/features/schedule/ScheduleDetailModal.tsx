import { WhatsappLogo } from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/ui/Spinner";
import type { CourseSchedule } from "../../api/schedules";
import {
  apiListWhatsAppChannels,
  formatChannelLabel,
  type WhatsAppChannel,
} from "../../api/whatsapp";
import {
  apiGetCourseSchedule,
  apiNotifyCourseScheduleNow,
  apiRunCourseScheduleNow,
  apiUpdateCourseSchedule,
  apiDeleteCourseSchedule,
} from "../../api/schedules";

interface ScheduleDetailModalProps {
  open: boolean;
  scheduleId: string | null;
  onClose: () => void;
  onEdit: (schedule: CourseSchedule) => void;
  onDeleted: (scheduleId: string) => void;
  onUpdated: (schedule: CourseSchedule) => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ScheduleDetailModal({
  open,
  scheduleId,
  onClose,
  onEdit,
  onDeleted,
  onUpdated,
}: ScheduleDetailModalProps) {
  const [schedule, setSchedule] = useState<CourseSchedule | null>(null);
  const [whatsappChannels, setWhatsappChannels] = useState<WhatsAppChannel[]>([]);
  const [defaultWhatsappChannelId, setDefaultWhatsappChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoadingKey, setActionLoadingKey] = useState<
    "notify" | "run" | "pause" | "delete" | null
  >(null);
  const [activeTab, setActiveTab] = useState<"overview" | "runs" | "notifications">("overview");

  const loadDetail = async (id: string, isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await apiGetCourseSchedule(id);
      setSchedule(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load schedule details.");
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (open) {
      void apiListWhatsAppChannels()
        .then((res) => {
          setWhatsappChannels(res.channels);
          setDefaultWhatsappChannelId(res.defaultChannelId);
        })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (open && scheduleId) {
      setActionSuccess(null);
      setError(null);
      setActionLoadingKey(null);
      void loadDetail(scheduleId, false);
    } else if (!open) {
      setSchedule(null);
      setActionSuccess(null);
      setError(null);
      setActionLoadingKey(null);
    }
  }, [open, scheduleId]);

  if (!open || !scheduleId) return null;

  const handleNotifyNow = async () => {
    if (!schedule) return;
    setActionLoadingKey("notify");
    setActionSuccess(null);
    setError(null);
    try {
      const res = await apiNotifyCourseScheduleNow(schedule.id);
      setActionSuccess(
        `Dispatched ${res.sentCount} WhatsApp reminder message(s).` +
          (res.failedCount > 0 ? ` (${res.failedCount} failed)` : ""),
      );
      void loadDetail(schedule.id, true);
    } catch (err: any) {
      setError(err?.message || "Failed to broadcast WhatsApp reminder.");
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleRunNow = async () => {
    if (!schedule) return;
    setActionLoadingKey("run");
    setActionSuccess(null);
    setError(null);
    try {
      await apiRunCourseScheduleNow(schedule.id);
      setActionSuccess("Course practice calling window triggered successfully.");
      void loadDetail(schedule.id, true);
    } catch (err: any) {
      setError(err?.message || "Failed to trigger practice run.");
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleTogglePause = async () => {
    if (!schedule) return;
    setActionLoadingKey("pause");
    setError(null);
    try {
      const nextStatus = schedule.status === "paused" ? "active" : "paused";
      const updated = await apiUpdateCourseSchedule(schedule.id, {
        status: nextStatus,
      });
      setSchedule((prev) => (prev ? { ...prev, ...updated } : updated));
      onUpdated(updated);
      setActionSuccess(
        `Schedule ${nextStatus === "paused" ? "paused" : "resumed"} successfully.`,
      );
    } catch (err: any) {
      setError(err?.message || "Failed to update schedule status.");
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleDelete = async () => {
    if (!schedule) return;
    if (!window.confirm(`Are you sure you want to delete "${schedule.title}"?`)) {
      return;
    }
    setActionLoadingKey("delete");
    setError(null);
    try {
      await apiDeleteCourseSchedule(schedule.id);
      onDeleted(schedule.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to delete schedule.");
      setActionLoadingKey(null);
    }
  };

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-50 text-blue-700 border-blue-200",
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200",
    completed: "bg-neutral-100 text-neutral-700 border-neutral-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={schedule?.title ?? "Course Schedule Details"}
      description={schedule?.course?.title ? `Course: ${schedule.course.title}` : undefined}
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      {loading && !schedule ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : schedule ? (
        <div className="mt-3 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}
          {actionSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
              {actionSuccess}
            </div>
          )}

          {/* Quick Header Badges & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                  statusColors[schedule.status] ?? "bg-neutral-50 text-neutral-700"
                }`}
              >
                {schedule.status}
              </span>
              <span className="text-xs font-medium text-neutral-600">
                {schedule.scheduleType === "recurring" ? "Recurring Weekly" : "One-Time"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(schedule);
                }}
              >
                Reschedule / Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTogglePause}
                disabled={actionLoadingKey !== null}
              >
                {actionLoadingKey === "pause" ? (
                  <span className="flex items-center gap-1.5">
                    <Spinner size="sm" />
                    Updating...
                  </span>
                ) : schedule.status === "paused" ? (
                  "Resume"
                ) : (
                  "Pause"
                )}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-neutral-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("overview")}
              className={`border-b-2 py-2 px-3 transition-colors ${
                activeTab === "overview"
                  ? "border-neutral-900 text-neutral-950"
                  : "border-transparent text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Overview & Timing
            </button>
            <button
              onClick={() => setActiveTab("runs")}
              className={`border-b-2 py-2 px-3 transition-colors ${
                activeTab === "runs"
                  ? "border-neutral-900 text-neutral-950"
                  : "border-transparent text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Run History ({schedule.runs?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("notifications")}
              className={`border-b-2 py-2 px-3 transition-colors ${
                activeTab === "notifications"
                  ? "border-neutral-900 text-neutral-950"
                  : "border-transparent text-neutral-500 hover:text-neutral-900"
              }`}
            >
              WhatsApp Reminder Logs ({schedule.recentNotifications?.length ?? 0})
            </button>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-3.5 text-xs text-neutral-700">
              {schedule.description && (
                <p className="text-neutral-600 leading-relaxed bg-white p-3 rounded-lg border border-neutral-100">
                  {schedule.description}
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-neutral-200/70 p-3 bg-white space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Active Calling Hours
                  </span>
                  <p className="text-sm font-semibold text-neutral-950">
                    {schedule.timeWindowStart} – {schedule.timeWindowEnd}
                  </p>
                  <p className="text-[11px] text-neutral-500">Timezone: {schedule.timezone}</p>
                </div>

                <div className="rounded-xl border border-neutral-200/70 p-3 bg-white space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Cadence / Days
                  </span>
                  {schedule.scheduleType === "recurring" ? (
                    <div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {schedule.daysOfWeek.map((day) => (
                          <span
                            key={day}
                            className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-800"
                          >
                            {DAY_NAMES[day]}
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Active from {schedule.startDate} {schedule.endDate ? `to ${schedule.endDate}` : ""}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-neutral-950">{schedule.startDate}</p>
                  )}
                </div>
              </div>

              {/* WhatsApp Prior Reminder Box */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-white">
                      <WhatsappLogo className="w-3.5 h-3.5 shrink-0" weight="fill" />
                    </span>
                    <span className="font-semibold text-emerald-950">
                      WhatsApp Advance Reminder
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-800">
                    {schedule.notifyWhatsappPrior
                      ? `${schedule.notifyMinutesBefore} mins prior`
                      : "Disabled"}
                  </span>
                </div>
                {schedule.notifyWhatsappPrior && (
                  <div className="text-[11px] text-emerald-900 flex items-center justify-between border-t border-emerald-200/60 pt-1.5">
                    <span className="text-neutral-500">Sender Line:</span>
                    <span className="font-semibold text-neutral-900">
                      {(() => {
                        const targetId = schedule.whatsappChannelId || defaultWhatsappChannelId;
                        const ch = whatsappChannels.find((c) => c.id === targetId);
                        if (ch) return formatChannelLabel(ch);
                        return schedule.whatsappChannelId ? "Custom Line" : "Default Organization Line";
                      })()}
                    </span>
                  </div>
                )}
                {schedule.customMessage && (
                  <p className="text-[11px] text-emerald-900 bg-white/70 p-2 rounded border border-emerald-100 italic">
                    &ldquo;{schedule.customMessage}&rdquo;
                  </p>
                )}
                {schedule.lastNotificationSentAt && (
                  <p className="text-[10px] text-emerald-700">
                    Last reminder dispatched: {new Date(schedule.lastNotificationSentAt).toLocaleString()}
                  </p>
                )}
              </div>

              {/* On Demand Execution Controls */}
              <div className="rounded-xl border border-neutral-200 bg-white p-3.5 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Manual Triggers
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNotifyNow}
                    disabled={actionLoadingKey !== null}
                    className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                  >
                    {actionLoadingKey === "notify" ? (
                      <span className="flex items-center gap-1.5">
                        <Spinner size="sm" />
                        Broadcasting...
                      </span>
                    ) : (
                      "Broadcast WhatsApp Reminder Now"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunNow}
                    disabled={actionLoadingKey !== null}
                  >
                    {actionLoadingKey === "run" ? (
                      <span className="flex items-center gap-1.5">
                        <Spinner size="sm" />
                        Triggering...
                      </span>
                    ) : (
                      "Trigger Practice Window Now"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Runs History */}
          {activeTab === "runs" && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(!schedule.runs || schedule.runs.length === 0) ? (
                <p className="text-xs text-neutral-500 py-6 text-center">
                  No execution runs recorded yet. Runs occur automatically during active hours.
                </p>
              ) : (
                schedule.runs.map((run) => (
                  <div
                    key={run.id}
                    className="flex flex-col gap-1.5 p-2.5 rounded-lg border border-neutral-100 bg-neutral-50 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-neutral-900">{run.runDate}</p>
                        <p className="text-[11px] text-neutral-500">
                          {run.startedAt ? new Date(run.startedAt).toLocaleTimeString() : "Pending"}
                          {run.telenowCampaignId ? ` • Campaign: ${run.telenowCampaignId.slice(0, 12)}…` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-white px-2 py-0.5 border border-neutral-200 text-[10px] font-medium text-neutral-600">
                          Dialed: {run.targetsCount}
                        </span>
                        <span className="rounded bg-white px-2 py-0.5 border border-neutral-200 text-[10px] font-medium text-neutral-600">
                          Notified: {run.notifiedCount}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold capitalize ${
                            run.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : run.status === "calling"
                              ? "bg-blue-100 text-blue-800"
                              : run.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-neutral-200 text-neutral-800"
                          }`}
                        >
                          {run.status}
                        </span>
                      </div>
                    </div>
                    {run.error && (
                      <p className="rounded bg-red-50 p-1.5 text-[11px] text-red-700 border border-red-200">
                        {run.error}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Notification Logs */}
          {activeTab === "notifications" && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(!schedule.recentNotifications || schedule.recentNotifications.length === 0) ? (
                <p className="text-xs text-neutral-500 py-6 text-center">
                  No WhatsApp notifications recorded yet.
                </p>
              ) : (
                schedule.recentNotifications.map((n) => (
                  <div
                    key={n.id}
                    className="flex flex-col gap-1.5 p-2.5 rounded-lg border border-neutral-100 bg-neutral-50 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-neutral-900">
                          {n.user?.name || "Practitioner"} ({n.phone})
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          {n.sentAt ? new Date(n.sentAt).toLocaleString() : new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold capitalize ${
                          n.status === "sent"
                            ? "bg-emerald-100 text-emerald-800"
                            : n.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-neutral-200 text-neutral-800"
                        }`}
                      >
                        {n.status}
                      </span>
                    </div>
                    {n.error && (
                      <p className="rounded bg-red-50 p-1.5 text-[11px] text-red-700 border border-red-200">
                        {n.error}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={handleDelete}
              disabled={actionLoadingKey !== null}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1"
            >
              {actionLoadingKey === "delete" ? <Spinner size="sm" /> : null}
              Delete Schedule
            </button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
