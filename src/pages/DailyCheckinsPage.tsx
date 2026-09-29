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
  apiDeleteCheckinSchedule,
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
import {
  apiCheckNumberConnections,
  apiGetNumbers,
} from "../api/telephony";
import type { WorkspacePhoneNumber } from "../api/telephony";
import { Button, Spinner, Modal, Tabs } from "../components";
import { useAuth } from "../features/auth";
import { AudiencePicker } from "../features/courses/AudiencePicker";
import { VoiceSelector } from "../features/courses/VoiceSelector";
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

function parseScriptToQuestions(script?: string | null): string[] {
  if (!script || !script.trim()) {
    return [
      "What progress have you made since our last check-in?",
      "What are your main priorities for today?",
      "Are you facing any blockers or need support from the team?",
      "Do you have any suggestions or feedback to share?",
    ];
  }
  if (script.includes("You are running a short daily voice check-in")) {
    return [
      "What is your status and what happened since the last check-in?",
      "Do you have any suggestions for improvement?",
      "Are there any blockers or other updates worth knowing?",
    ];
  }
  const lines = script
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^(\d+[.)]\s*|[-*•]\s*)/, "").trim())
    .filter(Boolean);
  return lines.length > 0
    ? lines
    : [
        "What progress have you made since our last check-in?",
        "What are your main priorities for today?",
        "Are you facing any blockers or need support from the team?",
      ];
}

