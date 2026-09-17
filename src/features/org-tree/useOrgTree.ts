import { useEffect, useRef, useState } from "react";

import type { OrgFlowEdge, OrgFlowNode } from "./buildTreeData";
import { computeMatches, layoutOrgTree, visibleSubset } from "./buildTreeData";
import type { OrgTreeData } from "../../api/hrms";
import { apiGetOrgTree } from "../../api/hrms";

export type OrgTreeStatus = "loading" | "ready" | "error";

export function useOrgTree() {
  const [status, setStatus] = useState<OrgTreeStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [orgTree, setOrgTree] = useState<OrgTreeData | null>(null);
  const [nodes, setNodes] = useState<OrgFlowNode[]>([]);
  const [edges, setEdges] = useState<OrgFlowEdge[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchKey, setSearchKey] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState(0);
  const layoutRef = useRef<{
    nodes: OrgFlowNode[];
    edges: OrgFlowEdge[];
  }>({ nodes: [], edges: [] });
  const collapsedRef = useRef<Set<string>>(new Set());
  /** Non-null while a search result is isolated on the canvas. */
  const searchKeepRef = useRef<Set<string> | null>(null);

  /**
   * Computes the "spine" default: the org-root chain (executive dept →
   * root person) expanded, everything else that has children collapsed.
   * Since a collapsed node only hides its *descendants*, department cards
   * stay visible while all people remain hidden until clicked.
   */
  function defaultCollapsed(
    allNodes: OrgFlowNode[],
    allEdges: OrgFlowEdge[],
  ): Set<string> {
    const parentIds = new Set(
      allEdges.filter((e) => e.structural).map((e) => e.source),
    );
    const rootPeople = new Set(
      allNodes
        .filter((n) => n.type === "employee" && n.data.isRoot)
        .map((n) => n.id),
    );
    const rootContainers = new Set(
      allEdges
        .filter((e) => e.structural && rootPeople.has(e.target))
        .map((e) => e.source),
    );
    const expanded = new Set([...rootPeople, ...rootContainers]);

    const collapsed = new Set<string>();
    for (const n of allNodes) {
      if (!parentIds.has(n.id)) continue;
      if (expanded.has(n.id)) continue;
      collapsed.add(n.id);
    }
    return collapsed;
  }

  /** Annotates group + employee nodes with their current collapsed state for rendering. */
  function commitCollapse(nodes: OrgFlowNode[]): OrgFlowNode[] {
    const collapsed = collapsedRef.current;
    return nodes.map((node) => {
      if (
        node.type !== "department" &&
        node.type !== "group" &&
        node.type !== "employee"
      )
        return node;
      return {
        ...node,
        data: { ...node.data, collapsed: collapsed.has(node.id) },
      } as OrgFlowNode;
    });
  }

  function applyCollapse(next: Set<string>) {
    collapsedRef.current = next;
    const { nodes: allNodes, edges: allEdges } = layoutRef.current;
    const keep = searchKeepRef.current;
    const visible = visibleSubset(allNodes, allEdges, next, keep ?? undefined);
    setNodes(commitCollapse(visible.nodes));
    setEdges(visible.edges);
  }

  function toggleCollapse(id: string) {
    const next = new Set(collapsedRef.current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    applyCollapse(next);
    setFocusId(id);
  }

  function collapseAll() {
    const { nodes: allNodes, edges: allEdges } = layoutRef.current;
    if (allNodes.length === 0) return;
    applyCollapse(defaultCollapsed(allNodes, allEdges));
    setFocusId(null);
    clearSearch();
  }

  function expandAll() {
    applyCollapse(new Set());
    setFocusId(null);
    clearSearch();
  }

  function clearFocus() {
    setFocusId(null);
  }

  function search(query: string) {
    const { nodes: allNodes, edges: allEdges } = layoutRef.current;
    if (allNodes.length === 0) return;
    const q = query.trim();
    if (!q) {
      clearSearch();
      return;
    }

    const matches = computeMatches(allNodes, q);
    const keep = new Set(matches.keepIds);
    collapsedRef.current = new Set();
    searchKeepRef.current = keep;

    if (matches.personCount === 0) {
      setNodes([]);
      setEdges([]);
      setSearchActive(true);
      setSearchKey(q.toLowerCase());
      setSearchResults(0);
      setFocusId(null);
      return;
    }

    const visible = visibleSubset(allNodes, allEdges, new Set(), keep);
    setSearchActive(true);
    setSearchKey(q.toLowerCase());
    setSearchResults(matches.personCount);
    setFocusId(null);
    setNodes(commitCollapse(visible.nodes));
    setEdges(visible.edges);
  }

  function clearSearch() {
    searchKeepRef.current = null;
    setSearchActive(false);
    setSearchKey(null);
    setSearchResults(0);
    const { nodes: allNodes, edges: allEdges } = layoutRef.current;
    const visible = visibleSubset(allNodes, allEdges, collapsedRef.current);
    setNodes(commitCollapse(visible.nodes));
    setEdges(visible.edges);
  }

  useEffect(() => {
    let cancelled = false;

    apiGetOrgTree()
      .then((data) => {
        if (cancelled) return;
        const layout = layoutOrgTree(data);
        if (layout.nodes.length === 0) {
          setStatus("ready");
          return;
        }
        const nodesWithToggle: OrgFlowNode[] = layout.nodes.map(
          (node) =>
            ({
              ...node,
              data: { ...node.data, toggleCollapse } as typeof node.data,
            }) as OrgFlowNode,
        );
        layoutRef.current = { nodes: nodesWithToggle, edges: layout.edges };

        collapsedRef.current = defaultCollapsed(nodesWithToggle, layout.edges);
        const visible = visibleSubset(
          nodesWithToggle,
          layout.edges,
          collapsedRef.current,
        );

        setOrgTree(data);
        setNodes(commitCollapse(visible.nodes));
        setEdges(visible.edges);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? "Failed to load the org tree.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
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
    toggleCollapse,
    collapseAll,
    expandAll,
    search,
    clearSearch,
  };
}
