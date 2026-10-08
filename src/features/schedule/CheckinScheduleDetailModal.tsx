import { useState, useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/ui/Spinner";
import type { CalendarEventItem } from "../../api/schedules";
import {
  apiRunCheckinNow,
  apiUpdateCheckinSchedule,
  apiDeleteCheckinSchedule,
} from "../../api/checkins";
import { toast } from "sonner";

interface CheckinScheduleDetailModalProps {
  open: boolean;
  event: CalendarEventItem | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function CheckinScheduleDetailModal({
  open,
  event,
  onClose,
  onUpdated,
  onDeleted,
}: CheckinScheduleDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [timeLocal, setTimeLocal] = useState("");
  const [questionScript, setQuestionScript] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState<
    "run" | "pause" | "delete" | null
  >(null);

  useEffect(() => {
    if (event) {
      setTitle(event.title || "Daily Check-in");
      setTimeLocal(event.startTime || "08:45");
      setQuestionScript(event.questionScript || "");
      setIsEditing(false);
      setActionLoadingKey(null);
    }
  }, [event]);

  if (!open || !event) return null;

  const handleRunNow = async () => {
    setActionLoadingKey("run");
    try {
      const res = await apiRunCheckinNow(event.scheduleId);
      if (res.outcome.ok) {
        toast.success("Daily check-in calls initiated for your direct reports.");
      } else {
        toast.error(res.outcome.error || "Failed to trigger check-in calls.");
      }
      onUpdated();
    } catch (err: any) {
      toast.error(err?.message || "Failed to trigger check-in calls.");
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleTogglePause = async () => {
    setActionLoadingKey("pause");
    try {
      const nextEnabled = event.status !== "active";
      await apiUpdateCheckinSchedule(event.scheduleId, {
        enabled: nextEnabled,
      });
      toast.success(
        `Daily check-in schedule ${nextEnabled ? "resumed" : "paused"} successfully.`,
      );
      onUpdated();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update schedule status.");
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${event.title}"?`)) {
      return;
    }
    setActionLoadingKey("delete");
    try {
      await apiDeleteCheckinSchedule(event.scheduleId);
      toast.success("Daily check-in schedule deleted.");
      onDeleted();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete schedule.");
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(timeLocal)) {
      toast.error("Pick a valid time (HH:MM).");
      return;
    }

    setSaving(true);
    try {
      await apiUpdateCheckinSchedule(event.scheduleId, {
        title: title.trim(),
        timeLocal: timeLocal.trim(),
        questionScript: questionScript.trim() || undefined,
      });
      toast.success("Daily check-in schedule updated successfully.");
      setIsEditing(false);
      onUpdated();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update schedule.");
    } finally {
      setSaving(false);
    }
  };

  // Parse script questions for clean display
  const parsedQuestions = (event.questionScript || "")
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^(\d+[.)]\s*|[-*•]\s*)/, "").trim())
    .filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Reschedule Daily Check-in" : event.title || "Daily Check-in"}
      description={
        isEditing
          ? "Update the calling time, title, and conversation questions."
          : `Manager: ${event.ownerName || "Team Lead"} • Daily AI Voice Check-in`
      }
      className="max-w-xl max-h-[90vh] overflow-y-auto"
    >
      <div className="mt-3 space-y-4">
        {/* Status & Quick Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                event.status === "active"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {event.status === "active" ? "Active" : "Paused"}
            </span>
            <span className="text-xs font-medium text-neutral-600">
              Weekdays (Mon–Fri)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {!isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
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
                  ) : event.status === "active" ? (
                    "Pause"
                  ) : (
                    "Resume"
                  )}
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={saving}
              >
                Cancel Edit
              </Button>
            )}
          </div>
        </div>

        {isEditing ? (
          /* Edit Form */
          <div className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">
                Check-in Title
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs text-neutral-900 shadow-sm focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Morning Standup Check-in"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">
                  Call Time (HH:MM)
                </label>
                <input
                  type="time"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs text-neutral-900 shadow-sm focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                  value={timeLocal}
                  onChange={(e) => setTimeLocal(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">
                  Timezone
                </label>
                <input
                  type="text"
                  disabled
                  value={event.timezone}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-100 px-3.5 py-2 text-xs text-neutral-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700">
                Question Script / Prompt (one question per line)
              </label>
              <textarea
                rows={4}
                className="w-full rounded-xl border border-neutral-300 bg-white p-3 text-xs leading-relaxed text-neutral-900 shadow-sm focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                value={questionScript}
                onChange={(e) => setQuestionScript(e.target.value)}
                placeholder="1. What progress have you made since our last check-in?&#10;2. What are your main priorities for today?&#10;3. Are you facing any blockers?"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                loading={saving}
              >
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          /* View Details */
          <div className="space-y-3.5 text-xs text-neutral-700">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-200/70 p-3 bg-white space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Scheduled Time
                </span>
                <p className="text-sm font-semibold text-neutral-950">
                  {event.startTime}
                </p>
                <p className="text-[11px] text-neutral-500">
                  Timezone: {event.timezone}
                </p>
              </div>

              <div className="rounded-xl border border-neutral-200/70 p-3 bg-white space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Cadence
                </span>
                <p className="text-sm font-semibold text-neutral-950">
                  Every Weekday (Mon–Fri)
                </p>
                <p className="text-[11px] text-neutral-500">
                  Outbound call to direct team reports
                </p>
              </div>
            </div>

            {/* Questions Asked Card */}
            <div className="rounded-xl border border-neutral-200 bg-white p-3.5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Check-in Questions
              </span>
              {parsedQuestions.length > 0 ? (
                <ul className="space-y-1.5 list-decimal pl-4 text-xs text-neutral-800">
                  {parsedQuestions.map((q, i) => (
                    <li key={i} className="leading-relaxed">
                      {q}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-neutral-500 italic">
                  Standard check-in questions: Progress, Priorities, Blockers, Suggestions.
                </p>
              )}
            </div>

            {/* Manual Execution Trigger Card */}
            <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900">
                  Live Manual Execution
                </span>
                <span className="text-[11px] text-purple-700 font-medium">
                  Trigger calls right now
                </span>
              </div>
              <p className="text-xs text-purple-950 leading-relaxed">
                Initiate the daily outbound voice check-in calls to your team immediately without waiting for the scheduled time.
              </p>
              <div className="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunNow}
                  disabled={actionLoadingKey !== null}
                  className="border-purple-300 text-purple-900 hover:bg-purple-100"
                >
                  {actionLoadingKey === "run" ? (
                    <span className="flex items-center gap-1.5">
                      <Spinner size="sm" />
                      Triggering calls...
                    </span>
                  ) : (
                    "Run Check-in Now"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={handleDelete}
            disabled={actionLoadingKey !== null || saving}
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
    </Modal>
  );
}