function serializeQuestionsToScript(questions: string[]): string {
  const valid = questions.map((q) => q.trim()).filter(Boolean);
  if (valid.length === 0) {
    return (
      "1. What progress have you made since our last check-in?\n" +
      "2. What are your main priorities for today?\n" +
      "3. Are you facing any blockers or need support from the team?"
    );
  }
  return valid.map((q, i) => `${i + 1}. ${q}`).join("\n");
}

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
  initial?: Pick<
    CheckinSchedule,
    | "id"
    | "title"
    | "timeLocal"
    | "questionScript"
    | "enabled"
    | "additionalUserIds"
    | "voice"
    | "voiceProvider"
    | "phoneNumberId"
    | "phoneNumber"
  >;
  defaultScript: string;
  submitLabel: string;
  onSubmit: (values: {
    title: string;
    timeLocal: string;
    questionScript: string;
    enabled?: boolean;
    additionalUserIds?: string[];
    voice?: string | null;
    voiceProvider?: string | null;
    phoneNumberId?: string | null;
    phoneNumber?: string | null;
  }) => Promise<void>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [timeLocal, setTimeLocal] = useState(initial?.timeLocal ?? "08:45");
  const [questions, setQuestions] = useState<string[]>(() =>
    parseScriptToQuestions(initial?.questionScript ?? defaultScript),
  );
  const [additionalUserIds, setAdditionalUserIds] = useState<string[]>(
    initial?.additionalUserIds ?? [],
  );
  const [voice, setVoice] = useState(initial?.voice ?? "cgSgspJ2msm6clMCkdW9");
  const [voiceProvider, setVoiceProvider] = useState(initial?.voiceProvider ?? "elevenlabs");
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(initial?.phoneNumberId ?? null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(initial?.phoneNumber ?? null);

  // Phone assignment modal state
  const [assignPhoneModalOpen, setAssignPhoneModalOpen] = useState(false);
  const [workspaceNumbers, setWorkspaceNumbers] = useState<WorkspacePhoneNumber[]>([]);
  const [carrierStatuses, setCarrierStatuses] = useState<Record<string, boolean | null>>({});
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [pendingReassignNumber, setPendingReassignNumber] = useState<WorkspacePhoneNumber | null>(null);

  const [saving, setSaving] = useState(false);

  const handleOpenPhoneModal = async () => {
    setAssignPhoneModalOpen(true);
    setLoadingNumbers(true);
    try {
      const [numRes, connRes] = await Promise.allSettled([
        apiGetNumbers(),
        apiCheckNumberConnections(),
      ]);

      if (numRes.status === "fulfilled") {
        setWorkspaceNumbers(numRes.value.numbers);
      } else {
        toast.error("Failed to load available phone numbers.");
      }

      if (connRes.status === "fulfilled") {
        const connMap: Record<string, boolean | null> = {};
        for (const conn of connRes.value.connections) {
          connMap[conn.id] = conn.matches;
        }
        setCarrierStatuses(connMap);
      }
    } finally {
      setLoadingNumbers(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Give your check-in a title.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(timeLocal)) {
      toast.error("Pick a time (HH:MM).");
      return;
    }
    const scriptToSave = serializeQuestionsToScript(questions);
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        timeLocal,
        questionScript: scriptToSave,
        enabled: initial?.enabled,
        additionalUserIds,
        voice,
        voiceProvider,
        phoneNumberId,
        phoneNumber,
      });
    } catch (err) {
      const message =
        (err as { message?: string })?.message ?? "Couldn't save the check-in.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const activeQuestionCount = questions.filter((q) => q.trim().length > 0).length;
  const CHECKIN_TABS = [
    { id: "basics", label: "Basics" },
    {
      id: "script",
      label: "Questions",
      count: activeQuestionCount > 0 ? activeQuestionCount : undefined,
    },
    { id: "voice", label: "Voice & Phone" },
    {
      id: "audience",
      label: "Audience",
      count: additionalUserIds.length > 0 ? additionalUserIds.length : undefined,
    },
  ];
  const [activeTab, setActiveTab] = useState("basics");
  const tabIndex = CHECKIN_TABS.findIndex((t) => t.id === activeTab);
  const isLastTab = tabIndex === CHECKIN_TABS.length - 1;

  return (
    <motion.div
      variants={fadeUp}
      className="w-full flex flex-col gap-6"
    >
      <Tabs
        items={CHECKIN_TABS}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab 1: Basics */}
      {activeTab === "basics" && (
        <div className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-7 shadow-sm">
          <div>
            <h2 className="font-serif text-lg font-medium text-neutral-950">
              Check-in Basics
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Set a descriptive title and choose what time the automated voice check-in call occurs each day.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="checkin-title" className={metaLabel}>
                Title
              </label>
              <input
                id="checkin-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Daily engineering standup sync"
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="checkin-time" className={metaLabel}>
                Call Time (organisation timezone)
              </label>
              <input
                id="checkin-time"
                type="time"
                value={timeLocal}
                onChange={(e) => setTimeLocal(e.target.value)}
                className={cn(inputCls, "w-full max-w-xs")}
              />
              <p className="text-xs text-neutral-500">
                Calls will automatically queue and dial your reports at this scheduled time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Questions */}
      {activeTab === "script" && (
        <div className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-medium text-neutral-950">
                Check-in Questions
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Specify the questions your AI assistant will ask each direct report during the call.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuestions((prev) => [...prev, ""])}
              className="text-xs shrink-0 self-start sm:self-auto min-h-9"
            >
              + Add Question
            </Button>
          </div>

          <div className="flex flex-col gap-3.5">
            {questions.map((question, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 sm:p-3.5 transition-all focus-within:border-neutral-900 focus-within:bg-white focus-within:ring-2 focus-within:ring-neutral-900/10"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-xs font-semibold text-neutral-800">
                  {index + 1}
                </span>
                <input
                  value={question}
                  onChange={(e) => {
                    const next = [...questions];
                    next[index] = e.target.value;
                    setQuestions(next);
                  }}
                  placeholder={`Question ${index + 1} (e.g. "What did you accomplish since our last sync?")`}
                  className="w-full bg-transparent text-sm text-neutral-950 placeholder:text-neutral-400 outline-none"
                />
                <div className="flex items-center gap-1 shrink-0">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...questions];
                        const temp = next[index - 1];
                        next[index - 1] = next[index];
                        next[index] = temp;
                        setQuestions(next);
                      }}
                      title="Move up"
                      className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 transition-colors"
                    >
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 15V5M5 10l5-5 5 5" />
                      </svg>
                    </button>
                  )}
                  {index < questions.length - 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...questions];
                        const temp = next[index + 1];
                        next[index + 1] = next[index];
                        next[index] = temp;
                        setQuestions(next);
                      }}
                      title="Move down"
                      className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 transition-colors"
                    >
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 5v10M5 10l5 5 5-5" />
                      </svg>
                    </button>
                  )}
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuestions(questions.filter((_, i) => i !== index));
                      }}
                      title="Remove question"
                      className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8m0-8l-8 8" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3.5 text-xs text-neutral-500 leading-relaxed">
            <span className="font-semibold text-neutral-700">Automated Assistant Flow: </span>
            The voice agent handles caller greetings, introduces the check-in, politely gathers answers to each question, asks brief follow-ups if unclear, and compiles an executive summary.
          </div>
        </div>
      )}

      {/* Tab 3: Voice & Phone */}
      {activeTab === "voice" && (
        <div className="flex flex-col gap-6">
          {/* Outbound Phone Line */}
          <div className="flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-7 shadow-sm">
            <div>
              <h2 className="font-serif text-lg font-medium text-neutral-950">
                Outbound Phone Line
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Assign a dedicated carrier phone line so reports see a recognized team caller ID.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                {phoneNumber ? (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-semibold text-neutral-950">
                        {phoneNumber}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Dedicated Caller ID
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Outbound check-in calls will originate from this dedicated line so reports recognize your team caller ID.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      Shared Carrier Pool (Default)
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Assign a dedicated phone line from your workspace to display a consistent caller ID.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant={phoneNumber ? "outline" : "primary"}
                size="sm"
                onClick={() => void handleOpenPhoneModal()}
                className="min-h-10 text-xs"
              >
                {phoneNumber ? "Change line" : "Assign phone line"}
              </Button>
              {phoneNumber && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPhoneNumberId(null);
                    setPhoneNumber(null);
                  }}
                  className="min-h-10 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* AI Voice Persona */}
        <div className="flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-7 shadow-sm">
          <div>
            <h2 className="font-serif text-lg font-medium text-neutral-950">
              AI Voice Persona
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Choose the voice your reports will hear during the check-in call. Audition any voice in the catalog below.
            </p>
          </div>

          <VoiceSelector
            selectedVoiceId={voice}
            selectedProvider={voiceProvider}
            onSelectVoice={(vId, provider) => {
              setVoice(vId);
              setVoiceProvider(provider);
            }}
          />
        </div>
      </div>
    )}

      {/* Tab 4: Audience */}
      {activeTab === "audience" && (
        <div className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-7 shadow-sm">
          <div>
            <h2 className="font-serif text-lg font-medium text-neutral-950">
              Check-in Participants & Audience
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Your direct reports are automatically included. You can optionally add other members in your reporting hierarchy below.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 overflow-hidden bg-neutral-50/50 p-2 sm:p-3">
            <AudiencePicker
              selected={additionalUserIds}
              onChange={setAdditionalUserIds}
              allowAnyRole={true}
              disabled={saving}
            />
          </div>
        </div>
      )}

      {/* Navigation / Actions Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          )}
          {tabIndex > 0 && (
            <Button
              variant="outline"
              onClick={() => setActiveTab(CHECKIN_TABS[tabIndex - 1].id)}
              disabled={saving}
            >
              Back
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isLastTab && (
            <Button
              variant="outline"
              loading={saving}
              onClick={() => void handleSubmit()}
            >
              Save draft
            </Button>
          )}
          {isLastTab ? (
            <Button loading={saving} onClick={() => void handleSubmit()}>
              {submitLabel}
            </Button>
          ) : (
            <Button onClick={() => setActiveTab(CHECKIN_TABS[tabIndex + 1].id)}>
              Next
            </Button>
          )}
        </div>
      </div>

      {/* Assign Phone Line Modal */}
      <Modal
        open={assignPhoneModalOpen}
        onClose={() => {
          setAssignPhoneModalOpen(false);
          setPendingReassignNumber(null);
        }}
        title="Select Outbound Phone Line"
        description="Choose a phone line from your organisation's carrier pool for this daily check-in."
      >
        <div className="flex flex-col gap-4">
          {pendingReassignNumber ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-200/80 text-amber-800">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-amber-950 text-sm">
                    Reassign {pendingReassignNumber.e164}?
                  </h4>
                  <p className="mt-1 leading-relaxed text-amber-900">
                    {pendingReassignNumber.assignedCheckin ? (
                      <>
                        This number is currently bound to check-in{" "}
                        <strong className="font-semibold text-amber-950">
                          {pendingReassignNumber.assignedCheckin.title}
                        </strong>
                        . Reassigning will detach it from that check-in.
                      </>
                    ) : pendingReassignNumber.assignedCourse ? (
                      <>
                        This number is currently bound to course{" "}
                        <strong className="font-semibold text-amber-950">
                          {pendingReassignNumber.assignedCourse.title}
                        </strong>
                        . Reassigning will redirect carrier routing to this check-in agent.
                      </>
                    ) : (
                      <>
                        This number is currently bound in Telenow to an external agent. Reassigning will detach that agent and attach this check-in schedule.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 border-t border-amber-200/60 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingReassignNumber(null)}
                >
                  Back to list
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setPhoneNumberId(pendingReassignNumber.id);
                    setPhoneNumber(pendingReassignNumber.e164);
                    setPendingReassignNumber(null);
                    setAssignPhoneModalOpen(false);
                    toast.info(`Selected ${pendingReassignNumber.e164}.`);
                  }}
                  className="bg-amber-900 text-white hover:bg-amber-950"
                >
                  Confirm Reassign
                </Button>
              </div>
            </div>
          ) : loadingNumbers ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" className="text-neutral-500" />
            </div>
          ) : workspaceNumbers.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              No numbers found in your carrier account. Connect or purchase a phone number in Integrations first.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {workspaceNumbers.map((num) => {
                const isSelected = phoneNumberId === num.id;
                const isThisCheckin = Boolean(
                  num.assignedCheckin && num.assignedCheckin.id === initial?.id,
                );
                const isOtherCheckin = Boolean(
                  num.assignedCheckin && num.assignedCheckin.id !== initial?.id,
                );
                const isCourse = Boolean(num.assignedCourse);
                const isExternalAgent = Boolean(
                  !num.assignedCheckin && !num.assignedCourse && num.agentId,
                );
                const isMemberLocked = Boolean(num.allocatedToMemberId);
                const hasReassignTarget = isOtherCheckin || isCourse || isExternalAgent;
                const isAvailable = !hasReassignTarget && !isMemberLocked;
                const connMatch = carrierStatuses[num.id];

                return (
                  <div
                    key={num.id}
                    className={cn(
                      "flex flex-col gap-2 p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between",
                      isSelected
                        ? "bg-neutral-900/[0.04]"
                        : isMemberLocked
                          ? "bg-neutral-50/60 opacity-75"
                          : "hover:bg-neutral-50",
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
                          isSelected
                            ? "bg-neutral-900 text-white"
                            : isMemberLocked
                              ? "bg-rose-100 text-rose-700"
                              : hasReassignTarget
                                ? "bg-amber-100 text-amber-700"
                                : "bg-neutral-100 text-neutral-600",
                        )}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-sm font-semibold text-neutral-900">
                            {num.e164}
                          </span>
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600 uppercase">
                            {num.country} · {num.numberType}
                          </span>
                          {connMatch === true && (
                            <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Carrier active
                            </span>
                          )}
                          {connMatch === false && (
                            <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                              Carrier issue
                            </span>
                          )}
                          {isThisCheckin && (
                            <span className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-800">
                              Current line
                            </span>
                          )}
                          {isOtherCheckin && (
                            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                              In use: Check-in ({num.assignedCheckin?.title})
                            </span>
                          )}
                          {isCourse && (
                            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                              In use: Course ({num.assignedCourse?.title})
                            </span>
                          )}
                          {isExternalAgent && (
                            <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                              External Agent
                            </span>
                          )}
                          {isMemberLocked && (
                            <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                              Locked to Member
                            </span>
                          )}
                          {isAvailable && (
                            <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Available
                            </span>
                          )}
                        </div>

                        {isMemberLocked ? (
                          <p className="mt-0.5 text-[11px] text-rose-600">
                            Held by a team member for inbound calls. Inbound exclusivity prevents AI agent assignment.
                          </p>
                        ) : isOtherCheckin ? (
                          <p className="mt-0.5 text-[11px] text-amber-700">
                            Reassigning will detach this line from "{num.assignedCheckin?.title}" and attach it to this check-in.
                          </p>
                        ) : isCourse ? (
                          <p className="mt-0.5 text-[11px] text-amber-700">
                            Reassigning will detach this line from "{num.assignedCourse?.title}" and attach it to this check-in.
                          </p>
                        ) : isExternalAgent ? (
                          <p className="mt-0.5 text-[11px] text-indigo-700">
                            Currently assigned to an external agent in Telenow. Selecting will reassign carrier routing.
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-neutral-500 capitalize">
                            Carrier: {num.provider} · Free to assign
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-end pt-1 sm:pt-0">
                      {isMemberLocked ? (
                        <span className="rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-400 cursor-not-allowed">
                          Unavailable
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            isSelected
                              ? "primary"
                              : hasReassignTarget
                                ? "outline"
                                : "secondary"
                          }
                          onClick={() => {
                            if (hasReassignTarget && !isSelected) {
                              setPendingReassignNumber(num);
                            } else {
                              setPhoneNumberId(num.id);
                              setPhoneNumber(num.e164);
                              setAssignPhoneModalOpen(false);
                            }
                          }}
                          className={cn(
                            "h-8 px-3 text-xs font-semibold min-h-8",
                            hasReassignTarget &&
                              !isSelected &&
                              "border-amber-300 text-amber-900 hover:bg-amber-50",
                          )}
                        >
                          {isSelected
                            ? "Selected"
                            : hasReassignTarget
                              ? "Reassign"
                              : "Select"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAssignPhoneModalOpen(false);
                setPendingReassignNumber(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
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

  const [deleteTarget, setDeleteTarget] = useState<CheckinSchedule | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

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
    additionalUserIds?: string[];
    voice?: string | null;
    voiceProvider?: string | null;
    phoneNumberId?: string | null;
    phoneNumber?: string | null;
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
      additionalUserIds?: string[];
      voice?: string | null;
      voiceProvider?: string | null;
      phoneNumberId?: string | null;
      phoneNumber?: string | null;
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiDeleteCheckinSchedule(deleteTarget.id);
      toast.success("Schedule deleted.");
      setDeleteTarget(null);
      setDeleteInput("");
      await load();
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "Couldn't delete schedule.";
      toast.error(message);
    } finally {
      setIsDeleting(false);
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
                <div className="flex items-start justify-between gap-3 p-5 sm:p-6 pb-3 sm:pb-3">
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

                <div className="flex flex-wrap items-center gap-2 px-5 sm:px-6 pb-5">
                  <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                    {schedule.directReportCount}{" "}
                    {schedule.directReportCount === 1 ? "report" : "reports"}
                  </span>
                  <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                    {schedule.callableCount} callable
                  </span>
                  <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                    {schedule.enabled ? "On" : "Paused"}
                  </span>
                  {schedule.phoneNumber ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200 font-mono">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {schedule.phoneNumber}
                    </span>
                  ) : (
                    <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs text-neutral-500">
                      Default Line
                    </span>
                  )}
                  {schedule.voice && (
                    <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                      Voice: {schedule.voiceProvider === "elevenlabs" ? "ElevenLabs" : (schedule.voiceProvider ?? "Default")}
                    </span>
                  )}
                </div>

                {editingId === schedule.id && data && (
                  <div className="border-t border-neutral-100 p-4 sm:p-6 bg-neutral-50/40">
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
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
                    onClick={() => {
                      setDeleteTarget(schedule);
                      setDeleteInput("");
                    }}
                  >
                    Delete
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

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="Delete Schedule"
        description={`This action cannot be undone. This will permanently delete the check-in schedule "${deleteTarget?.title}".`}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">
              Please type <strong>{deleteTarget?.title}</strong> to confirm.
            </label>
            <input
              type="text"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={deleteTarget?.title}
              disabled={isDeleting}
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
              onClick={handleDelete}
              loading={isDeleting}
              disabled={deleteInput !== deleteTarget?.title}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}