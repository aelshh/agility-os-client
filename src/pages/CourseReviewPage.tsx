import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  apiApproveCourse,
  apiGetCourse,
  apiGetCourseEnrollments,
  apiProvisionCourse,
  apiRejectCourse,
} from "../api/courses";
import type { Course, CourseEnrollment } from "../api/courses";
import { Button, Spinner, Tabs } from "../components";
import { DeliverySummary } from "../features/courses/DeliverySummary";
import { RubricList } from "../features/courses/RubricList";
import { StatusBadge } from "../features/courses/StatusBadge";
import { cn } from "../lib/cn";
import { pageVariants, fadeUp } from "../lib/animation";

const detailLabel = "text-sm font-medium text-neutral-600";

const ENROLLMENT_TONE: Record<CourseEnrollment["status"], string> = {
  completed: "bg-emerald-500",
  answered: "bg-sky-500",
  no_answer: "bg-neutral-400",
  pending: "bg-neutral-300",
  queued: "bg-amber-400",
  calling: "bg-amber-500",
  failed: "bg-red-500",
  skipped: "bg-neutral-200",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
      void router.navigate({ to: "/courses/approvals" });
      return;
    }
    let cancelled = false;
    apiGetCourse(courseId)
      .then((loaded) => {
        if (cancelled) return;
        setCourse(loaded);
        setReviewTab("overview");
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
        void router.navigate({ to: "/courses/approvals" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, router]);

  const goBack = () => void router.navigate({ to: "/courses/approvals" });

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

  if (loading || !course) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-neutral-50">
        <Spinner size="md" className="text-neutral-700" />
      </div>
    );
  }

  const isPending = course.status === "pending_review";

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
        className="flex w-full max-w-3xl items-start justify-between gap-4"
      >
        <div className="min-w-0">
          <Button variant="ghost" size="sm" onClick={goBack} className="mb-3">
            &larr; Back to review queue
          </Button>
          <h1 className="font-serif text-3xl font-medium leading-snug tracking-normal text-neutral-950">
            {course.title}
          </h1>
          {course.description && (
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              {course.description}
            </p>
          )}
        </div>
        <StatusBadge status={course.status} />
      </motion.div>

      {!isPending && (
        <motion.div
          variants={fadeUp}
          className="w-full max-w-3xl rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 shadow-sm"
        >
          This course has already been{" "}
          <span className="font-semibold text-neutral-900">
            {course.status === "published" ? "published" : "sent back"}
          </span>{" "}
          — nothing left to review.
        </motion.div>
      )}

      <motion.div
        variants={fadeUp}
        className="flex w-full max-w-3xl flex-col gap-4"
      >
        <Tabs
          items={[
            { id: "overview", label: "Overview" },
            {
              id: "material",
              label: "Course material",
              count: (course.docs?.length ?? 0),
            },
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
          <div className="flex flex-col gap-4">
            <DeliverySummary
              course={course}
              onRetry={course.provisioningStatus === "failed" ? handleRetry : undefined}
              retrying={busy === "retry"}
            />
            <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className={detailLabel}>Details</p>
              <p className="text-sm text-neutral-700">
                {course.maxDurationSec}s call limit ·{" "}
                {course.isMandatory ? "mandatory" : "optional"} · created by{" "}
                <span className="font-medium text-neutral-900">
                  {course.createdByName ?? "Unknown"}
                </span>
              </p>
            </section>

            {course.status === "published" && (
              <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className={detailLabel}>
                  Practitioner results
                  {enrollmentsLoading && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-neutral-400">
                      <Spinner size="sm" className="text-neutral-400" />
                      loading…
                    </span>
                  )}
                </p>
                {enrollments.length === 0 && !enrollmentsLoading ? (
                  <p className="text-sm text-neutral-500">
                    No practitioners were enrolled for this course.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {enrollments.map((enrollment) => (
                      <li
                        key={enrollment.id}
                        className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "h-2.5 w-2.5 shrink-0 rounded-full",
                            ENROLLMENT_TONE[enrollment.status],
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
                          {enrollment.userName ?? "Unnamed"}
                        </span>
                        <span className="hidden text-xs capitalize text-neutral-500 sm:block">
                          {enrollment.status.replace("_", " ")}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            enrollment.score === null
                              ? "text-neutral-300"
                              : "text-neutral-950",
                          )}
                        >
                          {enrollment.score === null
                            ? "—"
                            : `${enrollment.score}%`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}

        {reviewTab === "material" && (
          <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className={detailLabel}>Course material</p>
            {course.knowledgeText?.trim() ? (
              <div className="max-h-96 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-lg border border-neutral-200 bg-white p-3 pr-2 text-sm leading-relaxed text-neutral-600">
                {course.knowledgeText}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No pasted notes.</p>
            )}
            {course.docs?.length > 0 && (
              <ul className="mt-1 flex max-h-64 flex-col gap-1 overflow-y-auto overscroll-contain pr-1">
                {course.docs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm"
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
    </motion.div>
  );
}