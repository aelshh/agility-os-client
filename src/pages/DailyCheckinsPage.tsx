import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  apiCreateCheckinSchedule,
  apiGetCheckinRun,
  apiListCheckinRuns,
  apiListCheckinSchedules,
  apiRunCheckinNow,
  apiUpdateCheckinSchedule,
} from "../api/checkins";
import type {
  CheckinRunDetail,
  CheckinRunListItem,
  CheckinRunStatus,
  CheckinSchedule,
  CheckinScheduleList,
  CheckinStatus,
} from "../api/checkins";
import { apiGetTelenowStatus } from "../api/telenow";
import { Button, Spinner } from "../components";
import { useAuth } from "../features/auth";
import { pageVariants, stagger, fadeUp } from "../lib/animation";
import { cn } from "../lib/cn";

const metaLabel = "text-xs font-medium uppercase tracking-wide text-neutral-400";

const RUN_BADGE: Record<CheckinRunStatus, { label: string; cls: string }> = {
  pending: { label: "Scheduled", cls: "bg-neutral-100 text-neutral-700" },
  provisioning: { label: "Placement calls…", cls: "bg-amber-100 text-amber-700" },
  completed: { label: "Calls placed", cls: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", cls: "bg-red-100 text-red-700" },
  skipped: { label: "Nothing to call", cls: "bg-neutral-100 text-neutral-500" },
};

const CHECKIN_BADGE: Record<CheckinStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-neutral-100 text-neutral-600" },
  queued: { label: "Queued", cls: "bg-sky-100 text-sky-700" },
  calling: { label: "Calling", cls: "bg-sky-100 text-sky-700" },
  answered: { label: "Answered", cls: "bg-indigo-100 text-indigo-700" },
  no_answer: { label: "No answer", cls: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", cls: "bg-red-100 text-red-700" },
  skipped: { label: "Skip", cls: "bg-neutral-100 text-neutral-500" },
};

function StatusBadge({
  status,
  map,
}: {
  status: string;
  map: Record<string, { label: string; cls: string }>;
}) {
  const entry = map[status] ?? { label: status, cls: "bg-neutral-100 text-neutral-600" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg px-2 py-1 text-xs font-semibold",
        entry.cls,
      )}
    >
      {entry.label}
    </span>
  );
}

const inputCls =
  "w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-950 outline-none transition-all placeholder:text-neutral-500 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

// ---------------------------------------------------------------------------
// Create + edit schedule form
// ---------------------------------------------------------------------------

