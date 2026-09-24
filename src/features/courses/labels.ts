import type { CourseStatus } from "../../api/courses";

export const STATUS_LABELS: Record<CourseStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  rejected: "Rejected",
};

export const STATUS_BADGE: Record<CourseStatus, string> = {
  draft: "bg-neutral-100 text-neutral-700 border-neutral-200",
  pending_review: "bg-amber-50 text-amber-700 border-amber-200",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};