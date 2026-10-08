import { useState, useEffect, useMemo } from "react";
import { Button } from "../components/Button";
import { Spinner } from "../components/ui/Spinner";
import { IconBadge } from "../components/ui/IconBadge";
import { CreateScheduleModal } from "../features/schedule/CreateScheduleModal";
import { ScheduleDetailModal } from "../features/schedule/ScheduleDetailModal";
import { CheckinScheduleDetailModal } from "../features/schedule/CheckinScheduleDetailModal";
import type { CalendarEventItem, CourseSchedule } from "../api/schedules";
import { apiGetCalendarEvents, apiListCourseSchedules } from "../api/schedules";
import type { Course } from "../api/courses";
import { apiListCourses } from "../api/courses";
import {
  CalendarCheck,
  CalendarPlus,
  CaretLeft,
  CaretRight,
  WhatsappLogo,
  } from "@phosphor-icons/react";

type CalendarView = "month" | "week" | "day" | "agenda";
type EventTypeFilter = "all" | "courses" | "checkins";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatTimeDisplay(timeStr: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
  if (!match) return timeStr;
  let h = Number.parseInt(match[1] ?? "0", 10);
  const m = match[2] ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function formatDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CourseCalendarPage() {
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("");
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>("all");
  const [loading, setLoading] = useState(true);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState<string | undefined>(undefined);
  const [scheduleToEdit, setScheduleToEdit] = useState<CourseSchedule | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [selectedCheckinEvent, setSelectedCheckinEvent] = useState<CalendarEventItem | null>(null);
  const [checkinDetailOpen, setCheckinDetailOpen] = useState(false);

  // Calculate visible range for events fetching
  const { rangeStart, rangeEnd } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();

    // Start from first day of month minus padding days
    const firstDay = new Date(y, m, 1);
    const startPadding = firstDay.getDay();
    const start = new Date(y, m, 1 - startPadding);

    // End at last day of month plus padding days
    const lastDay = new Date(y, m + 1, 0);
    const endPadding = 6 - lastDay.getDay();
    const end = new Date(y, m + 1, endPadding);

    return {
      rangeStart: formatDateString(start),
      rangeEnd: formatDateString(end),
    };
  }, [currentDate]);

  const loadCalendarData = async (silent = false) => {
    if (!silent && events.length === 0) {
      setLoading(true);
    }
    try {
      const [eventsList, schedulesList, coursesList] = await Promise.all([
        apiGetCalendarEvents(rangeStart, rangeEnd, selectedCourseFilter || undefined),
        apiListCourseSchedules(selectedCourseFilter ? { courseId: selectedCourseFilter } : undefined),
        apiListCourses(),
      ]);
      setEvents(eventsList);
      setSchedules(schedulesList);
      setCourses(coursesList);
    } catch (err) {
      console.error("Failed to load calendar data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCalendarData(events.length > 0);
  }, [rangeStart, rangeEnd, selectedCourseFilter]);

  // Navigation handlers
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (view === "month") {
      next.setMonth(next.getMonth() - 1);
    } else if (view === "week") {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (view === "month") {
      next.setMonth(next.getMonth() + 1);
    } else if (view === "week") {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleEventClick = (ev: CalendarEventItem) => {
    if (ev.eventType === "checkin") {
      setSelectedCheckinEvent(ev);
      setCheckinDetailOpen(true);
    } else {
      setSelectedScheduleId(ev.scheduleId);
      setDetailModalOpen(true);
    }
  };

  const handleScheduleCreatedOrUpdated = (_updated: CourseSchedule) => {
    void loadCalendarData(true);
  };

  const handleScheduleDeleted = (deletedId: string) => {
    setEvents((prev) => prev.filter((e) => e.scheduleId !== deletedId));
    setSchedules((prev) => prev.filter((s) => s.id !== deletedId));
  };

  const handleCellClick = (dateStr: string) => {
    setScheduleToEdit(null);
    setCreateInitialDate(dateStr);
    setCreateModalOpen(true);
  };

  const courseEventsCount = useMemo(
    () => events.filter((e) => (e.eventType ?? "course") === "course").length,
    [events],
  );
  const checkinEventsCount = useMemo(
    () => events.filter((e) => e.eventType === "checkin").length,
    [events],
  );

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const isCheckin = ev.eventType === "checkin";
      if (eventTypeFilter === "courses" && isCheckin) return false;
      if (eventTypeFilter === "checkins" && !isCheckin) return false;
      return true;
    });
  }, [events, eventTypeFilter]);

  // Group filtered events by date string "YYYY-MM-DD"
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const ev of filteredEvents) {
      const existing = map.get(ev.date) ?? [];
      existing.push(ev);
      map.set(ev.date, existing);
    }
    return map;
  }, [filteredEvents]);

  const todayStr = formatDateString(new Date());

  // Month grid generation
  const monthDays = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const firstDayOfMonth = new Date(y, m, 1);
    const startPad = firstDayOfMonth.getDay();

    const days: Array<{
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Total 35 or 42 cells (5 or 6 weeks)
    const startDate = new Date(y, m, 1 - startPad);
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      const dateStr = formatDateString(d);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: d.getMonth() === m,
        isToday: dateStr === todayStr,
      });
      // Stop at 35 if we already completed the month and filled the week
      if (i >= 34 && d.getMonth() !== m && d.getDay() === 6) {
        break;
      }
    }
    return days;
  }, [currentDate, todayStr]);

  // Week view days
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const sunday = new Date(d.setDate(d.getDate() - day));
    const list: Array<{ date: Date; dateStr: string; isToday: boolean }> = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
      const str = formatDateString(cur);
      list.push({ date: cur, dateStr: str, isToday: str === todayStr });
    }
    return list;
  }, [currentDate, todayStr]);

  const headerTitle = useMemo(() => {
    const m = MONTH_NAMES[currentDate.getMonth()];
    const y = currentDate.getFullYear();
    if (view === "month") {
      return `${m} ${y}`;
    }
    if (view === "week") {
      const first = weekDays[0]?.date;
      const last = weekDays[6]?.date;
      if (first && last) {
        return `${first.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
      }
    }
    if (view === "day") {
      return currentDate.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    return `${m} ${y} Agenda`;
  }, [currentDate, view, weekDays]);

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 px-4 py-6 sm:px-6 lg:p-8">
      {/* ── Top Bar / Header ── */}
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <IconBadge icon={CalendarCheck} variant="blue" size="md" />
            <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-neutral-950">
              Schedule & Calendar
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500">
            Unified view of course training windows, advance WhatsApp notifications, and team daily check-in calls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => {
              setScheduleToEdit(null);
              setCreateInitialDate(todayStr);
              setCreateModalOpen(true);
            }}
            icon={<CalendarPlus size={16} weight="bold" />}
            className="shadow-sm"
          >
            Schedule Course
          </Button>
        </div>
      </div>

      {/* ── Controls Toolbar: Navigation, Filters & View Selectors ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-sm mb-6">
        {/* Date Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-neutral-200 bg-neutral-50/60 p-0.5">
            <button
              type="button"
              onClick={handlePrev}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-white hover:text-neutral-900 transition-colors"
              aria-label="Previous"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:text-neutral-950"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-white hover:text-neutral-900 transition-colors"
              aria-label="Next"
            >
              <CaretRight size={16} weight="bold" />
            </button>
          </div>

          <span className="font-serif text-base sm:text-lg font-medium text-neutral-900 ml-1">
            {headerTitle}
          </span>
        </div>

        {/* Activity Type Filters + Course Filter + View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Activity Category Filter Pills */}
          <div className="flex items-center rounded-xl border border-neutral-200 bg-neutral-100/80 p-0.5">
            <button
              type="button"
              onClick={() => setEventTypeFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                eventTypeFilter === "all"
                  ? "bg-white text-neutral-950 shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              All ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setEventTypeFilter("courses")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                eventTypeFilter === "courses"
                  ? "bg-white text-emerald-950 shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Courses ({courseEventsCount})
            </button>
            <button
              type="button"
              onClick={() => setEventTypeFilter("checkins")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                eventTypeFilter === "checkins"
                  ? "bg-white text-purple-950 shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              Check-ins ({checkinEventsCount})
            </button>
          </div>

          {/* Course Filter Dropdown */}
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="rounded-xl border border-neutral-200 bg-neutral-50/70 px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-xs focus:border-neutral-900 focus:outline-none"
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          {/* View Mode Pills */}
          <div className="flex items-center rounded-xl border border-neutral-200 bg-neutral-100/70 p-0.5">
            {(["month", "week", "day", "agenda"] as CalendarView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-all ${
                  view === v
                    ? "bg-white text-neutral-950 shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Calendar Body ── */}
      {loading ? (
        <div className="flex h-96 items-center justify-center rounded-2xl border border-neutral-200 bg-white">
          <div className="flex flex-col items-center gap-2">
            <Spinner size="md" />
            <span className="text-xs font-medium text-neutral-500">Loading schedule calendar...</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden flex flex-col">
          {/* ════ MONTH VIEW ════ */}
          {view === "month" && (
            <div className="flex-1 flex flex-col">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50/80 text-center text-xs font-semibold text-neutral-600 py-2.5">
                {WEEKDAYS.map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              {/* Grid cells */}
              <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-neutral-200/80 bg-neutral-100/30">
                {monthDays.map(({ date, dateStr, isCurrentMonth, isToday }) => {
                  const dayEvents = eventsByDate.get(dateStr) ?? [];
                  return (
                    <div
                      key={dateStr}
                      onClick={() => handleCellClick(dateStr)}
                      className={`group relative min-h-24 sm:min-h-28 p-1.5 sm:p-2 transition-colors flex flex-col ${
                        isCurrentMonth ? "bg-white" : "bg-neutral-50/60 text-neutral-400"
                      } hover:bg-neutral-50 cursor-pointer`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                            isToday
                              ? "bg-neutral-950 text-white"
                              : isCurrentMonth
                              ? "text-neutral-800"
                              : "text-neutral-400"
                          }`}
                        >
                          {date.getDate()}
                        </span>

                        {isToday && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 hidden sm:inline">
                            Today
                          </span>
                        )}
                      </div>

                      {/* Event Chips */}
                      <div className="flex-1 space-y-1 overflow-y-auto max-h-20 sm:max-h-24">
                        {dayEvents.map((ev) => {
                          const isCheckin = ev.eventType === "checkin";
                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(ev);
                              }}
                              className={`group/chip flex items-center justify-between gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-all shadow-xs ${
                                ev.status === "paused"
                                  ? "border-amber-200 bg-amber-50/80 text-amber-900"
                                  : ev.status === "completed"
                                  ? "border-neutral-200 bg-neutral-100 text-neutral-700"
                                  : isCheckin
                                  ? "border-purple-200 bg-purple-50/90 text-purple-950 hover:bg-purple-100"
                                  : "border-emerald-200 bg-emerald-50/90 text-emerald-950 hover:bg-emerald-100"
                              }`}
                              title={`${isCheckin ? "[Daily Check-in] " : ""}${ev.title} (${ev.courseTitle ?? (ev.ownerName ? `Team: ${ev.ownerName}` : "Check-in")}) ${ev.startTime} - ${ev.endTime}`}
                            >
                              <span className="truncate flex items-center gap-1">
                                {isCheckin ? (
                                  <span className="h-1.5 w-1.5 rounded-full bg-purple-600 shrink-0" />
                                ) : (
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                                )}
                                {formatTimeDisplay(ev.startTime)} {ev.title}
                              </span>
                              {ev.notifyWhatsappPrior && (
                                <WhatsappLogo
                                  size={14}
                                  weight="duotone"
                                  className="text-emerald-600 shrink-0"
                                  aria-label="WhatsApp reminder enabled"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════ WEEK VIEW ════ */}
          {view === "week" && (
            <div className="flex-1 flex flex-col overflow-x-auto">
              <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50/80 divide-x divide-neutral-200 min-w-[640px]">
                {weekDays.map(({ date, dateStr, isToday }) => (
                  <div
                    key={dateStr}
                    className={`py-3 px-2 text-center ${
                      isToday ? "bg-emerald-50/40" : ""
                    }`}
                  >
                    <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                      {WEEKDAYS[date.getDay()]}
                    </p>
                    <p
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold mt-0.5 ${
                        isToday ? "bg-neutral-950 text-white" : "text-neutral-900"
                      }`}
                    >
                      {date.getDate()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 flex-1 divide-x divide-neutral-200 bg-white min-w-[640px] min-h-[420px]">
                {weekDays.map(({ dateStr }) => {
                  const dayEvents = eventsByDate.get(dateStr) ?? [];
                  return (
                    <div
                      key={dateStr}
                      onClick={() => handleCellClick(dateStr)}
                      className="p-2 space-y-2 hover:bg-neutral-50/40 cursor-pointer flex flex-col"
                    >
                      {dayEvents.map((ev) => {
                        const isCheckin = ev.eventType === "checkin";
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(ev);
                            }}
                            className={`rounded-xl border p-2 text-xs shadow-xs transition-all cursor-pointer ${
                              isCheckin
                                ? "border-purple-200 bg-purple-50/60 text-purple-950 hover:border-purple-300"
                                : "border-emerald-200 bg-emerald-50/60 text-emerald-950 hover:border-emerald-300"
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold mb-0.5">
                              <span
                                className={`text-[10px] ${
                                  isCheckin ? "text-purple-800" : "text-emerald-800"
                                }`}
                              >
                                {formatTimeDisplay(ev.startTime)} - {formatTimeDisplay(ev.endTime)}
                              </span>
                              {isCheckin ? (
                                <span className="rounded bg-purple-200/80 px-1 py-0.2 text-[9px] font-bold text-purple-900 uppercase">
                                  Check-in
                                </span>
                              ) : ev.notifyWhatsappPrior ? (
                                <span className="text-[10px] text-emerald-700 flex items-center gap-0.5">
                                  <WhatsappLogo size={13} weight="duotone" className="text-emerald-600" />
                                  WA
                                </span>
                              ) : null}
                            </div>
                            <p className="font-bold text-neutral-900 truncate">{ev.title}</p>
                            <p className="text-[11px] text-neutral-600 truncate">
                              {isCheckin
                                ? ev.ownerName
                                  ? `Owner: ${ev.ownerName}`
                                  : "Team Call"
                                : ev.courseTitle}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════ DAY VIEW ════ */}
          {view === "day" && (
            <div className="p-4 sm:p-6 space-y-4 max-w-2xl mx-auto w-full">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <span className="font-semibold text-sm text-neutral-900">
                  Scheduled for {currentDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<CalendarPlus size={14} weight="bold" />}
                  onClick={() => handleCellClick(formatDateString(currentDate))}
                >
                  Add Schedule
                </Button>
              </div>

              {((eventsByDate.get(formatDateString(currentDate)) ?? []).length === 0) ? (
                <div className="py-16 text-center text-xs text-neutral-500">
                  No practice sessions or check-in calls scheduled for this day.
                </div>
              ) : (
                <div className="space-y-3">
                  {(eventsByDate.get(formatDateString(currentDate)) ?? []).map((ev) => {
                    const isCheckin = ev.eventType === "checkin";
                    return (
                      <div
                        key={ev.id}
                        onClick={() => handleEventClick(ev)}
                        className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-neutral-300 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                isCheckin
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {formatTimeDisplay(ev.startTime)} – {formatTimeDisplay(ev.endTime)} ({ev.timezone})
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                isCheckin
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {isCheckin ? "Daily Check-in" : "Course Drill"}
                            </span>
                          </div>
                          <h3 className="font-bold text-neutral-950 text-sm">{ev.title}</h3>
                          <p className="text-xs text-neutral-600 mt-0.5">
                            {isCheckin
                              ? `Team check-in calls managed by ${ev.ownerName ?? "Manager"}`
                              : `Course: ${ev.courseTitle}`}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {ev.notifyWhatsappPrior && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                              <WhatsappLogo size={14} weight="duotone" className="text-emerald-600" />
                              WhatsApp: {ev.notifyMinutesBefore}m prior
                            </span>
                          )}
                          <Button size="sm" variant="outline">
                            Manage
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════ AGENDA / LIST VIEW ════ */}
          {view === "agenda" && (
            <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                  <h2 className="font-serif text-lg font-medium text-neutral-950">
                    All Configured Schedules ({schedules.length})
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Recurring patterns, practice windows, and automated check-ins
                  </p>
                </div>
                <Button
                  size="sm"
                  icon={<CalendarPlus size={14} weight="bold" />}
                  onClick={() => {
                    setScheduleToEdit(null);
                    setCreateInitialDate(todayStr);
                    setCreateModalOpen(true);
                  }}
                >
                  New Schedule
                </Button>
              </div>

              {schedules.length === 0 ? (
                <div className="py-16 text-center text-xs text-neutral-500">
                  No schedules created yet. Click "+ New Schedule" to create your first course calling schedule.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {schedules.map((sch) => (
                    <div
                      key={sch.id}
                      onClick={() => {
                        setSelectedScheduleId(sch.id);
                        setDetailModalOpen(true);
                      }}
                      className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-xs hover:border-neutral-300 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-neutral-950 text-sm">{sch.title}</span>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold capitalize ${
                              sch.status === "active"
                                ? "bg-emerald-100 text-emerald-800"
                                : sch.status === "paused"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-neutral-100 text-neutral-700"
                            }`}
                          >
                            {sch.status}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600">
                          Course: <span className="font-semibold text-neutral-800">{sch.course?.title ?? sch.courseId}</span>
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          Hours: {formatTimeDisplay(sch.timeWindowStart)} – {formatTimeDisplay(sch.timeWindowEnd)} ({sch.timezone})
                          {sch.scheduleType === "recurring"
                            ? ` • Days: ${sch.daysOfWeek.map((d) => WEEKDAYS[d]).join(", ")}`
                            : ` • Date: ${sch.startDate}`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {sch.notifyWhatsappPrior && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                            <WhatsappLogo size={13} weight="duotone" className="text-emerald-600" />
                            {sch.notifyMinutesBefore}m prior
                          </span>
                        )}
                        <Button size="sm" variant="outline">
                          View & Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      <CreateScheduleModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleScheduleCreatedOrUpdated}
        initialDate={createInitialDate}
        scheduleToEdit={scheduleToEdit}
      />

      <ScheduleDetailModal
        open={detailModalOpen}
        scheduleId={selectedScheduleId}
        onClose={() => setDetailModalOpen(false)}
        onEdit={(sch) => {
          setScheduleToEdit(sch);
          setCreateModalOpen(true);
        }}
        onDeleted={handleScheduleDeleted}
        onUpdated={handleScheduleCreatedOrUpdated}
      />

      <CheckinScheduleDetailModal
        open={checkinDetailOpen}
        event={selectedCheckinEvent}
        onClose={() => setCheckinDetailOpen(false)}
        onUpdated={() => void loadCalendarData(true)}
        onDeleted={() => {
          if (selectedCheckinEvent) {
            setEvents((prev) => prev.filter((e) => e.id !== selectedCheckinEvent.id));
          }
        }}
      />
    </div>
  );
}
