import * as d3 from "d3-hierarchy";

import type { OrgTreeData, OrgTreeNode } from "../../api/hrms";

/**
 * Converts the flat employees/edges shape from `GET /api/hrms/tree` into a
 * React Flow node graph laid out top-down as:
 *
 *   virtual root → Department groups → People (reporting hierarchy)
 *
 * People are arranged by their reporting lines. Whenever a reporting edge
 * crosses department boundaries a Department group node is inserted between
 * the manager and the report, so each department acts as a container that can
 * be collapsed. Roles are shown as badges on people.
 */

export const ROLE_LABELS: Record<string, string> = {
  architect: "Architect",
  strategist: "Strategist",
  quality_gate: "Quality Gate",
  content_curator: "Content Curator",
  talent_steward: "Talent Steward",
  field_coach: "Field Coach",
  practitioner: "Practitioner",
};

export const ROLE_COLOR: Record<string, string> = {
  architect: "#0a0a0a",
  strategist: "#10b981",
  quality_gate: "#f59e0b",
  content_curator: "#0ea5e9",
  talent_steward: "#8b5cf6",
  field_coach: "#f97316",
  practitioner: "#a3a3a3",
};

export const ROLE_ORDER: Record<string, number> = {
  architect: 0,
  strategist: 1,
  quality_gate: 2,
  content_curator: 3,
  talent_steward: 4,
  field_coach: 5,
  practitioner: 6,
};

export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 96;
export const GROUP_WIDTH = 208;
export const GROUP_HEIGHT = 56;
export const NODE_GAP_Y = 64;

// ---------------------------------------------------------------------------
// Flow node / edge types
// ---------------------------------------------------------------------------

export type OrgEmployeeNodeData = {
  kind: "employee";
  label: string;
  externalHrmsId: string;
  name: string;
  email: string | null;
  designation: string | null;
  department: string | null;
  role: string;
  isRoot: boolean;
  parentId: string | null;
  hasChildren: boolean;
  depth: number;
  /** Linked app user id — null when no account was provisioned. */
  userId: string | null;
  /** Lifecycle of the linked account: invited | active | churned | null. */
  userStatus: string | null;
  hasPendingInvite: boolean;
  isAdmin: boolean;
  /** True when this node is the viewer-facing self row (avoids self-invites). */
  isSelf?: boolean;
  /** Viewer-admin context + action wiring — injected by OrgTreeView. */
  viewerIsAdmin?: boolean;
  onInvite?: (id: string) => void;
  onToggleAdmin?: (id: string) => void;
  onSelectNode?: (id: string) => void;
  onPanelOpenChange?: (id: string, open: boolean) => void;
  collapsed?: boolean;
  toggleCollapse?: (id: string) => void;
  /** True when this node is the focus of the open detail drawer. */
  highlighted?: boolean;
};

export type OrgGroupNodeData = {
  kind: "group";
  groupType: "department";
  label: string;
  department: string;
  members: number;
  isRoot: boolean;
  parentId: string | null;
  hasChildren: boolean;
  depth: number;
  collapsed?: boolean;
  toggleCollapse?: (id: string) => void;
  onSelectNode?: (id: string) => void;
  /** True when this node is the focus of the open detail drawer. */
  highlighted?: boolean;
};

export type OrgFlowNode =
  | {
      id: string;
      position: { x: number; y: number };
      width: number;
      height: number;
      data: OrgEmployeeNodeData;
      type: "employee";
    }
  | {
      id: string;
      position: { x: number; y: number };
      width: number;
      height: number;
      data: OrgGroupNodeData;
      type: "department" | "group";
    };

export type OrgFlowEdge = {
  id: string;
  source: string;
  target: string;
  /** true = structural layout edge. All edges are structural in this layout. */
  structural: boolean;
};

type HierNode = {
  id: string;
  kind: "root" | "group" | "employee";
  groupType?: "department";
  label: string;
  department: string | null;
  role: string | null;
  members: number;
  width: number;
  height: number;
  employee?: OrgTreeNode;
  children?: HierNode[];
};

// ---------------------------------------------------------------------------
// Hierarchy construction
// ---------------------------------------------------------------------------

function deptOf(node: HierNode): string {
  return node.department?.trim() || "Unassigned";
}

function roleRank(node: HierNode): number {
  return ROLE_ORDER[node.role ?? ""] ?? 99;
}

function minRoleScore(node: HierNode): number {
  let score = 99;
  for (const child of node.children ?? []) {
    score = Math.min(score, roleRank(child));
  }
  return score;
}

