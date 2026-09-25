import { useEffect, useMemo, useState } from "react";

import { apiGetOrgTree } from "../../api/hrms";
import { Button, Spinner } from "../../components";
import { cn } from "../../lib/cn";

/**
 * Practitioner picker for a course's call audience ("Audience" tab).
 *
 * Only practitioners that can actually receive a practice call are listed:
 * the employee has a provisioned app account (`userId`), an active status, and
 * a dialable phone number. Everyone else is quietly excluded.
 */

type CallableEntry = {
  userId: string;
  name: string;
  phone: string;
  designation: string | null;
  department: string | null;
};

type AudiencePickerProps = {
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export function AudiencePicker({
  selected,
  onChange,
  disabled,
}: AudiencePickerProps) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CallableEntry[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGetOrgTree()
      .then((tree) => {
        if (cancelled) return;
        const seenExternalIds = new Set<string>();
        setEntries(
          tree.employees.flatMap((employee) => {
            const callable =
              employee.userId &&
              employee.role === "practitioner" &&
              employee.userStatus === "active" &&
              employee.phone &&
              employee.phone.trim().length > 0;
            if (
              !callable ||
              !employee.userId ||
              !employee.phone ||
              !employee.externalHrmsId
            )
              return [];
            if (seenExternalIds.has(employee.externalHrmsId)) return [];
            seenExternalIds.add(employee.externalHrmsId);
            return [
              {
                userId: employee.userId,
                name: employee.name || "Unnamed",
                phone: employee.phone,
                designation: employee.designation,
                department: employee.department,
              },
            ];
          }),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          (err as { message?: string })?.message ??
            "Couldn't load your team directory. Check it's uploaded on the Team page.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.designation ?? "").toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q) ||
        e.phone.includes(q),
    );
  }, [entries, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (userId: string) => {
    if (disabled) return;
    const next = new Set(selectedSet);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    onChange(Array.from(next).sort());
  };

  const selectAllVisible = () => {
    if (disabled) return;
    const next = new Set(selectedSet);
    for (const e of visible) next.add(e.userId);
    onChange(Array.from(next).sort());
  };

  const clearVisible = () => {
    if (disabled) return;
    const next = new Set(selectedSet);
    for (const e of visible) next.delete(e.userId);
    onChange(Array.from(next).sort());
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-6">
        <Spinner size="sm" className="text-neutral-500" />
        <p className="text-sm text-neutral-600">Loading your team…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-relaxed text-amber-800">
        {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-8 text-center">
        <p className="text-sm font-medium text-neutral-700">No callable practitioners yet</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-neutral-500">
          Practitioners appear here once they have an active account and a phone
          number (from the team directory upload). Calls are dialed for this
          course only when at least one practitioner is selected.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, role, department or phone…"
          disabled={disabled}
          className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-500 outline-none transition-all focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
        />
        {visible.length > 0 && (
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={selectAllVisible} disabled={disabled}>
              Select all
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearVisible} disabled={disabled}>
              Clear
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-500">
        {selected.length} selected of {entries.length} callable practitioners.
      </p>

      <ul
        className={cn(
          "max-h-80 divide-y divide-neutral-100 overflow-y-auto rounded-xl border border-neutral-200 bg-white",
          "overscroll-contain",
        )}
      >
        {visible.map((entry) => {
          const checked = selectedSet.has(entry.userId);
          return (
            <li key={entry.userId}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2.5",
                  disabled && "cursor-not-allowed opacity-60",
                  "select-none transition-colors hover:bg-neutral-50",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(entry.userId)}
                  disabled={disabled}
                  className="h-4 w-4 shrink-0 rounded border-neutral-300 accent-neutral-900"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-900">
                    {entry.name}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    {[entry.designation, entry.department]
                      .filter(Boolean)
                      .join(" · ") || "Practitioner"}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-neutral-600">
                  {entry.phone}
                </span>
              </label>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-neutral-500">
            No practitioners match “{query}”.
          </li>
        )}
      </ul>

      {selected.length === 0 && (
        <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-5 text-center text-sm text-neutral-500">
          No one selected yet — when this course is approved, practice calls are
          dialed for the practitioners you pick here.
        </p>
      )}
    </div>
  );
}