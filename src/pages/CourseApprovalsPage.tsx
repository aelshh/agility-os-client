import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { apiListCourses } from "../api/courses";
import type { Course } from "../api/courses";
import { Spinner } from "../components";
import { StatusBadge } from "../features/courses/StatusBadge";
import { pageVariants, stagger, fadeUp, EASE } from "../lib/animation";

const metaClasses = "text-xs font-medium uppercase tracking-wide text-neutral-400";

export function CourseApprovalsPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[] | null>(null);

  const load = useCallback(async () => {
    try {
      setCourses(await apiListCourses("pending_review"));
    } catch {
      toast.error("Couldn't load the review queue.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <motion.div
      key="approvals"
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
        className="flex w-full max-w-5xl flex-col gap-4"
      >
        <motion.div variants={fadeUp}>
          <h1 className="font-serif text-3xl font-medium tracking-normal text-neutral-950">
            Review queue
          </h1>
          <p className="mt-1 text-sm font-medium text-neutral-600">
            Courses submitted by your content team, waiting for your sign-off.
          </p>
        </motion.div>

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
              Queue is clear
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
              No courses are waiting for review right now.
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="grid w-full gap-4 md:grid-cols-2"
          >
            {courses.map((course) => (
              <motion.button
                key={course.id}
                type="button"
                variants={fadeUp}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.18, ease: EASE }}
                onClick={() =>
                  void router.navigate({
                    to: "/courses/approvals/$courseId",
                    params: { courseId: course.id },
                  })
                }
                className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-neutral-300"
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
                  <span className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                    {(course.faqs?.length ?? 0) > 0
                      ? `${course.faqs.length} ${course.faqs.length === 1 ? "question" : "questions"}`
                      : (course.docs?.length ?? 0) > 0
                        ? `${course.docs.length} ${course.docs.length === 1 ? "document" : "documents"}`
                        : "No material yet"}
                  </span>
                  {(course.audienceIds?.length ?? 0) > 0 && (
                    <span className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                      {course.audienceIds.length} practitioner
                      {course.audienceIds.length === 1 ? "" : "s"} selected
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className={metaClasses}>
                    by {course.createdByName ?? "Unknown"}
                  </p>
                  <span className="text-xs font-semibold text-neutral-900">
                    Review &rarr;
                  </span>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}