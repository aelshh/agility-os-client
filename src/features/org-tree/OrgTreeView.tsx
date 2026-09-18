import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";

import { cn } from "../../lib/cn";
import { Button, Modal, Spinner } from "../../components";
import { useAuth } from "../auth";
import { ROLE_COLOR, ROLE_LABELS } from "./buildTreeData";
import { EmployeeNode } from "./EmployeeNode";
import { GroupNode } from "./GroupNode";
import { DetailPanel } from "./DetailPanel";
import { EmployeeDetail } from "./EmployeeDetail";
import { DepartmentDetail } from "./DepartmentDetail";
import { useOrgTree } from "./useOrgTree";
import type { OrgGroupNodeData } from "./buildTreeData";
import {
  apiCreateInvites,
  apiGrantAdmin,
  apiRevokeAdmin,
} from "../../api/invites";
import type { CreateInvitesResponse } from "../../api/invites";
import type { OrgTreeData, OrgTreeNode } from "../../api/hrms";

const nodeTypes = {
  employee: EmployeeNode,
  department: GroupNode,
  group: GroupNode,
};

const ROLE_LIST = Object.keys(ROLE_LABELS);

/** Right-side floating action panel on employee cards (EmployeeNode). */
const PANEL_WIDTH = 176; // w-44
const PANEL_MARGIN = 8; // ml-2
const PANEL_GAP = 24;
const PANEL_TRANSITION = "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)";

function getSubtreeIds(nodes: Node[], rootId: string): Set<string> {
  const parentIdById = new Map<string, string | null>();
  for (const n of nodes)
    parentIdById.set(n.id, (n.data?.parentId as string) ?? null);
  const ids = new Set<string>();
  for (const n of nodes) {
    let cursor: string | null = n.id;
    while (cursor) {
      if (cursor === rootId) {
        ids.add(n.id);
        break;
      }
      cursor = parentIdById.get(cursor) ?? null;
    }
  }
  return ids;
}

type InviteTarget = { userId: string; name: string; email: string };
type AdminTarget = { userId: string; name: string; isAdmin: boolean };

function DetailPanelRenderer({
  detailId,
  setDetailId,
  rfNodes,
  orgTree,
  employeeById,
  viewerIsAdmin,
  viewerId,
  openInvite,
  openAdmin,
  onInviteAll,
  onNavigate,
}: {
  detailId: string | null;
  setDetailId: (id: string | null) => void;
  rfNodes: Node[];
  orgTree: OrgTreeData;
  employeeById: Map<string, OrgTreeNode>;
  viewerIsAdmin: boolean;
  viewerId: string | null;
  openInvite: (id: string) => void;
  openAdmin: (id: string) => void;
  onInviteAll: (targets: InviteTarget[]) => void;
  onNavigate: (id: string) => void;
}) {
  if (!detailId) return null;

  const detailNode = rfNodes.find((n) => n.id === detailId);
  const detailEmployee = employeeById.get(detailId) ?? null;

  if (detailEmployee) {
    return (
      <DetailPanel
        open
        onClose={() => setDetailId(null)}
        title={detailEmployee.name}
        subtitle={
          detailEmployee.designation ||
          ROLE_LABELS[detailEmployee.role] ||
          undefined
        }
      >
        <EmployeeDetail
          employee={detailEmployee}
          orgTree={orgTree}
          viewerIsAdmin={viewerIsAdmin}
          viewerId={viewerId}
          onOpenInvite={openInvite}
          onOpenAdmin={openAdmin}
          onNavigate={onNavigate}
        />
      </DetailPanel>
    );
  }

  if (detailNode?.type === "department") {
    const group = detailNode.data as OrgGroupNodeData;
    return (
      <DetailPanel
        open
        onClose={() => setDetailId(null)}
        title={group.label}
        subtitle={`Department · ${group.members} member${group.members === 1 ? "" : "s"}`}
      >
        <DepartmentDetail
          department={group.department}
          orgTree={orgTree}
          viewerIsAdmin={viewerIsAdmin}
          viewerId={viewerId}
          onNavigate={onNavigate}
          onInviteAll={onInviteAll}
        />
      </DetailPanel>
    );
  }

  return null;
}

