import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CourseEnrollment } from "../../api/courses";
import { AudioPlayer } from "../../components/AudioPlayer";
import { cn } from "../../lib/cn";
import { EASE } from "../../lib/animation";

interface CourseCallDetailModalProps {
  enrollment: CourseEnrollment | null;
  onClose: () => void;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

export function CourseCallDetailModal({ enrollment, onClose }: CourseCallDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"scorecard" | "transcript" | "coaching">("scorecard");

  useEffect(() => {
    if (!enrollment) return;
    setActiveTab("scorecard");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [enrollment, onClose]);

  if (!enrollment) return null;

  const score = enrollment.score;
  const grade =
    score !== null
      ? score >= 85
        ? { label: "Mastered", color: "text-emerald-700 bg-emerald-50 border-emerald-200" }
        : score >= 70
          ? { label: "Proficient", color: "text-sky-700 bg-sky-50 border-sky-200" }
          : { label: "Needs Practice", color: "text-amber-700 bg-amber-50 border-amber-200" }
      : null;

  // Talk ratio metrics calculation
  const talkRatio = enrollment.talkRatio;
  const totalWords = talkRatio ? (talkRatio.customerWords || 0) + (talkRatio.agentWords || 0) : 0;
  const learnerShare =
    totalWords > 0 ? Math.round(((talkRatio?.customerWords || 0) / totalWords) * 100) : 50;
  const coachShare = 100 - learnerShare;

  const qaScorecard = enrollment.qaScorecard || [];
  const coachingTips = enrollment.coachingTips || [];
  const transcript = enrollment.transcript || [];
  const actionItems = enrollment.actionItems || [];
  const objections = enrollment.objections || [];
  const topics = enrollment.topics || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 lg:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="absolute inset-0 bg-neutral-950/50 backdrop-blur-[3px]"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal Window */}
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Evaluation Scorecard: ${enrollment.userName || "Practitioner"}`}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.24, ease: EASE }}
          className="relative z-10 flex max-h-[90vh] max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 flex-col gap-3 border-b border-neutral-200 bg-neutral-50/70 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-serif text-xl font-medium text-neutral-950 truncate">
                    {enrollment.userName || "Unnamed Practitioner"}
                  </h2>
                  {grade && (
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                        grade.color,
                      )}
                    >
                      {grade.label} · {score}%
                    </span>
                  )}
                  {enrollment.status !== "completed" && (
                    <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-700 capitalize">
                      {enrollment.status.replace("_", " ")}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                  {enrollment.userPhone && (
                    <span className="font-mono text-neutral-700">{enrollment.userPhone}</span>
                  )}
                  {enrollment.userRole && (
                    <>
                      <span>·</span>
                      <span className="capitalize">{enrollment.userRole.replace("_", " ")}</span>
                    </>
                  )}
                  {enrollment.userRegion && (
                    <>
                      <span>·</span>
                      <span>{enrollment.userRegion}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>Duration: {formatDuration(enrollment.durationSecs)}</span>
                  <span>·</span>
                  <span>{formatDate(enrollment.completedAt || enrollment.calledAt)}</span>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 active:scale-95"
                aria-label="Close dialog"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 border-t border-neutral-200/60 pt-3">
              <button
                type="button"
                onClick={() => setActiveTab("scorecard")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  activeTab === "scorecard"
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900",
                )}
              >
                Rubric & Speaking
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("coaching")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5",
                  activeTab === "coaching"
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900",
                )}
              >
                <span>AI Coaching Tips</span>
                {coachingTips.length > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      activeTab === "coaching" ? "bg-white/20 text-white" : "bg-neutral-200 text-neutral-700",
                    )}
                  >
                    {coachingTips.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("transcript")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5",
                  activeTab === "transcript"
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900",
                )}
              >
                <span>Call Audio & Transcript</span>
                {transcript.length > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      activeTab === "transcript" ? "bg-white/20 text-white" : "bg-neutral-200 text-neutral-700",
                    )}
                  >
                    {transcript.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* ── TAB 1: SCORECARD & METRICS ── */}
            {activeTab === "scorecard" && (
              <div className="space-y-6">
                {/* Audio Recording Banner if available */}
                {enrollment.recordingUrl && (
                  <AudioPlayer
                    src={enrollment.recordingUrl}
                    title="Practice Session Recording"
                  />
                )}

                {/* Performance & Speaking Metrics Grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Mastery Score Box */}
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        Practice Mastery
                      </span>
                      {score !== null && (
                        <span className="font-mono text-2xl font-bold text-neutral-900">
                          {score}%
                        </span>
                      )}
                    </div>
                    {score !== null ? (
                      <div className="mt-3">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              score >= 85 ? "bg-emerald-500" : score >= 70 ? "bg-sky-500" : "bg-amber-500",
                            )}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <div className="mt-2 flex justify-between text-[11px] text-neutral-400">
                          <span>0%</span>
                          <span>Passing: 70%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-neutral-500">
                        Not scored yet or incomplete call.
                      </p>
                    )}
                  </div>

                  {/* Learner Talk Share Ratio */}
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        Speaking Balance
                      </span>
                      <span className="text-xs font-semibold text-neutral-700">
                        Learner {learnerShare}% · Coach {coachShare}%
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-500"
                          style={{ width: `${learnerShare}%` }}
                          title={`Learner: ${learnerShare}%`}
                        />
                        <div
                          className="h-full bg-neutral-300 transition-all duration-500"
                          style={{ width: `${coachShare}%` }}
                          title={`Coach: ${coachShare}%`}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-[11px] text-neutral-500">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-indigo-600" />
                          Learner ({talkRatio?.customerWords || 0} words)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-neutral-300" />
                          Coach ({talkRatio?.agentWords || 0} words)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Executive Summary */}
                {enrollment.summary && (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4">
                    <div className="flex items-center gap-2">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-indigo-600">
                        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM8.5 6.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm-.75 4.75a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3z" />
                      </svg>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
                        Session Summary & Key Highlights
                      </h4>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap">
                      {enrollment.summary}
                    </p>
                  </div>
                )}

                {/* Rubric Criteria Evaluation List with Evidence Snippets */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-base font-medium text-neutral-900">
                      Evaluated Rubric Criteria
                    </h3>
                    {qaScorecard.length > 0 && (
                      <span className="text-xs font-medium text-neutral-500">
                        {qaScorecard.filter((q) => q.met).length} of {qaScorecard.length} met
                      </span>
                    )}
                  </div>

                  {qaScorecard.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-neutral-200 p-6 text-center text-xs text-neutral-500">
                      No criterion evaluation data recorded for this session.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {qaScorecard.map((item, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "rounded-2xl border p-4 transition-all",
                            item.met
                              ? "border-emerald-200/80 bg-emerald-50/30"
                              : "border-red-200/80 bg-red-50/30",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {item.met ? (
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              ) : (
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                              <span className="text-sm font-semibold text-neutral-900">
                                {item.key}
                              </span>
                            </div>

                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-xs font-semibold",
                                item.met
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-800",
                              )}
                            >
                              {item.met ? "Met" : "Not Met"}
                            </span>
                          </div>

                          {/* Spoken Evidence Quote Box */}
                          {item.evidence && item.evidence.trim().length > 0 && (
                            <div className="mt-3 rounded-xl border border-neutral-200/80 bg-white/90 p-3 text-xs text-neutral-700 shadow-2xs">
                              <span className="font-semibold text-neutral-500 uppercase tracking-wider text-[10px] block mb-1">
                                Spoken Evidence Quote
                              </span>
                              <blockquote className="italic leading-relaxed text-neutral-800 before:content-['“'] after:content-['”']">
                                {item.evidence}
                              </blockquote>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Topics & Objections Chips */}
                {(objections.length > 0 || topics.length > 0 || actionItems.length > 0) && (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Discovered Signals
                    </h4>

                    {objections.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-neutral-600 block mb-1.5">
                          Objections Handled
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {objections.map((obj, i) => (
                            <span
                              key={i}
                              className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-900"
                            >
                              {obj}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {topics.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-neutral-600 block mb-1.5">
                          Key Conversation Topics
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {topics.map((top, i) => (
                            <span
                              key={i}
                              className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700"
                            >
                              {top}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {actionItems.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-neutral-600 block mb-1.5">
                          Action Items & Follow-ups
                        </span>
                        <ul className="list-disc list-inside space-y-1 text-xs text-neutral-700">
                          {actionItems.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 2: COACHING FEEDBACK ── */}
            {activeTab === "coaching" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-base font-medium text-neutral-900">
                      Actionable Coaching Advice
                    </h3>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      AI feedback highlighting specific moments and high-impact changes for next time.
                    </p>
                  </div>
                </div>

                {coachingTips.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 p-8 text-center text-xs text-neutral-500">
                    No coaching tips were generated for this call.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {coachingTips.map((tip, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-neutral-900">
                            Coaching Point #{idx + 1}
                          </span>
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase",
                              tip.severity === "high"
                                ? "bg-red-100 text-red-800"
                                : tip.severity === "low"
                                  ? "bg-neutral-100 text-neutral-700"
                                  : "bg-amber-100 text-amber-800",
                            )}
                          >
                            {tip.severity} Priority
                          </span>
                        </div>

                        {tip.issue && (
                          <div>
                            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
                              Observed Issue
                            </span>
                            <p className="mt-0.5 text-sm text-neutral-800 leading-relaxed">
                              {tip.issue}
                            </p>
                          </div>
                        )}

                        {tip.suggestion && (
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                            <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block">
                              Recommended Adjustment
                            </span>
                            <p className="mt-0.5 text-sm text-indigo-950 leading-relaxed">
                              {tip.suggestion}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: AUDIO & TRANSCRIPT ── */}
            {activeTab === "transcript" && (
              <div className="space-y-4">
                {enrollment.recordingUrl && (
                  <AudioPlayer
                    src={enrollment.recordingUrl}
                    title="Session Audio Recording"
                  />
                )}

                <div className="space-y-3">
                  <h3 className="font-serif text-base font-medium text-neutral-900">
                    Full Conversation Transcript
                  </h3>

                  {transcript.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-neutral-200 p-8 text-center text-xs text-neutral-500">
                      No transcript turns recorded for this session.
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50/40 p-4">
                      {transcript.map((turn, i) => {
                        const isCoach =
                          turn.role.toLowerCase() === "agent" ||
                          turn.role.toLowerCase() === "assistant" ||
                          turn.role.toLowerCase() === "bot";
                        return (
                          <div
                            key={i}
                            className={cn(
                              "flex flex-col gap-1 max-w-[85%]",
                              isCoach ? "mr-auto items-start" : "ml-auto items-end",
                            )}
                          >
                            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 px-1">
                              <span className="font-semibold text-neutral-700 capitalize">
                                {isCoach ? "Voice Coach" : enrollment.userName || "Learner"}
                              </span>
                              {turn.at && <span>· {turn.at}</span>}
                            </div>
                            <div
                              className={cn(
                                "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                                isCoach
                                  ? "bg-white border border-neutral-200 text-neutral-900 rounded-tl-sm shadow-2xs"
                                  : "bg-neutral-900 text-white rounded-tr-sm shadow-sm",
                              )}
                            >
                              {turn.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-end border-t border-neutral-200 bg-white p-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 active:scale-95"
            >
              Close Scorecard
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
