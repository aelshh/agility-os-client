import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  PhoneCall,
  Brain,
  ChatCenteredText,
  Eye,
  CalendarBlank,
  Funnel,
  MagnifyingGlass,
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  CaretDoubleLeft,
  CaretDoubleRight,
  X,
  CheckCircle,
  Clock,
  TrendUp,
  XCircle,
} from "@phosphor-icons/react";
import { apiGetCallLogs } from "../api/calls";
import type { CallLog, CallLogStats } from "../api/calls";
import { CourseCallDetailModal } from "../features/courses/CourseCallDetailModal";
import { IconBadge } from "../components/ui/IconBadge";
import { Button, Spinner, Dropdown } from "../components";
import { cn } from "../lib/cn";
import { pageVariants, fadeUp, stagger } from "../lib/animation";

export type DatePreset = "all" | "today" | "yesterday" | "7d" | "30d" | "month" | "custom";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDateRangeForPreset(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const todayStr = toLocalDateString(now);

  if (preset === "today") {
    return { startDate: todayStr, endDate: todayStr };
  }
  if (preset === "yesterday") {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = toLocalDateString(yest);
    return { startDate: yestStr, endDate: yestStr };
  }
  if (preset === "7d") {
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 6);
    return { startDate: toLocalDateString(d7), endDate: todayStr };
  }
  if (preset === "30d") {
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 29);
    return { startDate: toLocalDateString(d30), endDate: todayStr };
  }
  if (preset === "month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: toLocalDateString(firstDay), endDate: todayStr };
  }
  return { startDate: "", endDate: "" };
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function formatShortDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return dateStr;
  }
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10 per page" },
  { value: "25", label: "25 per page" },
  { value: "50", label: "50 per page" },
  { value: "100", label: "100 per page" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All Call Types" },
  { value: "course", label: "Course Practice" },
  { value: "checkin", label: "Daily Check-in" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "calling", label: "Calling" },
  { value: "queued", label: "Queued" },
  { value: "answered", label: "Answered" },
  { value: "no_answer", label: "No Answer" },
];

const DATE_PRESET_OPTIONS: { id: DatePreset; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "month", label: "This Month" },
  { id: "custom", label: "Custom Range" },
];