function OrgTreeCanvas() {
  const {
    status,
    error,
    orgTree,
    nodes,
    edges,
    focusId,
    searchActive,
    searchKey,
    searchResults,
    clearFocus,
    collapseAll,
    expandAll,
    search,
    clearSearch,
    revealAndFocus,
    refresh,
  } = useOrgTree();
  const { user: viewer } = useAuth();
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow<Node>();
  const [query, setQuery] = useState("");

  // ── selection ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inviteModal, setInviteModal] = useState<{
    open: boolean;
    targets: InviteTarget[];
  }>({ open: false, targets: [] });
  const [adminModal, setAdminModal] = useState<{
    open: boolean;
    user: AdminTarget | null;
  }>({ open: false, user: null });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  /** Employee card currently showing the floating action panel (hover). */
  const [panelNodeId, setPanelNodeId] = useState<string | null>(null);
  /** Ids currently shifted aside (or still animating back) — keep their
   *  transform transition so both shift and restore animate via CSS. */
  const movedIdsRef = useRef<Set<string>>(new Set());

  const handlePanelOpenChange = useCallback(
    (id: string, open: boolean) => setPanelNodeId(open ? id : null),
    [],
  );

  /** Navigate to a node from the detail drawer: reveal it on the canvas,
   *  focus its subtree, and switch the drawer content. */
  const handleNavigate = useCallback(
    (id: string) => {
      revealAndFocus(id);
      setDetailId(id);
    },
    [revealAndFocus],
  );

  const viewerIsAdmin = orgTree?.viewerIsAdmin ?? false;
  const viewerId = viewer?.id ?? null;
  const employeeById = useMemo(
    () =>
      new Map(
        (orgTree?.employees ?? []).map((e) => [e.externalHrmsId, e] as const),
      ),
    [orgTree],
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Node[] }) => {
      setSelectedIds(
        selected.filter((n) => n.type === "employee").map((n) => n.id),
      );
    },
    [],
  );

  const openInvite = useCallback(
    (nodeId: string) => {
      const emp = employeeById.get(nodeId);
      if (!emp || !emp.userId || emp.userStatus !== "invited" || !emp.email) {
        return;
      }
      setInviteModal({
        open: true,
        targets: [{ userId: emp.userId, name: emp.name, email: emp.email }],
      });
    },
    [employeeById],
  );

  /** Employee invitable from a multi-select batch. */
  const eligibleTargets = useMemo<InviteTarget[]>(() => {
    if (!viewerIsAdmin) return [];
    const out: InviteTarget[] = [];
    for (const id of selectedIds) {
      const emp = employeeById.get(id);
      if (
        emp &&
        emp.userId &&
        emp.userId !== viewerId &&
        emp.userStatus === "invited" &&
        emp.email
      ) {
        out.push({ userId: emp.userId, name: emp.name, email: emp.email });
      }
    }
    return out;
  }, [selectedIds, employeeById, viewerIsAdmin, viewerId]);

  const openBatchInvite = useCallback(() => {
    if (eligibleTargets.length === 0) return;
    setInviteModal({ open: true, targets: eligibleTargets });
  }, [eligibleTargets]);

  const openAdmin = useCallback(
    (nodeId: string) => {
      const emp = employeeById.get(nodeId);
      if (!emp || !emp.userId || emp.userStatus !== "active") return;
      setAdminModal({
        open: true,
        user: { userId: emp.userId, name: emp.name, isAdmin: emp.isAdmin },
      });
    },
    [employeeById],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setRfNodes((prev) =>
      prev.map((n) => (n.selected ? { ...n, selected: false } : n)),
    );
  }, [setRfNodes]);

  const submitInvites = async () => {
    const targets = inviteModal.targets;
    if (targets.length === 0) return;
    setInviteBusy(true);
    try {
      const res: CreateInvitesResponse = await apiCreateInvites(
        targets.map((t) => t.userId),
      );
      const s = res.summary;
      if (s.sent > 0) {
        toast.success(
          s.skipped + s.failed > 0
            ? `Invite${s.sent === 1 ? "" : "s"} sent (${s.sent}); ${s.skipped + s.failed} failed to send.`
            : `Invite${s.sent === 1 ? "" : "s"} sent to ${s.sent} teammate${s.sent === 1 ? "" : "s"}.`,
        );
      } else if (s.failed > 0) {
        toast.error("Failed to send email.");
      } else {
        toast.info("Nothing to send — those people are already set up.");
      }
      setInviteModal({ open: false, targets: [] });
      clearSelection();
      refresh();
    } catch (err) {
      const message =
        (err as { message?: string })?.message ??
        "Something went wrong sending invites.";
      toast.error(message);
    } finally {
      setInviteBusy(false);
    }
  };

  const submitAdminToggle = async () => {
    const target = adminModal.user;
    if (!target) return;
    setAdminBusy(true);
    try {
      if (target.isAdmin) {
        await apiRevokeAdmin(target.userId);
        toast.success(`${target.name} is no longer an admin.`);
      } else {
        await apiGrantAdmin(target.userId);
        toast.success(`${target.name} is now an admin.`);
      }
      setAdminModal({ open: false, user: null });
      refresh();
    } catch (err) {
      const message =
        (err as { message?: string }).message ??
        "Something went wrong updating admin access.";
      toast.error(message);
    } finally {
      setAdminBusy(false);
    }
  };

  // ── unified fit pipeline ────────────────────────────────────────────
  const fitTokenRef = useRef(0);
  const clearAfterFitRef = useRef(false);
  const [fitTick, setFitTick] = useState(0);
  const fitIdsRef = useRef<string[] | null>(null);

  // Keep latest handlers in refs so pipeline effects only depend on fitTick.
  const clearFocusRef = useRef(clearFocus);
  useEffect(() => {
    clearFocusRef.current = clearFocus;
  }, [clearFocus]);
  const fitViewRef = useRef(fitView);
  useEffect(() => {
    fitViewRef.current = fitView;
  }, [fitView]);

  /** Schedule a smooth viewport fit. Replaces all previous fit effects. */
  function requestFit(opts?: { ids?: string[]; clearAfter?: boolean }) {
    fitIdsRef.current = opts?.ids ?? null;
    clearAfterFitRef.current = opts?.clearAfter ?? false;
    fitTokenRef.current += 1;
    setFitTick((t) => t + 1);
  }

  useEffect(() => {
    if (fitTick === 0) return;
    const token = fitTokenRef.current;
    const targetIds = fitIdsRef.current;
    let raf: number;

    const run = () => {
      raf = requestAnimationFrame(() => {
        // second rAF: wait for React Flow to commit positions + measure
        raf = requestAnimationFrame(() => {
          if (fitTokenRef.current !== token) return;
          const target = targetIds?.map((id) => ({ id }));
          fitViewRef
            .current({
              nodes: target ?? undefined,
              padding: target ? 0.35 : 0.12,
              duration: 500,
              maxZoom: target ? 1 : 1.2,
            })
            .then(() => {
              if (fitTokenRef.current !== token) return;
              if (clearAfterFitRef.current) clearFocusRef.current();
            });
        });
      });
    };
    run();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitTick]);

  // ── initial fit on first data load ──────────────────────────────────
  const didInitFit = useRef(false);
  useEffect(() => {
    if (status === "ready" && rfNodes.length > 0 && !didInitFit.current) {
      didInitFit.current = true;
      requestFit();
    }
  }, [status, rfNodes]);

  // ── focus subtree fit after toggle ──────────────────────────────────
  useEffect(() => {
    if (!focusId) return;
    const ids = getSubtreeIds(rfNodes, focusId);
    if (ids.size === 0) {
      clearFocusRef.current();
      return;
    }
    requestFit({ ids: [...ids], clearAfter: true });
  }, [focusId, rfNodes]);

  // ── search fit once per query ───────────────────────────────────────
  const didFitSearch = useRef<string | null>(null);
  useEffect(() => {
    if (searchKey === null) {
      didFitSearch.current = null;
      return;
    }
    if (didFitSearch.current === searchKey) return;
    if (rfNodes.length === 0) return;
    didFitSearch.current = searchKey;
    requestFit({ ids: rfNodes.map((n) => n.id) });
  }, [searchKey, rfNodes]);

  // ── actions ─────────────────────────────────────────────────────────
  const handleExpandAll = () => {
    expandAll();
    requestFit();
  };
  const handleCollapseAll = () => {
    collapseAll();
    requestFit();
  };
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };
  const handleClearSearch = () => {
    setQuery("");
    clearSearch();
    requestFit();
  };

  // ── sync internal state with React Flow ─────────────────────────────
  const edgesWithArrows = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        type: "smoothstep" as const,
        animated: false,
        style: { stroke: "#737373", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 12,
          color: "#737373",
        },
        className: "org-edge",
      })),
    [edges],
  );

  useEffect(() => {
    // If the floating action panel is open over a node, push aside every
    // column of nodes it would cover so the Invite/Grant buttons stay fully
    // visible. Computed deterministically from the base layout each run so it
    // survives re-decoration without jitter.
    const shiftXById = new Map<string, number>();
    if (panelNodeId) {
      const hovered = nodes.find((n) => n.id === panelNodeId);
      if (hovered) {
        const panelX0 = hovered.position.x + hovered.width + PANEL_MARGIN;
        const panelX1 = panelX0 + PANEL_WIDTH;
        const panelY0 = hovered.position.y;
        const panelY1 = panelY0 + hovered.height;
        const targetX = panelX1 + PANEL_GAP;

        const coveredColumns = new Set<number>();
        for (const n of nodes) {
          if (n.id === panelNodeId) continue;
          const nx = n.position.x;
          const ny = n.position.y;
          if (
            nx < targetX &&
            nx < panelX1 &&
            nx + n.width > panelX0 &&
            ny < panelY1 &&
            ny + n.height > panelY0
          ) {
            coveredColumns.add(nx);
          }
        }

        if (coveredColumns.size > 0) {
          const delta = targetX - Math.min(...coveredColumns);
          if (delta > 0) {
            for (const n of nodes) {
              if (coveredColumns.has(n.position.x)) {
                shiftXById.set(n.id, n.position.x + delta);
              }
            }
          }
        }
      }
    }

    // Keep the transform transition on every shifted/restoring node across
    // re-decoration frames, so both the shift and the return animate.
    const transitionFor = new Set([...shiftXById.keys(), ...movedIdsRef.current]);
    movedIdsRef.current = transitionFor;

    const decorated: Node[] = nodes.map((n) => {
      const highlighted = n.id === detailId;
      const base =
        n.type === "employee"
          ? {
              ...n,
              data: {
                ...n.data,
                highlighted,
                viewerIsAdmin,
                isSelf: !!viewerId && n.data.userId === viewerId,
                onInvite: openInvite,
                onToggleAdmin: openAdmin,
                onSelectNode: setDetailId,
                onPanelOpenChange: handlePanelOpenChange,
              },
            }
          : {
              ...n,
              data: { ...n.data, highlighted, onSelectNode: setDetailId },
            } as unknown as Node;

      const shiftX = shiftXById.get(n.id);
      return {
        ...base,
        ...(shiftX !== undefined
          ? { position: { ...base.position, x: shiftX } }
          : {}),
        ...(transitionFor.has(n.id)
          ? { style: { transition: PANEL_TRANSITION } }
          : {}),
      } as unknown as Node;
    });
    setRfNodes(decorated);
  }, [
    nodes,
    setRfNodes,
    viewerIsAdmin,
    viewerId,
    openInvite,
    openAdmin,
    detailId,
    panelNodeId,
    handlePanelOpenChange,
  ]);

  // Once the panel closes, let the restore animation finish, then drop the
  // transition style from the moved nodes so layout changes stay instant.
  useEffect(() => {
    if (panelNodeId || movedIdsRef.current.size === 0) return;
    const timeout = setTimeout(() => {
      const ids = movedIdsRef.current;
      movedIdsRef.current = new Set();
      setRfNodes((prev) =>
        prev.map((n) => (ids.has(n.id) ? { ...n, style: undefined } : n)),
      );
    }, 480);
    return () => clearTimeout(timeout);
  }, [panelNodeId, setRfNodes]);

  useEffect(() => {
    setRfEdges(edgesWithArrows);
  }, [edgesWithArrows, setRfEdges]);

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm font-medium">
            {orgTree ? "Refreshing org tree…" : "Building org tree…"}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error" || !orgTree) {
    return (
      <div className="flex h-full items-center justify-center">
        <div
          className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700"
          role="alert"
        >
          {error ?? "Failed to load the org tree."}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: "smoothstep", interactionWidth: 24 }}
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.02}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable
        multiSelectionKeyCode={["Shift", "Meta", "Control"]}
        proOptions={{ hideAttribution: true }}
        className="org-flow"
      >
        <Background gap={32} size={1.5} color="#e7e7e7" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          nodeColor={(n: Node) => {
            const d = n.data as { kind?: string; role?: string };
            if (d.kind === "group" || n.type === "department") return "#737373";
            return ROLE_COLOR[(d.role as string) ?? ""] ?? "#a3a3a3";
          }}
          nodeStrokeWidth={2}
          maskColor="rgba(255, 255, 255, 0.75)"
        />
      </ReactFlow>

      {/* Search */}
      <div className="absolute left-1/2 top-3 z-20 w-[340px] -translate-x-1/2 rounded-xl border border-neutral-200 bg-white/95 p-2 shadow-lg shadow-neutral-900/5 backdrop-blur">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <svg
            className="h-4 w-4 shrink-0 text-neutral-400"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="m15 15 3.5 3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search person, role, department…"
            className="w-full min-w-0 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
            aria-label="Search the org tree"
          />
          {searchActive ? (
            <button
              type="button"
              onClick={handleClearSearch}
              className="shrink-0 rounded-md bg-neutral-900 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-neutral-700"
            >
              Clear
            </button>
          ) : (
            <button
              type="submit"
              className="shrink-0 rounded-md bg-neutral-900 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-neutral-700"
            >
              Search
            </button>
          )}
        </form>
        {searchActive && (
          <p className="mt-1.5 px-1 text-[10px] font-medium text-neutral-500">
            {searchResults > 0
              ? `${searchResults.toLocaleString()} result${searchResults === 1 ? "" : "s"} for “${searchKey}” — Clear to see the full tree.`
              : `No results for “${searchKey}”.`}
          </p>
        )}
      </div>

      <div className="absolute left-3 top-3 z-10 w-[260px] rounded-xl border border-neutral-200 bg-white/95 p-3 shadow-lg shadow-neutral-900/5 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Org tree
          </p>
          <p className="text-[11px] font-medium text-neutral-400">
            {nodes.length} shown · {orgTree.employees.length} total
          </p>
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleExpandAll}
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Collapse all
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
          {ROLE_LIST.map((role) => (
            <span key={role} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: ROLE_COLOR[role] ?? "#a3a3a3" }}
              />
              <span className="text-[10px] font-medium text-neutral-500">
                {ROLE_LABELS[role]}
              </span>
            </span>
          ))}
        </div>

        {viewerIsAdmin && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 rounded-lg bg-neutral-100 px-2 py-1.5">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-100 ring-1 ring-emerald-600/40" />
              <span className="text-[10px] font-medium text-neutral-600">
                active
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-100 ring-1 ring-amber-600/40" />
              <span className="text-[10px] font-medium text-neutral-600">
                invite sent
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-neutral-100 ring-1 ring-neutral-400/60" />
              <span className="text-[10px] font-medium text-neutral-600">
                needs invite
              </span>
            </span>
          </div>
        )}

        <p
          className={cn(
            "mt-3 rounded-lg px-2 py-1.5 text-[10px] leading-snug text-neutral-400",
            "bg-neutral-100",
          )}
        >
          Department groups wrap people following reporting lines. Click any
          node to expand it and see its details; click again to collapse.
          Shift-click or shift-drag to select; drag to pan, scroll to zoom.
        </p>
      </div>

      {/* Batch invite bar */}
      {viewerIsAdmin && selectedIds.length > 0 && (
        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-neutral-200 bg-white/95 px-3.5 py-2.5 shadow-lg shadow-neutral-900/10 backdrop-blur">
          <p className="text-xs font-semibold text-neutral-700">
            {selectedIds.length} selected
          </p>
          <Button
            size="sm"
            disabled={eligibleTargets.length === 0}
            onClick={() => {
              if (eligibleTargets.length > 0) openBatchInvite();
            }}
          >
            Invite ({eligibleTargets.length})
          </Button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs font-semibold text-neutral-500 transition-colors hover:text-neutral-900"
          >
            Clear
          </button>
        </div>
      )}

      {/* Invite modal */}
      <Modal
        open={inviteModal.open}
        onClose={() => setInviteModal({ open: false, targets: [] })}
        title="Send account invitations"
        description={`${inviteModal.targets.length} teammate${inviteModal.targets.length === 1 ? "" : "s"} will get an email invite. Each invite expires after 72 hours and can only be used once.`}
      >
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {inviteModal.targets.map((t) => (
            <li
              key={t.userId}
              className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {t.name}
                </p>
                <p className="truncate text-xs text-neutral-500">{t.email}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => setInviteModal({ open: false, targets: [] })}
            disabled={inviteBusy}
          >
            Cancel
          </Button>
          <Button onClick={submitInvites} loading={inviteBusy}>
            Send invite{inviteModal.targets.length === 1 ? "" : "s"}
          </Button>
        </div>
      </Modal>

      {/* Admin modal */}
      <Modal
        open={adminModal.open}
        onClose={() => setAdminModal({ open: false, user: null })}
        title={adminModal.user?.isAdmin ? "Remove admin access" : "Grant admin access"}
        description={
          adminModal.user?.isAdmin
            ? `${adminModal.user.name} will lose the ability to invite teammates and manage admins. You can always re-grant it later.`
            : `${adminModal.user?.name} will be able to invite teammates and manage admin access for the org.`
        }
      >
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => setAdminModal({ open: false, user: null })}
            disabled={adminBusy}
          >
            Cancel
          </Button>
          <Button
            variant={adminModal.user?.isAdmin ? "outline" : "primary"}
            onClick={submitAdminToggle}
            loading={adminBusy}
          >
            {adminModal.user?.isAdmin ? "Remove admin" : "Grant admin"}
          </Button>
        </div>
      </Modal>

      {/* Right-side detail panel */}
      <DetailPanelRenderer
        detailId={detailId}
        setDetailId={setDetailId}
        rfNodes={rfNodes}
        orgTree={orgTree}
        employeeById={employeeById}
        viewerIsAdmin={viewerIsAdmin}
        viewerId={viewerId}
        openInvite={openInvite}
        openAdmin={openAdmin}
        onInviteAll={(targets) => setInviteModal({ open: true, targets })}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

export function OrgTreeView() {
  return (
    <div className="h-full min-h-0 w-full">
      <ReactFlowProvider>
        <OrgTreeCanvas />
      </ReactFlowProvider>
    </div>
  );
}