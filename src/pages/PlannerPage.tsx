import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUndoRedo, firestoreDeleteField, type LocalOp, type FirestoreOp } from "../hooks/useUndoRedo";
import ReactFlow, {
  Background,
  SelectionMode,
  applyNodeChanges,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
  type OnNodesChange,
} from "reactflow";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../firebase";
import { NodeContextMenu } from "../components/Planner/NodeContextMenu";
import "reactflow/dist/style.css";

type PlannerPageProps = {
  user: User;
};

type NodeKind = "root" | "project" | "item" | "story";
type TaskStatus = "none" | "todo" | "done";

type StoryStep = {
  id: string;
  text: string;
  done: boolean;
};

type EntityType = "entity" | "investor" | "partner" | "vendor" | "contact" | "client" | "organization" | "person";
type RefCategoryFilter = "all" | "people" | "other";
type RefScopeFilter = "view" | "all";

type TreeNodeDoc = {
  title: string;
  parentId: string | null;
  kind: NodeKind;
  x?: number;
  y?: number;
  color?: string;
  taskStatus?: TaskStatus;
  storySteps?: StoryStep[];
  body?: string;
};

type TreeNode = TreeNodeDoc & { id: string };

type CrossRefDoc = {
  label: string;
  code: string;
  nodeIds: string[];
  anchorNodeId?: string;
  portalX?: number;
  portalY?: number;
  portalAnchorX?: number;
  portalAnchorY?: number;
  // Preferred layout model: offset from anchor. Layout-change-proof.
  portalOffsetX?: number;
  portalOffsetY?: number;
  entityType?: EntityType;
  tags?: string[];
  notes?: string;
  contact?: string;
  links?: string[];
};

type CrossRef = {
  id: string;
  label: string;
  code: string;
  nodeIds: string[];
  anchorNodeId: string | null;
  portalX: number | null;
  portalY: number | null;
  portalAnchorX: number | null;
  portalAnchorY: number | null;
  // Preferred layout model: offset from anchor. Layout-change-proof.
  portalOffsetX: number | null;
  portalOffsetY: number | null;
  entityType: EntityType;
  tags: string[];
  notes: string;
  contact: string;
  links: string[];
  createdAtMs: number;
  updatedAtMs: number;
};


type PaletteItem = {
  id: string;
  label: string;
  hint?: string;
  action: () => void;
};

const HEX_COLOR_REGEX = /^#?[0-9a-fA-F]{6}$/;

function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) return undefined;
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  return `#${hex.toUpperCase()}`;
}

function defaultNodeColor(kind: NodeKind): string {
  if (kind === "root") return "#52340A";
  if (kind === "project") return "#0A1A50";
  if (kind === "story") return "#063428";
  return "#141624";
}

function storyContainerColor(): string {
  return "#3A166C";
}


function normalizeNodeKind(value: unknown): NodeKind {
  if (value === "root" || value === "project" || value === "item" || value === "story") return value;
  return "item";
}

function normalizeTaskStatus(value: unknown): TaskStatus {
  if (value === "todo" || value === "done") return value;
  return "none";
}

function normalizeStorySteps(value: unknown): StoryStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const raw = entry as { id?: unknown; text?: unknown; title?: unknown; done?: unknown };
      const textCandidate = typeof raw.text === "string" ? raw.text : typeof raw.title === "string" ? raw.title : "";
      const text = textCandidate.trim();
      if (!text) return null;
      const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : `step-${index + 1}`;
      return {
        id,
        text,
        done: raw.done === true,
      } satisfies StoryStep;
    })
    .filter((entry): entry is StoryStep => !!entry);
}

function normalizeNodeBody(value: unknown): string {
  if (typeof value !== "string") return "";
  return value;
}

function createStoryStep(text: string): StoryStep {
  return {
    id: `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    done: false,
  };
}

function nextNodeKind(kind: NodeKind): NodeKind {
  if (kind === "project") return "item";
  if (kind === "item") return "story";
  if (kind === "story") return "project";
  return "root";
}

function normalizeCode(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return cleaned || "REF";
}

function initialsFromLabel(input: string): string {
  const parts = input
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "REF";
  if (parts.length === 1) return normalizeCode(parts[0].slice(0, 4));
  const code = `${parts[0][0] || ""}${parts[1][0] || ""}`;
  return normalizeCode(code);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function parseCsvLike(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
}

function parseLineList(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/\r?\n/)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
}

function getNudge(seed: string, xRange = 12, yRange = 8): { x: number; y: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const x = ((hash % (xRange * 2 + 1)) + (xRange * 2 + 1)) % (xRange * 2 + 1) - xRange;
  const yHash = ((hash >> 8) % (yRange * 2 + 1) + (yRange * 2 + 1)) % (yRange * 2 + 1) - yRange;
  return { x, y: yHash };
}

function chooseAnchorNodeId(nodeIds: string[], ...preferredIds: Array<string | null | undefined>): string | null {
  for (const preferred of preferredIds) {
    if (preferred && nodeIds.includes(preferred)) return preferred;
  }
  return nodeIds[0] || null;
}

function defaultPortalPositionForAnchor(anchor: { x: number; y: number } | null, seed: string): { x: number; y: number } {
  const baseX = anchor?.x ?? 0;
  const baseY = anchor?.y ?? 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const angle = (((hash >>> 0) % 360) * Math.PI) / 180;
  const radius = 96 + ((((hash >>> 8) & 0xff) / 255) * 96);
  const wobble = getNudge(`${seed}:portal`, 16, 16);
  return {
    x: baseX + 140 - 23 + Math.cos(angle) * radius + wobble.x,
    y: baseY + 60 - 23 + Math.sin(angle) * radius + wobble.y,
  };
}

function resolvePortalFollowPosition(
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: { x: number; y: number } | null,
  seed: string
): { x: number; y: number } {
  if (!anchor) {
    return {
      x: typeof ref.portalX === "number" ? ref.portalX : 0,
      y: typeof ref.portalY === "number" ? ref.portalY : 0,
    };
  }
  if (typeof ref.portalX === "number" && typeof ref.portalY === "number") {
    const savedAnchorX = typeof ref.portalAnchorX === "number" ? ref.portalAnchorX : anchor.x;
    const savedAnchorY = typeof ref.portalAnchorY === "number" ? ref.portalAnchorY : anchor.y;
    return {
      x: ref.portalX + (anchor.x - savedAnchorX),
      y: ref.portalY + (anchor.y - savedAnchorY),
    };
  }
  return defaultPortalPositionForAnchor(anchor, seed);
}

function timestampToMs(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const maybe = value as { toMillis?: () => number };
  if (typeof maybe.toMillis !== "function") return 0;
  try {
    return maybe.toMillis();
  } catch {
    return 0;
  }
}

function formatUpdatedTime(ms: number): string {
  if (!ms) return "No activity yet";
  const diffMs = Date.now() - ms;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}m ago`;
  if (diffMs < day) return `${Math.max(1, Math.floor(diffMs / hour))}h ago`;
  return `${Math.max(1, Math.floor(diffMs / day))}d ago`;
}

function buildNodePath(nodeId: string, nodesById: Map<string, TreeNode>): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  let cursorId: string | null = nodeId;
  while (cursorId && !seen.has(cursorId)) {
    seen.add(cursorId);
    const node = nodesById.get(cursorId);
    if (!node) break;
    parts.unshift(node.title);
    cursorId = node.parentId;
  }
  return parts.join(" / ");
}

function collectDescendants(startId: string, childrenByParent: Map<string, string[]>): string[] {
  const ordered: string[] = [];
  const stack = [startId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    ordered.push(current);
    const children = childrenByParent.get(current) || [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }
  return ordered;
}

function getMasterNodeFor(nodeId: string, rootNodeId: string | null, nodesById: Map<string, TreeNode>): string {
  if (!rootNodeId) return nodeId;
  let cursor = nodesById.get(nodeId);
  if (!cursor) return rootNodeId;
  while (cursor.parentId && cursor.parentId !== rootNodeId) {
    const parent = nodesById.get(cursor.parentId);
    if (!parent) break;
    cursor = parent;
  }
  return cursor.id || rootNodeId;
}

// ── Portal bubble node ─────────────────────────────────────────────────────
// One orb per (ref × linked-node) pair. Pinned near its node via fixed offset.
// No Handles — avoids ReactFlow 11 / React 19 useLayoutEffect conflict.
// Right-click fires onContextMenu so the parent can show a delete menu.
const PortalNode = memo(function PortalNode({
  data,
}: NodeProps<{
  code: string;
  tooltip: string;
  count: number;
  isActive: boolean;
  onToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}>) {
  return (
    <div
      style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); data.onContextMenu(e); }}
    >
      <button
        type="button"
        className={`planner-portal-inner${data.isActive ? " active" : ""}`}
        onClick={(e) => { e.stopPropagation(); data.onToggle(); }}
      >
        <div className="planner-portal-label" data-tooltip={data.tooltip}>
          {data.code}
        </div>
        {data.count > 1 && (
          <span className="planner-portal-count">{data.count}</span>
        )}
      </button>
    </div>
  );
});

const nodeTypes: NodeTypes = { portal: PortalNode };
const edgeTypes: EdgeTypes = Object.freeze({});
const ENTITY_TYPES: EntityType[] = ["entity", "organization", "partner", "vendor", "investor", "person", "contact", "client"];
const PEOPLE_ENTITY_TYPES = new Set<EntityType>(["person", "contact", "client"]);
const ENTITY_TYPE_GROUPS: Array<{ label: string; options: EntityType[] }> = [
  { label: "General", options: ["entity", "organization", "partner", "vendor", "investor"] },
  { label: "People", options: ["person", "contact", "client"] },
];

function isPeopleEntityType(entityType: EntityType): boolean {
  return PEOPLE_ENTITY_TYPES.has(entityType);
}

function collapsedKeyFromIds(ids: Iterable<string>): string {
  return Array.from(ids).sort().join("|");
}

