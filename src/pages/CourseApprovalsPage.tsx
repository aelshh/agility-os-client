import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle, ChatCenteredText, Trophy, ArrowRight } from "@phosphor-icons/react";

import { apiListCourses } from "../api/courses";
import type { Course } from "../api/courses";
import { Spinner } from "../components";
import { IconBadge } from "../components/ui/IconBadge";
import { StatusBadge } from "../features/courses/StatusBadge";
import { pageVariants, stagger, fadeUp, EASE } from "../lib/animation";


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
        className="flex w-full max-w-5xl flex-col gap-6"
      >
        <motion.div variants={fadeUp} className="flex items-start gap-4">
          <IconBadge
            icon={CheckCircle}
            variant="amber"
            size="lg"
            weight="duotone"
          />
          <div>
            <h1 className="font-serif text-3xl font-medium tracking-normal text-neutral-950">
              Review queue
            </h1>
            <p className="mt-1 text-sm font-medium text-neutral-600">
              Courses submitted by your content team, waiting for your sign-off.
            </p>
          </div>
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
            <IconBadge
              icon={CheckCircle}
              variant="emerald"
              size="xl"
              weight="duotone"
              className="mx-auto mb-3"
            />
            <p className="text-base font-semibold text-neutral-900">
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
                className="group flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition-all hover:border-neutral-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-serif text-lg font-medium leading-snug text-neutral-950 group-hover:text-amber-900 transition-colors">
                      {course.title}
                    </h2>
                    <StatusBadge status={course.status} />
                  </div>
                  {course.description && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-600">
                      {course.description}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4 text-xs text-neutral-500">
                  <div className="flex flex-wrap items-center gap-3">
                    {course.faqs && course.faqs.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-neutral-600">
                        <ChatCenteredText className="h-3.5 w-3.5 text-neutral-400" weight="duotone" />
                        {course.faqs.length} question{course.faqs.length === 1 ? "" : "s"}
                      </span>
                    )}
                    {course.scoringRubric && course.scoringRubric.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-neutral-600">
                        <Trophy className="h-3.5 w-3.5 text-neutral-400" weight="duotone" />
                        {course.scoringRubric.length} rubric criteria
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 font-semibold text-neutral-900 group-hover:translate-x-0.5 transition-transform">
                    Review <ArrowRight className="h-3.5 w-3.5" weight="bold" />
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
