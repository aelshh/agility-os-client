import { WhatsappLogo } from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/ui/Spinner";
import type { Course } from "../../api/courses";
import { apiListCourses } from "../../api/courses";
import {
  apiListWhatsAppChannels,
  formatChannelLabel,
  type WhatsAppChannel,
} from "../../api/whatsapp";
import type {
  CourseSchedule,
  CourseScheduleType,
  CreateCourseScheduleInput,
  UpdateCourseScheduleInput,
} from "../../api/schedules";
import {
  apiCreateCourseSchedule,
  apiUpdateCourseSchedule,
} from "../../api/schedules";

interface CreateScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (schedule: CourseSchedule) => void;
  initialDate?: string;
  initialCourseId?: string;
  scheduleToEdit?: CourseSchedule | null;
}

const DAYS_OF_WEEK = [
  { id: 1, label: "Mon", full: "Monday" },
  { id: 2, label: "Tue", full: "Tuesday" },
  { id: 3, label: "Wed", full: "Wednesday" },
  { id: 4, label: "Thu", full: "Thursday" },
  { id: 5, label: "Fri", full: "Friday" },
  { id: 6, label: "Sat", full: "Saturday" },
  { id: 0, label: "Sun", full: "Sunday" },
];

const LEAD_TIME_OPTIONS = [
  { value: 15, label: "15 mins before" },
  { value: 30, label: "30 mins before (Recommended)" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 0, label: "At start of window" },
];

