import type { CourseStatus } from "../../api/courses";
import { cn } from "../../lib/cn";
import { STATUS_BADGE, STATUS_LABELS } from "./labels";

export function StatusBadge({ status }: { status: CourseStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STATUS_BADGE[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}