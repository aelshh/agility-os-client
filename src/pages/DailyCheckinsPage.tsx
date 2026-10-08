import { CaretDown, CaretUp, PhoneCall, Plus } from "@phosphor-icons/react";
import { IconBadge } from "../components/ui/IconBadge";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  CheckinQuestionAnswer,
  CheckinRunDetail,
  CheckinRunListItem,
  CheckinRunStatus,
  CheckinSchedule,
  CheckinScheduleList,
  CheckinStatus,
  CheckinSummary,
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
  provisioning: { label: "Dialing reports…", cls: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", cls: "bg-red-100 text-red-700" },
  skipped: { label: "Nothing to dial", cls: "bg-neutral-100 text-neutral-500" },
};

const CHECKIN_BADGE: Record<CheckinStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-neutral-100 text-neutral-600" },
  queued: { label: "Queued", cls: "bg-sky-100 text-sky-700" },
  calling: { label: "Calling", cls: "bg-sky-100 text-sky-700 animate-pulse" },
  answered: { label: "Answered", cls: "bg-indigo-100 text-indigo-700" },
  no_answer: { label: "No answer", cls: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", cls: "bg-red-100 text-red-700" },
  skipped: { label: "Skipped", cls: "bg-neutral-100 text-neutral-500" },
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
        "inline-flex shrink-0 items-center rounded-lg px-2.5 py-1 text-xs font-semibold",
        entry.cls,
      )}
    >
      {entry.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Summary Normalization Helper
// ---------------------------------------------------------------------------

export type NormalizedCheckinSummary = {
  report: string;
  priorities: string;
  blockers: string;
  suggestions: string;
  updates: string;
  sentiment: "positive" | "neutral" | "needs_attention" | "blocked";
  keyTakeaway: string;
  answers: CheckinQuestionAnswer[];
  hasContent: boolean;
};

function normalizeCheckinSummary(
  raw: CheckinSummary | string | null | undefined,
): NormalizedCheckinSummary {
  if (!raw) {
    return {
      report: "",
      priorities: "",
      blockers: "",
      suggestions: "",
      updates: "",
      sentiment: "neutral",
      keyTakeaway: "",
      answers: [],
      hasContent: false,
    };
  }

  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const report = typeof obj["report"] === "string" ? obj["report"].trim() : "";
    const priorities =
      typeof obj["priorities"] === "string" ? obj["priorities"].trim() : "";
    const blockers =
      typeof obj["blockers"] === "string" ? obj["blockers"].trim() : "";
    const suggestions =
      typeof obj["suggestions"] === "string" ? obj["suggestions"].trim() : "";
    const updates =
      typeof obj["updates"] === "string" ? obj["updates"].trim() : "";

    let sentiment: NormalizedCheckinSummary["sentiment"] = "neutral";
    if (
      obj["sentiment"] === "positive" ||
      obj["sentiment"] === "neutral" ||
      obj["sentiment"] === "needs_attention" ||
      obj["sentiment"] === "blocked"
    ) {
      sentiment = obj["sentiment"] as NormalizedCheckinSummary["sentiment"];
    } else if (
      blockers ||
      report.toLowerCase().includes("medical") ||
      report.toLowerCase().includes("blocker")
    ) {
      sentiment = "needs_attention";
    }

    const keyTakeaway =
      typeof obj["keyTakeaway"] === "string" ? obj["keyTakeaway"].trim() : "";
    const rawAnswers = Array.isArray(obj["answers"]) ? obj["answers"] : [];
    const answers: CheckinQuestionAnswer[] = [];
    for (const item of rawAnswers) {
      if (typeof item === "object" && item !== null) {
        const itemRecord = item as Record<string, unknown>;
        const q =
          typeof itemRecord["question"] === "string"
            ? itemRecord["question"].trim()
            : "";
        const a =
          typeof itemRecord["answer"] === "string"
            ? itemRecord["answer"].trim()
            : "";
        if (q && a) answers.push({ question: q, answer: a });
      }
    }

    const hasContent = Boolean(
      report ||
        priorities ||
        blockers ||
        suggestions ||
        updates ||
        answers.length > 0 ||
        keyTakeaway,
    );

    return {
      report,
      priorities,
      blockers,
      suggestions,
      updates,
      sentiment,
      keyTakeaway:
        keyTakeaway ||
        (blockers
          ? `Blocked: ${blockers}`
          : report || priorities || updates || ""),
      answers,
      hasContent,
    };
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        return normalizeCheckinSummary(parsed);
      }
    } catch {}

    const str = raw.trim();
    if (!str || str === "[object Object]") {
      return {
        report: "",
        priorities: "",
        blockers: "",
        suggestions: "",
        updates: "",
        sentiment: "neutral",
        keyTakeaway: "",
        answers: [],
        hasContent: false,
      };
    }

    const reportMatch = str.match(
      /(?:Report|Accomplished|Progress):\s*([\s\S]*?)(?=(?:Suggestions|Updates|Blockers|Priorities):|$)/i,
    );
    const suggestionsMatch = str.match(
      /Suggestions:\s*([\s\S]*?)(?=(?:Report|Updates|Blockers|Priorities):|$)/i,
    );
    const updatesMatch = str.match(
      /(?:Updates(?:\s*\/\s*Blockers)?|Blockers):\s*([\s\S]*?)(?=(?:Report|Suggestions|Priorities):|$)/i,
    );
    const prioritiesMatch = str.match(
      /Priorities:\s*([\s\S]*?)(?=(?:Report|Suggestions|Updates|Blockers):|$)/i,
    );

    const report = reportMatch ? reportMatch[1].trim() : "";
    const suggestions = suggestionsMatch ? suggestionsMatch[1].trim() : "";
    const rawUpdates = updatesMatch ? updatesMatch[1].trim() : "";
    let priorities = prioritiesMatch ? prioritiesMatch[1].trim() : "";
    let blockers = "";

    if (rawUpdates.toLowerCase().includes("priority") && !priorities) {
      priorities = rawUpdates;
    }
    if (
      report.toLowerCase().includes("medical") ||
      report.toLowerCase().includes("blocker") ||
      rawUpdates.toLowerCase().includes("blocker")
    ) {
      blockers = report.toLowerCase().includes("medical") ? report : rawUpdates;
    }

    const isNeedsAttention = Boolean(
      blockers ||
        report.toLowerCase().includes("medical") ||
        str.toLowerCase().includes("blocker"),
    );

    const answers: CheckinQuestionAnswer[] = [];
    if (report)
      answers.push({
        question: "What progress have you made since our last check-in?",
        answer: report,
      });
    if (priorities)
      answers.push({
        question: "What are your main priorities for today?",
        answer: priorities,
      });
    if (blockers)
      answers.push({
        question: "Are you facing any blockers or need support from the team?",
        answer: blockers,
      });
    if (suggestions)
      answers.push({
        question: "Do you have any suggestions or feedback to share?",
        answer: suggestions,
      });

    const keyTakeaway =
      blockers && priorities
        ? `${blockers} · Priority: ${priorities}`
        : report || priorities || rawUpdates || str;

    return {
      report: report || (answers.length === 0 ? str : ""),
      priorities,
      blockers,
      suggestions,
      updates: rawUpdates,
      sentiment: isNeedsAttention ? "needs_attention" : "neutral",
      keyTakeaway,
      answers,
      hasContent: true,
    };
  }

  return {
    report: "",
    priorities: "",
    blockers: "",
    suggestions: "",
    updates: "",
    sentiment: "neutral",
    keyTakeaway: "",
    answers: [],
    hasContent: false,
  };
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
  const [voice, setVoice] = useState(initial?.voice ?? "");
  const [voiceProvider, setVoiceProvider] = useState(
    initial?.voiceProvider ?? "elevenlabs",
  );
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(
    initial?.phoneNumberId ?? null,
  );
  const [phoneNumber, setPhoneNumber] = useState<string | null>(
    initial?.phoneNumber ?? null,
  );

  // Phone assignment modal state
  const [assignPhoneModalOpen, setAssignPhoneModalOpen] = useState(false);
  const [workspaceNumbers, setWorkspaceNumbers] = useState<
    WorkspacePhoneNumber[]
  >([]);
  const [carrierStatuses, setCarrierStatuses] = useState<
    Record<string, boolean | null>
  >({});
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [pendingReassignNumber, setPendingReassignNumber] =
    useState<WorkspacePhoneNumber | null>(null);

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
    if (!voice || !voice.trim()) {
      toast.error("Please select an AI assistant voice persona before saving.");
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
      count:
        additionalUserIds.length > 0 ? additionalUserIds.length : undefined,
    },
  ];
  const [activeTab, setActiveTab] = useState("basics");
  const tabIndex = CHECKIN_TABS.findIndex((t) => t.id === activeTab);
  const isLastTab = tabIndex === CHECKIN_TABS.length - 1;

  return (
    <motion.div variants={fadeUp} className="w-full flex flex-col gap-6">
      <Tabs items={CHECKIN_TABS} active={activeTab} onChange={setActiveTab} />

      {/* Tab 1: Basics */}
      {activeTab === "basics" && (
        <div className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-7 shadow-sm">
          <div>
            <h2 className="font-serif text-lg font-medium text-neutral-950">
              Check-in Basics
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Set a descriptive title and choose what time the automated voice
              check-in call occurs each day.
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
                Calls will automatically queue and dial your reports at this
                scheduled time.
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
                Specify the questions your AI assistant will ask each direct
                report during the call.
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
                      <CaretUp className="h-4 w-4" />
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
                      <CaretDown className="h-4 w-4" />
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
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        className="h-4 w-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 6l8 8m0-8l-8 8"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3.5 text-xs text-neutral-500 leading-relaxed">
            <span className="font-semibold text-neutral-700">
              Automated Assistant Flow:{" "}
            </span>
            The voice agent greets the report, collects answers to each question
            in sequence, asks brief follow-ups if unclear, and compiles an
            executive summary.
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
                Assign a dedicated carrier phone line so reports see a recognized
                team caller ID.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <IconBadge icon={PhoneCall} variant={phoneNumber ? "emerald" : "neutral"} size="lg" weight="duotone" />
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
                        Outbound check-in calls will originate from this
                        dedicated line.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        Shared Carrier Pool (Default)
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Assign a dedicated phone line from your workspace to
                        display a consistent caller ID.
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
                Choose the voice your reports will hear during the check-in call.
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
              Your direct reports are automatically included. You can
              optionally add other members in your reporting hierarchy below.
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
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
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
                        . Reassigning will redirect carrier routing to this
                        check-in agent.
                      </>
                    ) : (
                      <>
                        This number is currently bound in Telenow to an external
                        agent. Reassigning will detach that agent and attach this
                        check-in schedule.
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
              No numbers found in your carrier account. Connect or purchase a
              phone number in Integrations first.
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
                const hasReassignTarget =
                  isOtherCheckin || isCourse || isExternalAgent;
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
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          className="h-4 w-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                          />
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
                            Held by a team member for inbound calls.
                          </p>
                        ) : isOtherCheckin ? (
                          <p className="mt-0.5 text-[11px] text-amber-700">
                            Reassigning will detach this line from "
                            {num.assignedCheckin?.title}" and attach it to this
                            check-in.
                          </p>
                        ) : isCourse ? (
                          <p className="mt-0.5 text-[11px] text-amber-700">
                            Reassigning will detach this line from "
                            {num.assignedCourse?.title}" and attach it to this
                            check-in.
                          </p>
                        ) : isExternalAgent ? (
                          <p className="mt-0.5 text-[11px] text-indigo-700">
                            Currently assigned to an external agent in Telenow.
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
// Run Detail View & Report Analytics
// ---------------------------------------------------------------------------

function RunDetailView({ detail }: { detail: CheckinRunDetail }) {
  const normalizedCheckins = useMemo(() => {
    return detail.checkins.map((c) => ({
      ...c,
      normalizedSummary: normalizeCheckinSummary(c.summary),
    }));
  }, [detail.checkins]);

  const totalCount = detail.checkins.length;
  const calledCount = detail.checkins.filter(
    (c) => c.status === "answered" || c.status === "completed",
  ).length;
  const reachableRate =
    totalCount > 0 ? Math.round((calledCount / totalCount) * 100) : 0;

  const blockerCount = normalizedCheckins.filter(
    (c) => c.normalizedSummary.blockers.length > 0,
  ).length;

  const suggestionCount = normalizedCheckins.filter(
    (c) => c.normalizedSummary.suggestions.length > 0,
  ).length;

  const hasNeedsAttention = normalizedCheckins.some(
    (c) =>
      c.normalizedSummary.sentiment === "needs_attention" ||
      c.normalizedSummary.sentiment === "blocked",
  );

  return (
    <div className="w-full flex flex-col gap-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* Header & Quick KPI Stats */}
      <div className="flex flex-col gap-4 border-b border-neutral-100 p-5 sm:p-6 bg-gradient-to-b from-neutral-50/70 to-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-serif text-lg font-medium text-neutral-950">
                Run Report: {detail.run.runDate}
              </h3>
              <StatusBadge status={detail.run.status} map={RUN_BADGE} />
              {hasNeedsAttention && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
                  Action Required
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Check-in schedule: {detail.schedule.title} · Dial time:{" "}
              {detail.schedule.timeLocal}
            </p>
          </div>
        </div>

        {/* Aggregate KPI Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
          <div className="flex flex-col rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
              Reach Rate
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono text-xl font-bold text-neutral-950">
                {reachableRate}%
              </span>
              <span className="text-xs text-neutral-500">
                ({calledCount}/{totalCount})
              </span>
            </div>
          </div>

          <div
            className={cn(
              "flex flex-col rounded-xl border p-3.5 shadow-xs",
              blockerCount > 0
                ? "border-amber-200 bg-amber-50/50"
                : "border-neutral-200/80 bg-white",
            )}
          >
            <span
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wider",
                blockerCount > 0 ? "text-amber-800" : "text-neutral-500",
              )}
            >
              Blockers Flagged
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={cn(
                  "font-mono text-xl font-bold",
                  blockerCount > 0 ? "text-amber-900" : "text-neutral-950",
                )}
              >
                {blockerCount}
              </span>
              <span
                className={cn(
                  "text-xs",
                  blockerCount > 0 ? "text-amber-700" : "text-neutral-500",
                )}
              >
                {blockerCount === 1 ? "report blocked" : "reports blocked"}
              </span>
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
              Ideas & Feedback
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono text-xl font-bold text-neutral-950">
                {suggestionCount}
              </span>
              <span className="text-xs text-neutral-500">
                {suggestionCount === 1 ? "suggestion" : "suggestions"}
              </span>
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
              Team Status
            </span>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  hasNeedsAttention ? "bg-amber-500" : "bg-emerald-500",
                )}
              />
              <span className="text-sm font-semibold text-neutral-900">
                {hasNeedsAttention ? "Needs Support" : "On Track"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Person Check-in Cards */}
      {normalizedCheckins.length === 0 ? (
        <div className="p-8 text-center text-sm text-neutral-500">
          No team members were dialed for this run.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-100">
          {normalizedCheckins.map((checkin) => (
            <PersonCheckinCard key={checkin.id} checkin={checkin} />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonCheckinCard({
  checkin,
}: {
  checkin: CheckinRunDetail["checkins"][number] & {
    normalizedSummary: NormalizedCheckinSummary;
  };
}) {
  const [viewMode, setViewMode] = useState<"qna" | "digest">("qna");
  const summary = checkin.normalizedSummary;

  const sentimentBadge = useMemo(() => {
    switch (summary.sentiment) {
      case "blocked":
      case "needs_attention":
        return {
          label: "Needs Attention",
          cls: "bg-amber-100 text-amber-800 border-amber-200",
          dot: "bg-amber-600",
        };
      case "positive":
        return {
          label: "Positive",
          cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
          dot: "bg-emerald-600",
        };
      default:
        return {
          label: "On Track",
          cls: "bg-neutral-100 text-neutral-700 border-neutral-200",
          dot: "bg-neutral-500",
        };
    }
  }, [summary.sentiment]);

  return (
    <div className="flex flex-col gap-4 p-5 sm:p-6 transition-colors hover:bg-neutral-50/40">
      {/* Caller Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {checkin.person.image ? (
            <img
              src={checkin.person.image}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full border border-neutral-200 object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-sm font-bold text-neutral-800">
              {(checkin.person.name ?? "?")[0]?.toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold text-neutral-950">
                {checkin.person.name ?? "Direct Report"}
              </p>
              {summary.hasContent && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                    sentimentBadge.cls,
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      sentimentBadge.dot,
                    )}
                  />
                  {sentimentBadge.label}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-neutral-500">
              {checkin.person.email ?? "—"}
              {checkin.calledAt && (
                <span>
                  {" "}
                  · Dialed {new Date(checkin.calledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={checkin.status} map={CHECKIN_BADGE} />
        </div>
      </div>

      {/* Executive Key Takeaway Banner */}
      {summary.keyTakeaway && (
        <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/80 p-3.5 text-xs text-neutral-800 shadow-xs flex items-start gap-2.5">
          <span className="text-base leading-none">💬</span>
          <div className="min-w-0">
            <span className="font-semibold text-neutral-900">
              Executive Takeaway:{" "}
            </span>
            <span className="leading-relaxed text-neutral-700">
              {summary.keyTakeaway}
            </span>
          </div>
        </div>
      )}

      {/* Content Tabs: Spoken Q&A vs Digest Breakdown */}
      {summary.hasContent ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2">
            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("qna")}
                className={cn(
                  "rounded-md px-3 py-1 transition-all",
                  viewMode === "qna"
                    ? "bg-white text-neutral-950 shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900",
                )}
              >
                Spoken Q&A ({summary.answers.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode("digest")}
                className={cn(
                  "rounded-md px-3 py-1 transition-all",
                  viewMode === "digest"
                    ? "bg-white text-neutral-950 shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900",
                )}
              >
                Digest Breakdown
              </button>
            </div>
          </div>

          {/* View Mode 1: Spoken Q&A */}
          {viewMode === "qna" && (
            <div className="flex flex-col gap-3">
              {summary.answers.length > 0 ? (
                summary.answers.map((qa, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5 rounded-xl border border-neutral-200/90 bg-white p-3.5 text-xs shadow-xs"
                  >
                    <div className="flex items-start gap-2 text-neutral-900 font-semibold">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-[11px] font-bold text-neutral-700">
                        Q{i + 1}
                      </span>
                      <span className="mt-0.5 leading-snug">{qa.question}</span>
                    </div>
                    <div className="mt-1 pl-7 text-neutral-700 leading-relaxed bg-neutral-50/70 p-2.5 rounded-lg border border-neutral-100">
                      <span className="font-semibold text-neutral-900">
                        Answer:{" "}
                      </span>
                      {qa.answer}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-xs text-neutral-600 leading-relaxed">
                  {summary.report || "No specific Q&A breakdown captured."}
                </div>
              )}
            </div>
          )}

          {/* View Mode 2: Digest Breakdown */}
          {viewMode === "digest" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {summary.report && (
                <div className="flex flex-col gap-1 rounded-xl border border-neutral-200/90 bg-white p-3.5 shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500">
                    <span>🚀</span> Accomplished / Progress
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-800">
                    {summary.report}
                  </p>
                </div>
              )}

              {summary.priorities && (
                <div className="flex flex-col gap-1 rounded-xl border border-sky-200/80 bg-sky-50/30 p-3.5 shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-800">
                    <span>🎯</span> Today's Priorities
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-800">
                    {summary.priorities}
                  </p>
                </div>
              )}

              {summary.blockers && (
                <div className="flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50/60 p-3.5 shadow-xs sm:col-span-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
                    <span>⚠️</span> Blockers & Support Needed
                  </div>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-amber-950">
                    {summary.blockers}
                  </p>
                </div>
              )}

              {summary.suggestions && (
                <div className="flex flex-col gap-1 rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
                    <span>💡</span> Suggestions & Feedback
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-800">
                    {summary.suggestions}
                  </p>
                </div>
              )}

              {summary.updates && (
                <div className="flex flex-col gap-1 rounded-xl border border-neutral-200/90 bg-white p-3.5 shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500">
                    <span>📝</span> Updates & Notes
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-800">
                    {summary.updates}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4 text-xs text-neutral-500">
          {checkin.status === "no_answer"
            ? "No answer received when dialed. Next automated retry will occur on the next scheduled run."
            : checkin.status === "calling" || checkin.status === "queued"
              ? "Call is currently in progress. Spoken summary will generate automatically once completed."
              : checkin.error
                ? `Call error: ${checkin.error}`
                : "Awaiting call placement."}
        </div>
      )}

      {checkin.error && (
        <p className="mt-1 text-xs leading-relaxed text-red-600 font-medium">
          Error: {checkin.error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function DailyCheckinsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isArchitect = user?.role === "architect";

  const [data, setData] = useState<CheckinScheduleList | null>(null);
  const [loadingState, setLoadingState] = useState<
    "loading" | "error" | "success"
  >("loading");

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // History & Run Detail State
  const [activeHistoryScheduleId, setActiveHistoryScheduleId] = useState<
    string | null
  >(null);
  const [runs, setRuns] = useState<CheckinRunListItem[] | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [detail, setDetail] = useState<CheckinRunDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [busyRunId, setBusyRunId] = useState<string | null>(null);
  const [busyToggleId, setBusyToggleId] = useState<string | null>(null);
  const [telenowConfigured, setTelenowConfigured] = useState<boolean | null>(
    null,
  );

  const [deleteTarget, setDeleteTarget] = useState<CheckinSchedule | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoadingState("loading");
    try {
      const res = await apiListCheckinSchedules();
      setData(res);
      setLoadingState("success");
    } catch (err) {
      console.error("Failed to load daily checkin schedules:", err);
      setLoadingState("error");
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
      // Automatically refresh history if open
      if (activeHistoryScheduleId === schedule.id) {
        const history = await apiListCheckinRuns(schedule.id);
        setRuns(history);
        if (history.length > 0) {
          setDetail(await apiGetCheckinRun(history[0].id));
        }
      }
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
      const message =
        (err as { message?: string })?.message ?? "Couldn't delete schedule.";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const openHistory = async (schedule: CheckinSchedule) => {
    if (activeHistoryScheduleId === schedule.id) {
      setActiveHistoryScheduleId(null);
      setDetail(null);
      setRuns(null);
      return;
    }

    setActiveHistoryScheduleId(schedule.id);
    setDetail(null);
    setRuns(null);
    setLoadingRuns(true);

    try {
      const history = await apiListCheckinRuns(schedule.id);
      setRuns(history);
      if (history.length > 0) {
        setLoadingDetail(true);
        try {
          const detailRes = await apiGetCheckinRun(history[0].id);
          setDetail(detailRes);
        } finally {
          setLoadingDetail(false);
        }
      }
    } catch {
      toast.error("Couldn't load run history.");
    } finally {
      setLoadingRuns(false);
    }
  };

  const selectRun = async (run: CheckinRunListItem) => {
    setLoadingDetail(true);
    try {
      setDetail(await apiGetCheckinRun(run.id));
    } catch {
      toast.error("Couldn't load this run.");
    } finally {
      setLoadingDetail(false);
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
        className="flex w-full flex-col gap-6"
      >
        {/* Page Header */}
        <motion.div
          variants={fadeUp}
          className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-3.5">
              <IconBadge icon={PhoneCall} variant="purple" size="lg" weight="duotone" />
              <div>
                <h1 className="font-serif text-3xl font-medium tracking-normal text-neutral-950">
                  Daily check-ins
                </h1>
                <p className="mt-1 text-sm font-medium text-neutral-600">
                  Automated daily voice calls to gather progress, priorities, and blockers from your team.
                </p>
              </div>
            </div>
            <p className="mt-1 text-sm font-medium text-neutral-600">
              Automated AI voice calls connect with your team daily to gather
              spoken status, priorities, blockers, and feedback.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                if (telenowConfigured === false) {
                  if (isArchitect) {
                    toast.error(
                      "Please connect your Telenow API key in Settings before creating check-ins.",
                    );
                    void router.navigate({ to: "/profile" });
                  } else {
                    toast.error(
                      "Your organisation must connect Telenow Voice AI before scheduling check-ins. Please contact an architect.",
                    );
                  }
                  return;
                }
                setCreating((v) => !v);
                setEditingId(null);
              }}
              icon={
                <Plus className="h-4 w-4" weight="bold" />
              }
            >
              New check-in
            </Button>
          </div>
        </motion.div>

        {/* Missing Voice AI Integration Warning */}
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
                <p className="font-semibold text-amber-950">
                  Voice AI Integration Required
                </p>
                <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                  Telenow Voice AI is not connected for your organisation. An
                  API key must be configured in Settings before automated daily
                  check-in calls can be placed.
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

        {/* Schedule Creation Form */}
        {creating && data && (
          <ScheduleForm
            defaultScript={data.defaultScript}
            submitLabel="Schedule it"
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        )}

        {/* Loading Skeleton */}
        {loadingState === "loading" && (
          <div className="grid w-full gap-4 md:grid-cols-2">
            {[1, 2].map((k) => (
              <div
                key={k}
                className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm animate-pulse"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-2 w-2/3">
                    <div className="h-5 bg-neutral-200 rounded-md w-3/4" />
                    <div className="h-4 bg-neutral-100 rounded-md w-1/2" />
                  </div>
                  <div className="h-6 w-20 bg-neutral-200 rounded-lg" />
                </div>
                <div className="flex gap-2 pt-2">
                  <div className="h-6 w-24 bg-neutral-100 rounded-lg" />
                  <div className="h-6 w-20 bg-neutral-100 rounded-lg" />
                </div>
                <div className="h-10 bg-neutral-50 rounded-xl mt-4 border border-neutral-100" />
              </div>
            ))}
          </div>
        )}

        {/* Error State with Retry Button */}
        {loadingState === "error" && (
          <motion.div
            variants={fadeUp}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-neutral-900">
              Couldn't load check-in schedules
            </p>
            <p className="text-xs text-neutral-500 max-w-sm">
              Please check your network connection or permissions and try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              className="mt-2"
            >
              Try Again
            </Button>
          </motion.div>
        )}

        {/* Empty State */}
        {loadingState === "success" &&
          data &&
          data.schedules.length === 0 &&
          !creating && (
            <motion.div
              variants={fadeUp}
              className="w-full rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm sm:p-10"
            >
              <IconBadge icon={PhoneCall} variant="purple" size="xl" weight="duotone" className="mx-auto mb-3" />
              <p className="text-base font-semibold text-neutral-900">
                No daily check-ins yet
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
                Schedule a recurring voice call to stay in the loop with everyone
                working under you — no meetings, no friction, just a short spoken
                update.
              </p>
              <Button className="mt-5" onClick={() => setCreating(true)}>
                Create your first check-in
              </Button>
            </motion.div>
          )}

        {/* Schedules Grid */}
        {loadingState === "success" && data && data.schedules.length > 0 && (
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="flex flex-col gap-6 w-full"
          >
            {data.schedules.map((schedule) => {
              const isHistoryOpen = activeHistoryScheduleId === schedule.id;

              return (
                <motion.article
                  key={schedule.id}
                  variants={fadeUp}
                  className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Schedule Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-5 sm:p-6 pb-3 sm:pb-3 bg-gradient-to-b from-neutral-50/50 to-white">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-serif text-xl font-medium leading-snug text-neutral-950">
                          {schedule.title}
                        </h2>
                        <StatusBadge
                          status={schedule.todayRunStatus ?? "pending"}
                          map={RUN_BADGE}
                        />
                      </div>
                      <p className="mt-1 text-sm text-neutral-600">
                        Daily at {schedule.timeLocal}
                        {data.timezone ? ` (${data.timezone})` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={busyRunId === schedule.id}
                        onClick={() => void handleRunNow(schedule)}
                        className="text-xs"
                      >
                        Run now
                      </Button>
                      <Button
                        size="sm"
                        variant={isHistoryOpen ? "primary" : "secondary"}
                        onClick={() => void openHistory(schedule)}
                        className="text-xs"
                      >
                        {isHistoryOpen ? "Hide Report" : "View Report & History"}
                      </Button>
                    </div>
                  </div>

                  {/* Meta Chips */}
                  <div className="flex flex-wrap items-center gap-2 px-5 sm:px-6 pb-4">
                    <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                      {schedule.directReportCount}{" "}
                      {schedule.directReportCount === 1 ? "report" : "reports"}
                    </span>
                    <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                      {schedule.callableCount} callable
                    </span>
                    <span
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-semibold",
                        schedule.enabled
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-neutral-100 text-neutral-600",
                      )}
                    >
                      {schedule.enabled ? "Active" : "Paused"}
                    </span>
                    {schedule.phoneNumber ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200 font-mono">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {schedule.phoneNumber}
                      </span>
                    ) : (
                      <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs text-neutral-500">
                        Shared Pool
                      </span>
                    )}
                    {schedule.voice && (
                      <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                        Voice:{" "}
                        {schedule.voiceProvider === "elevenlabs"
                          ? "ElevenLabs"
                          : (schedule.voiceProvider ?? "Default")}
                      </span>
                    )}
                  </div>

                  {/* Edit Schedule Form Dropdown */}
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

                  {/* Card Actions Footer */}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50/60 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(
                            editingId === schedule.id ? null : schedule.id,
                          );
                          setCreating(false);
                        }}
                        className="text-xs"
                      >
                        {editingId === schedule.id ? "Cancel edit" : "Edit"}
                      </Button>
                      <Button
                        size="sm"
                        variant={schedule.enabled ? "ghost" : "outline"}
                        loading={busyToggleId === schedule.id}
                        onClick={() => void handleToggle(schedule)}
                        className="text-xs"
                      >
                        {schedule.enabled ? "Pause" : "Resume"}
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs ml-auto"
                      onClick={() => {
                        setDeleteTarget(schedule);
                        setDeleteInput("");
                      }}
                    >
                      Delete
                    </Button>
                  </div>

                  {/* Run History & Report Section */}
                  {isHistoryOpen && (
                    <div className="flex w-full flex-col gap-4 border-t border-neutral-200 bg-neutral-50/30 p-4 sm:p-6">
                      {loadingRuns ? (
                        <div className="flex items-center justify-center py-12">
                          <Spinner size="md" className="text-neutral-600" />
                        </div>
                      ) : !runs || runs.length === 0 ? (
                        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-xs">
                          <p className="text-sm font-semibold text-neutral-900">
                            No runs recorded yet
                          </p>
                          <p className="mt-1 text-xs text-neutral-500 max-w-sm mx-auto">
                            Press "Run now" to fire today's check-in calls
                            immediately.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {/* Run Date Pill Selector */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mr-1">
                              Select Date:
                            </span>
                            {runs.map((run) => {
                              const isSelected = detail?.run.id === run.id;
                              const total = Object.values(
                                run.counts ?? {},
                              ).reduce((a, b) => a + b, 0);

                              return (
                                <button
                                  key={run.id}
                                  type="button"
                                  onClick={() => void selectRun(run)}
                                  className={cn(
                                    "flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs",
                                    isSelected
                                      ? "border-neutral-900 bg-neutral-900 text-white"
                                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50",
                                  )}
                                >
                                  <span>{run.runDate}</span>
                                  {total > 0 && (
                                    <span
                                      className={cn(
                                        "rounded-full px-1.5 py-0.2 text-[10px]",
                                        isSelected
                                          ? "bg-neutral-800 text-neutral-200"
                                          : "bg-neutral-100 text-neutral-600",
                                      )}
                                    >
                                      {total}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Run Detail Loading or Content */}
                          {loadingDetail ? (
                            <div className="flex items-center justify-center py-12 rounded-2xl border border-neutral-200 bg-white">
                              <Spinner size="md" className="text-neutral-600" />
                            </div>
                          ) : detail && detail.schedule.id === schedule.id ? (
                            <RunDetailView detail={detail} />
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </motion.article>
              );
            })}
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
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
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