function ScheduleForm({
  initial,
  defaultScript,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Pick<CheckinSchedule, "title" | "timeLocal" | "questionScript" | "enabled">;
  defaultScript: string;
  submitLabel: string;
  onSubmit: (values: {
    title: string;
    timeLocal: string;
    questionScript: string;
    enabled?: boolean;
  }) => Promise<void>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [timeLocal, setTimeLocal] = useState(initial?.timeLocal ?? "08:45");
  const [questionScript, setQuestionScript] = useState(
    initial?.questionScript ?? defaultScript,
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Give your check-in a title.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(timeLocal)) {
      toast.error("Pick a time (HH:MM).");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        timeLocal,
        questionScript: questionScript.trim() || defaultScript,
        enabled: initial?.enabled,
      });
    } catch (err) {
      const message =
        (err as { message?: string })?.message ?? "Couldn't save the check-in.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      variants={fadeUp}
      className="w-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="grid w-full gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="checkin-title" className={metaLabel}>
            Title
          </label>
          <input
            id="checkin-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Daily status call"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="checkin-time" className={metaLabel}>
            Time (organisation timezone)
          </label>
          <input
            id="checkin-time"
            type="time"
            value={timeLocal}
            onChange={(e) => setTimeLocal(e.target.value)}
            className={cn(inputCls, "w-full")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="checkin-script" className={metaLabel}>
            What the voice agent asks
          </label>
          <textarea
            id="checkin-script"
            value={questionScript}
            onChange={(e) => setQuestionScript(e.target.value)}
            rows={6}
            className={cn(inputCls, "resize-y leading-relaxed")}
          />
          <p className="text-xs text-neutral-500">
            Your direct reports get a short spoken call each day. The agent
            collects their report, suggestions, and updates.{" "}
            {"{{scheduler_name}}"} is replaced with your name.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button loading={saving} onClick={() => void handleSubmit()}>
            {submitLabel}
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Run detail (per-person results for a run)
// ---------------------------------------------------------------------------

function RunDetailView({ detail }: { detail: CheckinRunDetail }) {
  const withSummary = detail.checkins.filter((c) => c.summary);
  const called = detail.checkins.filter(
    (c) => c.status === "answered" || c.status === "completed",
  );

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-4">
        <div className="min-w-0">
          <h3 className="font-serif text-base font-medium text-neutral-950">
            {detail.schedule.title}
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            {detail.run.runDate} ·{" "}
            {called.length}/{detail.checkins.length} reached ·{" "}
            {withSummary.length} summaries
          </p>
        </div>
        <StatusBadge status={detail.run.status} map={RUN_BADGE} />
      </div>

      {detail.checkins.length === 0 ? (
        <p className="px-5 py-6 text-sm text-neutral-500">
          No one was dialed this run.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {detail.checkins.map((checkin) => (
            <li key={checkin.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  {checkin.person.image ? (
                    <img
                      src={checkin.person.image}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full border border-neutral-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-semibold text-neutral-700">
                      {(checkin.person.name ?? "?")[0]?.toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-950">
                      {checkin.person.name ?? "Unknown"}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {checkin.person.email ?? "—"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={checkin.status} map={CHECKIN_BADGE} />
              </div>

              {checkin.summary && (
                <div className="mt-3 grid w-full gap-3 rounded-xl bg-neutral-50 p-3">
                  {checkin.summary.report && (
                    <SummarySection label="Report" text={checkin.summary.report} />
                  )}
                  {checkin.summary.suggestions && (
                    <SummarySection
                      label="Suggestions"
                      text={checkin.summary.suggestions}
                    />
                  )}
                  {checkin.summary.updates && (
                    <SummarySection label="Updates" text={checkin.summary.updates} />
                  )}
                </div>
              )}

              {checkin.error && (
                <p className="mt-2 text-xs leading-relaxed text-red-600">
                  {checkin.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SummarySection({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-neutral-700">{text}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DailyCheckinsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isArchitect = user?.role === "architect";

  const [data, setData] = useState<CheckinScheduleList | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [runs, setRuns] = useState<CheckinRunListItem[] | null>(null);
  const [detail, setDetail] = useState<CheckinRunDetail | null>(null);
  const [busyRunId, setBusyRunId] = useState<string | null>(null);
  const [busyToggleId, setBusyToggleId] = useState<string | null>(null);
  const [telenowConfigured, setTelenowConfigured] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiListCheckinSchedules());
    } catch {
      toast.error("Couldn't load your check-in schedules.");
    }
  }, []);

  useEffect(() => {
    void load();
    if (isArchitect) {
      apiGetTelenowStatus()
        .then((s) => setTelenowConfigured(s.configured))
        .catch(() => setTelenowConfigured(false));
    }
  }, [load, isArchitect]);

  const handleCreate = async (values: {
    title: string;
    timeLocal: string;
    questionScript: string;
  }) => {
    await apiCreateCheckinSchedule(values);
    toast.success("Daily check-in scheduled.");
    setCreating(false);
    await load();
  };

  const handleUpdate = async (
    schedule: CheckinSchedule,
    values: {
      title: string;
      timeLocal: string;
      questionScript: string;
      enabled?: boolean;
    },
  ) => {
    await apiUpdateCheckinSchedule(schedule.id, values);
    toast.success("Check-in updated.");
    setEditingId(null);
    await load();
    if (detail?.schedule.id === schedule.id) {
      setRuns(await apiListCheckinRuns(schedule.id));
    }
  };

  const handleRunNow = async (schedule: CheckinSchedule) => {
    setBusyRunId(schedule.id);
    try {
      await apiRunCheckinNow(schedule.id);
      toast.success("Check-in calls are being placed now.");
      await load();
    } catch (err) {
      const message =
        (err as { message?: string })?.message ?? "Couldn't start the run.";
      toast.error(message);
    } finally {
      setBusyRunId(null);
    }
  };

  const handleToggle = async (schedule: CheckinSchedule) => {
    setBusyToggleId(schedule.id);
    try {
      await apiUpdateCheckinSchedule(schedule.id, { enabled: !schedule.enabled });
      await load();
    } catch {
      toast.error("Couldn't update the schedule.");
    } finally {
      setBusyToggleId(null);
    }
  };

  const openHistory = async (schedule: CheckinSchedule) => {
    if (runs && detail?.schedule.id === schedule.id) {
      setDetail(null);
      setRuns(null);
      return;
    }
    setDetail(null);
    setRuns(null);
    try {
      const history = await apiListCheckinRuns(schedule.id);
      setRuns(history);
      if (history.length > 0) {
        setDetail(await apiGetCheckinRun(history[0].id));
      }
    } catch {
      toast.error("Couldn't load run history.");
    }
  };

  const selectRun = async (run: CheckinRunListItem) => {
    try {
      setDetail(await apiGetCheckinRun(run.id));
    } catch {
      toast.error("Couldn't load this run.");
    }
  };

  return (
    <motion.div
      key="checkins"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex min-h-screen flex-col items-start gap-6 bg-neutral-50 px-4 py-6 font-sans sm:px-6 lg:p-8"
    >
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="flex w-full flex-col gap-4"
      >
        <motion.div
          variants={fadeUp}
          className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0">
            <h1 className="font-serif text-3xl font-medium tracking-normal text-neutral-950">
              Daily check-ins
            </h1>
            <p className="mt-1 text-sm font-medium text-neutral-600">
              Each day an AI voice agent calls the people who report to you to
              collect their status, suggestions, and updates — then you review
              the summaries here.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                if (telenowConfigured === false) {
                  if (isArchitect) {
                    toast.error("Please connect your Telenow API key in Settings before creating check-ins.");
                    void router.navigate({ to: "/profile" });
                  } else {
                    toast.error("Your organisation must connect Telenow Voice AI before scheduling check-ins. Please contact an architect.");
                  }
                  return;
                }
                setCreating((v) => !v);
                setEditingId(null);
              }}
              icon={
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M10 4v12M4 10h12" />
                </svg>
              }
            >
              New check-in
            </Button>
          </div>
        </motion.div>

        {telenowConfigured === false && (
          <motion.div
            variants={fadeUp}
            className="flex w-full flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 font-bold text-xs text-amber-900">
                !
              </span>
              <div>
                <p className="font-semibold text-amber-950">Voice AI Integration Required</p>
                <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                  Telenow Voice AI is not connected for your organisation. An API key must be configured in Settings before automated daily check-in calls can be placed.
                </p>
              </div>
            </div>
            {isArchitect && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-300 bg-white hover:bg-amber-100/50 text-amber-950"
                onClick={() => void router.navigate({ to: "/profile" })}
              >
                Configure in Settings
              </Button>
            )}
          </motion.div>
        )}

        {creating && data && (
          <ScheduleForm
            defaultScript={data.defaultScript}
            submitLabel="Schedule it"
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        )}

        {data === null ? (
          <div className="flex w-full items-center justify-center py-24">
            <Spinner size="md" className="text-neutral-700" />
          </div>
        ) : data.schedules.length === 0 && !creating ? (
          <motion.div
            variants={fadeUp}
            className="w-full rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm sm:p-10"
          >
            <p className="text-sm font-semibold text-neutral-900">
              No daily check-ins yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
              Schedule a recurring voice call to stay in the loop with everyone
              working under you — no meetings, no emails, just a short spoken
              update.
            </p>
            <Button
              className="mt-5"
              onClick={() => setCreating(true)}
            >
              Create your first check-in
            </Button>
          </motion.div>
        ) : (
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="grid w-full gap-4 md:grid-cols-2"
          >
            {data.schedules.map((schedule) => (
              <motion.article
                key={schedule.id}
                variants={fadeUp}
                className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <h2 className="font-serif text-lg font-medium leading-snug text-neutral-950">
                      {schedule.title}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-600">
                      Daily at {schedule.timeLocal}
                      {data.timezone ? ` (${data.timezone})` : ""}
                    </p>
                  </div>
                  <StatusBadge status={schedule.todayRunStatus ?? "pending"} map={RUN_BADGE} />
                </div>

                <div className="flex flex-wrap gap-2 px-5">
                  <span className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                    {schedule.directReportCount}{" "}
                    {schedule.directReportCount === 1 ? "report" : "reports"}
                  </span>
                  <span className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                    {schedule.callableCount} callable
                  </span>
                  <span className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                    {schedule.enabled ? "On" : "Paused"}
                  </span>
                </div>

                {editingId === schedule.id && data && (
                  <div className="border-t border-neutral-100 p-4 sm:p-5">
                    <ScheduleForm
                      initial={schedule}
                      defaultScript={data.defaultScript}
                      submitLabel="Save changes"
                      onSubmit={(values) => handleUpdate(schedule, values)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-neutral-100 bg-neutral-50/60 p-4 sm:p-5">
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busyRunId === schedule.id}
                    onClick={() => void handleRunNow(schedule)}
                  >
                    Run now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void openHistory(schedule)}
                  >
                    {runs && detail?.schedule.id === schedule.id
                      ? "Close history"
                      : "History"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(editingId === schedule.id ? null : schedule.id);
                      setCreating(false);
                    }}
                  >
                    {editingId === schedule.id ? "Cancel edit" : "Edit"}
                  </Button>
                  <Button
                    size="sm"
                    variant={schedule.enabled ? "ghost" : "outline"}
                    loading={busyToggleId === schedule.id}
                    onClick={() => void handleToggle(schedule)}
                  >
                    {schedule.enabled ? "Pause" : "Resume"}
                  </Button>
                </div>

                {runs && detail?.schedule.id === schedule.id && (
                  <div className="flex w-full flex-col gap-4 border-t border-neutral-100 p-4 sm:p-5">
                    {runs.length === 0 ? (
                      <p className="text-sm text-neutral-500">
                        No runs yet. Press “Run now” to fire today’s calls
                        immediately.
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {runs.map((run) => (
                            <button
                              key={run.id}
                              type="button"
                              onClick={() => void selectRun(run)}
                              className={cn(
                                "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                                detail.run.id === run.id
                                  ? "border-neutral-900 bg-neutral-900 text-white"
                                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400",
                              )}
                            >
                              {run.runDate}
                            </button>
                          ))}
                        </div>
                        <RunDetailView detail={detail} />
                      </>
                    )}
                  </div>
                )}
              </motion.article>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}