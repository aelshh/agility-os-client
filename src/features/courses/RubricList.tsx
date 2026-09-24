import type { RubricCriterion } from "../../api/courses";

export function RubricList({ rubric }: { rubric: RubricCriterion[] }) {
  if (!rubric.length) {
    return <p className="text-sm text-neutral-500">No scoring criteria set.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {rubric.map((criteria, i) => (
        <li
          key={i}
          className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2"
        >
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {criteria.name}
            </p>
            {criteria.description && (
              <p className="text-xs text-neutral-500">{criteria.description}</p>
            )}
          </div>
          <span className="shrink-0 rounded-lg bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">
            {criteria.weight}%
          </span>
        </li>
      ))}
    </ul>
  );
}