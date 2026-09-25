import type { Course, ProvisioningStatus } from "../../api/courses";
import { Button, Spinner } from "../../components";
import { cn } from "../../lib/cn";

/**
 * Rollup of practice-call delivery for a course: how many practitioners were
 * selected, called, completed, and the average score. Also surfaces the
 * Telenow provisioning state — including a retry when it failed.
 */

type DeliverySummaryProps = {
  course: Pick<
    Course,
    | "status"
    | "provisioningStatus"
    | "provisioningError"
    | "delivery"
    | "audienceIds"
    | "telenowAgentId"
  >;
  /** When set, renders a retry affordance for failed provisioning. */
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
};

const PROVISIONING: Record<
  ProvisioningStatus,
  { tone: string; label: string }
> = {
  none: { tone: "neutral", label: "Not scheduled" },
  provisioning: { tone: "blue", label: "Setting up" },
  completed: { tone: "green", label: "Live" },
  failed: { tone: "red", label: "Setup failed" },
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="truncate text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-neutral-950">
        {value}
      </dd>
    </div>
  );
}

export function DeliverySummary({
  course,
  onRetry,
  retrying,
  className,
}: DeliverySummaryProps) {
  const status = course.provisioningStatus;
  const tone = PROVISIONING[status].tone;
  const delivery = course.delivery;
  const selected = Math.max(delivery.selected, course.audienceIds.length);

  const notPublished = course.status !== "published";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700",
            tone === "red" && "border-red-200 bg-red-50 text-red-700",
            tone === "blue" && "border-sky-200 bg-sky-50 text-sky-700",
            tone === "neutral" && "border-neutral-200 bg-neutral-100 text-neutral-600",
          )}
        >
          {status === "provisioning" && <Spinner size="sm" className="text-sky-700" />}
          {PROVISIONING[status].label}
        </span>
        <span className="text-xs text-neutral-500">
          {course.telenowAgentId ? "Agent deployed" : "No agent yet"}
        </span>
      </div>

      {status === "failed" && course.provisioningError && (
        <p className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs leading-relaxed text-red-700">
          {course.status !== "published"
            ? "This course couldn't be set up."
            : "Calls couldn't be scheduled."}{" "}
          {course.provisioningError}
        </p>
      )}

      {onRetry && status === "failed" && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            loading={retrying}
            onClick={onRetry}
          >
            {retrying ? "Retrying…" : "Retry setup"}
          </Button>
        </div>
      )}

      {notPublished && status !== "failed" ? (
        <p className="text-xs leading-relaxed text-neutral-500">
          {selected === 0
            ? "No practitioners selected yet. Calls start after approval."
            : `${selected} practitioner${selected === 1 ? "" : "s"} selected — calls will start after approval.`}
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-3 border-t border-neutral-200 pt-3 sm:grid-cols-4">
          <Stat label="Selected" value={String(selected)} />
          <Stat label="Called" value={String(delivery.called)} />
          <Stat label="Completed" value={String(delivery.completed)} />
          <Stat
            label="Avg score"
            value={delivery.avgScore === null ? "—" : `${delivery.avgScore}%`}
          />
        </dl>
      )}
    </div>
  );
}