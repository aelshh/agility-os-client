import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { apiListCourses, apiSubmitCourse } from "../api/courses";
import type { Course } from "../api/courses";
import { apiGetTelenowStatus } from "../api/telenow";
import { Button, Spinner } from "../components";
import { useAuth } from "../features/auth";
import { StatusBadge } from "../features/courses/StatusBadge";
import { pageVariants, stagger, fadeUp, EASE } from "../lib/animation";

const metaLabel = "text-xs font-medium uppercase tracking-wide text-neutral-400";

export function CoursesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [telenowConfigured, setTelenowConfigured] = useState<boolean | null>(null);

  const isArchitect = user?.role === "architect";

  const load = useCallback(async () => {
    try {
      setCourses(await apiListCourses());
    } catch {
      toast.error("Couldn't load your courses.");
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

  const handleSubmit = async (course: Course) => {
    setSubmittingId(course.id);
    try {
      await apiSubmitCourse(course.id);
      toast.success("Course submitted for review.");
      await load();
    } catch (err) {
      const message =
        (err as { message?: string })?.message ??
        "Couldn't submit the course.";
      toast.error(message);
    } finally {
      setSubmittingId(null);
    }
  };

  const editable = (course: Course) =>
    course.status === "draft" || course.status === "rejected";

  const canActOn = (course: Course) =>
    isArchitect || course.createdBy === user?.id;

  return (
    <motion.div
      key="courses"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex min-h-screen flex-col items-start gap-8 bg-neutral-50 px-4 py-6 font-sans sm:px-6 lg:p-8"
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
              Courses
            </h1>
            <p className="mt-1 text-sm font-medium text-neutral-600">
              Build courses to train your team on anything — a new product
              launch, new technology, a new process. Draft them, submit for
              review, and track them here.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {isArchitect && (
              <Button
                variant="outline"
                onClick={() => void router.navigate({ to: "/courses/approvals" })}
              >
                Review queue
              </Button>
            )}
            <Button
              onClick={() => {
                if (telenowConfigured === false) {
                  if (isArchitect) {
                    toast.error("Please connect your Telenow API key in Settings before creating courses.");
                    void router.navigate({ to: "/profile" });
                  } else {
                    toast.error("Your organisation must connect Telenow Voice AI before creating courses. Please contact an architect.");
                  }
                  return;
                }
                void router.navigate({ to: "/courses/new" });
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
              New course
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
                  Telenow Voice AI is not connected for your organisation. An API key must be configured in Settings before voice courses can be created or practice calls placed.
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

        {courses === null ? (
          <div className="flex w-full items-center justify-center py-24">
            <Spinner size="md" className="text-neutral-700" />
          </div>
        ) : courses.length === 0 ? (
          <motion.div
            variants={fadeUp}
            className="w-full rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm"
          >
            <p className="text-sm font-semibold text-neutral-900">
              No courses yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
              Create your first course — share the material learners should
              know and the questions a coach will ask during practice.
            </p>
            <Button
              className="mt-5"
              onClick={() => void router.navigate({ to: "/courses/new" })}
            >
              Create your first course
            </Button>
          </motion.div>
        ) : (
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {courses.map((course) => (
              <motion.article
                key={course.id}
                variants={fadeUp}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-serif text-lg font-medium leading-snug text-neutral-950">
                    {course.title}
                  </h2>
                  <StatusBadge status={course.status} />
                </div>

                {course.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-600">
                    {course.description}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {(course.faqs?.length ?? 0) > 0 ? (
                    <span className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                      {course.faqs.length}{" "}
                      {course.faqs.length === 1 ? "question" : "questions"}
                    </span>
                  ) : (course.docs?.length ?? 0) > 0 ? (
                    <span className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                      {course.docs.length}{" "}
                      {course.docs.length === 1 ? "document" : "documents"}
                    </span>
                  ) : (
                    <span className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                      No material yet
                    </span>
                  )}
                  {course.knowledgeText?.trim() && (
                    <span className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                      Notes added
                    </span>
                  )}
                </div>

                {course.status === "rejected" && course.reviewComment && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
                    <span className="font-semibold">Rejected:</span>{" "}
                    {course.reviewComment}
                  </div>
                )}

                {course.status === "published" && (
                  <div
                    className={`mt-4 rounded-xl border px-3 py-2 text-xs leading-relaxed ${
                      course.provisioningStatus === "failed"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : course.provisioningStatus === "provisioning"
                          ? "border-sky-200 bg-sky-50 text-sky-700"
                          : "border-neutral-200 bg-neutral-50 text-neutral-700"
                    }`}
                  >
                    {course.provisioningStatus === "failed" && (
                      <span className="font-semibold">Setup failed — </span>
                    )}
                    {course.provisioningStatus === "provisioning" && (
                      <span className="font-semibold">Setting up calls… </span>
                    )}
                    {course.delivery.selected} selected ·{" "}
                    {course.delivery.called} called · {course.delivery.completed}{" "}
                    completed · avg{" "}
                    {course.delivery.avgScore === null
                      ? "—"
                      : `${course.delivery.avgScore}%`}
                  </div>
                )}

                <div className="mt-auto pt-4">
                  <p className={metaLabel}>
                    by {course.createdByName ?? "Unknown"}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {canActOn(course) && editable(course) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void router.navigate({
                              to: "/courses/$courseId/edit",
                              params: { courseId: course.id },
                            })
                          }
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          loading={submittingId === course.id}
                          onClick={() => void handleSubmit(course)}
                        >
                          Submit for review
                        </Button>
                      </>
                    )}
                    {(!canActOn(course) || !editable(course)) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void router.navigate({
                            to: "/courses/$courseId/edit",
                            params: { courseId: course.id },
                          })
                        }
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}