export function CreateScheduleModal({
  open,
  onClose,
  onSuccess,
  initialDate,
  initialCourseId,
  scheduleToEdit,
}: CreateScheduleModalProps) {
  const isEditing = Boolean(scheduleToEdit);

  const [courses, setCourses] = useState<Course[]>([]);
  const [whatsappChannels, setWhatsappChannels] = useState<WhatsAppChannel[]>([]);
  const [defaultWhatsappChannelId, setDefaultWhatsappChannelId] = useState<string | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [courseId, setCourseId] = useState(
    scheduleToEdit?.courseId ?? initialCourseId ?? "",
  );
  const [title, setTitle] = useState(scheduleToEdit?.title ?? "");
  const [description, setDescription] = useState(
    scheduleToEdit?.description ?? "",
  );
  const [scheduleType, setScheduleType] = useState<CourseScheduleType>(
    scheduleToEdit?.scheduleType ?? "recurring",
  );
  const [startDate, setStartDate] = useState(
    scheduleToEdit?.startDate ??
      initialDate ??
      new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(scheduleToEdit?.endDate ?? "");
  const [selectedDays, setSelectedDays] = useState<number[]>(
    scheduleToEdit?.daysOfWeek ?? [1, 2, 3, 4, 5],
  );
  const [timeWindowStart, setTimeWindowStart] = useState(
    scheduleToEdit?.timeWindowStart ?? "10:00",
  );
  const [timeWindowEnd, setTimeWindowEnd] = useState(
    scheduleToEdit?.timeWindowEnd ?? "14:00",
  );
  const [whatsappChannelId, setWhatsappChannelId] = useState<string | null>(
    scheduleToEdit?.whatsappChannelId ?? null,
  );
  const [notifyWhatsappPrior, setNotifyWhatsappPrior] = useState(
    scheduleToEdit?.notifyWhatsappPrior ?? true,
  );
  const [notifyMinutesBefore, setNotifyMinutesBefore] = useState(
    scheduleToEdit?.notifyMinutesBefore ?? 30,
  );
  const [customMessage, setCustomMessage] = useState(
    scheduleToEdit?.customMessage ?? "",
  );

  useEffect(() => {
    if (!open) return;

    setLoadingCourses(true);
    setError(null);

    void apiListWhatsAppChannels()
      .then((res) => {
        setWhatsappChannels(res.channels);
        setDefaultWhatsappChannelId(res.defaultChannelId);
      })
      .catch((err) => {
        console.error("Failed to load WhatsApp channels in schedule modal", err);
      });

    void apiListCourses()
      .then((list) => {
        setCourses(list);
        if (scheduleToEdit) {
          setCourseId(scheduleToEdit.courseId);
          setTitle(scheduleToEdit.title);
          setDescription(scheduleToEdit.description ?? "");
          setScheduleType(scheduleToEdit.scheduleType);
          setStartDate(scheduleToEdit.startDate);
          setEndDate(scheduleToEdit.endDate ?? "");
          setSelectedDays(scheduleToEdit.daysOfWeek ?? [1, 2, 3, 4, 5]);
          setTimeWindowStart(scheduleToEdit.timeWindowStart);
          setTimeWindowEnd(scheduleToEdit.timeWindowEnd);
          setWhatsappChannelId(scheduleToEdit.whatsappChannelId ?? null);
          setNotifyWhatsappPrior(scheduleToEdit.notifyWhatsappPrior);
          setNotifyMinutesBefore(scheduleToEdit.notifyMinutesBefore);
          setCustomMessage(scheduleToEdit.customMessage ?? "");
        } else {
          const selected = initialCourseId || (list.length > 0 ? list[0]?.id ?? "" : "");
          setCourseId(selected);
          if (initialDate) setStartDate(initialDate);
          const matched = list.find((c) => c.id === selected);
          setTitle(matched ? `${matched.title} Practice Window` : "");
          setDescription("");
          setScheduleType("recurring");
          setEndDate("");
          setSelectedDays([1, 2, 3, 4, 5]);
          setTimeWindowStart("10:00");
          setTimeWindowEnd("14:00");
          setWhatsappChannelId(matched?.whatsappChannelId ?? null);
          setNotifyWhatsappPrior(true);
          setNotifyMinutesBefore(30);
          setCustomMessage("");
        }
      })
      .catch((err) => {
        setError(err?.message || "Failed to load courses");
      })
      .finally(() => {
        setLoadingCourses(false);
      });
  }, [open, scheduleToEdit, initialDate, initialCourseId]);

  // Auto-fill title from course selection if title is empty
  const handleCourseChange = (newCourseId: string) => {
    setCourseId(newCourseId);
    const matched = courses.find((c) => c.id === newCourseId);
    if (!title || title.endsWith("Practice Window")) {
      if (matched) {
        setTitle(`${matched.title} Practice Window`);
      }
    }
    if (!isEditing && matched?.whatsappChannelId) {
      setWhatsappChannelId(matched.whatsappChannelId);
    }
  };

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== dayId));
      }
    } else {
      setSelectedDays([...selectedDays, dayId].sort((a, b) => a - b));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!courseId) {
      setError("Please select a course to schedule.");
      return;
    }
    if (!title.trim()) {
      setError("Please provide a schedule title.");
      return;
    }
    if (timeWindowStart >= timeWindowEnd) {
      setError("Calling window end time must be after start time.");
      return;
    }
    if (scheduleType === "recurring" && selectedDays.length === 0) {
      setError("Please select at least one active day of the week.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && scheduleToEdit) {
        const payload: UpdateCourseScheduleInput = {
          courseId,
          title: title.trim(),
          description: description.trim() || null,
          scheduleType,
          startDate,
          endDate: endDate ? endDate : null,
          daysOfWeek: selectedDays,
          timeWindowStart,
          timeWindowEnd,
          whatsappChannelId: whatsappChannelId || null,
          notifyWhatsappPrior,
          notifyMinutesBefore,
          customMessage: customMessage.trim() || null,
        };
        const updated = await apiUpdateCourseSchedule(
          scheduleToEdit.id,
          payload,
        );
        onSuccess(updated);
        onClose();
      } else {
        const payload: CreateCourseScheduleInput = {
          courseId,
          title: title.trim(),
          description: description.trim() || null,
          scheduleType,
          startDate,
          endDate: endDate ? endDate : null,
          daysOfWeek: selectedDays,
          timeWindowStart,
          timeWindowEnd,
          whatsappChannelId: whatsappChannelId || null,
          notifyWhatsappPrior,
          notifyMinutesBefore,
          customMessage: customMessage.trim() || null,
          audienceType: "course_default",
        };
        const created = await apiCreateCourseSchedule(payload);
        onSuccess(created);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save course schedule.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Reschedule / Edit Course" : "Schedule Course Practice"}
      description="Configure active outbound calling hours and advance WhatsApp notifications for practitioners."
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Course Picker */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
            Select Course <span className="text-red-500">*</span>
          </label>
          {loadingCourses ? (
            <div className="flex items-center gap-2 text-xs text-neutral-500 py-2">
              <Spinner size="sm" /> Loading courses...
            </div>
          ) : (
            <select
              value={courseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              required
            >
              <option value="" disabled>
                -- Choose a course --
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} {c.status !== "published" ? `(${c.status})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Schedule Title */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
            Schedule Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekly Sales Onboarding Drills"
            className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            required
          />
        </div>

        {/* Recurrence Type Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
            Schedule Cadence
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScheduleType("recurring")}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-sm font-medium transition-all ${
                scheduleType === "recurring"
                  ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              Recurring (Weekly)
            </button>
            <button
              type="button"
              onClick={() => setScheduleType("one_time")}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-sm font-medium transition-all ${
                scheduleType === "one_time"
                  ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              One-Time Date
            </button>
          </div>
        </div>

        {/* Days of Week (for Recurring) */}
        {scheduleType === "recurring" && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
              Active Days of the Week
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {DAYS_OF_WEEK.map((d) => {
                const active = selectedDays.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDay(d.id)}
                    className={`h-9 min-w-10 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                      active
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              The AI practice sessions will only trigger on the selected days.
            </p>
          </div>
        )}

        {/* Dates Range */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
              {scheduleType === "recurring" ? "Start Date" : "Date"} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              required
            />
          </div>

          {scheduleType === "recurring" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
          )}
        </div>

        {/* Calling Window */}
        <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <WhatsappLogo className="w-4 h-4 text-emerald-600 shrink-0" weight="fill" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
              Active Practice Calling Window
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Window Starts At
              </label>
              <input
                type="time"
                value={timeWindowStart}
                onChange={(e) => setTimeWindowStart(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Window Ends At
              </label>
              <input
                type="time"
                value={timeWindowEnd}
                onChange={(e) => setTimeWindowEnd(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none"
                required
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-neutral-500">
            Outbound practitioner calls are only placed between {timeWindowStart} and {timeWindowEnd}.
          </p>
        </div>

        {/* WhatsApp Notification Prior */}
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/30 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-white">
                <WhatsappLogo className="w-3.5 h-3.5 shrink-0" weight="fill" />
              </span>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-950 block">
                  Prior WhatsApp Reminder
                </span>
                <span className="text-[11px] text-emerald-800">
                  Notify practitioners on WhatsApp in advance before practice begins
                </span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifyWhatsappPrior}
                onChange={(e) => setNotifyWhatsappPrior(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {notifyWhatsappPrior && (
            <div className="space-y-3 pt-2 border-t border-emerald-100">
              {whatsappChannels.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-emerald-950 mb-1">
                    Sending WhatsApp Line
                  </label>
                  <select
                    value={whatsappChannelId || ""}
                    onChange={(e) => setWhatsappChannelId(e.target.value || null)}
                    className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs text-neutral-900 shadow-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">
                      {defaultWhatsappChannelId
                        ? `Use Default: ${formatChannelLabel(whatsappChannels.find((c) => c.id === defaultWhatsappChannelId) || { id: defaultWhatsappChannelId, name: "Default Sender", phone: "", status: "active" })}`
                        : "Use Organization Default Line"}
                    </option>
                    {whatsappChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {formatChannelLabel(c)} {c.id === defaultWhatsappChannelId ? "⭐ (Default)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-emerald-950 mb-1">
                  Reminder Advance Lead Time
                </label>
                <select
                  value={notifyMinutesBefore}
                  onChange={(e) => setNotifyMinutesBefore(Number(e.target.value))}
                  className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs text-neutral-900 shadow-sm focus:border-emerald-600 focus:outline-none"
                >
                  {LEAD_TIME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-emerald-950 mb-1">
                  Custom WhatsApp Note (Optional)
                </label>
                <input
                  type="text"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="e.g. Please find a quiet space for your roleplay."
                  className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs text-neutral-900 shadow-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                {isEditing ? "Updating..." : "Scheduling..."}
              </span>
            ) : isEditing ? (
              "Update Schedule"
            ) : (
              "Save & Schedule"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
