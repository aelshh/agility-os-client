import { useEffect, useMemo, useRef, useState } from "react";
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

import { cn } from "../../lib/cn";
import { Spinner } from "../../components";
import { EmployeeNode } from "./EmployeeNode";
import { GroupNode } from "./GroupNode";
import { ROLE_COLOR, ROLE_LABELS } from "./buildTreeData";
import { useOrgTree } from "./useOrgTree";

const nodeTypes = {
  employee: EmployeeNode,
  department: GroupNode,
  group: GroupNode,
};

const ROLE_LIST = Object.keys(ROLE_LABELS);

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
  } = useOrgTree();
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow<Node>();
  const [query, setQuery] = useState("");

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
    setRfNodes(nodes);
  }, [nodes, setRfNodes]);
  useEffect(() => {
    setRfEdges(edgesWithArrows);
  }, [edgesWithArrows, setRfEdges]);

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm font-medium">Building org tree…</p>
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
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: "smoothstep", interactionWidth: 24 }}
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.02}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable
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

        <p
          className={cn(
            "mt-3 rounded-lg px-2 py-1.5 text-[10px] leading-snug text-neutral-400",
            "bg-neutral-100",
          )}
        >
          Department groups wrap people following reporting lines. Click any
          node to expand one level; collapse to hide its subtree. Drag to pan,
          scroll to zoom.
        </p>
      </div>
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