function directReportCounts(orgTree: OrgTreeData): Map<string, number> {
  const counts = new Map<string, number>();
  const byExt = new Map(orgTree.employees.map((e) => [e.externalHrmsId, e]));
  for (const e of orgTree.employees) {
    if (e.externalManagerId && byExt.has(e.externalManagerId)) {
      counts.set(
        e.externalManagerId,
        (counts.get(e.externalManagerId) ?? 0) + 1,
      );
    }
  }
  return counts;
}

/**
 * Builds the raw reporting tree (person → person) from `externalManagerId`.
 * Employees whose manager is missing, invalid, or themselves become roots.
 */
function buildPersonTree(orgTree: OrgTreeData): HierNode[] {
  const byExt = new Map(orgTree.employees.map((e) => [e.externalHrmsId, e]));
  const byId = new Map<string, HierNode>();
  const childrenByManager = new Map<string, HierNode[]>();

  for (const emp of orgTree.employees) {
    const node: HierNode = {
      id: emp.externalHrmsId,
      kind: "employee",
      label: emp.name,
      department: emp.department?.trim() || null,
      role: emp.role,
      members: 1,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      employee: emp,
    };
    byId.set(node.id, node);

    const mgr = emp.externalManagerId;
    if (mgr && byExt.has(mgr) && mgr !== emp.externalHrmsId) {
      const list = childrenByManager.get(mgr) ?? [];
      list.push(node);
      childrenByManager.set(mgr, list);
    }
  }

  const roots: HierNode[] = [];
  for (const emp of orgTree.employees) {
    const mgr = emp.externalManagerId;
    const node = byId.get(emp.externalHrmsId)!;
    node.children = childrenByManager.get(node.id) ?? [];
    const isRoot = !mgr || mgr === emp.externalHrmsId || !byExt.has(mgr);
    if (isRoot) roots.push(node);
  }

  return roots;
}

function countMembersByDept(node: HierNode, dept: string): number {
  let count = node.kind === "employee" && deptOf(node) === dept ? 1 : 0;
  for (const child of node.children ?? []) {
    count += countMembersByDept(child, dept);
  }
  return count;
}

/**
 * Walks a person node and wraps children that belong to a different
 * department into their own Department group node. Same-department reports
 * stay directly under the person. Applies recursively, so nested
 * cross-department transitions keep nesting (person inside dept A manages
 * someone in dept B → dept B group appears under that person).
 */
function wrapChildren(node: HierNode): void {
  const myDept = node.kind === "root" ? null : deptOf(node);
  const sameDept: HierNode[] = [];
  const crossByDept = new Map<string, HierNode[]>();

  for (const child of node.children ?? []) {
    if (myDept !== null && deptOf(child) === myDept) {
      sameDept.push(child);
    } else {
      const d = deptOf(child);
      const list = crossByDept.get(d) ?? [];
      list.push(child);
      crossByDept.set(d, list);
    }
  }

  for (const child of sameDept) wrapChildren(child);

  const deptGroups: HierNode[] = [];
  for (const [department, people] of crossByDept) {
    const groupChildren: HierNode[] = [];
    for (const person of people) {
      wrapChildren(person);
      groupChildren.push(person);
    }
    const group: HierNode = {
      id: `dept:${department}`,
      kind: "group",
      groupType: "department",
      label: department,
      department,
      role: null,
      members: 0,
      width: GROUP_WIDTH,
      height: GROUP_HEIGHT,
      children: groupChildren,
    };
    group.members = countMembersByDept(group, department);
    deptGroups.push(group);
  }

  node.children = [...sameDept, ...deptGroups];
}

function sortChildren(
  node: HierNode,
  directReports: Map<string, number>,
): void {
  const people = (node.children ?? []).filter((c) => c.kind === "employee");
  const groups = (node.children ?? []).filter((c) => c.kind === "group");

  people.sort((a, b) => {
    const roleDiff = roleRank(a) - roleRank(b);
    if (roleDiff !== 0) return roleDiff;
    const aDirect = directReports.get(a.id) ?? 0;
    const bDirect = directReports.get(b.id) ?? 0;
    if (aDirect !== bDirect) return bDirect - aDirect;
    return a.label.localeCompare(b.label);
  });
  groups.sort((a, b) => {
    const scoreDiff = minRoleScore(a) - minRoleScore(b);
    if (scoreDiff !== 0) return scoreDiff;
    return a.label.localeCompare(b.label);
  });

  node.children = [...people, ...groups];
  for (const child of node.children ?? []) sortChildren(child, directReports);
}

