import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  apiAssignNumberToCourse,
  apiCheckNumberConnections,
  apiGetNumbers,
  apiUnassignNumber,
  type ConnectionStatus,
  type WorkspacePhoneNumber,
} from "../../api/telephony";
import { apiListCourses, type Course } from "../../api/courses";
import { Button, Modal, Spinner } from "../../components";
import { cn } from "../../lib/cn";

interface PhoneNumbersTableProps {
  onAssignChange?: () => void;
  readOnly?: boolean;
}

export function PhoneNumbersTable({
  onAssignChange,
  readOnly = false,
}: PhoneNumbersTableProps) {
  const [numbers, setNumbers] = useState<WorkspacePhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "assigned" | "available">("all");

  // Connection check state
  const [checkingConnections, setCheckingConnections] = useState(false);
  const [connections, setConnections] = useState<Record<string, boolean | null>>({});

  // Assign modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetNumber, setTargetNumber] = useState<WorkspacePhoneNumber | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // Unassign modal state
  const [unassignModalOpen, setUnassignModalOpen] = useState(false);
  const [numberToUnassign, setNumberToUnassign] = useState<WorkspacePhoneNumber | null>(null);
  const [unassigning, setUnassigning] = useState(false);

  const fetchNumbers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGetNumbers();
      setNumbers(res.numbers);
    } catch (err) {
      setError(
        (err as { message?: string })?.message ??
          "Failed to load phone numbers. Check your Voice AI connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNumbers();
  }, []);

  const handleCheckConnections = async () => {
    try {
      setCheckingConnections(true);
      const res = await apiCheckNumberConnections();
      const statusMap: Record<string, boolean | null> = {};
      res.connections.forEach((conn: ConnectionStatus) => {
        statusMap[conn.id] = conn.matches;
      });
      setConnections(statusMap);
      toast.success("Carrier connections verified.");
    } catch (err) {
      toast.error(
        (err as { message?: string })?.message ??
          "Failed to verify carrier connection status.",
      );
    } finally {
      setCheckingConnections(false);
    }
  };

  const openAssignModal = async (number: WorkspacePhoneNumber) => {
    setTargetNumber(number);
    setSelectedCourseId(number.assignedCourse?.id ?? "");
    setAssignModalOpen(true);
    try {
      setCoursesLoading(true);
      const list = await apiListCourses();
      setCourses(list);
      if (!number.assignedCourse && list.length > 0) {
        setSelectedCourseId(list[0].id);
      }
    } catch {
      toast.error("Failed to load courses.");
    } finally {
      setCoursesLoading(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetNumber || !selectedCourseId) return;

    try {
      setAssigning(true);
      const res = await apiAssignNumberToCourse(targetNumber.id, selectedCourseId);
      toast.success(res.message || "Phone number assigned to course coach.");
      setAssignModalOpen(false);
      await fetchNumbers();
      onAssignChange?.();
    } catch (err) {
      toast.error(
        (err as { message?: string })?.message ??
          "Failed to assign phone number to course.",
      );
    } finally {
      setAssigning(false);
    }
  };

  const openUnassignModal = (number: WorkspacePhoneNumber) => {
    setNumberToUnassign(number);
    setUnassignModalOpen(true);
  };

  const handleUnassignSubmit = async () => {
    if (!numberToUnassign) return;
    try {
      setUnassigning(true);
      await apiUnassignNumber(numberToUnassign.id);
      toast.success("Course unassigned from phone line.");
      setUnassignModalOpen(false);
      await fetchNumbers();
      onAssignChange?.();
    } catch (err) {
      toast.error(
        (err as { message?: string })?.message ??
          "Failed to unassign phone number.",
      );
    } finally {
      setUnassigning(false);
    }
  };

  const filteredNumbers = useMemo(() => {
    return numbers.filter((n) => {
      const isAssigned = Boolean(n.assignedCourse || n.agentId);
      const isAvailable =
        !n.assignedCourse && !n.agentId && !n.allocatedToMemberId;

      if (statusFilter === "assigned" && !isAssigned) return false;
      if (statusFilter === "available" && !isAvailable) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNum = n.e164.toLowerCase().includes(q);
        const matchRegion = n.region?.toLowerCase().includes(q) ?? false;
        const matchCountry = n.country.toLowerCase().includes(q);
        const matchCourse =
          n.assignedCourse?.title.toLowerCase().includes(q) ?? false;
        const matchAgent = n.agentName?.toLowerCase().includes(q) ?? false;
        if (!matchNum && !matchRegion && !matchCountry && !matchCourse && !matchAgent) {
          return false;
        }
      }
      return true;
    });
  }, [numbers, statusFilter, search]);

  const assignedCount = numbers.filter((n) => Boolean(n.assignedCourse)).length;
  const availableCount = numbers.filter(
    (n) => !n.assignedCourse && !n.agentId && !n.allocatedToMemberId,
  ).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Metric summary banner */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Lines</p>
            <p className="text-xl font-semibold text-neutral-950">{numbers.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Assigned to Courses</p>
            <p className="text-xl font-semibold text-neutral-950">{assignedCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Available Pool</p>
            <p className="text-xl font-semibold text-neutral-950">{availableCount}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter pills */}
        <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "min-h-9 min-w-16 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              statusFilter === "all"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            All Lines ({numbers.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("assigned")}
            className={cn(
              "min-h-9 min-w-16 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              statusFilter === "assigned"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            Assigned ({assignedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("available")}
            className={cn(
              "min-h-9 min-w-16 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              statusFilter === "available"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            Available ({availableCount})
          </button>
        </div>

        {/* Search & Check connections */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-44 flex-1 sm:w-64">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search number or course…"
              className="min-h-10 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCheckConnections}
            loading={checkingConnections}
            className="min-h-10"
          >
            Check connections
          </Button>
        </div>
      </div>

      {/* Table view */}
      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50/50 py-12">
          <div className="flex flex-col items-center gap-2">
            <Spinner size="md" className="text-neutral-500" />
            <p className="text-xs font-medium text-neutral-500">Loading telephony lines…</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error}
        </div>
      ) : filteredNumbers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 p-8 text-center">
          <p className="text-sm font-medium text-neutral-700">No phone lines found.</p>
          <p className="mt-1 text-xs text-neutral-400">
            {numbers.length === 0
              ? "Your Voice AI workspace has no numbers provisioned yet. Add numbers via your carrier account to assign them to courses."
              : "Try adjusting your search query or filter."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/90 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Phone Line
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Carrier
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Assigned Course Coach
                  </th>
                  <th scope="col" className="hidden px-3 py-3 text-center sm:table-cell">
                    Routing Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right sm:px-5">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredNumbers.map((number) => {
                  const isAssigned = Boolean(number.assignedCourse);
                  const carrierMatch = connections[number.id];

                  return (
                    <tr
                      key={number.id}
                      className={cn(
                        "group transition-colors",
                        isAssigned
                          ? "bg-neutral-900/[0.02] hover:bg-neutral-50/80"
                          : "hover:bg-neutral-50/80",
                      )}
                    >
                      {/* Phone Number & Country */}
                      <td className="px-4 py-3.5 sm:px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold shadow-xs transition-colors",
                              isAssigned
                                ? "bg-neutral-900 text-white"
                                : "bg-neutral-100 text-neutral-600",
                            )}
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-sm font-semibold text-neutral-950">
                                {number.e164}
                              </span>
                              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600 uppercase">
                                {number.country}
                              </span>
                            </div>
                            {number.region && (
                              <p className="truncate text-xs text-neutral-500">
                                {number.region}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Number Type */}
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 capitalize">
                          {number.numberType}
                        </span>
                      </td>

                      {/* Carrier / Provider */}
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700 capitalize">
                          {number.provider}
                        </span>
                      </td>

                      {/* Assigned Course Coach */}
                      <td className="px-4 py-3.5">
                        {number.assignedCourse ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <Link
                                to="/courses/$courseId/edit"
                                params={{ courseId: number.assignedCourse.id }}
                                className="truncate text-xs font-semibold text-neutral-900 hover:underline"
                              >
                                {number.assignedCourse.title}
                              </Link>
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider",
                                  number.assignedCourse.status === "published"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : number.assignedCourse.status === "pending_review"
                                      ? "bg-sky-50 text-sky-700 border border-sky-200"
                                      : "bg-neutral-100 text-neutral-600",
                                )}
                              >
                                {number.assignedCourse.status === "published"
                                  ? "Live"
                                  : number.assignedCourse.status.replace("_", " ")}
                              </span>
                            </div>
                            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Inbound coaching active
                            </span>
                          </div>
                        ) : number.agentId ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-semibold text-neutral-900">
                                {number.agentName || "External Voice Agent"}
                              </span>
                              <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.2 text-[9px] font-semibold text-indigo-700 uppercase tracking-wider">
                                External Agent
                              </span>
                            </div>
                            <span className="text-[11px] text-indigo-700">
                              Bound to agent in Telenow
                            </span>
                          </div>
                        ) : number.allocatedToMemberId ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-semibold text-neutral-900">
                                Team Member Inbound
                              </span>
                              <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.2 text-[9px] font-semibold text-rose-700 uppercase tracking-wider">
                                Locked
                              </span>
                            </div>
                            <span className="text-[11px] text-rose-600">
                              Held by team member (inbound exclusive)
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Available line
                          </span>
                        )}
                      </td>

                      {/* Carrier Routing Status */}
                      <td className="hidden px-3 py-3.5 text-center sm:table-cell">
                        {carrierMatch === true ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Connected
                          </span>
                        ) : carrierMatch === false ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Reconnect needed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                            Ready
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right sm:px-5">
                        {!readOnly && (
                          <div className="flex items-center justify-end gap-2">
                            {isAssigned ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openAssignModal(number)}
                                  className="min-h-9 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                                >
                                  Change
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openUnassignModal(number)}
                                  className="min-h-9 rounded-lg px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  Unassign
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openAssignModal(number)}
                                className="min-h-9 rounded-lg bg-neutral-900 px-3 py-1 text-xs font-semibold text-white hover:bg-neutral-800 transition-all shadow-xs"
                              >
                                Assign course
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign Course Modal */}
      <Modal
        open={assignModalOpen}
        onClose={() => !assigning && setAssignModalOpen(false)}
        title={targetNumber?.assignedCourse ? "Change Assigned Course" : "Assign Line to Course"}
        description={`Configure which Course AI Coach answers calls made to ${targetNumber?.e164 ?? ""}.`}
      >
        <form onSubmit={handleAssignSubmit} className="flex flex-col gap-4">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3.5 text-xs text-neutral-600">
            <span className="font-semibold text-neutral-900">How phone assignment works:</span>
            <p className="mt-1 leading-relaxed">
              Learners can dial <span className="font-semibold text-neutral-900">{targetNumber?.e164}</span> from their phone to begin practicing with the AI coach. Outbound practice campaign calls will also display this number as the caller ID.
            </p>
          </div>

          {targetNumber?.assignedCourse && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <span className="font-semibold">⚠️ Currently in use:</span> This line is currently bound to "{targetNumber.assignedCourse.title}". Assigning it here will disconnect inbound coaching calls to that course.
            </div>
          )}
          {!targetNumber?.assignedCourse && targetNumber?.agentId && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
              <span className="font-semibold">⚠️ Currently in use:</span> This line is currently bound in Telenow to an external agent{targetNumber.agentName ? ` "${targetNumber.agentName}"` : ""}. Assigning it will detach that agent from inbound calls.
            </div>
          )}
          {targetNumber?.allocatedToMemberId && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
              <span className="font-semibold">🔒 Inbound Exclusivity:</span> This number is allocated to a team member in Telenow. Telenow will reject assigning an AI agent with a 409 Conflict until the number is unallocated in Telenow Workplace Settings.
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-700">Select Course Coach</span>
            {coursesLoading ? (
              <div className="flex items-center gap-2 py-3 text-xs text-neutral-500">
                <Spinner size="sm" /> Loading courses…
              </div>
            ) : courses.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                No courses created yet. Create a course first before assigning a phone number.
              </p>
            ) : (
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={assigning}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} ({course.status === "published" ? "Live" : course.status})
                  </option>
                ))}
              </select>
            )}
          </label>

          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAssignModalOpen(false)}
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={assigning}
              disabled={!selectedCourseId || courses.length === 0}
            >
              Confirm assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Unassign Confirmation Modal */}
      <Modal
        open={unassignModalOpen}
        onClose={() => !unassigning && setUnassignModalOpen(false)}
        title="Unassign Phone Line"
        description={`Are you sure you want to unassign ${numberToUnassign?.e164 ?? ""} from "${numberToUnassign?.assignedCourse?.title ?? ""}"?`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-neutral-600">
            Once unassigned, learners calling this line will no longer reach the AI coach, and this phone number will return to your available numbers pool.
          </p>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setUnassignModalOpen(false)}
              disabled={unassigning}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
              loading={unassigning}
              onClick={handleUnassignSubmit}
            >
              Unassign line
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