export default function PlannerPage({ user }: PlannerPageProps) {
  const [profileName, setProfileName] = useState("");
  const [rootNodeId, setRootNodeId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [refs, setRefs] = useState<CrossRef[]>([]);
  const [currentRootId, setCurrentRootId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingSelectedNodeId, setPendingSelectedNodeId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 980px)").matches : false
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSidebarSection, setMobileSidebarSection] = useState<"project" | "node" | "bubbles">("project");
  const [mobileQuickEditorOpen, setMobileQuickEditorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newRefLabelInputRef = useRef<HTMLInputElement>(null);
  const [newChildTitle, setNewChildTitle] = useState("");
  const [newStoryStepText, setNewStoryStepText] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [pendingRenameNodeId, setPendingRenameNodeId] = useState<string | null>(null);
  const [storyLaneMode, setStoryLaneMode] = useState(false);
  const [expandedStoryNodeIds, setExpandedStoryNodeIds] = useState<Set<string>>(new Set());
  const [newRefLabel, setNewRefLabel] = useState("");
  const [newRefCode, setNewRefCode] = useState("");
  const [newRefType, setNewRefType] = useState<EntityType>("entity");
  const [refSearchQuery, setRefSearchQuery] = useState("");
  const [refCategoryFilter, setRefCategoryFilter] = useState<RefCategoryFilter>("all");
  const [refScopeFilter, setRefScopeFilter] = useState<RefScopeFilter>("view");
  const [editRefId, setEditRefId] = useState("");
  const [editRefLabel, setEditRefLabel] = useState("");
  const [editRefCode, setEditRefCode] = useState("");
  const [editRefType, setEditRefType] = useState<EntityType>("entity");
  const [editRefTags, setEditRefTags] = useState("");
  const [editRefNotes, setEditRefNotes] = useState("");
  const [editRefContact, setEditRefContact] = useState("");
  const [editRefLinks, setEditRefLinks] = useState("");
  const [mergeFromRefId, setMergeFromRefId] = useState("");
  const [linkNodeQuery, setLinkNodeQuery] = useState("");
  const [linkTargetNodeId, setLinkTargetNodeId] = useState("");
  const [activePortalRefId, setActivePortalRefId] = useState<string | null>(null);
  const [portalContextMenu, setPortalContextMenu] = useState<{ x: number; y: number; refId: string } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  // Swipe-to-dismiss tracking for the mobile quick-editor sheet.
  const sheetTouchStartY = useRef<number | null>(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [dropTargetNodeId, setDropTargetNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "error">("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [collapsedHydrated, setCollapsedHydrated] = useState(false);
  const syncedCollapsedKeyRef = useRef("");
  const lastFocusKeyRef = useRef("");

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  const {
    canUndo,
    canRedo,
    push: pushHistory,
    undo,
    redo,
    suppressSnapshotRef,
    newNodeDocId,
    undoLabel,
    redoLabel,
  } = useUndoRedo(user.uid);

  /**
   * Apply a list of LocalOps to React state immediately (used by undo/redo).
   * Kept as a stable callback; setNodes/setRefs identity is guaranteed stable.
   */
  const applyLocalOps = useCallback((ops: LocalOp[]) => {
    const nodeOps = ops.filter((o) => o.target === "nodes");
    const refOps  = ops.filter((o) => o.target === "refs");
    if (nodeOps.length > 0) {
      setNodes((prev) => {
        let next = prev;
        for (const op of nodeOps) {
          if (op.op === "patch")  next = next.map((n) => n.id === op.nodeId ? { ...n, ...op.patch } as TreeNode : n);
          if (op.op === "add")    next = [...next, op.node as TreeNode];
          if (op.op === "remove") { const ids = new Set(op.nodeIds); next = next.filter((n) => !ids.has(n.id)); }
        }
        return next;
      });
    }
    if (refOps.length > 0) {
      setRefs((prev) => {
        let next = prev;
        for (const op of refOps) {
          if (op.op === "patch")  next = next.map((r) => r.id === op.refId ? { ...r, ...op.patch } as CrossRef : r);
          if (op.op === "add")    next = [...next, op.ref as CrossRef];
          if (op.op === "remove") { const ids = new Set(op.refIds); next = next.filter((r) => !ids.has(r.id)); }
        }
        return next;
      });
    }
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node] as const)), [nodes]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, string[]>();
    nodes.forEach((node) => {
      if (!node.parentId) return;
      if (!map.has(node.parentId)) map.set(node.parentId, []);
      map.get(node.parentId)?.push(node.id);
    });
    map.forEach((list) =>
      list.sort((a, b) => {
        const aTitle = nodesById.get(a)?.title || "";
        const bTitle = nodesById.get(b)?.title || "";
        return aTitle.localeCompare(bTitle);
      })
    );
    return map;
  }, [nodes, nodesById]);

  const ensureWorkspace = useCallback(async () => {
    if (!db) {
      setError("Firestore is not available. Check Firebase configuration.");
      setLoading(false);
      return;
    }
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const existing = userSnap.exists() ? userSnap.data() : {};
    const preferredName =
      typeof existing.displayName === "string" && existing.displayName.trim()
        ? existing.displayName.trim()
        : (user.displayName || user.email?.split("@")[0] || "Main Node").trim();
    const rootId =
      typeof existing.rootNodeId === "string" && existing.rootNodeId.trim()
        ? existing.rootNodeId
        : doc(collection(db, "users", user.uid, "nodes")).id;

    const rootRef = doc(db, "users", user.uid, "nodes", rootId);
    const rootSnap = await getDoc(rootRef);
    const batch = writeBatch(db);
    let changed = false;

    if (!userSnap.exists()) {
      batch.set(userRef, {
        displayName: preferredName,
        email: user.email || "",
        rootNodeId: rootId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      changed = true;
    } else if (existing.displayName !== preferredName || existing.rootNodeId !== rootId) {
      batch.set(
        userRef,
        {
          displayName: preferredName,
          rootNodeId: rootId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      changed = true;
    }

    if (!rootSnap.exists()) {
      batch.set(rootRef, {
        title: preferredName,
        parentId: null,
        kind: "root",
        x: 0,
        y: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } satisfies TreeNodeDoc & { createdAt: unknown; updatedAt: unknown });
      changed = true;
    }

    if (changed) await batch.commit();
  }, [user.displayName, user.email, user.uid]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 980px)");
    const applyState = () => setIsMobileLayout(media.matches);
    applyState();

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches);
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (isMobileLayout) {
      setSidebarCollapsed(false);
      return;
    }
    setMobileSidebarOpen(false);
    setMobileQuickEditorOpen(false);
  }, [isMobileLayout]);

  useEffect(() => {
    if (!isMobileLayout || (!mobileSidebarOpen && !mobileQuickEditorOpen) || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileLayout, mobileQuickEditorOpen, mobileSidebarOpen]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    setMobileQuickEditorOpen(false);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (selectedNodeId) return;
    setMobileQuickEditorOpen(false);
  }, [selectedNodeId]);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      setError("Firestore is not available. Check Firebase configuration.");
      return;
    }
    let unsubProfile: (() => void) | null = null;
    let unsubNodes: (() => void) | null = null;
    let unsubRefs: (() => void) | null = null;
    let cancelled = false;
    let gotProfile = false;
    let gotNodes = false;
    let gotRefs = false;
    const markReady = () => {
      if (!cancelled && gotProfile && gotNodes && gotRefs) setLoading(false);
    };

    setLoading(true);
    setError(null);
    setCollapsedHydrated(false);
    syncedCollapsedKeyRef.current = "";

    ensureWorkspace()
      .then(() => {
        if (cancelled) return;

        unsubProfile = onSnapshot(
          doc(db, "users", user.uid),
          (snapshot) => {
            const data = snapshot.data();
            const nextProfileName =
              typeof data?.displayName === "string" && data.displayName.trim()
                ? data.displayName.trim()
                : (user.displayName || user.email?.split("@")[0] || "Main Node");
            const nextRootId =
              typeof data?.rootNodeId === "string" && data.rootNodeId.trim() ? data.rootNodeId : null;

            // Load collapsed nodes from Firebase
            const savedCollapsedNodes = Array.isArray(data?.collapsedNodes)
              ? data.collapsedNodes.filter((id): id is string => typeof id === "string")
              : [];
            const savedSet = new Set(savedCollapsedNodes);
            const savedKey = collapsedKeyFromIds(savedSet);
            syncedCollapsedKeyRef.current = savedKey;
            setCollapsedHydrated(true);
            setCollapsedNodeIds((prev) => {
              if (collapsedKeyFromIds(prev) === savedKey) return prev;
              return savedSet;
            });

            setProfileName(nextProfileName);
            setRootNodeId(nextRootId);
            gotProfile = true;
            markReady();
          },
          (snapshotError) => {
            setError(snapshotError.message);
            gotProfile = true;
            markReady();
          }
        );

        unsubNodes = onSnapshot(
          query(collection(db, "users", user.uid, "nodes")),
          (snapshot) => {
            // Don't overwrite local state while an undo/redo Firestore write is in flight.
            if (suppressSnapshotRef.current > 0) return;
            const nextNodes = snapshot.docs.map((entry) => {
              const value = entry.data() as Partial<TreeNodeDoc>;
              return {
                id: entry.id,
                title: typeof value.title === "string" ? value.title : "Untitled",
                parentId: typeof value.parentId === "string" ? value.parentId : null,
                kind: normalizeNodeKind(value.kind),
                x: typeof value.x === "number" ? value.x : undefined,
                y: typeof value.y === "number" ? value.y : undefined,
                color: normalizeHexColor(value.color),
                taskStatus: normalizeTaskStatus(value.taskStatus),
                storySteps: normalizeStorySteps(value.storySteps),
                body: normalizeNodeBody(value.body),
              } satisfies TreeNode;
            });
            nextNodes.sort((a, b) => a.title.localeCompare(b.title));
            setNodes(nextNodes);
            gotNodes = true;
            markReady();
          },
          (snapshotError) => {
            setError(snapshotError.message);
            gotNodes = true;
            markReady();
          }
        );

        unsubRefs = onSnapshot(
          query(collection(db, "users", user.uid, "crossRefs")),
          (snapshot) => {
            // Don't overwrite local state while an undo/redo Firestore write is in flight.
            if (suppressSnapshotRef.current > 0) return;
            const nextRefs = snapshot.docs.map((entry) => {
              const value = entry.data() as Partial<CrossRefDoc> & { createdAt?: unknown; updatedAt?: unknown };
              const entityType = ENTITY_TYPES.includes(value.entityType as EntityType)
                ? (value.entityType as EntityType)
                : "entity";
              return {
                id: entry.id,
                label: typeof value.label === "string" ? value.label : entry.id,
                code: typeof value.code === "string" ? normalizeCode(value.code) : "REF",
                nodeIds: asStringArray(value.nodeIds),
                anchorNodeId: typeof value.anchorNodeId === "string" ? value.anchorNodeId : null,
                portalX: typeof value.portalX === "number" ? value.portalX : null,
                portalY: typeof value.portalY === "number" ? value.portalY : null,
                portalAnchorX: typeof value.portalAnchorX === "number" ? value.portalAnchorX : null,
                portalAnchorY: typeof value.portalAnchorY === "number" ? value.portalAnchorY : null,
                portalOffsetX: typeof value.portalOffsetX === "number" ? value.portalOffsetX : null,
                portalOffsetY: typeof value.portalOffsetY === "number" ? value.portalOffsetY : null,
                entityType,
                tags: asStringArray(value.tags),
                notes: typeof value.notes === "string" ? value.notes : "",
                contact: typeof value.contact === "string" ? value.contact : "",
                links: asStringArray(value.links),
                createdAtMs: timestampToMs(value.createdAt),
                updatedAtMs: timestampToMs(value.updatedAt),
              } satisfies CrossRef;
            });
            nextRefs.sort(
              (a, b) => b.updatedAtMs - a.updatedAtMs || a.code.localeCompare(b.code) || a.label.localeCompare(b.label)
            );
            setRefs(nextRefs);
            gotRefs = true;
            markReady();
          },
          (snapshotError) => {
            setError(snapshotError.message);
            gotRefs = true;
            markReady();
          }
        );
      })
      .catch((workspaceError: unknown) => {
        if (cancelled) return;
        setError(workspaceError instanceof Error ? workspaceError.message : "Failed to initialize workspace.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      unsubProfile?.();
      unsubNodes?.();
      unsubRefs?.();
    };
  }, [ensureWorkspace, user.displayName, user.email, user.uid]);

  useEffect(() => {
    if (!rootNodeId) return;
    if (!currentRootId) {
      setCurrentRootId(rootNodeId);
      return;
    }
    // Recover gracefully if the current view root was deleted or became stale.
    if (!nodesById.has(currentRootId) && nodesById.has(rootNodeId)) {
      setCurrentRootId(rootNodeId);
    }
  }, [currentRootId, nodesById, rootNodeId]);

  useEffect(() => {
    if (selectedNodeId && !nodesById.has(selectedNodeId)) {
      if (pendingSelectedNodeId === selectedNodeId) return;
      setSelectedNodeId(null);
    }
  }, [pendingSelectedNodeId, selectedNodeId, nodesById]);

  useEffect(() => {
    if (!pendingSelectedNodeId) return;
    if (!nodesById.has(pendingSelectedNodeId)) return;
    setSelectedNodeId(pendingSelectedNodeId);
    setPendingSelectedNodeId(null);
  }, [nodesById, pendingSelectedNodeId]);

  useEffect(() => {
    if (!selectedNodeId && currentRootId) {
      setSelectedNodeId(currentRootId);
    }
  }, [selectedNodeId, currentRootId]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodesById.get(selectedNodeId) || null : null),
    [selectedNodeId, nodesById]
  );

  const applyLocalNodePatch = useCallback(
    (
      nodeId: string,
      patch: Partial<Pick<TreeNode, "title" | "parentId" | "kind" | "x" | "y" | "color" | "taskStatus" | "storySteps" | "body">>
    ) => {
      setNodes((prevNodes) => prevNodes.map((entry) => (entry.id === nodeId ? { ...entry, ...patch } : entry)));
    },
    []
  );

  useEffect(() => {
    setRenameTitle(selectedNode?.title || "");
  }, [selectedNode?.id, selectedNode?.title]);

  useEffect(() => {
    setBodyDraft(selectedNode?.body || "");
  }, [selectedNode?.body, selectedNode?.id]);

  useEffect(() => {
    if (!storyLaneMode) return;
    const current = currentRootId ? nodesById.get(currentRootId) : null;
    if (current?.kind === "story") return;
    setStoryLaneMode(false);
  }, [currentRootId, nodesById, storyLaneMode]);

  useEffect(() => {
    if (!pendingRenameNodeId) return;
    if (!selectedNodeId || selectedNodeId !== pendingRenameNodeId) return;
    const timeout = window.setTimeout(() => {
      setSidebarCollapsed(false);
      setMobileSidebarSection("node");
      if (isMobileLayout) setMobileSidebarOpen(true);
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
      setPendingRenameNodeId(null);
    }, 60);
    return () => window.clearTimeout(timeout);
  }, [isMobileLayout, pendingRenameNodeId, selectedNodeId]);

  useEffect(() => {
    setNewStoryStepText("");
  }, [selectedNode?.id]);

  const visibleTreeIds = useMemo(() => {
    if (!currentRootId) return [] as string[];
    return collectDescendants(currentRootId, childrenByParent);
  }, [childrenByParent, currentRootId]);

  const visibleTreeIdSet = useMemo(() => new Set(visibleTreeIds), [visibleTreeIds]);

  // Toggle node collapse/expand
  const toggleNodeCollapse = useCallback((nodeId: string) => {
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Persist collapsed nodes to Firebase
  useEffect(() => {
    if (!db || !user.uid || !collapsedHydrated) return;
    const collapsedArray = Array.from(collapsedNodeIds).sort();
    const nextKey = collapsedArray.join("|");
    if (syncedCollapsedKeyRef.current === nextKey) return;
    setDoc(
      doc(db, "users", user.uid),
      {
        collapsedNodes: collapsedArray,
      },
      { merge: true }
    )
      .then(() => {
        syncedCollapsedKeyRef.current = nextKey;
      })
      .catch((err) => {
      console.error("Failed to save collapsed state:", err);
    });
  }, [collapsedHydrated, collapsedNodeIds, user.uid]);

  // Filter out descendants of collapsed nodes
  const filteredTreeIds = useMemo(() => {
    if (collapsedNodeIds.size === 0) return visibleTreeIds;

    const hiddenIds = new Set<string>();
    // For each collapsed node, collect all its descendants
    collapsedNodeIds.forEach((collapsedId) => {
      const descendants = collectDescendants(collapsedId, childrenByParent);
      descendants.forEach((id) => {
        if (id !== collapsedId) {
          hiddenIds.add(id);
        }
      });
    });

    // Return only nodes that are not hidden
    return visibleTreeIds.filter((id) => !hiddenIds.has(id));
  }, [childrenByParent, collapsedNodeIds, visibleTreeIds]);

  // Search matching nodes
  const searchMatchingIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();

    const query = searchQuery.toLowerCase().trim();
    const matches = new Set<string>();

    filteredTreeIds.forEach((id) => {
      const node = nodesById.get(id);
      if (node && node.title.toLowerCase().includes(query)) {
        matches.add(id);
      }
    });

    return matches;
  }, [filteredTreeIds, nodesById, searchQuery]);

  const currentRootKind = currentRootId ? nodesById.get(currentRootId)?.kind || null : null;

  const treeLayout = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    if (!currentRootId) return map;
    const filteredIdSet = new Set(filteredTreeIds);

    if (storyLaneMode && currentRootKind === "story") {
      map.set(currentRootId, { x: 0, y: 0 });

      const firstChildren = (childrenByParent.get(currentRootId) || []).filter((child) => filteredIdSet.has(child));
      const orderedChildren = [...firstChildren].sort((a, b) => {
        const aNode = nodesById.get(a);
        const bNode = nodesById.get(b);
        const ax = typeof aNode?.x === "number" ? aNode.x : Number.POSITIVE_INFINITY;
        const bx = typeof bNode?.x === "number" ? bNode.x : Number.POSITIVE_INFINITY;
        if (ax !== bx) return ax - bx;
        const ay = typeof aNode?.y === "number" ? aNode.y : Number.POSITIVE_INFINITY;
        const by = typeof bNode?.y === "number" ? bNode.y : Number.POSITIVE_INFINITY;
        if (ay !== by) return ay - by;
        return (aNode?.title || "").localeCompare(bNode?.title || "");
      });

      const laneXGap = 340;
      const laneY = 260;
      const branchXGap = 220;
      const branchYGap = 150;

      const placeBranch = (parentId: string, parentX: number, parentY: number) => {
        const isCollapsed = collapsedNodeIds.has(parentId);
        const children = isCollapsed
          ? []
          : (childrenByParent.get(parentId) || []).filter((child) => filteredIdSet.has(child));
        children.forEach((childId, index) => {
          const x = parentX + branchXGap;
          const y = parentY + branchYGap + index * branchYGap;
          if (!map.has(childId)) map.set(childId, { x, y });
          placeBranch(childId, x, y);
        });
      };

      orderedChildren.forEach((childId, index) => {
        const x = index * laneXGap;
        map.set(childId, { x, y: laneY });
        placeBranch(childId, x, laneY);
      });

      return map;
    }

    let nextRow = 0;
    const xGap = 280;
    const yGap = 140;

    const walk = (nodeId: string, depth: number): number => {
      // Don't traverse children of collapsed nodes
      const isCollapsed = collapsedNodeIds.has(nodeId);
      const children = isCollapsed
        ? []
        : (childrenByParent.get(nodeId) || []).filter((child) => filteredIdSet.has(child));
      if (children.length === 0) {
        const y = nextRow * yGap;
        nextRow += 1;
        map.set(nodeId, { x: depth * xGap, y });
        return y;
      }
      const ys = children.map((child) => walk(child, depth + 1));
      const y = ys.reduce((acc, value) => acc + value, 0) / ys.length;
      map.set(nodeId, { x: depth * xGap, y });
      return y;
    };

    walk(currentRootId, 0);
    return map;
  }, [childrenByParent, collapsedNodeIds, currentRootId, currentRootKind, filteredTreeIds, nodesById, storyLaneMode]);

  const resolveNodePosition = useCallback(
    (nodeId: string) => {
      const node = nodesById.get(nodeId);
      const autoPosition = treeLayout.get(nodeId) || { x: 0, y: 0 };
      return {
        x: typeof node?.x === "number" ? node.x : autoPosition.x,
        y: typeof node?.y === "number" ? node.y : autoPosition.y,
      };
    },
    [nodesById, treeLayout]
  );

  const toggleStoryCardExpand = useCallback((nodeId: string) => {
    setExpandedStoryNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const filteredTreeIdSet = useMemo(() => new Set(filteredTreeIds), [filteredTreeIds]);

  // Maps each visible nodeId → the CrossRefs it belongs to, for inline badge display.
  const nodeRefBadges = useMemo((): Map<string, CrossRef[]> => {
    const map = new Map<string, CrossRef[]>();
    for (const ref of refs) {
      const inView = ref.nodeIds.filter((id) => filteredTreeIdSet.has(id));
      if (inView.length === 0) continue;
      for (const nodeId of inView) {
        const existing = map.get(nodeId);
        if (existing) {
          existing.push(ref);
        } else {
          map.set(nodeId, [ref]);
        }
      }
    }
    map.forEach((badges) => badges.sort((a, b) => a.code.localeCompare(b.code)));
    return map;
  }, [refs, filteredTreeIdSet]);

  // visiblePortals is computed after baseNodes so it reads live drag positions.

  const baseTreeNodes = useMemo(() => {
    return filteredTreeIds
      .map((id) => nodesById.get(id))
      .filter((node): node is TreeNode => !!node)
      .map((node) => {
        const childIds = childrenByParent.get(node.id) || [];
        const childCount = childIds.length;
        const isCollapsed = collapsedNodeIds.has(node.id);
        const autoPosition = treeLayout.get(node.id) || { x: 0, y: 0 };
        const position = {
          x: typeof node.x === "number" ? node.x : autoPosition.x,
          y: typeof node.y === "number" ? node.y : autoPosition.y,
        };
        const isRoot = node.id === rootNodeId;
        const isSearchMatch = searchMatchingIds.has(node.id);
        const isProject = node.kind === "project";
        const isStory = node.kind === "story";
        const hasStoryChildren = !isStory && childIds.some((childId) => nodesById.get(childId)?.kind === "story");
        const isTaskTodo = node.taskStatus === "todo";
        const isTaskDone = node.taskStatus === "done";
        const isStoryLaneBeat = storyLaneMode && currentRootKind === "story" && node.id !== currentRootId;
        const showStoryBody = isStory || isStoryLaneBeat;
        const isExpandedStoryCard = expandedStoryNodeIds.has(node.id);
        const bodyText = (node.body || "").trim();
        // Colors chosen for maximum at-a-glance hierarchy readability.
        // Hue carries the type; luminance/saturation carries the importance.
        const baseBackground = isRoot
          ? "rgba(82, 52, 6, 0.97)"         // Root: rich amber-brown — the anchor
          : hasStoryChildren
            ? "rgba(58, 22, 108, 0.97)"     // Story container: deep violet — narrative hub
          : isProject
            ? "rgba(10, 26, 80, 0.97)"      // Project: saturated navy blue
          : isStory
            ? "rgba(6, 52, 42, 0.97)"       // Story: deep emerald green
            : "rgba(20, 22, 36, 0.97)";     // Item: near-black slate — the workhorse
        const background = node.color || baseBackground;
        return {
          id: node.id,
          position,
          data: {
            label: (
              <div className={`planner-node-card${showStoryBody ? " story" : ""}`}>
                <div className="planner-node-label">
                  {childCount > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleNodeCollapse(node.id);
                      }}
                      style={{
                        marginRight: "6px",
                        padding: "2px 6px",
                        border: "none",
                        background: "rgba(255, 255, 255, 0.1)",
                        color: "rgba(255, 255, 255, 0.8)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "10px",
                        fontWeight: 700,
                        transition: "background 150ms ease",
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLButtonElement).style.background = "rgba(255, 255, 255, 0.2)";
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.background = "rgba(255, 255, 255, 0.1)";
                      }}
                    >
                      {isCollapsed ? "▶" : "▼"}
                    </button>
                  )}
                  <span className={isTaskDone ? "planner-node-title done" : "planner-node-title"}>{node.title}</span>
                  {!isRoot ? <span className={`planner-kind-badge ${node.kind}`}>{node.kind}</span> : null}
                  {!isRoot && (isTaskTodo || isTaskDone) ? (
                    <span className={`planner-task-badge ${isTaskDone ? "done" : "todo"}`}>
                      {isTaskDone ? "Done" : "Task"}
                    </span>
                  ) : null}
                  {childCount > 0 ? <span className="planner-node-count">{childCount}</span> : null}
                </div>
                {showStoryBody ? (
                  <>
                    <div className={`planner-node-body-preview ${isExpandedStoryCard ? "expanded" : ""}`}>
                      {bodyText || "No body text yet. Select this node and add text in the Body panel."}
                    </div>
                    <button
                      className="planner-story-card-expand"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleStoryCardExpand(node.id);
                      }}
                      type="button"
                    >
                      {isExpandedStoryCard ? "Collapse text" : "Expand text"}
                    </button>
                  </>
                ) : null}
              </div>
            ),
          },
          style: {
            border: isSearchMatch
              ? "2px solid rgba(34, 197, 94, 0.95)"
              : isRoot
                ? "2px solid rgba(255, 200, 60, 0.95)"    // bright gold — highest emphasis
                : hasStoryChildren
                  ? "1.5px solid rgba(192, 132, 252, 0.85)" // bright violet — narrative container
                : isProject
                  ? "1.5px solid rgba(99, 179, 255, 0.8)"   // sky blue — project level
                : isStory
                  ? "1.5px solid rgba(52, 211, 153, 0.8)"   // bright emerald — story
                : "1px solid rgba(100, 106, 140, 0.5)",     // muted slate — item
            borderRadius: isStoryLaneBeat ? 10 : 14,
            // Slightly wider nodes on mobile to accommodate bigger font without wrapping.
            width: isStoryLaneBeat ? 300 : showStoryBody ? (isMobileLayout ? 300 : 280) : (isMobileLayout ? 280 : 260),
            minHeight: showStoryBody ? (isExpandedStoryCard ? 280 : 190) : undefined,
            padding: showStoryBody ? 12 : (isMobileLayout ? 12 : 10),
            background,
            color: "rgba(250, 252, 255, 0.95)",
            boxShadow: isSearchMatch
              ? "0 0 0 3px rgba(34, 197, 94, 0.35), 0 12px 28px rgba(0,0,0,0.4)"
              : isRoot
                ? "0 0 0 1px rgba(255,200,60,0.15), 0 14px 32px rgba(0,0,0,0.5)"
                : hasStoryChildren
                  ? "0 0 0 1px rgba(192,132,252,0.12), 0 12px 28px rgba(0,0,0,0.45)"
                : isProject
                  ? "0 0 0 1px rgba(99,179,255,0.1), 0 10px 24px rgba(0,0,0,0.4)"
                : isStory
                  ? "0 0 0 1px rgba(52,211,153,0.1), 0 10px 22px rgba(0,0,0,0.4)"
                : "0 6px 16px rgba(0,0,0,0.35)",
            fontWeight: 700,
            fontSize: isMobileLayout ? 14 : 12.5,
          } as React.CSSProperties,
          draggable: true,
          selectable: true,
        } as Node;
      });
  }, [
    childrenByParent,
    collapsedNodeIds,
    currentRootId,
    currentRootKind,
    expandedStoryNodeIds,
    filteredTreeIds,
    isMobileLayout,
    nodesById,
    rootNodeId,
    searchMatchingIds,
    storyLaneMode,
    toggleNodeCollapse,
    toggleStoryCardExpand,
    treeLayout,
  ]);

  const baseTreeEdges = useMemo(() => {
    const filteredIdSet = new Set(filteredTreeIds);
    return filteredTreeIds
      .map((id) => nodesById.get(id))
      .filter((node): node is TreeNode => !!node && !!node.parentId && filteredIdSet.has(node.parentId))
      .map((node) => {
        return {
          id: `edge:${node.parentId}:${node.id}`,
          source: node.parentId as string,
          target: node.id,
          style: {
            stroke: "rgba(125, 211, 252, 0.45)",
            strokeWidth: 2,
          },
          animated: false,
        } as Edge;
      });
  }, [filteredTreeIds, nodesById]);

  // Dashed orange edges: one short line per (ref × visible linked node)
  const basePortalEdges = useMemo((): Edge[] => {
    const edges: Edge[] = [];
    for (const ref of refs) {
      for (const nodeId of ref.nodeIds) {
        if (!filteredTreeIdSet.has(nodeId)) continue;
        edges.push({
          id: `portal-edge:${ref.id}:${nodeId}`,
          source: nodeId,
          target: `portal:${ref.id}:${nodeId}`,
          animated: false,
          zIndex: 5,
          style: {
            stroke: "rgba(255,160,71,0.6)",
            strokeWidth: 1.5,
            strokeDasharray: "4 4",
          },
        } as Edge);
      }
    }
    return edges;
  }, [refs, filteredTreeIdSet]);

  // Memoized so hoverIndex (which depends on baseEdges) gets a stable reference
  // and doesn't recreate itself on every render, preventing the infinite loop:
  // baseEdges → hoverIndex → hoverNodeIds/hoverEdgeIds → flowNodes → render → repeat
  const baseEdges = useMemo(
    () => [...baseTreeEdges, ...basePortalEdges],
    [baseTreeEdges, basePortalEdges]
  );

  const hoverIndex = useMemo(() => {
    const nodeToEdges = new Map<string, Set<string>>();
    const nodeToNeighbors = new Map<string, Set<string>>();
    const edgeToNodes = new Map<string, { source: string; target: string }>();
    baseEdges.forEach((edge) => {
      edgeToNodes.set(edge.id, { source: edge.source, target: edge.target });
      if (!nodeToEdges.has(edge.source)) nodeToEdges.set(edge.source, new Set());
      if (!nodeToEdges.has(edge.target)) nodeToEdges.set(edge.target, new Set());
      nodeToEdges.get(edge.source)?.add(edge.id);
      nodeToEdges.get(edge.target)?.add(edge.id);
      if (!nodeToNeighbors.has(edge.source)) nodeToNeighbors.set(edge.source, new Set());
      if (!nodeToNeighbors.has(edge.target)) nodeToNeighbors.set(edge.target, new Set());
      nodeToNeighbors.get(edge.source)?.add(edge.target);
      nodeToNeighbors.get(edge.target)?.add(edge.source);
    });
    return { nodeToEdges, nodeToNeighbors, edgeToNodes };
  }, [baseEdges]);

  const hoverNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (hoveredNodeId) {
      ids.add(hoveredNodeId);
      hoverIndex.nodeToNeighbors.get(hoveredNodeId)?.forEach((id) => ids.add(id));
    }
    if (hoveredEdgeId) {
      const edge = hoverIndex.edgeToNodes.get(hoveredEdgeId);
      if (edge) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
    }
    return ids;
  }, [hoverIndex, hoveredEdgeId, hoveredNodeId]);

  const hoverEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    if (hoveredEdgeId) ids.add(hoveredEdgeId);
    if (hoveredNodeId) {
      hoverIndex.nodeToEdges.get(hoveredNodeId)?.forEach((id) => ids.add(id));
    }
    return ids;
  }, [hoverIndex, hoveredEdgeId, hoveredNodeId]);

  const activeLinkedNodeIds = useMemo(() => {
    if (!activePortalRefId) return new Set<string>();
    const activeRef = refs.find((ref) => ref.id === activePortalRefId);
    return new Set(activeRef?.nodeIds || []);
  }, [activePortalRefId, refs]);

  // Tree nodes only — portals are injected separately at render time so their
  // positions can track displayNodes live (during drag) without going through
  // the flowNodes → displayNodes pipeline (which would lag one render behind).
  // ── ventovault-map pattern ─────────────────────────────────────────────────
  // baseNodes is the single source of truth for tree node positions.
  // onNodesChange (RAF-batched) writes directly into baseNodes via applyNodeChanges.
  // Portal positions are derived from baseNodes in a useMemo — no intermediate
  // displayNodes state, no competing useEffect, no flashing.
  const [baseNodes, setBaseNodes] = useState<Node[]>([]);
  const draggedNodeIdRef   = useRef<string | null>(null);
  const nodesChangeRafRef  = useRef<number | null>(null);
  const pendingNodeChangesRef = useRef<Parameters<OnNodesChange>[0] | null>(null);

  // baseTreeNodes → baseNodes: sync styles/metadata whenever the Firestore-derived
  // tree changes (node added/removed/renamed) but ONLY update positions for nodes
  // that are NOT currently being dragged (ReactFlow owns their position during drag).
  useEffect(() => {
    setBaseNodes((prev) => {
      if (prev.length === 0) return baseTreeNodes;
      // Build a live-position map from current baseNodes (what ReactFlow sees).
      const livePos = new Map(prev.map((n) => [n.id, n.position] as const));
      return baseTreeNodes.map((node) => {
        const live = livePos.get(node.id);
        // Keep the live position if we have one (preserves drag in progress);
        // fall back to the Firestore position for newly-added nodes.
        return live ? ({ ...node, position: live } as Node) : node;
      });
    });
  }, [baseTreeNodes]);

  // Batch onNodesChange events through RAF — identical to ventovault-map.
  // Portals are stripped here because they are derived nodes not in baseNodes.
  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    const treeChanges = changes.filter((c) => !c.id.startsWith("portal:"));
    if (treeChanges.length === 0) return;
    pendingNodeChangesRef.current = [
      ...(pendingNodeChangesRef.current ?? []),
      ...treeChanges,
    ];
    if (nodesChangeRafRef.current !== null) return;
    nodesChangeRafRef.current = window.requestAnimationFrame(() => {
      const pending = pendingNodeChangesRef.current;
      pendingNodeChangesRef.current = null;
      nodesChangeRafRef.current = null;
      if (pending && pending.length > 0) {
        setBaseNodes((nds) => applyNodeChanges(pending, nds));
      }
    });
  }, []);

  // Styled tree nodes — positions come from baseNodes (live), styles from state flags.
  const flowNodes = useMemo(() => {
    return baseNodes.map((node) => {
      const isSelected = selectedNodeId === node.id;
      const isActivePortalTarget = activeLinkedNodeIds.has(node.id);
      const isHoverRelated = hoverNodeIds.has(node.id);
      const isDropTarget = node.id === dropTargetNodeId;
      return {
        ...node,
        className: isDropTarget ? "drop-target-hover" : undefined,
        style: {
          ...(node.style || {}),
          border: isSelected
            ? "2px solid rgba(253, 224, 71, 0.95)"
            : isDropTarget
              ? "2px solid rgba(52, 211, 153, 0.95)"
            : isActivePortalTarget
              ? "2px solid rgba(251, 146, 60, 0.85)"
            : (node.style as React.CSSProperties)?.border,
          boxShadow: isSelected
            ? "0 0 0 3px rgba(253, 224, 71, 0.18), 0 14px 32px rgba(0,0,0,0.45)"
            : isDropTarget
              ? "0 0 0 4px rgba(52, 211, 153, 0.28), 0 14px 32px rgba(0,0,0,0.5)"
            : isActivePortalTarget
              ? "0 0 0 2px rgba(251,146,60,0.2), 0 14px 30px rgba(0,0,0,0.42)"
            : isHoverRelated
              ? "0 0 0 2px rgba(125,211,252,0.22), 0 14px 30px rgba(0,0,0,0.42)"
              : (node.style as React.CSSProperties)?.boxShadow,
          opacity: hoveredNodeId || hoveredEdgeId ? (isHoverRelated ? 1 : 0.4) : 1,
          transition: "opacity 180ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1), border-color 180ms cubic-bezier(0.4, 0, 0.2, 1)",
        },
      } as Node;
    });
  }, [activeLinkedNodeIds, baseNodes, dropTargetNodeId, hoverNodeIds, hoveredEdgeId, hoveredNodeId, selectedNodeId]);

  const flowEdges = useMemo(() => {
    return baseEdges.map((edge) => {
      const isHoverRelated = hoverEdgeIds.has(edge.id);
      const edgeStyle = (edge.style || {}) as React.CSSProperties;
      const baseStroke = (edgeStyle.stroke as string | undefined) || "rgba(125, 211, 252, 0.45)";
      const baseWidth = typeof edgeStyle.strokeWidth === "number" ? edgeStyle.strokeWidth : 2;
      return {
        ...edge,
        style: {
          ...edgeStyle,
          stroke: isHoverRelated ? "rgba(255, 255, 255, 0.9)" : baseStroke,
          strokeWidth: isHoverRelated ? Math.max(baseWidth, 3) : baseWidth,
          opacity: hoveredNodeId || hoveredEdgeId ? (isHoverRelated ? 1 : 0.35) : 1,
          transition: "opacity 180ms cubic-bezier(0.4, 0, 0.2, 1), stroke 180ms cubic-bezier(0.4, 0, 0.2, 1), stroke-width 180ms cubic-bezier(0.4, 0, 0.2, 1)",
        },
      } as Edge;
    });
  }, [baseEdges, hoverEdgeIds, hoveredEdgeId, hoveredNodeId]);

  // ── Portal bubble nodes ────────────────────────────────────────────────────
  // Derived directly from baseNodes (live positions) — identical to how
  // ventovault-map derives portalNodes from baseNodes. No intermediate map needed.
  const visiblePortals = useMemo((): Node[] => {
    const PORTAL_SIZE = isMobileLayout ? 48 : 40;
    const PORTAL_GAP  = isMobileLayout ? 56 : 46;
    const NODE_WIDTH  = isMobileLayout ? 280 : 260;
    const OFFSET_Y    = isMobileLayout ? -62 : -52;

    // Build map: nodeId → sorted refs that link to it
    const refsByNode = new Map<string, CrossRef[]>();
    for (const ref of refs) {
      for (const nodeId of ref.nodeIds) {
        if (!filteredTreeIdSet.has(nodeId)) continue;
        if (!refsByNode.has(nodeId)) refsByNode.set(nodeId, []);
        refsByNode.get(nodeId)!.push(ref);
      }
    }
    refsByNode.forEach((nodeRefs) => nodeRefs.sort((a, b) => a.code.localeCompare(b.code)));

    // Build a position map from baseNodes (live drag positions).
    // Falls back to resolveNodePosition for nodes not yet in baseNodes.
    const livePos = new Map(baseNodes.map((n) => [n.id, n.position] as const));

    const result: Node[] = [];
    refsByNode.forEach((nodeRefs, nodeId) => {
      const pos = livePos.get(nodeId) ?? resolveNodePosition(nodeId);
      const totalWidth = nodeRefs.length * PORTAL_SIZE + (nodeRefs.length - 1) * (PORTAL_GAP - PORTAL_SIZE);
      const startX = pos.x + NODE_WIDTH / 2 - totalWidth / 2;

      nodeRefs.forEach((ref, idx) => {
        const x = startX + idx * PORTAL_GAP;
        const y = pos.y + OFFSET_Y;
        const linkedTitles = ref.nodeIds
          .map((nid) => nodesById.get(nid)?.title)
          .filter(Boolean)
          .join(" · ");
        const tooltip = linkedTitles ? `${ref.label}\n${linkedTitles}` : ref.label;

        result.push({
          id: `portal:${ref.id}:${nodeId}`,
          position: { x, y },
          type: "portal",
          data: {
            code: ref.code,
            tooltip,
            count: ref.nodeIds.length,
            isActive: false,
            onToggle: () => {},
            onContextMenu: () => {},
          },
          draggable: false,
          selectable: false,
          zIndex: 10,
          style: {
            width: PORTAL_SIZE,
            height: PORTAL_SIZE,
            borderRadius: 999,
            background: "transparent",
            border: "none",
            padding: 0,
          },
        } as Node);
      });
    });
    return result;
  }, [refs, filteredTreeIdSet, baseNodes, resolveNodePosition, nodesById, isMobileLayout]);

  // Inject active state and callbacks — kept separate so toggling activePortalRefId
  // doesn't re-run the position computation above.
  const livePortalNodes = useMemo((): Node[] => {
    return visiblePortals.map((pNode) => {
      const parts = pNode.id.split(":");
      const refId = parts[1];
      const isActive = activePortalRefId === refId;
      return {
        ...pNode,
        data: {
          ...pNode.data,
          isActive,
          onToggle: () => setActivePortalRefId((prev) => prev === refId ? null : refId),
          onContextMenu: (e: React.MouseEvent) => {
            e.preventDefault();
            setPortalContextMenu({ x: e.clientX, y: e.clientY, refId });
          },
        },
      } as Node;
    });
  }, [visiblePortals, activePortalRefId]);

  // Final node array — styled tree nodes + portal orbs (ventovault-map: viewNodes).
  const reactFlowNodes = useMemo(
    () => [...flowNodes, ...livePortalNodes],
    [flowNodes, livePortalNodes]
  );

  // Save warning helper (successful autosaves are silent).
  const showSaveError = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus("error");
    saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Double-click to zoom (less aggressive)
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!rfInstance) return;
      rfInstance.fitView({
        nodes: [node],
        duration: 250,
        padding: 0.8,
        maxZoom: 1.2,
      });
    },
    [rfInstance]
  );

  const currentRootNode = useMemo(
    () => (currentRootId ? nodesById.get(currentRootId) || null : null),
    [currentRootId, nodesById]
  );

  const currentRootPath = useMemo(
    () => (currentRootId ? buildNodePath(currentRootId, nodesById) : ""),
    [currentRootId, nodesById]
  );

  const selectedNodeChildren = useMemo(() => {
    if (!selectedNodeId) return [] as TreeNode[];
    return (childrenByParent.get(selectedNodeId) || [])
      .map((id) => nodesById.get(id))
      .filter((node): node is TreeNode => !!node);
  }, [childrenByParent, nodesById, selectedNodeId]);

  const selectedNodeHasStoryChildren = useMemo(() => {
    if (!selectedNodeId) return false;
    return (childrenByParent.get(selectedNodeId) || []).some((childId) => nodesById.get(childId)?.kind === "story");
  }, [childrenByParent, nodesById, selectedNodeId]);

  const selectedNodeRefs = useMemo(() => {
    if (!selectedNodeId) return [] as CrossRef[];
    return refs.filter((ref) => ref.nodeIds.includes(selectedNodeId));
  }, [refs, selectedNodeId]);

  const selectedNodeRefIds = useMemo(() => new Set(selectedNodeRefs.map((ref) => ref.id)), [selectedNodeRefs]);

  const refTargetPathsById = useMemo(() => {
    const map = new Map<string, string[]>();
    refs.forEach((ref) => {
      const paths = ref.nodeIds
        .map((id) => (nodesById.has(id) ? buildNodePath(id, nodesById) : null))
        .filter((path): path is string => !!path)
        .sort((a, b) => a.localeCompare(b));
      map.set(ref.id, paths);
    });
    return map;
  }, [nodesById, refs]);

  const describeRefTargets = useCallback(
    (ref: CrossRef, limit = 2) => {
      const paths = refTargetPathsById.get(ref.id) || [];
      if (paths.length === 0) return "Unlinked";
      const preview = paths.slice(0, limit).join(" | ");
      const remaining = paths.length - limit;
      return remaining > 0 ? `${preview} +${remaining} more` : preview;
    },
    [refTargetPathsById]
  );

  const describeRefLibraryPreview = useCallback((ref: CrossRef) => {
    const tagPreview = ref.tags.length > 0 ? ` · ${ref.tags.slice(0, 2).join(", ")}` : "";
    const linkPreview = ref.nodeIds.length === 0 ? "unlinked" : `${ref.nodeIds.length} link${ref.nodeIds.length === 1 ? "" : "s"}`;
    return `${ref.entityType}${tagPreview} · ${linkPreview}`;
  }, []);

  const filteredRefs = useMemo(() => {
    const queryText = refSearchQuery.trim().toLowerCase();
    const scopedRefs =
      refScopeFilter === "view" ? refs.filter((ref) => ref.nodeIds.some((nodeId) => visibleTreeIdSet.has(nodeId))) : refs;
    return scopedRefs.filter((ref) => {
      const categoryMatch =
        refCategoryFilter === "all"
          ? true
          : refCategoryFilter === "people"
            ? isPeopleEntityType(ref.entityType)
            : !isPeopleEntityType(ref.entityType);
      if (!categoryMatch) return false;
      if (!queryText) return true;
      return `${ref.code} ${ref.label} ${ref.entityType} ${ref.tags.join(" ")} ${ref.notes} ${ref.contact} ${ref.links.join(" ")}`
        .toLowerCase()
        .includes(queryText);
    });
  }, [refCategoryFilter, refScopeFilter, refSearchQuery, refs, visibleTreeIdSet]);

  const newRefSuggestions = useMemo(() => {
    if (!selectedNodeId) return [] as CrossRef[];
    const labelQuery = newRefLabel.trim().toLowerCase();
    const codeQuery = normalizeCode(newRefCode.trim());
    if (!labelQuery && !newRefCode.trim()) return [] as CrossRef[];
    return refs
      .filter((ref) => !ref.nodeIds.includes(selectedNodeId))
      .filter((ref) => {
        const labelMatches = labelQuery ? ref.label.toLowerCase().includes(labelQuery) : false;
        const codeMatches = newRefCode.trim().length > 0 ? ref.code.includes(codeQuery) : false;
        return labelMatches || codeMatches;
      })
      .slice(0, 6);
  }, [newRefCode, newRefLabel, refs, selectedNodeId]);

  const editableRef = useMemo(() => {
    if (!editRefId) return null;
    return refs.find((ref) => ref.id === editRefId) || null;
  }, [editRefId, refs]);

  const editedRefLinkedOnSelected = useMemo(() => {
    if (!editableRef || !selectedNodeId) return false;
    return editableRef.nodeIds.includes(selectedNodeId);
  }, [editableRef, selectedNodeId]);

  const editableRefTargets = useMemo(() => {
    if (!editableRef) return [] as Array<{ id: string; path: string }>;
    return editableRef.nodeIds
      .map((id) => {
        if (!nodesById.has(id)) return null;
        return { id, path: buildNodePath(id, nodesById) };
      })
      .filter((entry): entry is { id: string; path: string } => !!entry)
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [editableRef, nodesById]);

  const linkableNodeOptions = useMemo(() => {
    if (!editableRef) return [] as Array<{ id: string; path: string }>;
    const linkedIds = new Set(editableRef.nodeIds);
    const queryText = linkNodeQuery.trim().toLowerCase();
    const options = nodes
      .filter((node) => !linkedIds.has(node.id))
      .map((node) => ({
        id: node.id,
        path: buildNodePath(node.id, nodesById),
      }));
    const filtered = queryText
      ? options.filter((entry) => entry.path.toLowerCase().includes(queryText) || entry.id.toLowerCase().includes(queryText))
      : options;
    return filtered.sort((a, b) => a.path.localeCompare(b.path)).slice(0, 120);
  }, [editableRef, linkNodeQuery, nodes, nodesById]);

  const activePortalRef = useMemo(() => {
    if (!activePortalRefId) return null;
    return refs.find((ref) => ref.id === activePortalRefId) || null;
  }, [activePortalRefId, refs]);

  const activePortalTargets = useMemo(() => {
    if (!activePortalRef) return [] as TreeNode[];
    return activePortalRef.nodeIds
      .map((id) => nodesById.get(id))
      .filter((node): node is TreeNode => !!node)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [activePortalRef, nodesById]);

  const recentEntityRefs = useMemo(() => {
    return [...refs].sort((a, b) => b.updatedAtMs - a.updatedAtMs).slice(0, 6);
  }, [refs]);

  const mergeCandidateRefs = useMemo(() => {
    if (!editRefId) return [] as CrossRef[];
    const current = refs.find((ref) => ref.id === editRefId);
    if (!current) return [] as CrossRef[];
    return refs
      .filter((ref) => ref.id !== current.id)
      .filter((ref) => {
        const sameCode = ref.code === current.code;
        const sameLabel = ref.label.trim().toLowerCase() === current.label.trim().toLowerCase();
        const codeContains = ref.code.includes(current.code) || current.code.includes(ref.code);
        const labelContains =
          ref.label.toLowerCase().includes(current.label.toLowerCase()) ||
          current.label.toLowerCase().includes(ref.label.toLowerCase());
        return sameCode || sameLabel || codeContains || labelContains;
      })
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
      .slice(0, 12);
  }, [editRefId, refs]);

  const hydrateRefEditor = useCallback((ref: CrossRef | null) => {
    if (!ref) {
      setEditRefId("");
      setEditRefLabel("");
      setEditRefCode("");
      setEditRefType("entity");
      setEditRefTags("");
      setEditRefNotes("");
      setEditRefContact("");
      setEditRefLinks("");
      setMergeFromRefId("");
      return;
    }
    setEditRefId(ref.id);
    setEditRefLabel(ref.label);
    setEditRefCode(ref.code);
    setEditRefType(ref.entityType);
    setEditRefTags(ref.tags.join(", "));
    setEditRefNotes(ref.notes);
    setEditRefContact(ref.contact);
    setEditRefLinks(ref.links.join("\n"));
    setMergeFromRefId("");
  }, []);

  const buildDefaultPortalPosition = useCallback(
    (anchorNodeId: string | null, seed: string) => {
      if (!anchorNodeId) return null;
      return defaultPortalPositionForAnchor(resolveNodePosition(anchorNodeId), `${seed}:${anchorNodeId}`);
    },
    [resolveNodePosition]
  );

  const goGrandmotherView = useCallback(() => {
    if (!rootNodeId) return;
    setCurrentRootId(rootNodeId);
    setStoryLaneMode(false);
    setActivePortalRefId(null);
  }, [rootNodeId]);

  const goUpOneView = useCallback(() => {
    if (!currentRootNode?.parentId) return;
    setCurrentRootId(currentRootNode.parentId);
    setStoryLaneMode(false);
    setActivePortalRefId(null);
  }, [currentRootNode?.parentId]);

  const openSelectedAsMaster = useCallback(() => {
    if (!selectedNodeId) return;
    setCurrentRootId(selectedNodeId);
    setStoryLaneMode(false);
    setActivePortalRefId(null);
  }, [selectedNodeId]);

  const openSelectedAsStoryLane = useCallback(() => {
    if (!selectedNodeId) return;
    const selected = nodesById.get(selectedNodeId);
    if (!selected || selected.kind !== "story") return;
    setCurrentRootId(selectedNodeId);
    setStoryLaneMode(true);
    setActivePortalRefId(null);
  }, [nodesById, selectedNodeId]);

  const saveNodeBody = useCallback(
    async (nodeId: string, nextBody: string) => {
      if (!db) return;
      const previousBody = nodesById.get(nodeId)?.body || "";
      const normalizedBody = nextBody.trim();
      if (normalizedBody === previousBody) return;
      pushHistory({
        id: crypto.randomUUID(),
        label: `Edit body`,
        forwardLocal:    [{ target: "nodes", op: "patch", nodeId, patch: { body: normalizedBody } }],
        forwardFirestore:[{ kind: "updateNode", nodeId, data: { body: normalizedBody || firestoreDeleteField() } }],
        inverseLocal:    [{ target: "nodes", op: "patch", nodeId, patch: { body: previousBody } }],
        inverseFirestore:[{ kind: "updateNode", nodeId, data: { body: previousBody || firestoreDeleteField() } }],
      });
      setBusyAction(true);
      setError(null);
      applyLocalNodePatch(nodeId, { body: normalizedBody });
      try {
        await updateDoc(doc(db, "users", user.uid, "nodes", nodeId), {
          body: normalizedBody ? normalizedBody : deleteField(),
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        applyLocalNodePatch(nodeId, { body: previousBody });
        setError(actionError instanceof Error ? actionError.message : "Could not save node body text.");
      } finally {
        setBusyAction(false);
      }
    },
    [applyLocalNodePatch, nodesById, pushHistory, user.uid]
  );

  const saveSelectedBody = useCallback(async () => {
    if (!selectedNodeId) return;
    await saveNodeBody(selectedNodeId, bodyDraft);
  }, [bodyDraft, saveNodeBody, selectedNodeId]);

  const createChild = useCallback(async () => {
    if (!db) return;
    const title = newChildTitle.trim() || "New Node";
    const parentId = selectedNodeId || currentRootId || rootNodeId;
    if (!parentId) return;
    const newId = newNodeDocId();
    const parentPosition = resolveNodePosition(parentId);
    const siblingCount = (childrenByParent.get(parentId) || []).length;
    const nodeData: TreeNodeDoc = {
      title,
      parentId,
      kind: "item",
      x: parentPosition.x + 280,
      y: parentPosition.y + 20 + siblingCount * 96,
    };
    pushHistory({
      id: crypto.randomUUID(),
      label: `Create "${title}"`,
      forwardLocal:    [{ target: "nodes", op: "add", node: { ...nodeData, id: newId } }],
      forwardFirestore:[{ kind: "setNode", nodeId: newId, data: nodeData }],
      inverseLocal:    [{ target: "nodes", op: "remove", nodeIds: [newId] }],
      inverseFirestore:[{ kind: "deleteNode", nodeId: newId }],
    });
    setBusyAction(true);
    setError(null);
    try {
      await setDoc(doc(db, "users", user.uid, "nodes", newId), {
        ...nodeData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } satisfies TreeNodeDoc & { createdAt: unknown; updatedAt: unknown });
      setNewChildTitle("");
      setPendingSelectedNodeId(newId);
      setPendingRenameNodeId(newId);
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not create node.");
    } finally {
      setBusyAction(false);
    }
  }, [childrenByParent, currentRootId, newChildTitle, newNodeDocId, pushHistory, resolveNodePosition, rootNodeId, selectedNodeId, user.uid]);

  const renameSelected = useCallback(async () => {
    if (!db || !selectedNodeId) return;
    const title = renameTitle.trim();
    const currentTitle = nodesById.get(selectedNodeId)?.title || "";
    if (!title) {
      setRenameTitle(currentTitle);
      return;
    }
    if (title === currentTitle) return;
    pushHistory({
      id: crypto.randomUUID(),
      label: `Rename "${currentTitle}"`,
      forwardLocal:    [{ target: "nodes", op: "patch", nodeId: selectedNodeId, patch: { title } }],
      forwardFirestore:[{ kind: "updateNode", nodeId: selectedNodeId, data: { title } }],
      inverseLocal:    [{ target: "nodes", op: "patch", nodeId: selectedNodeId, patch: { title: currentTitle } }],
      inverseFirestore:[{ kind: "updateNode", nodeId: selectedNodeId, data: { title: currentTitle } }],
    });
    applyLocalNodePatch(selectedNodeId, { title });
    setBusyAction(true);
    setError(null);
    try {
      await updateDoc(doc(db, "users", user.uid, "nodes", selectedNodeId), {
        title,
        updatedAt: serverTimestamp(),
      });
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not rename node.");
    } finally {
      setBusyAction(false);
    }
  }, [applyLocalNodePatch, nodesById, pushHistory, renameTitle, selectedNodeId, user.uid]);

  const setNodeTaskStatus = useCallback(
    async (nodeId: string, taskStatus: TaskStatus) => {
      if (!db) return;
      const previousTaskStatus = nodesById.get(nodeId)?.taskStatus || "none";
      pushHistory({
        id: crypto.randomUUID(),
        label: `Set task status "${taskStatus}"`,
        forwardLocal:    [{ target: "nodes", op: "patch", nodeId, patch: { taskStatus } }],
        forwardFirestore:[{ kind: "updateNode", nodeId, data: { taskStatus: taskStatus === "none" ? firestoreDeleteField() : taskStatus } }],
        inverseLocal:    [{ target: "nodes", op: "patch", nodeId, patch: { taskStatus: previousTaskStatus } }],
        inverseFirestore:[{ kind: "updateNode", nodeId, data: { taskStatus: previousTaskStatus === "none" ? firestoreDeleteField() : previousTaskStatus } }],
      });
      setBusyAction(true);
      setError(null);
      applyLocalNodePatch(nodeId, { taskStatus });
      try {
        await updateDoc(doc(db, "users", user.uid, "nodes", nodeId), {
          taskStatus: taskStatus === "none" ? deleteField() : taskStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        applyLocalNodePatch(nodeId, { taskStatus: previousTaskStatus });
        setError(actionError instanceof Error ? actionError.message : "Could not update task status.");
      } finally {
        setBusyAction(false);
      }
    },
    [applyLocalNodePatch, nodesById, pushHistory, user.uid]
  );

  const saveStorySteps = useCallback(
    async (nodeId: string, storySteps: StoryStep[]) => {
      if (!db) return;
      const previousStorySteps = nodesById.get(nodeId)?.storySteps || [];
      setBusyAction(true);
      setError(null);
      applyLocalNodePatch(nodeId, { storySteps });
      try {
        await updateDoc(doc(db, "users", user.uid, "nodes", nodeId), {
          storySteps: storySteps.length > 0 ? storySteps : deleteField(),
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        applyLocalNodePatch(nodeId, { storySteps: previousStorySteps });
        setError(actionError instanceof Error ? actionError.message : "Could not save story steps.");
      } finally {
        setBusyAction(false);
      }
    },
    [applyLocalNodePatch, nodesById, user.uid]
  );

  const addStoryStep = useCallback(async () => {
    if (!selectedNode || selectedNode.kind !== "story") return;
    const text = newStoryStepText.trim();
    if (!text) return;
    const nextSteps = [...(selectedNode.storySteps || []), createStoryStep(text)];
    await saveStorySteps(selectedNode.id, nextSteps);
    setNewStoryStepText("");
  }, [newStoryStepText, saveStorySteps, selectedNode]);

  const toggleStoryStepDone = useCallback(
    async (stepId: string) => {
      if (!selectedNode || selectedNode.kind !== "story") return;
      const nextSteps = (selectedNode.storySteps || []).map((step) =>
        step.id === stepId ? { ...step, done: !step.done } : step
      );
      await saveStorySteps(selectedNode.id, nextSteps);
    },
    [saveStorySteps, selectedNode]
  );

  const deleteStoryStep = useCallback(
    async (stepId: string) => {
      if (!selectedNode || selectedNode.kind !== "story") return;
      const nextSteps = (selectedNode.storySteps || []).filter((step) => step.id !== stepId);
      await saveStorySteps(selectedNode.id, nextSteps);
    },
    [saveStorySteps, selectedNode]
  );

  const moveStoryStep = useCallback(
    async (stepId: string, direction: -1 | 1) => {
      if (!selectedNode || selectedNode.kind !== "story") return;
      const current = [...(selectedNode.storySteps || [])];
      const index = current.findIndex((step) => step.id === stepId);
      if (index < 0) return;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return;
      const [moved] = current.splice(index, 1);
      current.splice(targetIndex, 0, moved);
      await saveStorySteps(selectedNode.id, current);
    },
    [saveStorySteps, selectedNode]
  );

  const setNodeColor = useCallback(
    async (nodeId: string, color: string | undefined) => {
      if (!db) return;
      const normalized = normalizeHexColor(color);
      const previousColor = nodesById.get(nodeId)?.color;
      pushHistory({
        id: crypto.randomUUID(),
        label: normalized ? `Set color "${normalized}"` : `Clear color`,
        forwardLocal:    [{ target: "nodes", op: "patch", nodeId, patch: { color: normalized } }],
        forwardFirestore:[{ kind: "updateNode", nodeId, data: { color: normalized ?? firestoreDeleteField() } }],
        inverseLocal:    [{ target: "nodes", op: "patch", nodeId, patch: { color: previousColor } }],
        inverseFirestore:[{ kind: "updateNode", nodeId, data: { color: previousColor ?? firestoreDeleteField() } }],
      });
      setBusyAction(true);
      setError(null);
      applyLocalNodePatch(nodeId, { color: normalized });
      try {
        await updateDoc(doc(db, "users", user.uid, "nodes", nodeId), {
          color: normalized ?? deleteField(),
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        applyLocalNodePatch(nodeId, { color: previousColor });
        setError(actionError instanceof Error ? actionError.message : "Could not update node color.");
      } finally {
        setBusyAction(false);
      }
    },
    [applyLocalNodePatch, nodesById, pushHistory, user.uid]
  );

  const organizeVisibleTree = useCallback(async () => {
    if (!db || filteredTreeIds.length === 0) return;
    const plannedPositions = filteredTreeIds
      .map((id) => {
        const position = treeLayout.get(id);
        if (!position) return null;
        return { id, position };
      })
      .filter((entry): entry is { id: string; position: { x: number; y: number } } => !!entry);

    if (plannedPositions.length === 0) return;

    const nextPositions = new Map(plannedPositions.map((entry) => [entry.id, entry.position] as const));
    setBusyAction(true);
    setError(null);
    setNodes((prevNodes) =>
      prevNodes.map((entry) => {
        const next = nextPositions.get(entry.id);
        if (!next) return entry;
        return { ...entry, x: next.x, y: next.y };
      })
    );

    try {
      let batch = writeBatch(db);
      let operations = 0;
      for (const entry of plannedPositions) {
        batch.update(doc(db, "users", user.uid, "nodes", entry.id), {
          x: entry.position.x,
          y: entry.position.y,
          updatedAt: serverTimestamp(),
        });
        operations += 1;
        if (operations >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          operations = 0;
        }
      }
      if (operations > 0) {
        await batch.commit();
      }
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not organize node layout.");
    } finally {
      setBusyAction(false);
    }
  }, [filteredTreeIds, treeLayout, user.uid]);

  const cleanUpCrossRefs = useCallback(async () => {
    if (!db) return;
    const operations = refs
      .map((ref) => {
        const cleanedNodeIds = Array.from(new Set(ref.nodeIds.filter((id) => nodesById.has(id))));
        if (cleanedNodeIds.length === 0) {
          return { type: "delete" as const, refId: ref.id };
        }
        const cleanedAnchorNodeId = chooseAnchorNodeId(cleanedNodeIds, ref.anchorNodeId);
        const cleanedAnchorPosition = cleanedAnchorNodeId ? resolveNodePosition(cleanedAnchorNodeId) : null;
        const cleanedPortalPosition = resolvePortalFollowPosition(ref, cleanedAnchorPosition, `${ref.id}:cleanup`);
        const unchanged =
          cleanedNodeIds.length === ref.nodeIds.length &&
          cleanedNodeIds.every((id, index) => id === ref.nodeIds[index]) &&
          cleanedAnchorNodeId === (ref.anchorNodeId || null);
        if (unchanged) return null;
        return {
          type: "update" as const,
          refId: ref.id,
          nodeIds: cleanedNodeIds,
          anchorNodeId: cleanedAnchorNodeId,
          portalX: cleanedPortalPosition.x,
          portalY: cleanedPortalPosition.y,
          portalAnchorX: cleanedAnchorPosition?.x ?? null,
          portalAnchorY: cleanedAnchorPosition?.y ?? null,
        };
      })
      .filter(
        (
          entry
        ): entry is
          | {
              type: "update";
              refId: string;
              nodeIds: string[];
              anchorNodeId: string | null;
              portalX: number;
              portalY: number;
              portalAnchorX: number | null;
              portalAnchorY: number | null;
            }
          | { type: "delete"; refId: string } =>
          !!entry
      );

    if (operations.length === 0) return;

    setBusyAction(true);
    setError(null);
    try {
      let batch = writeBatch(db);
      let count = 0;
      for (const entry of operations) {
        const refDoc = doc(db, "users", user.uid, "crossRefs", entry.refId);
        if (entry.type === "delete") {
          batch.delete(refDoc);
        } else {
          batch.update(refDoc, {
            nodeIds: entry.nodeIds,
            anchorNodeId: entry.anchorNodeId ?? deleteField(),
            portalX: entry.portalX,
            portalY: entry.portalY,
            portalAnchorX: entry.portalAnchorX ?? deleteField(),
            portalAnchorY: entry.portalAnchorY ?? deleteField(),
            updatedAt: serverTimestamp(),
          });
        }
        count += 1;
        if (count >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
      if (activePortalRefId && operations.some((entry) => entry.type === "delete" && entry.refId === activePortalRefId)) {
        setActivePortalRefId(null);
      }
      if (editRefId && operations.some((entry) => entry.type === "delete" && entry.refId === editRefId)) {
        hydrateRefEditor(null);
      }
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not clean up cross-reference bubbles.");
    } finally {
      setBusyAction(false);
    }
  }, [activePortalRefId, editRefId, hydrateRefEditor, nodesById, refs, resolveNodePosition, user.uid]);

  const deleteSelected = useCallback(async () => {
    if (!db || !selectedNodeId || selectedNodeId === rootNodeId) return;
    const ids = collectDescendants(selectedNodeId, childrenByParent);
    const idSet = new Set(ids);
    const fallbackId = nodesById.get(selectedNodeId)?.parentId || rootNodeId || null;

    // ── Build undo snapshot BEFORE the batch ─────────────────────────────────
    const deletedNodes = ids.map((id) => nodesById.get(id)).filter(Boolean) as TreeNode[];
    const affectedRefs = refs.filter((ref) => ref.nodeIds.some((id) => idSet.has(id)));

    // forward: remove all subtree nodes + delete/update affected refs
    const fwdLocalNodes: LocalOp[] = [{ target: "nodes", op: "remove", nodeIds: ids }];
    const fwdFirestoreNodes: FirestoreOp[] = ids.map((id) => ({ kind: "deleteNode" as const, nodeId: id }));
    const fwdLocalRefs: LocalOp[] = [];
    const fwdFirestoreRefs: FirestoreOp[] = [];
    const invLocalRefs: LocalOp[] = [];
    const invFirestoreRefs: FirestoreOp[] = [];

    affectedRefs.forEach((ref) => {
      const remaining = ref.nodeIds.filter((id) => !idSet.has(id));
      if (remaining.length === 0) {
        fwdLocalRefs.push({ target: "refs", op: "remove", refIds: [ref.id] });
        fwdFirestoreRefs.push({ kind: "deleteRef", refId: ref.id });
      } else {
        const nextAnchorNodeId = chooseAnchorNodeId(remaining, ref.anchorNodeId);
        const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
        const nextPortalPosition = resolvePortalFollowPosition(ref, nextAnchorPosition, `${ref.id}:delete-selected`);
        fwdLocalRefs.push({ target: "refs", op: "patch", refId: ref.id, patch: { nodeIds: remaining, anchorNodeId: nextAnchorNodeId, portalX: nextPortalPosition.x, portalY: nextPortalPosition.y } });
        fwdFirestoreRefs.push({ kind: "updateRef", refId: ref.id, data: { nodeIds: remaining, anchorNodeId: nextAnchorNodeId ?? firestoreDeleteField(), portalX: nextPortalPosition.x, portalY: nextPortalPosition.y, portalAnchorX: nextAnchorPosition?.x ?? firestoreDeleteField(), portalAnchorY: nextAnchorPosition?.y ?? firestoreDeleteField() } });
      }
      // inverse: restore the ref to its original state
      invLocalRefs.push({ target: "refs", op: "patch", refId: ref.id, patch: { nodeIds: ref.nodeIds, anchorNodeId: ref.anchorNodeId, portalX: ref.portalX, portalY: ref.portalY } });
      invFirestoreRefs.push({ kind: "updateRef", refId: ref.id, data: { nodeIds: ref.nodeIds, anchorNodeId: ref.anchorNodeId ?? firestoreDeleteField(), portalX: ref.portalX, portalY: ref.portalY, portalAnchorX: ref.portalAnchorX ?? firestoreDeleteField(), portalAnchorY: ref.portalAnchorY ?? firestoreDeleteField() } });
    });

    const deletedTitle = nodesById.get(selectedNodeId)?.title ?? selectedNodeId;
    pushHistory({
      id: crypto.randomUUID(),
      label: `Delete "${deletedTitle}"`,
      forwardLocal:    [...fwdLocalNodes, ...fwdLocalRefs],
      forwardFirestore:[...fwdFirestoreNodes, ...fwdFirestoreRefs],
      inverseLocal:    [
        { target: "nodes", op: "add", node: deletedNodes[0] ?? {} as TreeNode },
        ...deletedNodes.slice(1).map((n): LocalOp => ({ target: "nodes", op: "add", node: n })),
        ...invLocalRefs,
      ],
      inverseFirestore:[
        ...deletedNodes.map((n): FirestoreOp => ({ kind: "setNode", nodeId: n.id, data: { title: n.title, parentId: n.parentId, kind: n.kind, x: n.x ?? 0, y: n.y ?? 0, ...(n.color ? { color: n.color } : {}), ...(n.taskStatus && n.taskStatus !== "none" ? { taskStatus: n.taskStatus } : {}), ...(n.body ? { body: n.body } : {}), ...(n.storySteps ? { storySteps: n.storySteps } : {}) } })),
        ...invFirestoreRefs,
      ],
    });
    // ─────────────────────────────────────────────────────────────────────────

    setBusyAction(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      ids.forEach((id) => {
        batch.delete(doc(db, "users", user.uid, "nodes", id));
      });
      refs.forEach((ref) => {
        const remaining = ref.nodeIds.filter((id) => !idSet.has(id));
        if (remaining.length === ref.nodeIds.length) return;
        const refDoc = doc(db, "users", user.uid, "crossRefs", ref.id);
        if (remaining.length === 0) {
          batch.delete(refDoc);
        } else {
          const nextAnchorNodeId = chooseAnchorNodeId(remaining, ref.anchorNodeId);
          const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
          const nextPortalPosition = resolvePortalFollowPosition(ref, nextAnchorPosition, `${ref.id}:delete-selected`);
          batch.update(refDoc, {
            nodeIds: remaining,
            anchorNodeId: nextAnchorNodeId ?? deleteField(),
            portalX: nextPortalPosition.x,
            portalY: nextPortalPosition.y,
            portalAnchorX: nextAnchorPosition?.x ?? deleteField(),
            portalAnchorY: nextAnchorPosition?.y ?? deleteField(),
            updatedAt: serverTimestamp(),
          });
        }
      });
      await batch.commit();
      if (currentRootId && idSet.has(currentRootId)) {
        setCurrentRootId(fallbackId);
      }
      setSelectedNodeId(fallbackId);
      setActivePortalRefId(null);
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not delete node.");
    } finally {
      setBusyAction(false);
    }
  }, [childrenByParent, currentRootId, nodesById, pushHistory, refs, resolveNodePosition, rootNodeId, selectedNodeId, user.uid]);

  const linkCrossRefToNode = useCallback(
    async (refId: string, nodeId: string) => {
      if (!db) return;
      const linked = refs.find((entry) => entry.id === refId);
      // Already linked — nothing to do.
      if (linked?.nodeIds.includes(nodeId)) return;
      const nextNodeIds = linked ? [...linked.nodeIds, nodeId] : [nodeId];
      const nextAnchorNodeId = chooseAnchorNodeId(nextNodeIds, linked?.anchorNodeId, nodeId);
      const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
      const nextPortalPosition = linked
        ? resolvePortalFollowPosition(linked, nextAnchorPosition, refId)
        : buildDefaultPortalPosition(nextAnchorNodeId, refId);

      // Capture the full before-state for undo.
      if (linked) {
        const prevData: Record<string, unknown> = {
          nodeIds: linked.nodeIds,
          anchorNodeId: linked.anchorNodeId ?? firestoreDeleteField(),
          portalX: linked.portalX,
          portalY: linked.portalY,
          portalAnchorX: linked.portalAnchorX ?? firestoreDeleteField(),
          portalAnchorY: linked.portalAnchorY ?? firestoreDeleteField(),
        };
        const nextData: Record<string, unknown> = {
          nodeIds: nextNodeIds,
          anchorNodeId: nextAnchorNodeId ?? firestoreDeleteField(),
          portalX: nextPortalPosition?.x ?? linked.portalX,
          portalY: nextPortalPosition?.y ?? linked.portalY,
          portalAnchorX: nextAnchorPosition?.x ?? firestoreDeleteField(),
          portalAnchorY: nextAnchorPosition?.y ?? firestoreDeleteField(),
        };
        pushHistory({
          id: crypto.randomUUID(),
          label: `Link bubble to node`,
          forwardLocal:    [{ target: "refs", op: "patch", refId, patch: { nodeIds: nextNodeIds, anchorNodeId: nextAnchorNodeId, portalX: nextData.portalX as number, portalY: nextData.portalY as number } }],
          forwardFirestore:[{ kind: "updateRef", refId, data: nextData }],
          inverseLocal:    [{ target: "refs", op: "patch", refId, patch: { nodeIds: linked.nodeIds, anchorNodeId: linked.anchorNodeId, portalX: linked.portalX, portalY: linked.portalY } }],
          inverseFirestore:[{ kind: "updateRef", refId, data: prevData }],
        });
      }

      setBusyAction(true);
      setError(null);
      try {
        await updateDoc(doc(db, "users", user.uid, "crossRefs", refId), {
          nodeIds: arrayUnion(nodeId),
          anchorNodeId: nextAnchorNodeId ?? deleteField(),
          ...(nextPortalPosition ? { portalX: nextPortalPosition.x, portalY: nextPortalPosition.y } : {}),
          ...(nextAnchorPosition ? { portalAnchorX: nextAnchorPosition.x, portalAnchorY: nextAnchorPosition.y } : {}),
          updatedAt: serverTimestamp(),
        });
        if (linked) {
          hydrateRefEditor({
            ...linked,
            nodeIds: nextNodeIds,
            anchorNodeId: nextAnchorNodeId,
            portalX: nextPortalPosition?.x ?? linked.portalX,
            portalY: nextPortalPosition?.y ?? linked.portalY,
            portalAnchorX: nextAnchorPosition?.x ?? linked.portalAnchorX,
            portalAnchorY: nextAnchorPosition?.y ?? linked.portalAnchorY,
          });
        }
        setActivePortalRefId(refId);
        setLinkNodeQuery("");
        setLinkTargetNodeId("");
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not link bubble to node.");
      } finally {
        setBusyAction(false);
      }
    },
    [buildDefaultPortalPosition, hydrateRefEditor, pushHistory, refs, resolveNodePosition, user.uid]
  );

  const createCrossRef = useCallback(async () => {
    if (!db || !selectedNodeId) return;
    const label = newRefLabel.trim();
    if (!label) return;
    const code = newRefCode.trim() ? normalizeCode(newRefCode) : initialsFromLabel(label);
    const existingExact = refs.find(
      (ref) => ref.code === code && ref.label.trim().toLowerCase() === label.toLowerCase()
    );
    setBusyAction(true);
    setError(null);
    try {
      if (existingExact) {
        const nextNodeIds = existingExact.nodeIds.includes(selectedNodeId)
          ? existingExact.nodeIds
          : [...existingExact.nodeIds, selectedNodeId];
        const nextAnchorNodeId = chooseAnchorNodeId(nextNodeIds, existingExact.anchorNodeId, selectedNodeId);
        const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
        const nextPortalPosition =
          resolvePortalFollowPosition(existingExact, nextAnchorPosition, existingExact.id);
        await updateDoc(doc(db, "users", user.uid, "crossRefs", existingExact.id), {
          nodeIds: arrayUnion(selectedNodeId),
          anchorNodeId: nextAnchorNodeId ?? deleteField(),
          ...(nextPortalPosition ? { portalX: nextPortalPosition.x, portalY: nextPortalPosition.y } : {}),
          ...(nextAnchorPosition ? { portalAnchorX: nextAnchorPosition.x, portalAnchorY: nextAnchorPosition.y } : {}),
          entityType: existingExact.entityType === "entity" ? newRefType : existingExact.entityType,
          updatedAt: serverTimestamp(),
        });
        hydrateRefEditor({
          ...existingExact,
          nodeIds: nextNodeIds,
          anchorNodeId: nextAnchorNodeId,
          portalX: nextPortalPosition?.x ?? existingExact.portalX,
          portalY: nextPortalPosition?.y ?? existingExact.portalY,
          portalAnchorX: nextAnchorPosition?.x ?? existingExact.portalAnchorX,
          portalAnchorY: nextAnchorPosition?.y ?? existingExact.portalAnchorY,
          entityType: existingExact.entityType === "entity" ? newRefType : existingExact.entityType,
        });
        setActivePortalRefId(existingExact.id);
      } else {
        const newDoc = doc(collection(db, "users", user.uid, "crossRefs"));
        const anchorPosition = resolveNodePosition(selectedNodeId);
        const portalPosition = buildDefaultPortalPosition(selectedNodeId, newDoc.id);
        await setDoc(doc(db, "users", user.uid, "crossRefs", newDoc.id), {
          label,
          code,
          nodeIds: [selectedNodeId],
          anchorNodeId: selectedNodeId,
          ...(portalPosition ? { portalX: portalPosition.x, portalY: portalPosition.y } : {}),
          portalAnchorX: anchorPosition.x,
          portalAnchorY: anchorPosition.y,
          entityType: newRefType,
          tags: [],
          notes: "",
          contact: "",
          links: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies CrossRefDoc & { createdAt: unknown; updatedAt: unknown });
        const newRef: CrossRef = {
          id: newDoc.id,
          label,
          code,
          nodeIds: [selectedNodeId],
          anchorNodeId: selectedNodeId,
          portalX: portalPosition?.x ?? null,
          portalY: portalPosition?.y ?? null,
          portalAnchorX: anchorPosition.x,
          portalAnchorY: anchorPosition.y,
          portalOffsetX: null,
          portalOffsetY: null,
          entityType: newRefType,
          tags: [],
          notes: "",
          contact: "",
          links: [],
          createdAtMs: 0,
          updatedAtMs: 0,
        };
        // Optimistically add to local state so the bubble appears immediately.
        setRefs((prev) => [...prev, newRef]);
        hydrateRefEditor(newRef);
        setActivePortalRefId(newDoc.id);
      }
      setNewRefLabel("");
      setNewRefCode("");
      setNewRefType("entity");
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not create cross-reference.");
    } finally {
      setBusyAction(false);
    }
  }, [buildDefaultPortalPosition, hydrateRefEditor, newRefCode, newRefLabel, newRefType, refs, resolveNodePosition, selectedNodeId, user.uid]);

  const duplicateCrossRef = useCallback(
    async (refId: string) => {
      if (!db) return;
      const source = refs.find((ref) => ref.id === refId);
      if (!source) return;
      const duplicateLabelBase = `${source.label} Copy`;
      let duplicateLabel = duplicateLabelBase;
      let index = 2;
      while (refs.some((ref) => ref.label.trim().toLowerCase() === duplicateLabel.trim().toLowerCase())) {
        duplicateLabel = `${duplicateLabelBase} ${index}`;
        index += 1;
      }
      const duplicateNodeIds = Array.from(new Set(source.nodeIds));
      const duplicateAnchorNodeId = chooseAnchorNodeId(duplicateNodeIds, source.anchorNodeId);
      const duplicateAnchorPosition = duplicateAnchorNodeId ? resolveNodePosition(duplicateAnchorNodeId) : null;
      const duplicatePortalPosition =
        typeof source.portalX === "number" && typeof source.portalY === "number"
          ? (() => {
              const sourceAnchorNodeId = chooseAnchorNodeId(source.nodeIds, source.anchorNodeId);
              const sourceAnchorPosition = sourceAnchorNodeId ? resolveNodePosition(sourceAnchorNodeId) : null;
              const sourcePosition = resolvePortalFollowPosition(source, sourceAnchorPosition, source.id);
              return { x: sourcePosition.x + 34, y: sourcePosition.y + 34 };
            })()
          : buildDefaultPortalPosition(duplicateAnchorNodeId, `${source.id}:copy:${duplicateLabel}`);
      setBusyAction(true);
      setError(null);
      try {
        const newDoc = doc(collection(db, "users", user.uid, "crossRefs"));
        await setDoc(doc(db, "users", user.uid, "crossRefs", newDoc.id), {
          label: duplicateLabel,
          code: source.code,
          nodeIds: duplicateNodeIds,
          ...(duplicateAnchorNodeId ? { anchorNodeId: duplicateAnchorNodeId } : {}),
          ...(duplicatePortalPosition ? { portalX: duplicatePortalPosition.x, portalY: duplicatePortalPosition.y } : {}),
          ...(duplicateAnchorPosition ? { portalAnchorX: duplicateAnchorPosition.x, portalAnchorY: duplicateAnchorPosition.y } : {}),
          entityType: source.entityType,
          tags: source.tags,
          notes: source.notes,
          contact: source.contact,
          links: source.links,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies CrossRefDoc & { createdAt: unknown; updatedAt: unknown });
        setActivePortalRefId(newDoc.id);
        hydrateRefEditor({
          ...source,
          id: newDoc.id,
          label: duplicateLabel,
          nodeIds: duplicateNodeIds,
          anchorNodeId: duplicateAnchorNodeId,
          portalX: duplicatePortalPosition?.x ?? null,
          portalY: duplicatePortalPosition?.y ?? null,
          portalAnchorX: duplicateAnchorPosition?.x ?? source.portalAnchorX,
          portalAnchorY: duplicateAnchorPosition?.y ?? source.portalAnchorY,
          createdAtMs: 0,
          updatedAtMs: 0,
        });
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not duplicate bubble.");
      } finally {
        setBusyAction(false);
      }
    },
    [buildDefaultPortalPosition, hydrateRefEditor, refs, resolveNodePosition, user.uid]
  );

  const saveCrossRefEdits = useCallback(async () => {
    if (!db || !editRefId) return;
    const label = editRefLabel.trim();
    if (!label) {
      setError("Bubble name is required.");
      return;
    }
    const code = editRefCode.trim() ? normalizeCode(editRefCode) : initialsFromLabel(label);
    const tags = parseCsvLike(editRefTags);
    const links = parseLineList(editRefLinks);
    const notes = editRefNotes.trim();
    const contact = editRefContact.trim();
    setBusyAction(true);
    setError(null);
    try {
      await updateDoc(doc(db, "users", user.uid, "crossRefs", editRefId), {
        label,
        code,
        entityType: editRefType,
        tags,
        notes,
        contact,
        links,
        updatedAt: serverTimestamp(),
      });
      setEditRefCode(code);
      setEditRefTags(tags.join(", "));
      setEditRefLinks(links.join("\n"));
      setActivePortalRefId(editRefId);
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not update bubble.");
    } finally {
      setBusyAction(false);
    }
  }, [editRefCode, editRefContact, editRefId, editRefLabel, editRefLinks, editRefNotes, editRefTags, editRefType, user.uid]);

  const mergeCrossRefIntoEdited = useCallback(async () => {
    if (!db || !editRefId || !mergeFromRefId || editRefId === mergeFromRefId) return;
    const primary = refs.find((ref) => ref.id === editRefId);
    const duplicate = refs.find((ref) => ref.id === mergeFromRefId);
    if (!primary || !duplicate) return;

    const mergedNodeIds = Array.from(new Set([...primary.nodeIds, ...duplicate.nodeIds]));
    const mergedTags = Array.from(new Set([...primary.tags, ...duplicate.tags].map((tag) => tag.trim()).filter(Boolean)));
    const mergedLinks = Array.from(new Set([...primary.links, ...duplicate.links].map((link) => link.trim()).filter(Boolean)));
    const mergedNotes = [primary.notes.trim(), duplicate.notes.trim()].filter(Boolean).join("\n\n");
    const mergedContact = primary.contact.trim() || duplicate.contact.trim();
    const mergedType = primary.entityType !== "entity" ? primary.entityType : duplicate.entityType;
    const mergedAnchorNodeId = chooseAnchorNodeId(mergedNodeIds, primary.anchorNodeId, duplicate.anchorNodeId);
    const mergedAnchorPosition = mergedAnchorNodeId ? resolveNodePosition(mergedAnchorNodeId) : null;
    const mergedPortalPosition =
      typeof primary.portalX === "number" && typeof primary.portalY === "number"
        ? resolvePortalFollowPosition(
            primary,
            primary.anchorNodeId ? resolveNodePosition(primary.anchorNodeId) : null,
            `${primary.id}:merged`
          )
        : typeof duplicate.portalX === "number" && typeof duplicate.portalY === "number"
          ? resolvePortalFollowPosition(
              duplicate,
              duplicate.anchorNodeId ? resolveNodePosition(duplicate.anchorNodeId) : null,
              `${duplicate.id}:merged`
            )
          : buildDefaultPortalPosition(mergedAnchorNodeId, primary.id);

    setBusyAction(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", user.uid, "crossRefs", primary.id), {
        nodeIds: mergedNodeIds,
        anchorNodeId: mergedAnchorNodeId ?? deleteField(),
        ...(mergedPortalPosition ? { portalX: mergedPortalPosition.x, portalY: mergedPortalPosition.y } : {}),
        ...(mergedAnchorPosition ? { portalAnchorX: mergedAnchorPosition.x, portalAnchorY: mergedAnchorPosition.y } : {}),
        tags: mergedTags,
        links: mergedLinks,
        notes: mergedNotes,
        contact: mergedContact,
        entityType: mergedType,
        updatedAt: serverTimestamp(),
      });
      batch.delete(doc(db, "users", user.uid, "crossRefs", duplicate.id));
      await batch.commit();

      setMergeFromRefId("");
      if (activePortalRefId === duplicate.id) {
        setActivePortalRefId(primary.id);
      }
      hydrateRefEditor({
        ...primary,
        nodeIds: mergedNodeIds,
        anchorNodeId: mergedAnchorNodeId,
        portalX: mergedPortalPosition?.x ?? primary.portalX,
        portalY: mergedPortalPosition?.y ?? primary.portalY,
        portalAnchorX: mergedAnchorPosition?.x ?? primary.portalAnchorX,
        portalAnchorY: mergedAnchorPosition?.y ?? primary.portalAnchorY,
        tags: mergedTags,
        links: mergedLinks,
        notes: mergedNotes,
        contact: mergedContact,
        entityType: mergedType,
      });
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not merge entities.");
    } finally {
      setBusyAction(false);
    }
  }, [activePortalRefId, buildDefaultPortalPosition, editRefId, hydrateRefEditor, mergeFromRefId, refs, resolveNodePosition, user.uid]);

  const deleteCrossRefBubble = useCallback(async () => {
    if (!db || !editRefId) return;
    setBusyAction(true);
    setError(null);
    const idToDelete = editRefId;
    // Optimistically remove from local state immediately so the orb
    // disappears at once rather than waiting for the Firestore snapshot.
    setRefs((prev) => prev.filter((r) => r.id !== idToDelete));
    if (activePortalRefId === idToDelete) setActivePortalRefId(null);
    hydrateRefEditor(null);
    setLinkNodeQuery("");
    setLinkTargetNodeId("");
    try {
      await deleteDoc(doc(db, "users", user.uid, "crossRefs", idToDelete));
    } catch (actionError: unknown) {
      // Roll back the optimistic removal on failure.
      setError(actionError instanceof Error ? actionError.message : "Could not delete bubble.");
    } finally {
      setBusyAction(false);
    }
  }, [activePortalRefId, editRefId, hydrateRefEditor, user.uid]);

  /** Delete a cross-reference directly by its ID (used by portal right-click context menu). */
  const deletePortalByRefId = useCallback(async (refId: string) => {
    if (!db || !refId) return;
    setBusyAction(true);
    setError(null);
    setPortalContextMenu(null);
    setRefs((prev) => prev.filter((r) => r.id !== refId));
    if (activePortalRefId === refId) setActivePortalRefId(null);
    if (editRefId === refId) {
      hydrateRefEditor(null);
      setLinkNodeQuery("");
      setLinkTargetNodeId("");
    }
    try {
      await deleteDoc(doc(db, "users", user.uid, "crossRefs", refId));
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not delete cross-reference.");
    } finally {
      setBusyAction(false);
    }
  }, [activePortalRefId, editRefId, hydrateRefEditor, user.uid]);

  // Dismiss the portal context menu when the user clicks outside of it.
  useEffect(() => {
    if (!portalContextMenu) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-portal-context-menu]")) return;
      setPortalContextMenu(null);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [portalContextMenu]);

  const selectRefForEditing = useCallback(
    (refId: string) => {
      setActivePortalRefId(refId);
      const ref = refs.find((entry) => entry.id === refId);
      hydrateRefEditor(ref || null);
      setLinkNodeQuery("");
      setLinkTargetNodeId("");
    },
    [hydrateRefEditor, refs]
  );

  useEffect(() => {
    if (!editRefId) return;
    if (refs.some((ref) => ref.id === editRefId)) return;
    hydrateRefEditor(null);
    setLinkNodeQuery("");
    setLinkTargetNodeId("");
  }, [editRefId, hydrateRefEditor, refs]);

  useEffect(() => {
    if (!linkTargetNodeId) return;
    if (linkableNodeOptions.some((entry) => entry.id === linkTargetNodeId)) return;
    setLinkTargetNodeId("");
  }, [linkTargetNodeId, linkableNodeOptions]);

  const detachCrossRef = useCallback(
    async (refId: string, nodeId: string) => {
      if (!db) return;
      const target = refs.find((entry) => entry.id === refId);
      setBusyAction(true);
      setError(null);
      try {
        if (target) {
          const remainingNodeIds = target.nodeIds.filter((id) => id !== nodeId);
          const nextAnchorNodeId = chooseAnchorNodeId(remainingNodeIds, target.anchorNodeId);
          const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
          const nextPortalPosition = resolvePortalFollowPosition(target, nextAnchorPosition, target.id);

          // Capture before/after for undo.
          const prevData: Record<string, unknown> = {
            nodeIds: target.nodeIds,
            anchorNodeId: target.anchorNodeId ?? firestoreDeleteField(),
            portalX: target.portalX,
            portalY: target.portalY,
            portalAnchorX: target.portalAnchorX ?? firestoreDeleteField(),
            portalAnchorY: target.portalAnchorY ?? firestoreDeleteField(),
          };
          const nextData: Record<string, unknown> = {
            nodeIds: remainingNodeIds,
            anchorNodeId: nextAnchorNodeId ?? firestoreDeleteField(),
            portalX: nextPortalPosition.x,
            portalY: nextPortalPosition.y,
            portalAnchorX: nextAnchorPosition?.x ?? firestoreDeleteField(),
            portalAnchorY: nextAnchorPosition?.y ?? firestoreDeleteField(),
          };
          pushHistory({
            id: crypto.randomUUID(),
            label: `Detach bubble from node`,
            forwardLocal:    [{ target: "refs", op: "patch", refId, patch: { nodeIds: remainingNodeIds, anchorNodeId: nextAnchorNodeId, portalX: nextPortalPosition.x, portalY: nextPortalPosition.y } }],
            forwardFirestore:[{ kind: "updateRef", refId, data: nextData }],
            inverseLocal:    [{ target: "refs", op: "patch", refId, patch: { nodeIds: target.nodeIds, anchorNodeId: target.anchorNodeId, portalX: target.portalX, portalY: target.portalY } }],
            inverseFirestore:[{ kind: "updateRef", refId, data: prevData }],
          });

          await updateDoc(doc(db, "users", user.uid, "crossRefs", refId), {
            nodeIds: remainingNodeIds,
            anchorNodeId: nextAnchorNodeId ?? deleteField(),
            ...(nextPortalPosition ? { portalX: nextPortalPosition.x, portalY: nextPortalPosition.y } : {}),
            ...(nextAnchorPosition ? { portalAnchorX: nextAnchorPosition.x, portalAnchorY: nextAnchorPosition.y } : {}),
            updatedAt: serverTimestamp(),
          });
          if (editRefId === refId) {
            hydrateRefEditor({
              ...target,
              nodeIds: remainingNodeIds,
              anchorNodeId: nextAnchorNodeId,
              portalX: nextPortalPosition.x,
              portalY: nextPortalPosition.y,
              portalAnchorX: nextAnchorPosition?.x ?? target.portalAnchorX,
              portalAnchorY: nextAnchorPosition?.y ?? target.portalAnchorY,
            });
          }
        } else {
          await updateDoc(doc(db, "users", user.uid, "crossRefs", refId), {
            nodeIds: arrayRemove(nodeId),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not detach cross-reference.");
      } finally {
        setBusyAction(false);
      }
    },
    [editRefId, hydrateRefEditor, pushHistory, refs, resolveNodePosition, user.uid]
  );

  const jumpToReferencedNode = useCallback(
    (nodeId: string) => {
      const masterId = getMasterNodeFor(nodeId, rootNodeId, nodesById);
      setCurrentRootId(masterId);
      setSelectedNodeId(nodeId);
      setActivePortalRefId(null);
    },
    [nodesById, rootNodeId]
  );

  const onNodeDrag = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Portal orbs don't trigger re-parenting.
      if (node.id.startsWith("portal:")) { setDropTargetNodeId(null); return; }
      // Multi-select drag: suppress re-parenting (ambiguous which is the primary).
      const selectedCount = rfInstance?.getNodes().filter((n) => n.selected && !n.id.startsWith("portal:")).length ?? 0;
      if (selectedCount > 1) {
        draggedNodeIdRef.current = null;
        setDropTargetNodeId(null);
        return;
      }
      draggedNodeIdRef.current = node.id;
      if (!rfInstance) {
        setDropTargetNodeId(null);
        return;
      }
      // All descendants + the node itself are forbidden drop targets (cycle prevention).
      const forbiddenIds = new Set(collectDescendants(node.id, childrenByParent));
      const currentParentId = nodesById.get(node.id)?.parentId ?? null;
      // Portals are not valid re-parent targets.
      const intersecting = rfInstance.getIntersectingNodes(node).filter((c) => !c.id.startsWith("portal:"));
      let bestTarget: string | null = null;
      for (const candidate of intersecting) {
        if (forbiddenIds.has(candidate.id)) continue;    // self or descendant
        if (candidate.id === currentParentId) continue;  // already the parent (no-op)
        bestTarget = candidate.id;
        break;
      }
      setDropTargetNodeId(bestTarget);
    },
    [childrenByParent, nodesById, rfInstance]
  );

  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      if (!db) return;

      // Portal nodes are pinned (draggable: false) — skip silently.
      if (node.id.startsWith("portal:")) return;

      // Snapshot and clear drop-target state before any async work.
      draggedNodeIdRef.current = null;
      const capturedDropTarget = dropTargetNodeId;
      setDropTargetNodeId(null);

      // ── Re-parent branch ─────────────────────────────────────────────────
      if (capturedDropTarget) {
        const prevNode = nodesById.get(node.id);
        // Guard: don't re-parent the root node.
        if (prevNode && prevNode.id !== rootNodeId) {
          const oldParentId = prevNode.parentId;
          const newParentId = capturedDropTarget;
          const oldX = prevNode.x ?? node.position.x;
          const oldY = prevNode.y ?? node.position.y;
          const newX = node.position.x;
          const newY = node.position.y;
          const newParentTitle = nodesById.get(newParentId)?.title ?? newParentId;
          pushHistory({
            id: crypto.randomUUID(),
            label: `Re-parent "${prevNode.title}" → "${newParentTitle}"`,
            forwardLocal:    [{ target: "nodes", op: "patch", nodeId: node.id, patch: { parentId: newParentId, x: newX, y: newY } }],
            forwardFirestore:[{ kind: "updateNode", nodeId: node.id, data: { parentId: newParentId, x: newX, y: newY } }],
            inverseLocal:    [{ target: "nodes", op: "patch", nodeId: node.id, patch: { parentId: oldParentId, x: oldX, y: oldY } }],
            inverseFirestore:[{ kind: "updateNode", nodeId: node.id, data: { parentId: oldParentId, x: oldX, y: oldY } }],
          });
          applyLocalNodePatch(node.id, { parentId: newParentId, x: newX, y: newY });
          try {
            await updateDoc(doc(db, "users", user.uid, "nodes", node.id), {
              parentId: newParentId,
              x: newX,
              y: newY,
              updatedAt: serverTimestamp(),
            });
          } catch (actionError: unknown) {
            showSaveError();
            setError(actionError instanceof Error ? actionError.message : "Could not re-parent node.");
          }
          return; // Don't fall through to the position-only save.
        }
      }

      // ── Position-only save ───────────────────────────────────────────────
      const prevNode = nodesById.get(node.id);
      const prevX = prevNode?.x ?? node.position.x;
      const prevY = prevNode?.y ?? node.position.y;
      if (prevX !== node.position.x || prevY !== node.position.y) {
        pushHistory({
          id: crypto.randomUUID(),
          label: `Move "${prevNode?.title ?? node.id}"`,
          forwardLocal:    [{ target: "nodes", op: "patch", nodeId: node.id, patch: { x: node.position.x, y: node.position.y } }],
          forwardFirestore:[{ kind: "updateNode", nodeId: node.id, data: { x: node.position.x, y: node.position.y } }],
          inverseLocal:    [{ target: "nodes", op: "patch", nodeId: node.id, patch: { x: prevX, y: prevY } }],
          inverseFirestore:[{ kind: "updateNode", nodeId: node.id, data: { x: prevX, y: prevY } }],
        });
      }
      setNodes((previous) =>
        previous.map((entry) => (entry.id === node.id ? { ...entry, x: node.position.x, y: node.position.y } : entry))
      );
      try {
        await updateDoc(doc(db, "users", user.uid, "nodes", node.id), {
          x: node.position.x,
          y: node.position.y,
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        showSaveError();
        setError(actionError instanceof Error ? actionError.message : "Could not save node position.");
      }
    },
    [applyLocalNodePatch, dropTargetNodeId, filteredTreeIdSet, nodesById, pushHistory, rootNodeId, showSaveError, user.uid]
  );

  const onSelectionDragStop = useCallback(
    async (_: React.MouseEvent, draggedNodes: Node[]) => {
      if (!db) return;
      // No re-parenting on multi-select drag — clear drop-target state.
      draggedNodeIdRef.current = null;
      setDropTargetNodeId(null);

      const movedTreeNodes = draggedNodes.filter((n) => !n.id.startsWith("portal:"));
      if (movedTreeNodes.length === 0) return;
      const movedTreePositions = new Map(movedTreeNodes.map((entry) => [entry.id, entry.position] as const));

      // Build a single undo entry covering all moved tree nodes (skip nodes that haven't actually moved).
      const movedWithDelta = movedTreeNodes.filter((entry) => {
        const prev = nodesById.get(entry.id);
        return prev && (prev.x !== entry.position.x || prev.y !== entry.position.y);
      });
      if (movedWithDelta.length > 0) {
        pushHistory({
          id: crypto.randomUUID(),
          label: movedWithDelta.length === 1
            ? `Move "${nodesById.get(movedWithDelta[0].id)?.title ?? movedWithDelta[0].id}"`
            : `Move ${movedWithDelta.length} nodes`,
          forwardLocal: movedWithDelta.map((entry) => ({
            target: "nodes" as const, op: "patch" as const, nodeId: entry.id,
            patch: { x: entry.position.x, y: entry.position.y },
          })),
          forwardFirestore: movedWithDelta.map((entry) => ({
            kind: "updateNode" as const, nodeId: entry.id,
            data: { x: entry.position.x, y: entry.position.y },
          })),
          inverseLocal: movedWithDelta.map((entry) => {
            const prev = nodesById.get(entry.id)!;
            return { target: "nodes" as const, op: "patch" as const, nodeId: entry.id, patch: { x: prev.x, y: prev.y } };
          }),
          inverseFirestore: movedWithDelta.map((entry) => {
            const prev = nodesById.get(entry.id)!;
            return { kind: "updateNode" as const, nodeId: entry.id, data: { x: prev.x, y: prev.y } };
          }),
        });
      }

      if (movedTreePositions.size > 0) {
        setNodes((previous) =>
          previous.map((entry) => {
            const next = movedTreePositions.get(entry.id);
            return next ? { ...entry, x: next.x, y: next.y } : entry;
          })
        );
      }
      try {
        let batch = writeBatch(db);
        let count = 0;
        for (const entry of movedTreeNodes) {
          batch.update(doc(db, "users", user.uid, "nodes", entry.id), {
            x: entry.position.x,
            y: entry.position.y,
            updatedAt: serverTimestamp(),
          });
          count += 1;
          if (count >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      } catch (actionError: unknown) {
        showSaveError();
        setError(actionError instanceof Error ? actionError.message : "Could not save node positions.");
      }
    },
    [nodesById, pushHistory, showSaveError, user.uid]
  );

  // Context menu handlers
  const handleContextAddChild = useCallback(
    async (nodeId: string) => {
      if (!db) return;
      const parentPosition = resolveNodePosition(nodeId);
      const siblingCount = (childrenByParent.get(nodeId) || []).length;
      const newId = newNodeDocId();
      const nodeData: TreeNodeDoc = {
        title: "New Node",
        parentId: nodeId,
        kind: "item",
        x: parentPosition.x + 280,
        y: parentPosition.y + 20 + siblingCount * 96,
      };
      pushHistory({
        id: crypto.randomUUID(),
        label: `Create "New Node"`,
        forwardLocal:    [{ target: "nodes", op: "add", node: { ...nodeData, id: newId } }],
        forwardFirestore:[{ kind: "setNode", nodeId: newId, data: nodeData }],
        inverseLocal:    [{ target: "nodes", op: "remove", nodeIds: [newId] }],
        inverseFirestore:[{ kind: "deleteNode", nodeId: newId }],
      });
      setBusyAction(true);
      setError(null);
      try {
        await setDoc(doc(db, "users", user.uid, "nodes", newId), {
          ...nodeData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies TreeNodeDoc & { createdAt: unknown; updatedAt: unknown });
        setPendingSelectedNodeId(newId);
        setPendingRenameNodeId(newId);
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not create node.");
      } finally {
        setBusyAction(false);
      }
    },
    [childrenByParent, newNodeDocId, pushHistory, resolveNodePosition, user.uid]
  );

  const handleContextAddStorySibling = useCallback(
    async (nodeId: string) => {
      if (!db) return;
      const baseNode = nodesById.get(nodeId);
      if (!baseNode || baseNode.kind !== "story") return;
      const parentId = baseNode.parentId;
      if (!parentId) return;
      const basePosition = resolveNodePosition(nodeId);
      const siblingIds = (childrenByParent.get(parentId) || []).filter((id) => id !== nodeId);
      const maxSiblingY = siblingIds.reduce((maxY, siblingId) => Math.max(maxY, resolveNodePosition(siblingId).y), basePosition.y);

      const newDoc = doc(collection(db, "users", user.uid, "nodes"));
      setBusyAction(true);
      setError(null);
      try {
        await setDoc(doc(db, "users", user.uid, "nodes", newDoc.id), {
          title: "New Story Beat",
          parentId,
          kind: "story",
          x: basePosition.x,
          y: maxSiblingY + 110,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies TreeNodeDoc & { createdAt: unknown; updatedAt: unknown });
        setPendingSelectedNodeId(newDoc.id);
        setPendingRenameNodeId(newDoc.id);
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not create story sibling.");
      } finally {
        setBusyAction(false);
      }
    },
    [childrenByParent, nodesById, resolveNodePosition, user.uid]
  );

  const handleContextDelete = useCallback(
    async (nodeId: string) => {
      if (!db || nodeId === rootNodeId) return;
      const ids = collectDescendants(nodeId, childrenByParent);
      const idSet = new Set(ids);
      const fallbackId = nodesById.get(nodeId)?.parentId || rootNodeId || null;

      // ── Build undo snapshot BEFORE the batch ───────────────────────────────
      const deletedNodes = ids.map((id) => nodesById.get(id)).filter(Boolean) as TreeNode[];
      const affectedRefs = refs.filter((ref) => ref.nodeIds.some((id) => idSet.has(id)));

      const fwdLocalNodes: LocalOp[] = [{ target: "nodes", op: "remove", nodeIds: ids }];
      const fwdFirestoreNodes: FirestoreOp[] = ids.map((id) => ({ kind: "deleteNode" as const, nodeId: id }));
      const fwdLocalRefs: LocalOp[] = [];
      const fwdFirestoreRefs: FirestoreOp[] = [];
      const invLocalRefs: LocalOp[] = [];
      const invFirestoreRefs: FirestoreOp[] = [];

      affectedRefs.forEach((ref) => {
        const keep = ref.nodeIds.filter((id) => !idSet.has(id));
        if (keep.length === 0) {
          fwdLocalRefs.push({ target: "refs", op: "remove", refIds: [ref.id] });
          fwdFirestoreRefs.push({ kind: "deleteRef", refId: ref.id });
        } else {
          const nextAnchorNodeId = chooseAnchorNodeId(keep, ref.anchorNodeId);
          const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
          const nextPortalPosition = resolvePortalFollowPosition(ref, nextAnchorPosition, `${ref.id}:context-delete`);
          fwdLocalRefs.push({ target: "refs", op: "patch", refId: ref.id, patch: { nodeIds: keep, anchorNodeId: nextAnchorNodeId, portalX: nextPortalPosition.x, portalY: nextPortalPosition.y } });
          fwdFirestoreRefs.push({ kind: "updateRef", refId: ref.id, data: { nodeIds: keep, anchorNodeId: nextAnchorNodeId ?? firestoreDeleteField(), portalX: nextPortalPosition.x, portalY: nextPortalPosition.y, portalAnchorX: nextAnchorPosition?.x ?? firestoreDeleteField(), portalAnchorY: nextAnchorPosition?.y ?? firestoreDeleteField() } });
        }
        invLocalRefs.push({ target: "refs", op: "patch", refId: ref.id, patch: { nodeIds: ref.nodeIds, anchorNodeId: ref.anchorNodeId, portalX: ref.portalX, portalY: ref.portalY } });
        invFirestoreRefs.push({ kind: "updateRef", refId: ref.id, data: { nodeIds: ref.nodeIds, anchorNodeId: ref.anchorNodeId ?? firestoreDeleteField(), portalX: ref.portalX, portalY: ref.portalY, portalAnchorX: ref.portalAnchorX ?? firestoreDeleteField(), portalAnchorY: ref.portalAnchorY ?? firestoreDeleteField() } });
      });

      const deletedTitle = nodesById.get(nodeId)?.title ?? nodeId;
      pushHistory({
        id: crypto.randomUUID(),
        label: `Delete "${deletedTitle}"`,
        forwardLocal:    [...fwdLocalNodes, ...fwdLocalRefs],
        forwardFirestore:[...fwdFirestoreNodes, ...fwdFirestoreRefs],
        inverseLocal: [
          ...deletedNodes.map((n): LocalOp => ({ target: "nodes", op: "add", node: n })),
          ...invLocalRefs,
        ],
        inverseFirestore:[
          ...deletedNodes.map((n): FirestoreOp => ({ kind: "setNode", nodeId: n.id, data: { title: n.title, parentId: n.parentId, kind: n.kind, x: n.x ?? 0, y: n.y ?? 0, ...(n.color ? { color: n.color } : {}), ...(n.taskStatus && n.taskStatus !== "none" ? { taskStatus: n.taskStatus } : {}), ...(n.body ? { body: n.body } : {}), ...(n.storySteps ? { storySteps: n.storySteps } : {}) } })),
          ...invFirestoreRefs,
        ],
      });
      // ───────────────────────────────────────────────────────────────────────

      setBusyAction(true);
      setError(null);
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => {
          batch.delete(doc(db, "users", user.uid, "nodes", id));
        });
        refs.forEach((ref) => {
          const keep = ref.nodeIds.filter((id) => !idSet.has(id));
          if (keep.length !== ref.nodeIds.length) {
            if (keep.length === 0) {
              batch.delete(doc(db, "users", user.uid, "crossRefs", ref.id));
            } else {
              const nextAnchorNodeId = chooseAnchorNodeId(keep, ref.anchorNodeId);
              const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
              const nextPortalPosition = resolvePortalFollowPosition(ref, nextAnchorPosition, `${ref.id}:context-delete`);
              batch.update(doc(db, "users", user.uid, "crossRefs", ref.id), {
                nodeIds: keep,
                anchorNodeId: nextAnchorNodeId ?? deleteField(),
                portalX: nextPortalPosition.x,
                portalY: nextPortalPosition.y,
                portalAnchorX: nextAnchorPosition?.x ?? deleteField(),
                portalAnchorY: nextAnchorPosition?.y ?? deleteField(),
                updatedAt: serverTimestamp(),
              });
            }
          }
        });
        await batch.commit();
        if (currentRootId && idSet.has(currentRootId)) {
          setCurrentRootId(fallbackId);
        }
        if (selectedNodeId === nodeId || idSet.has(selectedNodeId || "")) {
          setSelectedNodeId(fallbackId);
        }
        setActivePortalRefId(null);
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not delete node.");
      } finally {
        setBusyAction(false);
      }
    },
    [childrenByParent, currentRootId, nodesById, pushHistory, refs, resolveNodePosition, rootNodeId, selectedNodeId, user.uid]
  );

  const handleContextDuplicate = useCallback(
    async (nodeId: string) => {
      if (!db) return;
      const original = nodesById.get(nodeId);
      if (!original) return;

      const newDoc = doc(collection(db, "users", user.uid, "nodes"));
      setBusyAction(true);
      setError(null);
      try {
        await setDoc(doc(db, "users", user.uid, "nodes", newDoc.id), {
          title: `${original.title} (Copy)`,
          parentId: original.parentId,
          kind: original.kind,
          x: (typeof original.x === "number" ? original.x : 0) + 80,
          y: (typeof original.y === "number" ? original.y : 0) + 80,
          ...(original.color ? { color: original.color } : {}),
          ...(original.taskStatus && original.taskStatus !== "none" ? { taskStatus: original.taskStatus } : {}),
          ...(original.storySteps && original.storySteps.length > 0 ? { storySteps: original.storySteps } : {}),
          ...(original.body ? { body: original.body } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies TreeNodeDoc & { createdAt: unknown; updatedAt: unknown });
        setPendingSelectedNodeId(newDoc.id);
        setPendingRenameNodeId(newDoc.id);
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not duplicate node.");
      } finally {
        setBusyAction(false);
      }
    },
    [nodesById, user.uid]
  );

  const handleContextAddCrossRef = useCallback(
    async (nodeId: string) => {
      const anchor = nodesById.get(nodeId);
      setSelectedNodeId(nodeId);
      setActivePortalRefId(null);
      if (anchor) {
        setNewRefLabel((previous) => (previous.trim().length > 0 ? previous : `${anchor.title} Ref`));
      }
      setSidebarCollapsed(false);
      setMobileSidebarSection("bubbles");
      setMobileSidebarOpen(true);
      window.setTimeout(() => {
        const section = document.getElementById("cross-ref-bubbles-panel");
        section?.scrollIntoView({ block: "start", behavior: "smooth" });
        newRefLabelInputRef.current?.focus();
      }, 40);
    },
    [nodesById]
  );

  const handleContextRename = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setActivePortalRefId(null);
    setSidebarCollapsed(false);
    setMobileSidebarSection("node");
    setMobileSidebarOpen(true);
    window.setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 20);
  }, []);

  const handleContextChangeType = useCallback(
    async (nodeId: string) => {
      if (!db) return;
      const node = nodesById.get(nodeId);
      if (!node || node.kind === "root") return;

      // Cycle between project, item, and story.
      const previousKind = node.kind;
      const newKind = nextNodeKind(previousKind);

      pushHistory({
        id: crypto.randomUUID(),
        label: `Change type to "${newKind}"`,
        forwardLocal:    [{ target: "nodes", op: "patch", nodeId, patch: { kind: newKind } }],
        forwardFirestore:[{ kind: "updateNode", nodeId, data: { kind: newKind } }],
        inverseLocal:    [{ target: "nodes", op: "patch", nodeId, patch: { kind: previousKind } }],
        inverseFirestore:[{ kind: "updateNode", nodeId, data: { kind: previousKind } }],
      });
      setBusyAction(true);
      setError(null);
      setSelectedNodeId(nodeId);
      setActivePortalRefId(null);
      applyLocalNodePatch(nodeId, { kind: newKind });
      try {
        await updateDoc(doc(db, "users", user.uid, "nodes", nodeId), {
          kind: newKind,
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        applyLocalNodePatch(nodeId, { kind: previousKind });
        setError(actionError instanceof Error ? actionError.message : "Could not change node type.");
      } finally {
        setBusyAction(false);
      }
    },
    [applyLocalNodePatch, nodesById, pushHistory, user.uid]
  );

  const handleContextToggleTaskStatus = useCallback(
    (nodeId: string) => {
      const node = nodesById.get(nodeId);
      if (!node || node.kind === "root") return;
      const current = node.taskStatus || "none";
      const nextStatus: TaskStatus = current === "done" ? "todo" : "done";
      void setNodeTaskStatus(nodeId, nextStatus);
    },
    [nodesById, setNodeTaskStatus]
  );

  const paletteItems = useMemo(() => {
    const items: PaletteItem[] = [];
    const queryText = paletteQuery.trim().toLowerCase();
    const includesQuery = (value: string) => !queryText || value.toLowerCase().includes(queryText);

    const addItem = (id: string, label: string, hint: string | undefined, action: () => void, searchBlob = label) => {
      if (!includesQuery(searchBlob)) return;
      items.push({ id, label, hint, action });
    };

    addItem("cmd-grandmother", "Open top view (root)", "Navigation", goGrandmotherView, "top root grandmother home");
    addItem("cmd-up", "Go to parent view", "Navigation", goUpOneView, "up parent back one level");
    addItem("cmd-organize-tree", "Clean up tree layout", "Layout", organizeVisibleTree, "cleanup organize layout tidy tree auto arrange");
    addItem(
      "cmd-clean-bubbles",
      "Clean up cross-reference bubbles",
      "Cross-reference",
      cleanUpCrossRefs,
      "cleanup cross reference bubbles stale deleted"
    );
    if (currentRootKind === "story") {
      addItem(
        "cmd-toggle-story-lane",
        storyLaneMode ? "Disable story lane view" : "Enable story lane view",
        "Layout",
        () => setStoryLaneMode((prev) => !prev),
        "story lane linear sequence timeline"
      );
    }
    if (selectedNodeId) {
      addItem("cmd-open-master", "Open selected as master", "Navigation", openSelectedAsMaster, "open selected master");
      const selected = nodesById.get(selectedNodeId);
      if (selected?.kind === "story") {
        addItem(
          "cmd-open-story-lane",
          "Open selected in story lane",
          "Navigation",
          openSelectedAsStoryLane,
          "story lane linear sequence open"
        );
      }
      addItem(
        selected?.kind === "story" ? "cmd-add-story-sibling" : "cmd-add-child",
        selected?.kind === "story" ? "Add story sibling to selected node" : "Add child to selected node",
        "Create",
        () => {
          if (selected?.kind === "story") {
            handleContextAddStorySibling(selectedNodeId);
          } else {
            handleContextAddChild(selectedNodeId);
          }
        },
        selected?.kind === "story" ? "add story sibling beat sequence" : "add child create node"
      );
      if (selected && selected.kind !== "root") {
        const nextKind = nextNodeKind(selected.kind);
        addItem(
          "cmd-toggle-type",
          `Set selected node as ${nextKind}`,
          "Node type",
          () => handleContextChangeType(selectedNodeId),
          "toggle type project item story"
        );
        addItem(
          "cmd-toggle-task-status",
          selected.taskStatus === "done" ? "Mark selected task as todo" : "Mark selected task as done",
          "Task",
          () => handleContextToggleTaskStatus(selectedNodeId),
          "task done complete strike toggle"
        );
      }
    }
    addItem(
      "cmd-focus-search",
      "Focus node search",
      "Sidebar",
      () => {
        setSidebarCollapsed(false);
        setMobileSidebarSection("project");
        setMobileSidebarOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 30);
      },
      "focus search find node"
    );

    const nodeMatches = nodes
      .map((node) => ({ node, path: buildNodePath(node.id, nodesById) }))
      .filter((entry) => includesQuery(`${entry.node.title} ${entry.path}`))
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, 8);
    nodeMatches.forEach((entry) => {
      items.push({
        id: `node:${entry.node.id}`,
        label: entry.node.title,
        hint: entry.path,
        action: () => jumpToReferencedNode(entry.node.id),
      });
    });

    const entityMatches = refs
      .filter((ref) =>
        includesQuery(`${ref.code} ${ref.label} ${ref.entityType} ${ref.tags.join(" ")} ${ref.notes} ${ref.contact}`)
      )
      .slice(0, 8);
    entityMatches.forEach((ref) => {
      items.push({
        id: `entity:${ref.id}`,
        label: `${ref.code} - ${ref.label}`,
        hint: `${ref.entityType} · ${ref.nodeIds.length} links`,
        action: () => {
          setSidebarCollapsed(false);
          setMobileSidebarSection("bubbles");
          setMobileSidebarOpen(true);
          selectRefForEditing(ref.id);
        },
      });
    });

    if (selectedNodeId) {
      refs
        .filter((ref) => !ref.nodeIds.includes(selectedNodeId))
        .filter((ref) => includesQuery(`link ${ref.code} ${ref.label} ${ref.entityType} ${ref.tags.join(" ")}`))
        .slice(0, 6)
        .forEach((ref) => {
          items.push({
            id: `link:${ref.id}`,
            label: `Link selected to ${ref.code} - ${ref.label}`,
            hint: "Entity link",
            action: () => linkCrossRefToNode(ref.id, selectedNodeId),
          });
        });
    }

    return items;
  }, [
    cleanUpCrossRefs,
    currentRootKind,
    goGrandmotherView,
    goUpOneView,
    handleContextAddChild,
    handleContextAddStorySibling,
    handleContextChangeType,
    handleContextToggleTaskStatus,
    jumpToReferencedNode,
    linkCrossRefToNode,
    nodes,
    nodesById,
    openSelectedAsMaster,
    openSelectedAsStoryLane,
    organizeVisibleTree,
    paletteQuery,
    refs,
    selectRefForEditing,
    selectedNodeId,
    storyLaneMode,
  ]);

  useEffect(() => {
    if (!paletteOpen) return;
    setPaletteIndex(0);
    const id = window.setTimeout(() => {
      paletteInputRef.current?.focus();
      paletteInputRef.current?.select();
    }, 10);
    return () => window.clearTimeout(id);
  }, [paletteOpen]);

  const runPaletteAction = useCallback((item: PaletteItem) => {
    item.action();
    setPaletteOpen(false);
    setPaletteQuery("");
    setPaletteIndex(0);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Cmd/Ctrl+Z
      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (canUndo && !busyAction) undo(applyLocalOps);
        return;
      }

      // Redo: Cmd/Ctrl+Shift+Z  (also Ctrl+Y on Windows)
      if ((cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z") ||
          (!isMac && e.ctrlKey && e.key.toLowerCase() === "y")) {
        e.preventDefault();
        if (canRedo && !busyAction) redo(applyLocalOps);
        return;
      }

      if (cmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => {
          const next = !prev;
          if (next) {
            setPaletteQuery("");
            setPaletteIndex(0);
          }
          return next;
        });
        return;
      }

      if (paletteOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setPaletteOpen(false);
          setPaletteQuery("");
          setPaletteIndex(0);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setPaletteIndex((prev) => Math.min(prev + 1, Math.max(0, paletteItems.length - 1)));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setPaletteIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const item = paletteItems[paletteIndex];
          if (item) runPaletteAction(item);
          return;
        }
        return;
      }

      // Ignore if typing in input/textarea or if context menu is open
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || contextMenu) {
        return;
      }

      // Ctrl/Cmd+N - New child node
      if (cmdOrCtrl && e.key === 'n') {
        e.preventDefault();
        if (selectedNodeId) {
          handleContextAddChild(selectedNodeId);
        }
        return;
      }

      // Ctrl/Cmd+D - Duplicate node
      if (cmdOrCtrl && e.key === 'd') {
        e.preventDefault();
        if (selectedNodeId) {
          handleContextDuplicate(selectedNodeId);
        }
        return;
      }

      // Delete/Backspace - Delete node
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.shiftKey && !cmdOrCtrl) {
        e.preventDefault();
        if (selectedNodeId) {
          handleContextDelete(selectedNodeId);
        }
        return;
      }

      // Ctrl/Cmd+F - Focus search
      if (cmdOrCtrl && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Escape - Deselect or clear search
      if (e.key === 'Escape') {
        if (mobileQuickEditorOpen) {
          setMobileQuickEditorOpen(false);
          return;
        }
        if (mobileSidebarOpen) {
          setMobileSidebarOpen(false);
          return;
        }
        if (searchQuery) {
          setSearchQuery("");
        } else {
          setSelectedNodeId(null);
          setActivePortalRefId(null);
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    contextMenu,
    handleContextAddChild,
    handleContextDelete,
    handleContextDuplicate,
    paletteIndex,
    paletteItems,
    paletteOpen,
    mobileQuickEditorOpen,
    mobileSidebarOpen,
    runPaletteAction,
    searchQuery,
    selectedNodeId,
    canUndo,
    canRedo,
    undo,
    redo,
    applyLocalOps,
    busyAction,
  ]);

  const sidebarIsCollapsed = !isMobileLayout && sidebarCollapsed;
  const showProjectSection = !isMobileLayout || mobileSidebarSection === "project";
  const showNodeSection = !isMobileLayout || mobileSidebarSection === "node";
  const showBubblesSection = !isMobileLayout || mobileSidebarSection === "bubbles";

  if (!db) {
    return (
      <div className="planner-empty-state">
        Firestore is not available. Configure Firebase credentials to use the planning graph editor.
      </div>
    );
  }

  if (loading) {
    return <div className="planner-empty-state">Loading your planning graph...</div>;
  }

  return (
    <div className={`planner-shell ${sidebarIsCollapsed ? "sidebar-collapsed" : ""} ${isMobileLayout ? "mobile" : ""}`}>
      <aside
        className={`planner-sidebar ${sidebarIsCollapsed ? "collapsed" : ""} ${isMobileLayout ? (mobileSidebarOpen ? "mobile-open" : "mobile-hidden") : ""}`}
      >
        <div className="planner-sidebar-header">
          <button
            onClick={() => {
              if (isMobileLayout) {
                setMobileSidebarOpen(false);
                return;
              }
              setSidebarCollapsed(!sidebarCollapsed);
            }}
            className="planner-sidebar-toggle"
            aria-label={isMobileLayout ? "Close controls" : sidebarIsCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isMobileLayout ? "✕" : sidebarIsCollapsed ? "→" : "←"}
          </button>
          {!sidebarIsCollapsed && (
            <div className="planner-undo-redo-btns">
              <button
                className="planner-undo-redo-btn"
                onClick={() => undo(applyLocalOps)}
                disabled={!canUndo || busyAction}
                title={undoLabel ? `Undo: ${undoLabel}` : "Undo (⌘Z)"}
                aria-label="Undo"
              >
                ↩
              </button>
              <button
                className="planner-undo-redo-btn"
                onClick={() => redo(applyLocalOps)}
                disabled={!canRedo || busyAction}
                title={redoLabel ? `Redo: ${redoLabel}` : "Redo (⌘⇧Z)"}
                aria-label="Redo"
              >
                ↪
              </button>
            </div>
          )}
        </div>

        {sidebarIsCollapsed ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            paddingTop: "12px",
          }}>
            <div style={{
              fontSize: "10px",
              color: "rgba(245, 248, 255, 0.6)",
              textAlign: "center",
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              letterSpacing: "1px",
              fontWeight: 700,
            }}>
              Controls
            </div>
          </div>
        ) : (
          <>
        {/* Search Input */}
        <div style={{
          padding: "12px 12px 0",
          marginBottom: "12px",
        }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={isMobileLayout ? "Search nodes..." : "Search nodes... (Ctrl+F)"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.05)",
              color: "rgba(245, 248, 255, 0.94)",
              fontSize: isMobileLayout ? "16px" : "13px",
              outline: "none",
              transition: "all 150ms ease",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(34, 197, 94, 0.5)";
              e.target.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(255, 255, 255, 0.15)";
              e.target.style.background = "rgba(255, 255, 255, 0.05)";
            }}
          />
          {searchMatchingIds.size > 0 && (
            <div style={{
              marginTop: "6px",
              fontSize: "11px",
              color: "rgba(34, 197, 94, 0.9)",
              fontWeight: 600,
            }}>
              {searchMatchingIds.size} match{searchMatchingIds.size !== 1 ? "es" : ""} found
            </div>
          )}
          <button
            className="planner-palette-launcher"
            onClick={() => {
              setPaletteOpen(true);
              setPaletteQuery("");
              setPaletteIndex(0);
            }}
          >
            Command palette (Cmd/Ctrl+K)
          </button>
          {!isMobileLayout ? (
            <div className="planner-top-actions">
              <button onClick={organizeVisibleTree} disabled={busyAction || filteredTreeIds.length === 0}>
                Clean up tree layout
              </button>
              <button onClick={cleanUpCrossRefs} disabled={busyAction}>
                Clean stale bubbles
              </button>
            </div>
          ) : null}
        </div>

        {isMobileLayout ? (
          <div className="planner-mobile-section-tabs">
            <button
              className={mobileSidebarSection === "project" ? "active" : ""}
              onClick={() => setMobileSidebarSection("project")}
            >
              Project
            </button>
            <button
              className={mobileSidebarSection === "node" ? "active" : ""}
              onClick={() => setMobileSidebarSection("node")}
            >
              Node
            </button>
            <button
              className={mobileSidebarSection === "bubbles" ? "active" : ""}
              onClick={() => setMobileSidebarSection("bubbles")}
            >
              Bubbles
            </button>
          </div>
        ) : null}

        {showProjectSection ? (
          <>
        <div id="cross-ref-bubbles-panel" className="planner-panel-block">
          <h2>{profileName || "Main Node"}</h2>
          <p className="planner-subtle">{user.email}</p>
          <p className="planner-subtle">
            Current view: <strong>{currentRootPath || "No selection"}</strong>
          </p>
          <div className="planner-inline-buttons">
            <button onClick={goGrandmotherView} disabled={!rootNodeId} title="Jump to your root project view">
              Top view (root)
            </button>
            <button onClick={goUpOneView} disabled={!currentRootNode?.parentId} title="Move one level up from the current view">
              Parent view
            </button>
          </div>
          <p className="planner-subtle">Top view jumps to your root project. Parent view moves one level up.</p>
          <button onClick={openSelectedAsMaster} disabled={!selectedNodeId}>
            Open selected as master
          </button>
          <div className="planner-inline-buttons">
            <button onClick={openSelectedAsStoryLane} disabled={!selectedNodeId || selectedNode?.kind !== "story"}>
              Open selected in story lane
            </button>
            <button onClick={() => setStoryLaneMode((prev) => !prev)} disabled={currentRootKind !== "story"}>
              {storyLaneMode ? "Story lane: on" : "Story lane: off"}
            </button>
          </div>
          <div className="planner-row-label">Quick maintenance</div>
          <div className="planner-inline-buttons">
            <button onClick={organizeVisibleTree} disabled={busyAction || filteredTreeIds.length === 0}>
              Clean up tree layout
            </button>
            <button onClick={cleanUpCrossRefs} disabled={busyAction}>
              Clean stale bubbles
            </button>
          </div>
        </div>

        <div className="planner-panel-block">
          <h3>Add Child Node</h3>
          <p className="planner-subtle">Leave blank to create a default node name and rename immediately.</p>
          <input
            value={newChildTitle}
            onChange={(event) => setNewChildTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (busyAction) return;
              void createChild();
            }}
            placeholder="Film Production, Education, Finance..."
          />
          <button
            onClick={createChild}
            disabled={busyAction || (!selectedNodeId && !currentRootId && !rootNodeId)}
          >
            Add child
          </button>
        </div>
          </>
        ) : null}

        {showNodeSection ? (
        <div className="planner-panel-block">
          <h3>Selected Node</h3>
          {selectedNode ? (
            <>
              <div className="planner-row-label">Path</div>
              <div className="planner-path">{buildNodePath(selectedNode.id, nodesById)}</div>
              <div className="planner-row-label">Type</div>
              <div className="planner-inline-buttons">
                <button
                  onClick={() => handleContextChangeType(selectedNode.id)}
                  disabled={busyAction || selectedNode.kind === "root"}
                >
                  {selectedNode.kind === "root" ? "Root" : `Set as ${nextNodeKind(selectedNode.kind)}`}
                </button>
                <button disabled>{selectedNode.kind}</button>
              </div>
              <div className="planner-row-label">Task status</div>
              <div className="planner-inline-buttons">
                <select
                  value={selectedNode.taskStatus || "none"}
                  onChange={(event) => {
                    void setNodeTaskStatus(selectedNode.id, event.target.value as TaskStatus);
                  }}
                  disabled={busyAction || selectedNode.kind === "root"}
                >
                  <option value="none">No task</option>
                  <option value="todo">Todo</option>
                  <option value="done">Done</option>
                </select>
                <button
                  onClick={() => {
                    const current = selectedNode.taskStatus || "none";
                    const nextStatus: TaskStatus = current === "done" ? "todo" : "done";
                    void setNodeTaskStatus(selectedNode.id, nextStatus);
                  }}
                  disabled={busyAction || selectedNode.kind === "root"}
                >
                  {selectedNode.taskStatus === "done" ? "Mark todo" : "Mark done"}
                </button>
              </div>
              <div className="planner-row-label">Color</div>
              <div className="planner-inline-buttons">
                <input
                  type="color"
                  value={selectedNode.color || (selectedNodeHasStoryChildren ? storyContainerColor() : defaultNodeColor(selectedNode.kind))}
                  onChange={(event) => {
                    void setNodeColor(selectedNode.id, event.target.value);
                  }}
                  disabled={busyAction}
                  style={{ width: "72px", height: "34px", padding: "4px 6px" }}
                />
                <button
                  onClick={() => {
                    void setNodeColor(selectedNode.id, undefined);
                  }}
                  disabled={busyAction || !selectedNode.color}
                >
                  Reset color
                </button>
              </div>
              <input
                ref={renameInputRef}
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (busyAction) return;
                  void renameSelected();
                }}
              />
              <div className="planner-inline-buttons">
                <button onClick={renameSelected} disabled={busyAction || renameTitle.trim().length === 0}>
                  Rename
                </button>
                <button
                  className="danger"
                  onClick={deleteSelected}
                  disabled={busyAction || selectedNode.id === rootNodeId}
                >
                  Delete subtree
                </button>
              </div>
              <div className="planner-row-label">Body text</div>
              <textarea
                value={bodyDraft}
                onChange={(event) => setBodyDraft(event.target.value)}
                placeholder={
                  selectedNode.kind === "story"
                    ? "Write scene/story details for this node..."
                    : "Write extended notes for this node..."
                }
                rows={selectedNode.kind === "story" ? 7 : 5}
                disabled={busyAction}
              />
              <button onClick={saveSelectedBody} disabled={busyAction || bodyDraft.trim() === (selectedNode.body || "").trim()}>
                Save body text
              </button>

              <div className="planner-row-label">Children</div>
              <div className="planner-chip-list">
                {selectedNodeChildren.length === 0 ? (
                  <span className="planner-subtle">No child nodes yet.</span>
                ) : (
                  selectedNodeChildren.map((child) => (
                    <button
                      key={child.id}
                      className="chip"
                      onClick={() => {
                        setSelectedNodeId(child.id);
                        setActivePortalRefId(null);
                      }}
                    >
                      <span className={child.taskStatus === "done" ? "planner-node-title done" : ""}>{child.title}</span>
                    </button>
                  ))
                )}
              </div>

              {selectedNode.kind === "story" ? (
                <>
                  <div className="planner-row-label">Story lane</div>
                  <div className="planner-inline-buttons">
                    <button onClick={openSelectedAsStoryLane}>Open this story in lane view</button>
                    <button
                      onClick={() => {
                        void handleContextAddChild(selectedNode.id);
                      }}
                      disabled={busyAction}
                    >
                      Add beat node
                    </button>
                  </div>
                  <p className="planner-subtle">
                    Lane view arranges child nodes left-to-right as beats. Use each beat node's body text for long scene notes.
                  </p>
                  <details className="planner-advanced-tools">
                    <summary>Legacy checklist beats (optional)</summary>
                    <div className="planner-advanced-tools-content">
                      <div className="planner-reference-list">
                        {(selectedNode.storySteps || []).length === 0 ? (
                          <span className="planner-subtle">No checklist beats yet.</span>
                        ) : (
                          (selectedNode.storySteps || []).map((step, index) => (
                            <div key={step.id} className="planner-story-step-item">
                              <button
                                className="planner-story-step-toggle"
                                onClick={() => {
                                  void toggleStoryStepDone(step.id);
                                }}
                                disabled={busyAction}
                                title={step.done ? "Mark as not done" : "Mark as done"}
                              >
                                {step.done ? "☑" : "☐"}
                              </button>
                              <span className={step.done ? "planner-story-step-text done" : "planner-story-step-text"}>
                                {`${index + 1}. ${step.text}`}
                              </span>
                              <div className="planner-story-step-actions">
                                <button
                                  onClick={() => {
                                    void moveStoryStep(step.id, -1);
                                  }}
                                  disabled={busyAction || index === 0}
                                  title="Move up"
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => {
                                    void moveStoryStep(step.id, 1);
                                  }}
                                  disabled={busyAction || index === (selectedNode.storySteps || []).length - 1}
                                  title="Move down"
                                >
                                  ↓
                                </button>
                                <button
                                  className="danger"
                                  onClick={() => {
                                    void deleteStoryStep(step.id);
                                  }}
                                  disabled={busyAction}
                                  title="Delete step"
                                >
                                  x
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="planner-story-step-add">
                        <input
                          value={newStoryStepText}
                          onChange={(event) => setNewStoryStepText(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            if (busyAction || newStoryStepText.trim().length === 0) return;
                            void addStoryStep();
                          }}
                          placeholder="Add checklist beat..."
                          disabled={busyAction}
                        />
                        <button onClick={addStoryStep} disabled={busyAction || newStoryStepText.trim().length === 0}>
                          Add step
                        </button>
                      </div>
                    </div>
                  </details>
                </>
              ) : null}
            </>
          ) : (
            <p className="planner-subtle">No node selected.</p>
          )}
        </div>
        ) : null}

        {showBubblesSection ? (
        <div className="planner-panel-block">
          <h3>Bubbles</h3>
          <p className="planner-subtle">
            Shared entities across branches — vendor, partner, person, etc.
          </p>

          {/* ── CREATE / ATTACH ── */}
          <div className="planner-row-label">
            {selectedNode ? `Attach to: ${selectedNode.title}` : "Select a node to attach"}
          </div>
          <input
            ref={newRefLabelInputRef}
            value={newRefLabel}
            onChange={(event) => setNewRefLabel(event.target.value)}
            placeholder="Name (e.g., Mario Pinto, ACME Corp)"
          />
          <div className="planner-inline-buttons">
            <input
              value={newRefCode}
              onChange={(event) => setNewRefCode(event.target.value)}
              placeholder="Code (e.g., MP)"
              style={{ flex: 1 }}
            />
            <select value={newRefType} onChange={(event) => setNewRefType(event.target.value as EntityType)} style={{ flex: 1 }}>
              {ENTITY_TYPE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((entityType) => (
                    <option key={entityType} value={entityType}>
                      {entityType}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {(() => {
            const typedCode = newRefCode.trim() ? normalizeCode(newRefCode) : (newRefLabel.trim() ? initialsFromLabel(newRefLabel) : "");
            if (!typedCode) return null;
            const collisions = refs.filter((r) => r.code === typedCode);
            if (collisions.length === 0) return null;
            return (
              <p className="planner-code-collision-warn">
                ⚠ Code <strong>{typedCode}</strong> already used by:{" "}
                {collisions.map((r) => r.label).join(", ")}. Consider a longer code (e.g. <em>MPinto</em> vs <em>MPérez</em>).
              </p>
            );
          })()}
          <button onClick={createCrossRef} disabled={busyAction || !selectedNodeId || newRefLabel.trim().length === 0}>
            Create and attach to selected
          </button>

          {newRefSuggestions.length > 0 ? (
            <>
              <div className="planner-row-label">Or attach existing</div>
              <div className="planner-chip-list">
                {newRefSuggestions.map((ref) => (
                  <button
                    key={ref.id}
                    className="chip"
                    onClick={() => {
                      if (!selectedNodeId) return;
                      linkCrossRefToNode(ref.id, selectedNodeId);
                    }}
                    title={describeRefTargets(ref, 4)}
                  >
                    {`${ref.code} — ${ref.label}`}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {/* ── ON SELECTED NODE ── */}
          <div className="planner-row-label">On selected node</div>
          <div className="planner-chip-list">
            {selectedNodeRefs.length === 0 || !selectedNodeId ? (
              <span className="planner-subtle">None attached.</span>
            ) : (
              selectedNodeRefs.map((ref) => (
                <div key={ref.id} className="chip with-action">
                  <button
                    onClick={() => selectRefForEditing(ref.id)}
                    title={describeRefTargets(ref, 4)}
                  >{`${ref.code} — ${ref.label}`}</button>
                  <button
                    className="chip-action"
                    onClick={() => detachCrossRef(ref.id, selectedNodeId)}
                    title="Detach from selected node"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* ── ACTIVE BUBBLE (set by clicking on canvas or selecting here) ── */}
          {activePortalRef ? (
            <div className="planner-panel-block" style={{ marginTop: 8, padding: "10px 12px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                {`${activePortalRef.code} — ${activePortalRef.label}`}
                <span className="planner-kind-badge" style={{ marginLeft: 6 }}>{activePortalRef.entityType}</span>
              </div>
              {activePortalRef.contact ? <p className="planner-subtle" style={{ margin: "2px 0" }}>{activePortalRef.contact}</p> : null}
              {activePortalRef.notes ? <p className="planner-subtle" style={{ margin: "2px 0" }}>{activePortalRef.notes}</p> : null}
              {activePortalRef.links.length > 0 ? (
                <div style={{ margin: "4px 0" }}>
                  {activePortalRef.links.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 11, wordBreak: "break-all" }}>
                      {url}
                    </a>
                  ))}
                </div>
              ) : null}
              <div className="planner-row-label" style={{ marginTop: 6 }}>Linked nodes</div>
              <div className="planner-reference-list">
                {activePortalTargets.map((target) => (
                  <button key={target.id} onClick={() => jumpToReferencedNode(target.id)}>
                    {buildNodePath(target.id, nodesById)}
                  </button>
                ))}
              </div>
              <div className="planner-inline-buttons" style={{ marginTop: 6 }}>
                <button
                  onClick={() => {
                    if (!selectedNodeId) return;
                    if (activePortalRef.nodeIds.includes(selectedNodeId)) {
                      void detachCrossRef(activePortalRef.id, selectedNodeId);
                    } else {
                      void linkCrossRefToNode(activePortalRef.id, selectedNodeId);
                    }
                  }}
                  disabled={busyAction || !selectedNodeId}
                >
                  {!selectedNodeId ? "Select node" : activePortalRef.nodeIds.includes(selectedNodeId) ? "Unlink selected" : "Link to selected"}
                </button>
                <button
                  onClick={() => {
                    selectRefForEditing(activePortalRef.id);
                  }}
                  disabled={busyAction}
                >
                  Edit bubble
                </button>
              </div>
            </div>
          ) : null}

          {/* ── BUBBLE MANAGER (full list + edit) ── */}
          <details className="planner-advanced-tools">
            <summary>Manage all bubbles ({refs.length})</summary>
            <div className="planner-advanced-tools-content">
              <div className="planner-filter-toggle">
                <button type="button" className={refScopeFilter === "view" ? "active" : ""} onClick={() => setRefScopeFilter("view")}>
                  This view
                </button>
                <button type="button" className={refScopeFilter === "all" ? "active" : ""} onClick={() => setRefScopeFilter("all")}>
                  All
                </button>
                <button
                  type="button"
                  className={refCategoryFilter === "people" ? "active" : ""}
                  onClick={() => setRefCategoryFilter(refCategoryFilter === "people" ? "all" : "people")}
                >
                  People
                </button>
              </div>
              <input
                value={refSearchQuery}
                onChange={(event) => setRefSearchQuery(event.target.value)}
                placeholder="Search bubbles..."
              />
              <div className="planner-reference-list">
                {filteredRefs.length === 0 ? (
                  <span className="planner-subtle">
                    {refs.length === 0 ? "No bubbles yet." : "No matches."}
                  </span>
                ) : (
                  filteredRefs.map((ref) => {
                    const linkedOnSelected = selectedNodeId ? selectedNodeRefIds.has(ref.id) : false;
                    return (
                      <div key={ref.id} className="planner-reference-item">
                        <button onClick={() => selectRefForEditing(ref.id)}>{`${ref.code} — ${ref.label}`}</button>
                        <div className="planner-reference-preview">{describeRefLibraryPreview(ref)}</div>
                        <div className="planner-reference-actions">
                          <button
                            onClick={() => {
                              if (!selectedNodeId) return;
                              if (linkedOnSelected) {
                                detachCrossRef(ref.id, selectedNodeId);
                              } else {
                                linkCrossRefToNode(ref.id, selectedNodeId);
                              }
                            }}
                            disabled={busyAction || !selectedNodeId}
                          >
                            {!selectedNodeId ? "Select node" : linkedOnSelected ? "Unlink" : "Link to selected"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Edit active bubble */}
              {editRefId ? (
                <>
                  <div className="planner-row-label">
                    Editing: {editRefLabel || "—"}
                  </div>
                  <input
                    value={editRefLabel}
                    onChange={(event) => setEditRefLabel(event.target.value)}
                    placeholder="Bubble name"
                  />
                  <div className="planner-inline-buttons">
                    <input
                      value={editRefCode}
                      onChange={(event) => setEditRefCode(event.target.value)}
                      placeholder="Code"
                      style={{ flex: 1 }}
                    />
                    <select
                      value={editRefType}
                      onChange={(event) => setEditRefType(event.target.value as EntityType)}
                      style={{ flex: 1 }}
                    >
                      {ENTITY_TYPE_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map((entityType) => (
                            <option key={entityType} value={entityType}>{entityType}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <input
                    value={editRefTags}
                    onChange={(event) => setEditRefTags(event.target.value)}
                    placeholder="Tags (comma-separated)"
                  />
                  <input
                    value={editRefContact}
                    onChange={(event) => setEditRefContact(event.target.value)}
                    placeholder="Contact info"
                  />
                  <textarea
                    value={editRefNotes}
                    onChange={(event) => setEditRefNotes(event.target.value)}
                    placeholder="Notes"
                    rows={3}
                  />
                  <textarea
                    value={editRefLinks}
                    onChange={(event) => setEditRefLinks(event.target.value)}
                    placeholder="One URL per line"
                    rows={2}
                  />
                  <div className="planner-inline-buttons">
                    <button onClick={saveCrossRefEdits} disabled={busyAction || editRefLabel.trim().length === 0}>
                      Save
                    </button>
                    <button onClick={() => void duplicateCrossRef(editRefId)} disabled={busyAction}>
                      Duplicate
                    </button>
                  </div>

                  {/* Link to another node */}
                  <div className="planner-row-label">Link to node</div>
                  <input
                    value={linkNodeQuery}
                    onChange={(event) => setLinkNodeQuery(event.target.value)}
                    placeholder="Search node..."
                  />
                  <select value={linkTargetNodeId} onChange={(event) => setLinkTargetNodeId(event.target.value)}>
                    <option value="">Choose node...</option>
                    {linkableNodeOptions.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.path}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => { if (editRefId && linkTargetNodeId) linkCrossRefToNode(editRefId, linkTargetNodeId); }}
                    disabled={busyAction || !linkTargetNodeId}
                  >
                    Link node
                  </button>

                  {/* Linked nodes */}
                  <div className="planner-row-label">All linked nodes</div>
                  <div className="planner-reference-list">
                    {editableRefTargets.length === 0 ? (
                      <span className="planner-subtle">Not linked to any node yet.</span>
                    ) : (
                      editableRefTargets.map((entry) => (
                        <div key={entry.id} className="planner-reference-target-item">
                          <button onClick={() => jumpToReferencedNode(entry.id)}>{entry.path}</button>
                          <button className="danger" onClick={() => detachCrossRef(editRefId, entry.id)} disabled={busyAction}>
                            Unlink
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Merge */}
                  {mergeCandidateRefs.length > 0 ? (
                    <>
                      <div className="planner-row-label">Merge duplicate</div>
                      <select value={mergeFromRefId} onChange={(event) => setMergeFromRefId(event.target.value)}>
                        <option value="">Select duplicate...</option>
                        {mergeCandidateRefs.map((ref) => (
                          <option key={ref.id} value={ref.id}>{`${ref.code} — ${ref.label}`}</option>
                        ))}
                      </select>
                      <button onClick={mergeCrossRefIntoEdited} disabled={busyAction || !mergeFromRefId}>
                        Merge into current
                      </button>
                    </>
                  ) : null}

                  <button className="danger" onClick={deleteCrossRefBubble} disabled={busyAction} style={{ marginTop: 8 }}>
                    Delete bubble
                  </button>
                </>
              ) : (
                <p className="planner-subtle">Click a bubble above to edit it.</p>
              )}
            </div>
          </details>

        </div>
        ) : null}


        {error ? <div className="planner-error">{error}</div> : null}
          </>
        )}
      </aside>

      {isMobileLayout && mobileSidebarOpen ? (
        <button
          type="button"
          className="planner-mobile-backdrop"
          aria-label="Close controls panel"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      {isMobileLayout && mobileQuickEditorOpen ? (
        <button
          type="button"
          className="planner-mobile-backdrop planner-mobile-sheet-backdrop"
          aria-label="Close quick editor"
          onClick={() => setMobileQuickEditorOpen(false)}
        />
      ) : null}

      {isMobileLayout && mobileQuickEditorOpen ? (
        <section
          className="planner-mobile-sheet"
          role="dialog"
          aria-label="Quick node editor"
          onTouchStart={(e) => { sheetTouchStartY.current = e.touches[0]?.clientY ?? null; }}
          onTouchEnd={(e) => {
            const startY = sheetTouchStartY.current;
            if (startY === null) return;
            const endY = e.changedTouches[0]?.clientY ?? startY;
            sheetTouchStartY.current = null;
            // Swipe down ≥ 60px → dismiss
            if (endY - startY > 60) setMobileQuickEditorOpen(false);
          }}
        >
          <div
            className="planner-mobile-sheet-handle"
            onClick={() => setMobileQuickEditorOpen(false)}
            role="button"
            aria-label="Close"
          />
          {selectedNode ? (
            <>
              <div className="planner-mobile-sheet-header">
                <strong>{selectedNode.title}</strong>
                <span>{selectedNode.kind}</span>
              </div>
              <div className="planner-mobile-sheet-path">{buildNodePath(selectedNode.id, nodesById)}</div>
              <input
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (busyAction) return;
                  void renameSelected();
                }}
                placeholder="Rename node..."
              />
              <textarea
                value={bodyDraft}
                onChange={(event) => setBodyDraft(event.target.value)}
                placeholder={selectedNode.kind === "story" ? "Scene/story body..." : "Node notes..."}
                rows={selectedNode.kind === "story" ? 6 : 4}
              />
              <button onClick={saveSelectedBody} disabled={busyAction || bodyDraft.trim() === (selectedNode.body || "").trim()}>
                Save Body
              </button>
              <div className="planner-mobile-sheet-grid">
                <button
                  onClick={() => {
                    if (selectedNode.kind === "root") return;
                    const current = selectedNode.taskStatus || "none";
                    const nextStatus: TaskStatus = current === "done" ? "todo" : "done";
                    void setNodeTaskStatus(selectedNode.id, nextStatus);
                  }}
                  disabled={busyAction || selectedNode.kind === "root"}
                >
                  {selectedNode.taskStatus === "done" ? "Mark Todo" : "Mark Done"}
                </button>
                <button
                  onClick={() => {
                    void handleContextChangeType(selectedNode.id);
                  }}
                  disabled={busyAction || selectedNode.kind === "root"}
                >
                  {selectedNode.kind === "root" ? "Root" : `Set ${nextNodeKind(selectedNode.kind)}`}
                </button>
                <button
                  onClick={() => {
                    setCurrentRootId(selectedNode.id);
                    setMobileQuickEditorOpen(false);
                  }}
                >
                  Focus Here
                </button>
                <button
                  onClick={() => {
                    void handleContextAddChild(selectedNode.id);
                  }}
                  disabled={busyAction}
                >
                  Add Child
                </button>
              </div>
              {selectedNode.kind === "story" ? (
                <div className="planner-mobile-sheet-story">
                  <button onClick={openSelectedAsStoryLane}>Open Story Lane</button>
                  <button
                    onClick={() => {
                      void handleContextAddChild(selectedNode.id);
                    }}
                    disabled={busyAction}
                  >
                    Add Beat Node
                  </button>
                </div>
              ) : null}
              <div className="planner-mobile-sheet-actions">
                <button
                  onClick={() => {
                    setMobileSidebarSection("node");
                    setMobileSidebarOpen(true);
                  }}
                >
                  Open Full Node Panel
                </button>
                <button onClick={() => setMobileQuickEditorOpen(false)}>Close</button>
              </div>
            </>
          ) : (
            <div className="planner-subtle">Select a node to edit.</div>
          )}
        </section>
      ) : null}

      <main className="planner-canvas">
        {isMobileLayout ? (
          <div className="planner-mobile-toolbar">
            <button
              onClick={() => {
                setMobileSidebarSection("project");
                setMobileSidebarOpen(true);
                setMobileQuickEditorOpen(false);
              }}
            >
              ☰ Menu
            </button>
            <button
              onClick={() => {
                setMobileSidebarOpen(false);
                setMobileQuickEditorOpen(true);
              }}
              disabled={!selectedNode}
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (!selectedNodeId) return;
                void handleContextAddChild(selectedNodeId);
              }}
              disabled={!selectedNodeId}
            >
              ＋ Child
            </button>
            <button
              onClick={() => {
                if (!selectedNodeId || !selectedNode || selectedNode.kind === "root") return;
                const current = selectedNode.taskStatus || "none";
                const nextStatus: TaskStatus = current === "done" ? "todo" : "done";
                void setNodeTaskStatus(selectedNodeId, nextStatus);
              }}
              disabled={!selectedNode || selectedNode.kind === "root"}
            >
              {selectedNode?.taskStatus === "done" ? "↩ Todo" : "✓ Done"}
            </button>
            <button onClick={goGrandmotherView} disabled={!rootNodeId}>
              ⌂ Home
            </button>
            <button onClick={goUpOneView} disabled={!currentRootNode?.parentId}>
              ↑ Up
            </button>
          </div>
        ) : null}

        <ReactFlow
          nodes={reactFlowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: isMobileLayout ? 0.12 : 0.3, maxZoom: isMobileLayout ? 0.85 : 1 }}
          nodesConnectable={false}
          selectionOnDrag={!isMobileLayout}
          selectionMode={isMobileLayout ? SelectionMode.Full : SelectionMode.Partial}
          // On mobile, single-finger drag pans the canvas (no box-selection).
          // On desktop, panning requires middle-mouse or space+drag.
          panOnDrag={isMobileLayout ? [0, 1, 2] : [1, 2]}
          panOnScroll={!isMobileLayout}
          multiSelectionKeyCode={["Shift", "Meta", "Control"]}
          onInit={setRfInstance}
          onNodesChange={handleNodesChange}
          onNodeClick={(_, node) => {
            setContextMenu(null);
            setPortalContextMenu(null);
            // Portal orb tap: toggle active state and (on mobile) open Bubbles panel.
            if (node.id.startsWith("portal:")) {
              const parts = node.id.split(":");
              const refId = parts[1];
              setActivePortalRefId((prev) => (prev === refId ? null : refId));
              if (isMobileLayout) {
                setMobileSidebarSection("bubbles");
                setMobileSidebarOpen(true);
                setMobileQuickEditorOpen(false);
              }
              return;
            }
            setSelectedNodeId(node.id);
            setActivePortalRefId(null);
            if (isMobileLayout) setMobileSidebarOpen(false);
          }}
          onNodeDoubleClick={(_, node) => {
            if (isMobileLayout) return;
            // Zoom only; changing view root is an explicit action.
            onNodeDoubleClick(_, node);
          }}
          onNodeMouseEnter={(_, node) => {
            // Portal orbs are not in the hover index — hovering them would
            // dim ALL tree nodes to 0.4 opacity. Skip portals entirely.
            if (node.id.startsWith("portal:")) return;
            setHoveredNodeId(node.id);
          }}
          onNodeMouseLeave={(_, node) => {
            if (node.id.startsWith("portal:")) return;
            setHoveredNodeId(null);
          }}
          onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
          onEdgeMouseLeave={() => setHoveredEdgeId(null)}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onSelectionDragStop={onSelectionDragStop}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            // Portal orb right-click → show portal delete menu
            if (node.id.startsWith("portal:")) {
              const parts = node.id.split(":");
              const refId = parts[1];
              setPortalContextMenu({ x: event.clientX, y: event.clientY, refId });
              return;
            }
            setPortalContextMenu(null);
            if (isMobileLayout) {
              setSelectedNodeId(node.id);
              setActivePortalRefId(null);
              setMobileSidebarOpen(false);
              setMobileQuickEditorOpen(true);
              return;
            }
            setSelectedNodeId(node.id);
            setActivePortalRefId(null);
            setContextMenu({
              x: event.clientX,
              y: event.clientY,
              nodeId: node.id,
            });
          }}
          onPaneClick={() => {
            setContextMenu(null);
            setPortalContextMenu(null);
            // On mobile, tapping the canvas background deselects and closes the sheet.
            if (isMobileLayout) {
              setSelectedNodeId(null);
              setMobileQuickEditorOpen(false);
            }
          }}
          minZoom={0.3}
        >
          <Background gap={22} size={1} />
        </ReactFlow>

        {/* Context Menu */}
        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeId={contextMenu.nodeId}
            nodeTitle={nodesById.get(contextMenu.nodeId)?.title || "Node"}
            nodeKind={nodesById.get(contextMenu.nodeId)?.kind || "item"}
            taskStatus={nodesById.get(contextMenu.nodeId)?.taskStatus || "none"}
            hasChildren={(childrenByParent.get(contextMenu.nodeId) || []).length > 0}
            onClose={() => setContextMenu(null)}
            onAddChild={handleContextAddChild}
            onAddStorySibling={handleContextAddStorySibling}
            onDelete={handleContextDelete}
            onDuplicate={handleContextDuplicate}
            onRename={handleContextRename}
            onAddCrossRef={handleContextAddCrossRef}
            onChangeType={handleContextChangeType}
            onToggleTaskStatus={handleContextToggleTaskStatus}
          />
        )}

        {/* Portal orb right-click context menu */}
        {portalContextMenu && (() => {
          const menuRef = refs.find((r) => r.id === portalContextMenu.refId);
          return (
            <div
              data-portal-context-menu
              style={{
                position: "fixed",
                left: portalContextMenu.x,
                top: portalContextMenu.y,
                zIndex: 9999,
                minWidth: 180,
                background: "rgba(18, 20, 28, 0.97)",
                border: "1px solid rgba(255, 160, 71, 0.35)",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                padding: "6px 0",
                userSelect: "none",
              }}
            >
              {menuRef && (
                <div
                  style={{
                    padding: "6px 14px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "rgba(255,160,71,0.75)",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    marginBottom: 4,
                  }}
                >
                  {menuRef.code} · {menuRef.label}
                </div>
              )}
              <button
                type="button"
                onClick={() => void deletePortalByRefId(portalContextMenu.refId)}
                disabled={busyAction}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 14px",
                  background: "none",
                  border: "none",
                  cursor: busyAction ? "not-allowed" : "pointer",
                  fontSize: 13,
                  color: busyAction ? "rgba(239,68,68,0.4)" : "rgba(239,68,68,0.9)",
                  textAlign: "left",
                  transition: "background 100ms",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
              >
                <span style={{ fontSize: 15 }}>🗑</span>
                {busyAction ? "Deleting…" : "Delete cross-reference"}
              </button>
              <button
                type="button"
                onClick={() => setPortalContextMenu(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.45)",
                  textAlign: "left",
                  transition: "background 100ms",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
              >
                Cancel
              </button>
            </div>
          );
        })()}

        {paletteOpen && (
          <div
            className="planner-palette-backdrop"
            onClick={() => {
              setPaletteOpen(false);
              setPaletteQuery("");
              setPaletteIndex(0);
            }}
          >
            <div className="planner-palette" onClick={(event) => event.stopPropagation()}>
              <input
                ref={paletteInputRef}
                value={paletteQuery}
                onChange={(event) => {
                  setPaletteQuery(event.target.value);
                  setPaletteIndex(0);
                }}
                placeholder="Type a command, node, or entity..."
              />
              <div className="planner-palette-list">
                {paletteItems.length === 0 ? (
                  <div className="planner-palette-empty">No matches</div>
                ) : (
                  paletteItems.map((item, index) => (
                    <button
                      key={item.id}
                      className={`planner-palette-item ${index === paletteIndex ? "active" : ""}`}
                      onMouseEnter={() => setPaletteIndex(index)}
                      onClick={() => runPaletteAction(item)}
                    >
                      <span>{item.label}</span>
                      {item.hint ? <span>{item.hint}</span> : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Save error indicator (successful autosaves are silent). */}
        {saveStatus === "error" && (
          <div
            style={{
              position: "fixed",
              top: "16px",
              right: "16px",
              zIndex: 9998,
              padding: "10px 16px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
              transition: "all 200ms ease",
              background: "rgba(239, 68, 68, 0.95)",
              color: "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span style={{ fontSize: "16px" }}>⚠</span>
            <span>Could not save node position</span>
          </div>
        )}
      </main>
    </div>
  );
}