/**
 * Builds the flow hierarchy: reporting tree wrapped so cross-department
 * transitions pass through Department group nodes. Top-level roots always
 * land inside their own department group.
 */
function buildFlowHierarchy(orgTree: OrgTreeData): HierNode[] {
  const roots = buildPersonTree(orgTree);
  if (roots.length === 0) return [];

  const directReports = directReportCounts(orgTree);
  const pseudo: HierNode = {
    id: "__root__",
    kind: "root",
    label: "Org",
    department: null,
    role: null,
    members: 0,
    width: 0,
    height: 0,
    children: roots,
  };

  wrapChildren(pseudo);
  sortChildren(pseudo, directReports);
  return pseudo.children ?? [];
}

// ---------------------------------------------------------------------------
// Full layout
// ---------------------------------------------------------------------------

export function layoutOrgTree(orgTree: OrgTreeData): {
  nodes: OrgFlowNode[];
  edges: OrgFlowEdge[];
} {
  const roots = buildFlowHierarchy(orgTree);
  if (roots.length === 0) return { nodes: [], edges: [] };

  const byExt = new Map(orgTree.employees.map((e) => [e.externalHrmsId, e]));
  const orgRootIds = new Set(
    orgTree.employees
      .filter((e) => {
        const mgr = e.externalManagerId;
        return !mgr || !byExt.has(mgr) || mgr === e.externalHrmsId;
      })
      .map((e) => e.externalHrmsId),
  );

  const rootNode: HierNode = {
    id: "__root__",
    kind: "root",
    label: "Org",
    department: null,
    role: null,
    members: 0,
    width: 0,
    height: 0,
    children: roots,
  };

  const hierarchy = d3.hierarchy<HierNode>(rootNode);
  d3.tree<HierNode>().nodeSize([NODE_WIDTH + 32, NODE_HEIGHT + NODE_GAP_Y])(
    hierarchy,
  );

  const parentIdById = new Map<string, string | null>();
  const nodes: OrgFlowNode[] = [];

  for (const d of hierarchy.descendants()) {
    if (d.data.kind === "root") continue;
    const id = d.data.id;
    const parent = d.parent;
    parentIdById.set(
      id,
      parent && parent.data.kind !== "root" ? parent.data.id : null,
    );
    const width = d.data.width;
    const position = { x: (d.x ?? 0) - width / 2, y: d.y ?? 0 };

    if (d.data.kind === "employee" && d.data.employee) {
      const emp = d.data.employee;
      nodes.push({
        id,
        position,
        width,
        height: d.data.height,
        data: {
          kind: "employee",
          label: emp.name,
          externalHrmsId: emp.externalHrmsId,
          name: emp.name,
          email: emp.email,
          designation: emp.designation,
          department: emp.department,
          role: emp.role,
          isRoot: orgRootIds.has(id),
          parentId: parentIdById.get(id) ?? null,
          hasChildren: (d.children?.length ?? 0) > 0,
          depth: d.depth ?? 0,
          userId: emp.userId,
          userStatus: emp.userStatus,
          hasPendingInvite: emp.hasPendingInvite,
          isAdmin: emp.isAdmin,
        },
        type: "employee",
      });
    } else {
      nodes.push({
        id,
        position,
        width,
        height: d.data.height,
        data: {
          kind: "group",
          groupType: "department",
          label: d.data.label,
          department: d.data.department ?? "Unassigned",
          members: d.data.members,
          isRoot: parentIdById.get(id) === null,
          parentId: parentIdById.get(id) ?? null,
          hasChildren: (d.children?.length ?? 0) > 0,
          depth: d.depth ?? 0,
        },
        type: "department",
      });
    }
  }

  const edges: OrgFlowEdge[] = [];
  for (const [childId, parentId] of parentIdById) {
    if (parentId === null) continue;
    edges.push({
      id: `${parentId}:${childId}`,
      source: parentId,
      target: childId,
      structural: true,
    });
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Visible subset (collapse / search isolation) with re-layout
// ---------------------------------------------------------------------------

export type VisibleSubset = { nodes: OrgFlowNode[]; edges: OrgFlowEdge[] };

type LayoutNode = {
  id: string;
  width: number;
  children?: LayoutNode[];
};

function relayoutVisible(
  visible: OrgFlowNode[],
  visibleEdges: OrgFlowEdge[],
): VisibleSubset {
  const idToNode = new Map(visible.map((n) => [n.id, n]));
  const childrenByParent = new Map<string, OrgFlowNode[]>();
  for (const e of visibleEdges) {
    if (!e.structural) continue;
    const child = idToNode.get(e.target);
    if (!child) continue;
    const list = childrenByParent.get(e.source) ?? [];
    list.push(child);
    childrenByParent.set(e.source, list);
  }

  function build(node: OrgFlowNode): LayoutNode {
    return {
      id: node.id,
      width: node.width,
      children: (childrenByParent.get(node.id) ?? []).map(build),
    };
  }

  const roots = visible.filter(
    (n) => !n.data.parentId || !idToNode.has(n.data.parentId),
  );
  if (roots.length === 0) return { nodes: visible, edges: visibleEdges };

  const hierarchy = d3.hierarchy<LayoutNode>({
    id: "__root__",
    width: 0,
    children: roots.map(build),
  });
  d3.tree<LayoutNode>().nodeSize([NODE_WIDTH + 32, NODE_HEIGHT + NODE_GAP_Y])(
    hierarchy,
  );

  const positionById = new Map<string, { x: number; y: number }>();
  for (const d of hierarchy.descendants()) {
    if (d.data.id === "__root__") continue;
    positionById.set(d.data.id, { x: d.x ?? 0, y: d.y ?? 0 });
  }

  const relaid = visible.map((n) => {
    const pos = positionById.get(n.id) ?? { x: 0, y: 0 };
    return { ...n, position: { x: pos.x - n.width / 2, y: pos.y } };
  });

  return { nodes: relaid, edges: visibleEdges };
}

/**
 * Filters nodes/edges to those visible given a set of collapsed ids, then
 * re-lays the visible subset out with d3 so the graph stays compact. When
 * `keepIds` is provided it behaves as a hard filter (search isolation) in
 * addition to the collapse rules.
 */
export function visibleSubset(
  nodes: OrgFlowNode[],
  edges: OrgFlowEdge[],
  collapsedIds: Set<string>,
  keepIds?: Set<string>,
): VisibleSubset {
  const idToNode = new Map(nodes.map((n) => [n.id, n]));

  function isHidden(id: string): boolean {
    if (keepIds && !keepIds.has(id)) return true;
    let cursor = idToNode.get(id)?.data.parentId ?? null;
    while (cursor) {
      if (collapsedIds.has(cursor)) return true;
      cursor = idToNode.get(cursor)?.data.parentId ?? null;
    }
    return false;
  }

  const visible = nodes.filter((n) => !isHidden(n.id));
  const visibleIds = new Set(visible.map((n) => n.id));
  const visibleEdges = edges.filter(
    (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
  );

  return relayoutVisible(visible, visibleEdges);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type SearchMatches = { keepIds: string[]; personCount: number };

function collectDescendants(
  id: string,
  idToNode: Map<string, OrgFlowNode>,
  out: Set<string>,
): void {
  for (const n of idToNode.values()) {
    if (n.data.parentId === id) {
      out.add(n.id);
      collectDescendants(n.id, idToNode, out);
    }
  }
}

/**
 * Computes the node set to isolate for a search query. Matches across
 * persons (name, email, designation, department, role) and department group
 * nodes. The result always includes the ancestor path so matches are shown
 * with context; matched departments pull in their members.
 */
export function computeMatches(
  nodes: OrgFlowNode[],
  query: string,
): SearchMatches {
  const q = query.trim().toLowerCase();
  if (!q) return { keepIds: [], personCount: 0 };

  const idToNode = new Map(nodes.map((n) => [n.id, n]));
  const personMatches = new Set<string>();
  const groupMatches = new Set<string>();

  for (const n of nodes) {
    if (n.type === "employee") {
      const d = n.data;
      const haystack = [
        d.name,
        d.email,
        d.designation,
        d.department,
        ROLE_LABELS[d.role] ?? "",
        d.role,
        d.externalHrmsId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (haystack.includes(q)) personMatches.add(n.id);
    } else {
      const d = n.data;
      const haystack = [d.label, d.department]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (haystack.includes(q)) groupMatches.add(n.id);
    }
  }

  const keep = new Set<string>();
  function addWithAncestors(id: string): void {
    keep.add(id);
    let cursor = idToNode.get(id)?.data.parentId ?? null;
    while (cursor) {
      keep.add(cursor);
      cursor = idToNode.get(cursor)?.data.parentId ?? null;
    }
  }

  for (const id of personMatches) addWithAncestors(id);
  for (const id of groupMatches) {
    addWithAncestors(id);
    collectDescendants(id, idToNode, keep);
  }

  return { keepIds: [...keep], personCount: personMatches.size };
}
