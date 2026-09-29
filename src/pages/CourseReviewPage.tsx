import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  apiApproveCourse,
  apiGetCourse,
  apiGetCourseEnrollments,
  apiGetCourseKnowledgeBase,
  apiGetVoices,
  apiProvisionCourse,
  apiRejectCourse,
} from "../api/courses";
import type {
  Course,
  CourseEnrollment,
  TelenowKbDocument,
  TelenowKnowledgeBase,
  VoiceOption,
} from "../api/courses";
import { Button, Spinner, Tabs } from "../components";
import { DeliverySummary } from "../features/courses/DeliverySummary";
import { RubricList } from "../features/courses/RubricList";
import { StatusBadge } from "../features/courses/StatusBadge";
import { VoiceSelector } from "../features/courses/VoiceSelector";
import { CourseCallDetailModal } from "../features/courses/CourseCallDetailModal";
import { cn } from "../lib/cn";
import { pageVariants, fadeUp } from "../lib/animation";

const detailLabel = "text-sm font-medium text-neutral-600";

const ENROLLMENT_TONE: Record<CourseEnrollment["status"], string> = {
  completed: "bg-emerald-500",
  answered: "bg-sky-500",
  no_answer: "bg-neutral-400",
  pending: "bg-neutral-300",
  queued: "bg-amber-400",
  calling: "bg-amber-500 animate-pulse",
  failed: "bg-red-500",
  skipped: "bg-neutral-200",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

type PerformanceFilter = "all" | "mastered" | "proficient" | "needs_practice" | "incomplete";

export function CourseReviewPage() {
  const router = useRouter();
  const params = useParams({ strict: false });
  const courseId = params?.["courseId"];

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewTab, setReviewTab] = useState("overview");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | "retry" | null>(null);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [kbInfo, setKbInfo] = useState<TelenowKnowledgeBase | null>(null);
  const [kbDocuments, setKbDocuments] = useState<TelenowKbDocument[]>([]);
  const [kbLoading, setKbLoading] = useState(false);

  // Scorecard modal state
  const [selectedEnrollment, setSelectedEnrollment] = useState<CourseEnrollment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [performanceFilter, setPerformanceFilter] = useState<PerformanceFilter>("all");

  // ── Voice State ──
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [playingVoice, setPlayingVoice] = useState(false);
  const reviewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    apiGetVoices()
      .then(setVoices)
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (reviewAudioRef.current) {
        reviewAudioRef.current.pause();
        reviewAudioRef.current = null;
      }
    };
  }, []);

  const toggleReviewVoicePreview = (url: string) => {
    if (playingVoice) {
      reviewAudioRef.current?.pause();
      setPlayingVoice(false);
      return;
    }
    if (reviewAudioRef.current) {
      reviewAudioRef.current.pause();
    }
    const audio = new Audio(url);
    reviewAudioRef.current = audio;
    setPlayingVoice(true);
    audio.play().catch(() => setPlayingVoice(false));
    audio.onended = () => setPlayingVoice(false);
    audio.onerror = () => setPlayingVoice(false);
  };

  const handleRetry = async () => {
    if (!course) return;
    setBusy("retry");
    try {
      const refreshed = await apiProvisionCourse(course.id);
      setCourse(refreshed);
      toast.success("Setup retried — check the delivery status below.");
    } catch (err) {
      toast.error(
        (err as { message?: string })?.message ?? "Couldn't retry setup.",
      );
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!courseId) {
      void router.navigate({ to: "/courses" });
      return;
    }
    let cancelled = false;
    apiGetCourse(courseId)
      .then((loaded) => {
        if (cancelled) return;
        setCourse(loaded);
        setReviewTab("overview");

        // Fetch Knowledge Base
        setKbLoading(true);
        apiGetCourseKnowledgeBase(loaded.id)
          .then((kbRes) => {
            if (cancelled) return;
            setKbInfo(kbRes.knowledgeBase);
            setKbDocuments(kbRes.documents);
          })
          .catch(() => {
            // ignore
          })
          .finally(() => {
            if (!cancelled) setKbLoading(false);
          });

        if (loaded.status === "published") {
          setEnrollmentsLoading(true);
          return apiGetCourseEnrollments(loaded.id)
            .then((rows) => {
              if (cancelled) return;
              setEnrollments(rows);
            })
            .catch(() => {
              if (cancelled) return;
              setEnrollments([]);
            })
            .finally(() => {
              if (!cancelled) setEnrollmentsLoading(false);
            });
        }
        return undefined;
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Couldn't load this course for review.");
        void router.navigate({ to: "/courses" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, router]);

  const goBack = () => void router.navigate({ to: "/courses" });

  const handleApprove = async () => {
    if (!course) return;
    setBusy("approve");
    try {
      await apiApproveCourse(course.id);
      toast.success(`"${course.title}" published.`);
      goBack();
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Couldn't approve.");
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    if (!course) return;
    if (!comment.trim()) {
      toast.error("Add a comment so the creator knows what to fix.");
      return;
    }
    setBusy("reject");
    try {
      await apiRejectCourse(course.id, comment.trim());
      toast.success(`"${course.title}" sent back to the creator.`);
      goBack();
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Couldn't reject.");
    } finally {
      setBusy(null);
    }
  };

  // ── Cohort Analytics Computations ──
  const cohortAnalytics = useMemo(() => {
    const totalEnrolled = enrollments.length;
    const completedList = enrollments.filter((e) => e.status === "completed");
    const completedCount = completedList.length;
    const scoredList = enrollments.filter((e) => e.score !== null);

    const masteredCount = scoredList.filter((e) => (e.score ?? 0) >= 85).length;
    const proficientCount = scoredList.filter((e) => (e.score ?? 0) >= 70 && (e.score ?? 0) < 85).length;
    const needsPracticeCount = scoredList.filter((e) => (e.score ?? 0) < 70).length;

    const avgScore =
      scoredList.length > 0
        ? Math.round(scoredList.reduce((sum, e) => sum + (e.score ?? 0), 0) / scoredList.length)
        : null;

    // Avg Learner Talk Share
    let totalLearnerWords = 0;
    let totalAllWords = 0;
    for (const e of completedList) {
      if (e.talkRatio) {
        totalLearnerWords += e.talkRatio.customerWords || 0;
        totalAllWords += (e.talkRatio.customerWords || 0) + (e.talkRatio.agentWords || 0);
      }
    }
    const avgLearnerTalkShare =
      totalAllWords > 0 ? Math.round((totalLearnerWords / totalAllWords) * 100) : null;

    // Avg Duration
    const durationSum = completedList.reduce((sum, e) => sum + (e.durationSecs || 0), 0);
    const avgDurationSecs = completedList.length > 0 ? Math.round(durationSum / completedList.length) : null;

    // Weakest Criteria Heatmap
    const criteriaMap = new Map<string, { key: string; met: number; total: number }>();
    for (const e of completedList) {
      if (Array.isArray(e.qaScorecard)) {
        for (const item of e.qaScorecard) {
          const existing = criteriaMap.get(item.key) ?? { key: item.key, met: 0, total: 0 };
          existing.total += 1;
          if (item.met) existing.met += 1;
          criteriaMap.set(item.key, existing);
        }
      }
    }

    const criteriaStats = Array.from(criteriaMap.values())
      .map((c) => ({
        ...c,
        passRate: c.total > 0 ? Math.round((c.met / c.total) * 100) : 0,
      }))
      .sort((a, b) => a.passRate - b.passRate); // Weakest first

    return {
      totalEnrolled,
      completedCount,
      scoredCount: scoredList.length,
      masteredCount,
      proficientCount,
      needsPracticeCount,
      avgScore,
      avgLearnerTalkShare,
      avgDurationSecs,
      criteriaStats,
    };
  }, [enrollments]);

  // ── Filtered Enrollments for Table ──
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((e) => {
      // Search
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesName = (e.userName || "").toLowerCase().includes(q);
        const matchesPhone = (e.userPhone || "").toLowerCase().includes(q);
        const matchesEmail = (e.userEmail || "").toLowerCase().includes(q);
        const matchesRegion = (e.userRegion || "").toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesEmail && !matchesRegion) {
          return false;
        }
      }

      // Performance Filter
      if (performanceFilter === "mastered") return (e.score ?? 0) >= 85;
      if (performanceFilter === "proficient") return (e.score ?? 0) >= 70 && (e.score ?? 0) < 85;
      if (performanceFilter === "needs_practice") return e.score !== null && (e.score ?? 0) < 70;
      if (performanceFilter === "incomplete") return e.status !== "completed";
      return true;
    });
  }, [enrollments, searchQuery, performanceFilter]);

  if (loading || !course) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-neutral-50">
        <Spinner size="md" className="text-neutral-700" />
      </div>
    );
  }

  const isPending = course.status === "pending_review";
  const isPublished = course.status === "published";

  return (
    <motion.div
      key="course-review"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex min-h-screen flex-col items-center gap-8 bg-neutral-50 px-4 py-6 font-sans sm:px-6 lg:p-8"
    >
      <motion.div
        variants={fadeUp}
        className="flex w-full max-w-5xl items-start justify-between gap-4"
      >
        <div className="min-w-0">
          <Button variant="ghost" size="sm" onClick={goBack} className="mb-3">
            &larr; Back to courses
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl font-medium leading-snug tracking-normal text-neutral-950">
              {course.title}
            </h1>
            <StatusBadge status={course.status} />
          </div>
          {course.description && (
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              {course.description}
            </p>
          )}
        </div>
      </motion.div>

      {!isPending && !isPublished && (
        <motion.div
          variants={fadeUp}
          className="w-full max-w-5xl rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 shadow-sm"
        >
          This course is currently in{" "}
          <span className="font-semibold text-neutral-900 capitalize">
            {course.status.replace("_", " ")}
          </span>{" "}
          status.
        </motion.div>
      )}

      <motion.div
        variants={fadeUp}
        className="flex w-full max-w-5xl flex-col gap-6"
      >
        <Tabs
          items={[
            { id: "overview", label: isPublished ? "Analytics & Delivery" : "Overview" },
            {
              id: "knowledge",
              label: "Knowledge base",
              count: kbDocuments.length || (course.docs?.length ?? 0),
            },
            { id: "voice", label: "Coach voice & line" },
            {
              id: "questions",
              label: "Practice questions",
              count: (course.faqs?.length ?? 0),
            },
            { id: "rubric", label: "Scoring rubric" },
          ]}
          active={reviewTab}
          onChange={setReviewTab}
        />

        {reviewTab === "overview" && (
          <div className="flex flex-col gap-6">
            <DeliverySummary
              course={course}
              onRetry={course.provisioningStatus === "failed" ? handleRetry : undefined}
              retrying={busy === "retry"}
            />

            {/* ── COHORT PERFORMANCE ANALYTICS HUB (When Published or Enrollments Exist) ── */}
            {isPublished && (
              <div className="space-y-6">
                {/* 1. Cohort KPI Cards Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Completion Rate */}
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Cohort Completion
                    </span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="font-mono text-2xl font-bold text-neutral-900">
                        {cohortAnalytics.totalEnrolled > 0
                          ? `${Math.round((cohortAnalytics.completedCount / cohortAnalytics.totalEnrolled) * 100)}%`
                          : "0%"}
                      </span>
                      <span className="text-xs text-neutral-500 font-medium">
                        {cohortAnalytics.completedCount} of {cohortAnalytics.totalEnrolled} completed
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full bg-neutral-900 transition-all duration-500"
                        style={{
                          width: `${cohortAnalytics.totalEnrolled > 0 ? (cohortAnalytics.completedCount / cohortAnalytics.totalEnrolled) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Avg Mastery Score */}
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Average Mastery
                    </span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="font-mono text-2xl font-bold text-neutral-900">
                        {cohortAnalytics.avgScore !== null ? `${cohortAnalytics.avgScore}%` : "—"}
                      </span>
                      <span className="text-xs text-neutral-500 font-medium">
                        {cohortAnalytics.scoredCount} evaluated
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-500">
                      <span className="rounded bg-emerald-50 text-emerald-700 px-1 py-0.2 font-medium">
                        {cohortAnalytics.masteredCount} high
                      </span>
                      <span className="rounded bg-sky-50 text-sky-700 px-1 py-0.2 font-medium">
                        {cohortAnalytics.proficientCount} med
                      </span>
                      <span className="rounded bg-amber-50 text-amber-700 px-1 py-0.2 font-medium">
                        {cohortAnalytics.needsPracticeCount} low
                      </span>
                    </div>
                  </div>

                  {/* Active Speaking Share */}
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Learner Talk Share
                    </span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="font-mono text-2xl font-bold text-neutral-900">
                        {cohortAnalytics.avgLearnerTalkShare !== null
                          ? `${cohortAnalytics.avgLearnerTalkShare}%`
                          : "—"}
                      </span>
                      <span className="text-xs text-neutral-500 font-medium">
                        Active speaking
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-neutral-500">
                      Coach listening share:{" "}
                      {cohortAnalytics.avgLearnerTalkShare !== null
                        ? `${100 - cohortAnalytics.avgLearnerTalkShare}%`
                        : "—"}
                    </p>
                  </div>

                  {/* Avg Duration */}
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Avg Call Duration
                    </span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="font-mono text-2xl font-bold text-neutral-900">
                        {formatDuration(cohortAnalytics.avgDurationSecs)}
                      </span>
                      <span className="text-xs text-neutral-500 font-medium">
                        Limit: {course.maxDurationSec}s
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-neutral-500 truncate">
                      {course.isMandatory ? "Mandatory requirement" : "Elective practice"}
                    </p>
                  </div>
                </div>

                {/* 2. Weakest Criteria Heatmap Card */}
                {cohortAnalytics.criteriaStats.length > 0 && (
                  <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-serif text-base font-medium text-neutral-950">
                          Cohort Rubric Pass Rate & Gap Analysis
                        </h3>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Criteria ranked by learner struggle rate. Low pass rate areas highlight team training gaps.
                        </p>
                      </div>
                      <span className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 self-start sm:self-auto">
                        {cohortAnalytics.criteriaStats.length} evaluated criteria
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {cohortAnalytics.criteriaStats.map((item, i) => {
                        const isStruggling = item.passRate < 70;
                        return (
                          <div
                            key={i}
                            className={cn(
                              "rounded-xl border p-3.5 transition-all flex flex-col justify-between gap-2.5",
                              isStruggling
                                ? "border-amber-200 bg-amber-50/40"
                                : "border-neutral-200 bg-neutral-50/50",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-semibold text-neutral-900 truncate">
                                {item.key}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isStruggling && (
                                  <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 uppercase">
                                    Focus Area
                                  </span>
                                )}
                                <span
                                  className={cn(
                                    "font-mono text-sm font-bold",
                                    item.passRate >= 80
                                      ? "text-emerald-700"
                                      : item.passRate >= 70
                                        ? "text-sky-700"
                                        : "text-amber-700",
                                  )}
                                >
                                  {item.passRate}%
                                </span>
                              </div>
                            </div>

                            <div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    item.passRate >= 80
                                      ? "bg-emerald-500"
                                      : item.passRate >= 70
                                        ? "bg-sky-500"
                                        : "bg-amber-500",
                                  )}
                                  style={{ width: `${item.passRate}%` }}
                                />
                              </div>
                              <div className="mt-1.5 flex justify-between text-[11px] text-neutral-500">
                                <span>{item.met} passed</span>
                                <span>{item.total - item.met} missed</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Practitioner Evaluation Ledger Table */}
                <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden space-y-4 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-serif text-base font-medium text-neutral-950">
                        Practitioner Delivery & Evaluation Ledger
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Inspect individual call recordings, interactive transcripts, and AI coaching scorecards.
                      </p>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full sm:w-64">
                      <input
                        type="text"
                        placeholder="Search practitioner or role…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-3.5 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-500 focus:bg-white focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-100 pb-3 text-xs">
                    {(
                      [
                        { id: "all", label: `All (${enrollments.length})` },
                        {
                          id: "mastered",
                          label: `Mastered (${cohortAnalytics.masteredCount})`,
                        },
                        {
                          id: "proficient",
                          label: `Proficient (${cohortAnalytics.proficientCount})`,
                        },
                        {
                          id: "needs_practice",
                          label: `Needs Practice (${cohortAnalytics.needsPracticeCount})`,
                        },
                        {
                          id: "incomplete",
                          label: `Incomplete (${cohortAnalytics.totalEnrolled - cohortAnalytics.completedCount})`,
                        },
                      ] as const
                    ).map((pill) => (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => setPerformanceFilter(pill.id)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 font-semibold transition-all",
                          performanceFilter === pill.id
                            ? "bg-neutral-900 text-white shadow-2xs"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900",
                        )}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>

                  {/* Table */}
                  {enrollmentsLoading ? (
                    <div className="flex items-center justify-center py-12 text-xs text-neutral-500 gap-2">
                      <Spinner size="sm" className="text-neutral-600" />
                      Loading practitioner enrollments…
                    </div>
                  ) : filteredEnrollments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 py-10 text-center text-xs text-neutral-500">
                      No practitioner records match the selected filters.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold">
                            <th className="py-3 px-3">Practitioner</th>
                            <th className="py-3 px-3">Status</th>
                            <th className="py-3 px-3">Mastery Score</th>
                            <th className="py-3 px-3">Duration</th>
                            <th className="py-3 px-3">Talk Share</th>
                            <th className="py-3 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {filteredEnrollments.map((item) => {
                            const itemScore = item.score;
                            const itemLearnerShare =
                              item.talkRatio &&
                              (item.talkRatio.customerWords || 0) + (item.talkRatio.agentWords || 0) > 0
                                ? Math.round(
                                    ((item.talkRatio.customerWords || 0) /
                                      ((item.talkRatio.customerWords || 0) +
                                        (item.talkRatio.agentWords || 0))) *
                                      100,
                                  )
                                : null;

                            return (
                              <tr
                                key={item.id}
                                onClick={() => setSelectedEnrollment(item)}
                                className="group cursor-pointer hover:bg-neutral-50/80 transition-colors"
                              >
                                <td className="py-3 px-3">
                                  <div className="font-semibold text-neutral-900">
                                    {item.userName || "Unnamed"}
                                  </div>
                                  <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                                    {item.userPhone && <span>{item.userPhone}</span>}
                                    {item.userRole && (
                                      <>
                                        <span>·</span>
                                        <span className="capitalize">{item.userRole.replace("_", " ")}</span>
                                      </>
                                    )}
                                  </div>
                                </td>

                                <td className="py-3 px-3">
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 capitalize">
                                    <span
                                      aria-hidden="true"
                                      className={cn(
                                        "h-2 w-2 rounded-full shrink-0",
                                        ENROLLMENT_TONE[item.status],
                                      )}
                                    />
                                    {item.status.replace("_", " ")}
                                  </span>
                                </td>

                                <td className="py-3 px-3">
                                  {itemScore !== null ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-neutral-900 text-sm">
                                        {itemScore}%
                                      </span>
                                      <span
                                        className={cn(
                                          "rounded px-1.5 py-0.2 text-[10px] font-semibold",
                                          itemScore >= 85
                                            ? "bg-emerald-50 text-emerald-700"
                                            : itemScore >= 70
                                              ? "bg-sky-50 text-sky-700"
                                              : "bg-amber-50 text-amber-700",
                                        )}
                                      >
                                        {itemScore >= 85
                                          ? "Mastered"
                                          : itemScore >= 70
                                            ? "Proficient"
                                            : "Needs Practice"}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-neutral-400 font-mono">—</span>
                                  )}
                                </td>

                                <td className="py-3 px-3 font-mono text-neutral-600">
                                  {formatDuration(item.durationSecs)}
                                </td>

                                <td className="py-3 px-3">
                                  {itemLearnerShare !== null ? (
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200">
                                        <div
                                          className="h-full bg-indigo-600"
                                          style={{ width: `${itemLearnerShare}%` }}
                                        />
                                      </div>
                                      <span className="font-mono text-[11px] text-neutral-600">
                                        {itemLearnerShare}%
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-neutral-400 font-mono">—</span>
                                  )}
                                </td>

                                <td className="py-3 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEnrollment(item);
                                    }}
                                    className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-100 group-hover:border-neutral-300 transition-all"
                                  >
                                    Scorecard &rarr;
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Course Details Card */}
            <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className={detailLabel}>Course Configuration</p>
              <p className="text-sm text-neutral-700">
                {course.maxDurationSec}s call limit ·{" "}
                {course.isMandatory ? "mandatory" : "optional"} · created by{" "}
                <span className="font-medium text-neutral-900">
                  {course.createdByName ?? "Unknown"}
                </span>
              </p>
            </section>

            {/* AI Coach Voice Card */}
            {(() => {
              const selectedVoice = voices.find((v) => v.id === course.voice);
              return (
                <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className={detailLabel}>AI Coach Voice</p>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-900">
                        {selectedVoice?.displayName ?? "Sarah"}
                      </span>
                      {selectedVoice?.gender && (
                        <span className="rounded-md bg-neutral-200/80 px-2 py-0.5 text-[11px] font-medium text-neutral-700 capitalize">
                          {selectedVoice.gender}
                        </span>
                      )}
                      {selectedVoice?.accent && (
                        <span className="rounded-md bg-neutral-200/80 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                          {selectedVoice.accent}
                        </span>
                      )}
                      {selectedVoice?.description && (
                        <span className="hidden text-xs text-neutral-500 sm:inline">
                          · {selectedVoice.description}
                        </span>
                      )}
                    </div>

                    {selectedVoice?.previewUrl && (
                      <button
                        type="button"
                        onClick={() => toggleReviewVoicePreview(selectedVoice.previewUrl!)}
                        className={cn(
                          "flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all",
                          playingVoice
                            ? "bg-neutral-900 text-white shadow-sm"
                            : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100",
                        )}
                      >
                        {playingVoice ? (
                          <>
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                              <rect x="5" y="4" width="3" height="12" rx="1" />
                              <rect x="12" y="4" width="3" height="12" rx="1" />
                            </svg>
                            <span>Playing</span>
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                              <path d="M6.3 3.8A1 1 0 005 4.7v10.6a1 1 0 001.3.9l10-5.3a1 1 0 000-1.8l-10-5.3z" />
                            </svg>
                            <span>Listen to Voice</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </section>
              );
            })()}

            {/* Inbound Line Card */}
            <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className={detailLabel}>Inbound Phone Line</p>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {course.phoneNumber ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-neutral-900">
                      {course.phoneNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Inbound active
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-neutral-500">
                    No phone line assigned (outbound calls use default caller ID).
                  </span>
                )}
              </div>
            </section>
          </div>
        )}

        {reviewTab === "knowledge" && (
          <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div>
              <p className={detailLabel}>Knowledge base</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Grounding documents and references embedded for Voice AI coaching.
              </p>
            </div>

            {/* KB Header */}
            <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-neutral-900">
                    {kbInfo?.title ||
                      kbInfo?.name ||
                      (course.title
                        ? `Course: ${course.title}`
                        : "Knowledge Base")}
                  </h4>
                  <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 uppercase">
                    AI Grounded
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {kbLoading
                    ? "Loading Knowledge Base…"
                    : `${kbDocuments.filter((d) => d.status === "embedded").length} embedded · ${kbDocuments.filter((d) => d.status === "pending").length} vectorizing · top 3 chunks queried per turn`}
                </p>
              </div>
            </div>

            {/* Documents List */}
            {kbDocuments.length === 0 && !kbLoading && (!course.docs || course.docs.length === 0) && !course.knowledgeText?.trim() ? (
              <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
                No documents or notes attached to this Knowledge Base.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {kbDocuments.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {doc.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span className="capitalize">{doc.sourceType}</span>
                        {doc.fileSize && (
                          <>
                            <span>·</span>
                            <span>{formatBytes(doc.fileSize)}</span>
                          </>
                        )}
                        {doc.chunkCount ? (
                          <>
                            <span>·</span>
                            <span>{doc.chunkCount} chunks</span>
                          </>
                        ) : null}
                        {doc.sourceUri && doc.sourceType === "url" && (
                          <>
                            <span>·</span>
                            <a
                              href={doc.sourceUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="max-w-[200px] truncate text-indigo-600 hover:underline"
                            >
                              {doc.sourceUri}
                            </a>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {doc.status === "embedded" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-3 w-3"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Embedded
                        </span>
                      )}
                      {doc.status === "pending" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Vectorizing…
                        </span>
                      )}
                      {doc.status === "failed" && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                          title={doc.errorMessage || doc.error || "Processing failed"}
                        >
                          Failed
                        </span>
                      )}
                    </div>
                  </li>
                ))}

                {course.docs?.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="truncate font-medium text-neutral-900">
                      {doc.originalName}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {formatBytes(doc.sizeBytes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {course.knowledgeText?.trim() && (
              <div className="mt-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-neutral-500">
                  Additional Notes
                </span>
                <div className="max-h-64 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-lg border border-neutral-200 bg-white p-3 pr-2 text-sm leading-relaxed text-neutral-600">
                  {course.knowledgeText}
                </div>
              </div>
            )}
          </section>
        )}

        {reviewTab === "voice" && (
          <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={detailLabel}>Coach voice & line</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  The voice persona and phone line assigned to this course for AI practice calls. Audition any voice sample in the table below.
                </p>
              </div>
              {course.phoneNumber ? (
                <div className="flex items-center gap-2 self-start rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs">
                  <span className="font-mono font-semibold text-emerald-900">{course.phoneNumber}</span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Inbound Line
                  </span>
                </div>
              ) : (
                <div className="text-xs text-neutral-500">
                  No dedicated phone line assigned
                </div>
              )}
            </div>
            <VoiceSelector
              selectedVoiceId={course.voice || "sarah"}
              selectedProvider={course.voiceProvider || "elevenlabs"}
              onSelectVoice={() => {}}
              readOnly={true}
            />
          </section>
        )}

        {reviewTab === "questions" && (
          <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-4">
            <p className={detailLabel}>Practice questions</p>
            {course.faqs?.length > 0 ? (
              <ol className="flex flex-col gap-1.5">
                {course.faqs.map((question, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-700"
                  >
                    <span className="mr-1.5 font-semibold text-neutral-400">
                      {i + 1}.
                    </span>
                    {question}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-neutral-500">
                No practice questions set.
              </p>
            )}
          </section>
        )}

        {reviewTab === "rubric" && (
          <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className={detailLabel}>Scoring rubric</p>
            <RubricList rubric={course.scoringRubric} />
          </section>
        )}

        {isPending && (
          <>
            {rejectOpen ? (
              <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <label className="flex flex-col gap-1">
                  <span className={detailLabel}>Rejection reason</span>
                  <textarea
                    autoFocus
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell the creator exactly what to fix before resubmitting."
                    className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-neutral-900 focus:ring-2 focus:ring-red-900/10"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRejectOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    loading={busy === "reject"}
                    onClick={() => void handleReject()}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Send back to creator
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={busy !== null}
                >
                  Reject
                </Button>
                <Button loading={busy === "approve"} onClick={() => void handleApprove()}>
                  Approve & publish
                </Button>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* ── Practitioner Scorecard & Call Inspection Modal ── */}
      <CourseCallDetailModal
        enrollment={selectedEnrollment}
        onClose={() => setSelectedEnrollment(null)}
      />
    </motion.div>
  );
}