export function CallLogsPage() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<CallLogStats>({
    totalCalls: 0,
    completedCalls: 0,
    avgScore: null,
    totalDurationSecs: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);

  // Filter state
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Load calls
  const loadCalls = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const res = await apiGetCallLogs({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          type: (typeFilter as "all" | "course" | "checkin") || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: searchQuery.trim() || undefined,
          page,
          pageSize,
        });

        setCalls(res.calls || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        if (res.stats) {
          setStats(res.stats);
        }
      } catch (err) {
        console.error("Failed to load calls:", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [startDate, endDate, typeFilter, statusFilter, searchQuery, page, pageSize],
  );

  useEffect(() => {
    void loadCalls();
  }, [loadCalls]);

  // Handle Preset Change
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setPage(1);
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "custom") {
      // Keep existing custom dates or default to today
      if (!startDate && !endDate) {
        const now = toLocalDateString(new Date());
        setStartDate(now);
        setEndDate(now);
      }
    } else {
      const range = getDateRangeForPreset(preset);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  const handleCustomStartDateChange = (val: string) => {
    setDatePreset("custom");
    setStartDate(val);
    setPage(1);
  };

  const handleCustomEndDateChange = (val: string) => {
    setDatePreset("custom");
    setEndDate(val);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleTypeChange = (val: string) => {
    setTypeFilter(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setPage(1);
  };

  const handleResetFilters = () => {
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const isFiltered =
    datePreset !== "all" ||
    startDate !== "" ||
    endDate !== "" ||
    searchQuery.trim() !== "" ||
    typeFilter !== "all" ||
    statusFilter !== "all";

  // Calculate pagination range display: e.g. "Showing 1 to 25 of 142"
  const startItemIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItemIndex = total === 0 ? 0 : Math.min(page * pageSize, total);

  // Generate numbered pages array with ellipsis
  const paginationRange = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (page >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  }, [page, totalPages]);

  return (
    <motion.div
      key="call-logs"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6 bg-neutral-50 min-h-screen px-4 py-6 sm:px-6 lg:p-8 font-sans"
    >
      {/* ── Page Header ── */}
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <motion.div variants={fadeUp} className="flex items-start gap-3.5">
          <IconBadge
            icon={PhoneCall}
            variant="indigo"
            size="lg"
            weight="duotone"
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-950 font-serif">
              Call Logs & Voice Analytics
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-neutral-600 max-w-2xl leading-relaxed">
              Real-time audit log of all automated AI voice interactions across course drills and daily standup check-ins.
            </p>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-neutral-600 hover:text-neutral-900 min-h-9"
            >
              <X className="h-3.5 w-3.5 mr-1 text-neutral-400" weight="bold" />
              Reset filters
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadCalls(true)}
            disabled={isLoading || isRefreshing}
            className="text-xs min-h-9"
          >
            <ArrowClockwise
              className={cn("h-3.5 w-3.5 mr-1.5", isRefreshing && "animate-spin text-indigo-600")}
              weight="bold"
            />
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </motion.div>
      </motion.div>

      {/* ── KPI Overview Grid ── */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        {/* Total Calls */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Total Calls
            </span>
            <IconBadge icon={PhoneCall} variant="indigo" size="sm" weight="duotone" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl sm:text-3xl font-bold text-neutral-950">
              {stats.totalCalls}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {datePreset === "all" ? "All time aggregate" : "In selected date filter"}
          </p>
        </div>

        {/* Completed Calls */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Completed
            </span>
            <IconBadge icon={CheckCircle} variant="emerald" size="sm" weight="duotone" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl sm:text-3xl font-bold text-neutral-950">
              {stats.completedCalls}
            </span>
            {stats.totalCalls > 0 && (
              <span className="text-xs font-semibold text-emerald-700">
                ({Math.round((stats.completedCalls / stats.totalCalls) * 100)}%)
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {stats.totalCalls - stats.completedCalls} incomplete / failed
          </p>
        </div>

        {/* Avg Mastery Score */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Avg Mastery Score
            </span>
            <IconBadge icon={TrendUp} variant="amber" size="sm" weight="duotone" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl sm:text-3xl font-bold text-neutral-950">
              {stats.avgScore !== null ? `${stats.avgScore}%` : "—"}
            </span>
            {stats.avgScore !== null && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold",
                  stats.avgScore >= 80
                    ? "bg-emerald-50 text-emerald-700"
                    : stats.avgScore >= 60
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-50 text-red-700",
                )}
              >
                {stats.avgScore >= 80 ? "Mastered" : stats.avgScore >= 60 ? "Proficient" : "Needs Practice"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-500">Scored course practice calls</p>
        </div>

        {/* Total Airtime */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Total Airtime
            </span>
            <IconBadge icon={Clock} variant="neutral" size="sm" weight="duotone" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl sm:text-3xl font-bold text-neutral-950">
              {formatDuration(stats.totalDurationSecs)}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Cumulative AI talk duration</p>
        </div>
      </motion.div>

      {/* ── Filters & Controls Hub ── */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm space-y-4"
      >
        {/* Date Filter Preset Pills */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
            <CalendarBlank className="h-4 w-4 text-neutral-500" weight="duotone" />
            <span>Filter by Date Range</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {DATE_PRESET_OPTIONS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleDatePresetChange(preset.id)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all select-none",
                  datePreset === preset.id
                    ? "bg-neutral-900 text-white shadow-xs"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80 hover:text-neutral-900",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers (Shown when custom or date range selected) */}
        {datePreset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5">
            <div className="flex items-center gap-2">
              <label htmlFor="start-date-input" className="text-xs font-semibold text-neutral-700">
                From:
              </label>
              <input
                id="start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => handleCustomStartDateChange(e.target.value)}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 shadow-2xs outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="end-date-input" className="text-xs font-semibold text-neutral-700">
                To:
              </label>
              <input
                id="end-date-input"
                type="date"
                value={endDate}
                onChange={(e) => handleCustomEndDateChange(e.target.value)}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 shadow-2xs outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>

            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => handleDatePresetChange("all")}
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline ml-auto"
              >
                Clear date range
              </button>
            )}
          </div>
        )}

        {/* Secondary Filter Row: Search, Type, Status */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t border-neutral-100">
          {/* Search Input */}
          <div className="relative">
            <MagnifyingGlass
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
              weight="bold"
            />
            <input
              type="text"
              placeholder="Search user, phone, role, context…"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50/70 pl-9 pr-8 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 outline-none transition-all focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                <XCircle className="h-4 w-4" weight="fill" />
              </button>
            )}
          </div>

          {/* Type Dropdown */}
          <div>
            <Dropdown
              value={typeFilter}
              onChange={handleTypeChange}
              options={TYPE_OPTIONS}
              className="py-2 text-xs"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <Dropdown
              value={statusFilter}
              onChange={handleStatusChange}
              options={STATUS_OPTIONS}
              className="py-2 text-xs"
            />
          </div>

          {/* Active Filter Indicators / Reset */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span className="text-xs font-semibold text-neutral-500">
              Total matching: <strong className="text-neutral-900 font-mono">{total}</strong>
            </span>
            {isFiltered && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 text-xs px-2.5"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Filter Summary Pill Indicator */}
        {(startDate || endDate || datePreset !== "all") && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 border border-neutral-200/80 px-2.5 py-0.5 text-xs text-neutral-700">
              <CalendarBlank className="h-3.5 w-3.5 text-neutral-500" weight="bold" />
              <span>
                Date Filter:{" "}
                <strong>
                  {datePreset !== "custom" && datePreset !== "all"
                    ? DATE_PRESET_OPTIONS.find((o) => o.id === datePreset)?.label
                    : startDate && endDate
                      ? `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`
                      : startDate
                        ? `From ${formatShortDate(startDate)}`
                        : `Until ${formatShortDate(endDate)}`}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => handleDatePresetChange("all")}
                className="ml-1 text-neutral-400 hover:text-neutral-700"
                title="Remove date filter"
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            </span>
          </div>
        )}
      </motion.div>

      {/* ── Table Card ── */}
      <motion.div
        variants={fadeUp}
        className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm flex flex-col"
      >
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-neutral-500 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4 font-semibold">User</th>
                <th className="p-4 font-semibold">Context</th>
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Score</th>
                <th className="p-4 font-semibold">Duration</th>
                <th className="p-4 font-semibold">Date & Time</th>
                <th className="p-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center text-neutral-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Spinner size="md" className="text-neutral-700" />
                      <p className="text-xs font-semibold text-neutral-600">Loading call logs…</p>
                    </div>
                  </td>
                </tr>
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center text-neutral-500">
                    <IconBadge
                      icon={isFiltered ? Funnel : PhoneCall}
                      variant="indigo"
                      size="xl"
                      weight="duotone"
                      className="mx-auto mb-3"
                    />
                    <p className="font-semibold text-neutral-900 text-base">
                      {isFiltered ? "No calls match your filter criteria" : "No calls recorded yet"}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                      {isFiltered
                        ? "Try expanding your date range, resetting filters, or clearing the search query."
                        : "Practice calls and scheduled voice check-ins will automatically appear here once initiated."}
                    </p>
                    {isFiltered && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        className="mt-4 text-xs"
                      >
                        Reset all filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-neutral-50/80 transition-colors cursor-pointer group"
                    onClick={() => setSelectedCall(call)}
                  >
                    {/* User */}
                    <td className="p-4">
                      <div className="font-semibold text-neutral-900 group-hover:text-indigo-900 transition-colors">
                        {call.userName || "Unknown Practitioner"}
                      </div>
                      <div className="text-xs text-neutral-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                        {call.userEmail && <span>{call.userEmail}</span>}
                        {call.userPhone && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-neutral-600">{call.userPhone}</span>
                          </>
                        )}
                        {call.userRole && (
                          <>
                            <span>·</span>
                            <span className="capitalize">{call.userRole.replace("_", " ")}</span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Context / Title */}
                    <td className="p-4">
                      <div className="font-medium text-neutral-900 max-w-[220px] truncate" title={call.title || "Untitled"}>
                        {call.title || "Untitled"}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="p-4">
                      {call.type === "course" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
                          <Brain className="h-3.5 w-3.5" weight="duotone" />
                          Course
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200/60">
                          <ChatCenteredText className="h-3.5 w-3.5" weight="duotone" />
                          Check-in
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wider",
                          call.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : call.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : call.status === "calling" || call.status === "queued"
                                ? "bg-amber-100 text-amber-800 animate-pulse"
                                : "bg-neutral-100 text-neutral-700",
                        )}
                      >
                        {call.status.replace("_", " ")}
                      </span>
                    </td>

                    {/* Score */}
                    <td className="p-4">
                      {call.score !== null && call.score !== undefined ? (
                        <span
                          className={cn(
                            "font-mono font-bold text-sm",
                            call.score >= 80
                              ? "text-emerald-600"
                              : call.score >= 60
                                ? "text-amber-600"
                                : "text-red-600",
                          )}
                        >
                          {call.score}%
                        </span>
                      ) : (
                        <span className="text-neutral-400 font-mono text-xs">—</span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="p-4 text-neutral-600 font-mono text-xs">
                      {formatDuration(call.durationSecs)}
                    </td>

                    {/* Date */}
                    <td className="p-4 text-neutral-500 text-xs whitespace-nowrap">
                      {formatDate(call.calledAt || call.completedAt)}
                    </td>

                    {/* Details Action */}
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCall(call);
                        }}
                        className="h-8 px-2.5 text-xs font-semibold group-hover:bg-neutral-200/70"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" weight="duotone" />
                        Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Footer Bar ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-neutral-200 bg-neutral-50/70 p-4 sm:px-6">
          {/* Left: Row counts & page size */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
            <span>
              Showing <strong className="font-semibold text-neutral-900">{startItemIndex}</strong> to{" "}
              <strong className="font-semibold text-neutral-900">{endItemIndex}</strong> of{" "}
              <strong className="font-semibold text-neutral-900">{total}</strong> call logs
            </span>

            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400">·</span>
              <label htmlFor="page-size-select" className="sr-only">
                Page size
              </label>
              <select
                id="page-size-select"
                value={String(pageSize)}
                onChange={(e) => handlePageSizeChange(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800 shadow-2xs outline-none focus:border-neutral-900"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Page Navigation Buttons */}
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(1)}
              title="First page"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-all",
                page <= 1 || isLoading
                  ? "border-neutral-200 text-neutral-300 cursor-not-allowed bg-neutral-50"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 hover:border-neutral-300 active:scale-95 shadow-2xs",
              )}
            >
              <CaretDoubleLeft className="h-3.5 w-3.5" weight="bold" />
            </button>

            {/* Prev Page */}
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title="Previous page"
              className={cn(
                "flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-all",
                page <= 1 || isLoading
                  ? "border-neutral-200 text-neutral-300 cursor-not-allowed bg-neutral-50"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 hover:border-neutral-300 active:scale-95 shadow-2xs",
              )}
            >
              <CaretLeft className="h-3.5 w-3.5" weight="bold" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Numbered Page Buttons */}
            <div className="flex items-center gap-1 mx-1">
              {paginationRange.map((item, idx) => {
                if (typeof item === "string") {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1.5 py-1 text-xs text-neutral-400 font-semibold"
                    >
                      …
                    </span>
                  );
                }
                const isCurrent = item === page;
                return (
                  <button
                    key={`page-${item}`}
                    type="button"
                    disabled={isLoading}
                    onClick={() => setPage(item)}
                    className={cn(
                      "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-all",
                      isCurrent
                        ? "bg-neutral-900 text-white shadow-xs"
                        : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 hover:border-neutral-300 shadow-2xs",
                    )}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              title="Next page"
              className={cn(
                "flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-all",
                page >= totalPages || isLoading
                  ? "border-neutral-200 text-neutral-300 cursor-not-allowed bg-neutral-50"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 hover:border-neutral-300 active:scale-95 shadow-2xs",
              )}
            >
              <span className="hidden sm:inline">Next</span>
              <CaretRight className="h-3.5 w-3.5" weight="bold" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(totalPages)}
              title="Last page"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-all",
                page >= totalPages || isLoading
                  ? "border-neutral-200 text-neutral-300 cursor-not-allowed bg-neutral-50"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 hover:border-neutral-300 active:scale-95 shadow-2xs",
              )}
            >
              <CaretDoubleRight className="h-3.5 w-3.5" weight="bold" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Call Detail & Scorecard Modal ── */}
      {selectedCall && (
        <CourseCallDetailModal
          enrollment={selectedCall}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </motion.div>
  );
}
