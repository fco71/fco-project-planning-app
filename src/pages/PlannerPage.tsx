import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Handle,
  Position,
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
  entityType: EntityType;
  tags: string[];
  notes: string;
  contact: string;
  links: string[];
  createdAtMs: number;
  updatedAtMs: number;
};

type PortalData = {
  label: string;
  title: string;
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
  if (kind === "root") return "#3A2C0E";
  if (kind === "project") return "#101F3E";
  if (kind === "story") return "#10302A";
  return "#10141C";
}

function storyContainerColor(): string {
  return "#5B2A86";
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

function defaultPortalPositionForAnchor(anchor: TreeNode | undefined, seed: string): { x: number; y: number } {
  const baseX = typeof anchor?.x === "number" ? anchor.x : 0;
  const baseY = typeof anchor?.y === "number" ? anchor.y : 0;
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

const PortalNode = memo(function PortalNode({ data }: NodeProps<PortalData>) {
  return (
    <div className="planner-portal-label" data-tooltip={data.title} title={data.title}>
      <Handle type="target" position={Position.Top} isConnectable={false} className="planner-handle-hidden" />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="planner-handle-hidden" />
      {data.label}
    </div>
  );
});

const nodeTypes: NodeTypes = Object.freeze({ portal: PortalNode });
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [portalContextMenu, setPortalContextMenu] = useState<{ x: number; y: number; refId: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "error">("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [collapsedHydrated, setCollapsedHydrated] = useState(false);
  const syncedCollapsedKeyRef = useRef("");
  const lastFocusKeyRef = useRef("");

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
        const baseBackground = isRoot
          ? "rgba(58, 44, 14, 0.92)"
          : hasStoryChildren
            ? "rgba(91, 42, 134, 0.94)"
          : isProject
            ? "rgba(16, 31, 62, 0.95)"
          : isStory
            ? "rgba(16, 48, 42, 0.95)"
            : "rgba(16, 20, 28, 0.94)";
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
              ? "2px solid rgba(34, 197, 94, 0.9)"
              : isRoot
                ? "2px solid rgba(253, 228, 129, 0.9)"
                : hasStoryChildren
                  ? "1px solid rgba(216, 180, 254, 0.75)"
                : isProject
                  ? "1px solid rgba(96, 165, 250, 0.6)"
                : isStory
                  ? "1px solid rgba(45, 212, 191, 0.65)"
                : "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: isStoryLaneBeat ? 10 : 14,
            width: isStoryLaneBeat ? 300 : showStoryBody ? 280 : 260,
            minHeight: showStoryBody ? (isExpandedStoryCard ? 280 : 190) : undefined,
            padding: showStoryBody ? 12 : 10,
            background,
            color: "rgba(250, 252, 255, 0.95)",
            boxShadow: isSearchMatch
              ? "0 0 0 2px rgba(34, 197, 94, 0.3), 0 12px 28px rgba(0,0,0,0.4)"
              : "0 10px 24px rgba(0,0,0,0.35)",
            fontWeight: 700,
            fontSize: 12.5,
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

  const visiblePortals = useMemo(() => {
    return refs
      .map((ref) => {
        const validNodeIds = ref.nodeIds.filter((id) => nodesById.has(id));
        const inView = validNodeIds.filter((id) => visibleTreeIdSet.has(id));
        const resolvedAnchorId = chooseAnchorNodeId(validNodeIds, ref.anchorNodeId);
        const anchorId = chooseAnchorNodeId(inView, resolvedAnchorId);
        const anchorNode = anchorId ? nodesById.get(anchorId) : undefined;
        const position =
          typeof ref.portalX === "number" && typeof ref.portalY === "number"
            ? { x: ref.portalX, y: ref.portalY }
            : defaultPortalPositionForAnchor(anchorNode, `${ref.id}:${anchorId || resolvedAnchorId || "none"}`);
        return { ref: { ...ref, anchorNodeId: resolvedAnchorId }, inView, anchorId, position };
      })
      .filter(
        (entry): entry is { ref: CrossRef; inView: string[]; anchorId: string; position: { x: number; y: number } } =>
          entry.inView.length > 0 && !!entry.anchorId
      )
      .sort((a, b) => {
        if (a.anchorId !== b.anchorId) return a.anchorId.localeCompare(b.anchorId);
        return a.ref.code.localeCompare(b.ref.code) || a.ref.label.localeCompare(b.ref.label);
      });
  }, [nodesById, refs, visibleTreeIdSet]);

  useEffect(() => {
    if (!db) return;
    const refsMissingPortalPosition = visiblePortals.filter(
      (entry) => typeof entry.ref.portalX !== "number" || typeof entry.ref.portalY !== "number"
    );
    if (refsMissingPortalPosition.length === 0) return;

    let cancelled = false;
    const persistMissingPositions = async () => {
      try {
        let batch = writeBatch(db);
        let count = 0;
        for (const entry of refsMissingPortalPosition) {
          batch.update(doc(db, "users", user.uid, "crossRefs", entry.ref.id), {
            portalX: entry.position.x,
            portalY: entry.position.y,
            updatedAt: serverTimestamp(),
          });
          count += 1;
          if (count >= 450) {
            await batch.commit();
            if (cancelled) return;
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (!cancelled && count > 0) {
          await batch.commit();
        }
      } catch {
        // Silent best-effort migration for old bubbles without independent positions.
      }
    };

    void persistMissingPositions();
    return () => {
      cancelled = true;
    };
  }, [db, user.uid, visiblePortals]);

  const basePortalNodes = useMemo(() => {
    return visiblePortals.map((entry) => {
      return {
        id: `portal:${entry.ref.id}`,
        type: "portal",
        className: "planner-portal-node",
        position: entry.position,
        data: {
          label: `${entry.ref.code}${entry.ref.nodeIds.length > 1 ? `·${entry.ref.nodeIds.length}` : ""}`,
          title: `${entry.ref.label} (${entry.ref.nodeIds.length} links)`,
        } satisfies PortalData,
        style: {
          width: 46,
          height: 46,
          borderRadius: 999,
          border: "2px solid rgba(251, 146, 60, 0.85)",
          background: "rgba(82, 36, 8, 0.9)",
          color: "rgba(255, 235, 220, 0.97)",
          fontSize: 11,
          fontWeight: 800,
          boxShadow: "0 10px 20px rgba(0,0,0,0.35)",
          display: "grid",
          placeItems: "center",
          cursor: "grab",
        } as React.CSSProperties,
        draggable: true,
        selectable: true,
      } as Node<PortalData>;
    });
  }, [visiblePortals]);

  const basePortalEdges = useMemo(() => {
    return visiblePortals.flatMap((entry) =>
      entry.inView.map((source) => {
        return {
          id: `portal-edge:${entry.ref.id}:${source}`,
          source,
          target: `portal:${entry.ref.id}`,
          style: {
            stroke: "rgba(251, 146, 60, 0.65)",
            strokeWidth: 1.8,
            strokeDasharray: "6 6",
          },
          animated: false,
        } as Edge;
      })
    );
  }, [visiblePortals]);

  const baseEdges = useMemo(() => [...baseTreeEdges, ...basePortalEdges], [basePortalEdges, baseTreeEdges]);

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
  }, [hoverIndex.edgeToNodes, hoverIndex.nodeToNeighbors, hoveredEdgeId, hoveredNodeId]);

  const hoverEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    if (hoveredEdgeId) ids.add(hoveredEdgeId);
    if (hoveredNodeId) {
      hoverIndex.nodeToEdges.get(hoveredNodeId)?.forEach((id) => ids.add(id));
    }
    return ids;
  }, [hoverIndex.nodeToEdges, hoveredEdgeId, hoveredNodeId]);

  const activeLinkedNodeIds = useMemo(() => {
    if (!activePortalRefId) return new Set<string>();
    const activeRef = refs.find((ref) => ref.id === activePortalRefId);
    return new Set(activeRef?.nodeIds || []);
  }, [activePortalRefId, refs]);

  const flowNodes = useMemo(() => {
    const treeNodes = baseTreeNodes.map((node) => {
      const isSelected = selectedNodeId === node.id;
      const isActivePortalTarget = activeLinkedNodeIds.has(node.id);
      const isHoverRelated = hoverNodeIds.has(node.id);
      return {
        ...node,
        style: {
          ...(node.style || {}),
          border: isSelected
            ? "2px solid rgba(253, 224, 71, 0.95)"
            : isActivePortalTarget
              ? "2px solid rgba(251, 146, 60, 0.85)"
            : (node.style as React.CSSProperties)?.border,
          boxShadow: isSelected
            ? "0 0 0 3px rgba(253, 224, 71, 0.18), 0 14px 32px rgba(0,0,0,0.45)"
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

    const portalNodes = basePortalNodes.map((node) => {
      const isActive = node.id === `portal:${activePortalRefId}`;
      const isHoverRelated = hoverNodeIds.has(node.id);
      return {
        ...node,
        style: {
          ...(node.style || {}),
          border: isActive ? "2px solid rgba(254, 215, 170, 1)" : (node.style as React.CSSProperties)?.border,
          boxShadow: isActive
            ? "0 0 0 3px rgba(251,146,60,0.28), 0 14px 28px rgba(0,0,0,0.42)"
            : isHoverRelated
              ? "0 0 0 2px rgba(251,146,60,0.2), 0 14px 28px rgba(0,0,0,0.42)"
              : (node.style as React.CSSProperties)?.boxShadow,
          opacity: hoveredNodeId || hoveredEdgeId ? (isHoverRelated ? 1 : 0.5) : 1,
          transition: "opacity 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        },
      } as Node;
    });

    return [...treeNodes, ...portalNodes];
  }, [activeLinkedNodeIds, activePortalRefId, basePortalNodes, baseTreeNodes, hoverNodeIds, hoveredEdgeId, hoveredNodeId, selectedNodeId]);

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

  const [displayNodes, setDisplayNodes] = useState<Node[]>([]);

  useEffect(() => {
    setDisplayNodes(flowNodes);
  }, [flowNodes]);

  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    setDisplayNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

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
      return defaultPortalPositionForAnchor(nodesById.get(anchorNodeId), `${seed}:${anchorNodeId}`);
    },
    [nodesById]
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
    [applyLocalNodePatch, nodesById, user.uid]
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
    const newDoc = doc(collection(db, "users", user.uid, "nodes"));
    const parentPosition = resolveNodePosition(parentId);
    const siblingCount = (childrenByParent.get(parentId) || []).length;
    setBusyAction(true);
    setError(null);
    try {
      await setDoc(doc(db, "users", user.uid, "nodes", newDoc.id), {
        title,
        parentId,
        kind: "item",
        x: parentPosition.x + 280,
        y: parentPosition.y + 20 + siblingCount * 96,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } satisfies TreeNodeDoc & { createdAt: unknown; updatedAt: unknown });
      setNewChildTitle("");
      setPendingSelectedNodeId(newDoc.id);
      setPendingRenameNodeId(newDoc.id);
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not create node.");
    } finally {
      setBusyAction(false);
    }
  }, [childrenByParent, currentRootId, newChildTitle, resolveNodePosition, rootNodeId, selectedNodeId, user.uid]);

  const renameSelected = useCallback(async () => {
    if (!db || !selectedNodeId) return;
    const title = renameTitle.trim();
    const currentTitle = nodesById.get(selectedNodeId)?.title || "";
    if (!title) {
      setRenameTitle(currentTitle);
      return;
    }
    if (title === currentTitle) return;
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
  }, [nodesById, renameTitle, selectedNodeId, user.uid]);

  const setNodeTaskStatus = useCallback(
    async (nodeId: string, taskStatus: TaskStatus) => {
      if (!db) return;
      const previousTaskStatus = nodesById.get(nodeId)?.taskStatus || "none";
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
    [applyLocalNodePatch, nodesById, user.uid]
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
    [applyLocalNodePatch, nodesById, user.uid]
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
        const unchanged =
          cleanedNodeIds.length === ref.nodeIds.length &&
          cleanedNodeIds.every((id, index) => id === ref.nodeIds[index]) &&
          cleanedAnchorNodeId === (ref.anchorNodeId || null);
        if (unchanged) return null;
        return { type: "update" as const, refId: ref.id, nodeIds: cleanedNodeIds, anchorNodeId: cleanedAnchorNodeId };
      })
      .filter(
        (entry): entry is { type: "update"; refId: string; nodeIds: string[]; anchorNodeId: string | null } | { type: "delete"; refId: string } =>
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
  }, [activePortalRefId, editRefId, hydrateRefEditor, nodesById, refs, user.uid]);

  const deleteSelected = useCallback(async () => {
    if (!db || !selectedNodeId || selectedNodeId === rootNodeId) return;
    const ids = collectDescendants(selectedNodeId, childrenByParent);
    const idSet = new Set(ids);
    const fallbackId = nodesById.get(selectedNodeId)?.parentId || rootNodeId || null;
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
          batch.update(refDoc, {
            nodeIds: remaining,
            anchorNodeId: nextAnchorNodeId ?? deleteField(),
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
  }, [childrenByParent, currentRootId, nodesById, refs, rootNodeId, selectedNodeId, user.uid]);

  const linkCrossRefToNode = useCallback(
    async (refId: string, nodeId: string) => {
      if (!db) return;
      const linked = refs.find((entry) => entry.id === refId);
      const nextNodeIds = linked ? (linked.nodeIds.includes(nodeId) ? linked.nodeIds : [...linked.nodeIds, nodeId]) : [nodeId];
      const nextAnchorNodeId = chooseAnchorNodeId(nextNodeIds, linked?.anchorNodeId, nodeId);
      const nextPortalPosition =
        linked && typeof linked.portalX === "number" && typeof linked.portalY === "number"
          ? { x: linked.portalX, y: linked.portalY }
          : buildDefaultPortalPosition(nextAnchorNodeId, refId);
      setBusyAction(true);
      setError(null);
      try {
        await updateDoc(doc(db, "users", user.uid, "crossRefs", refId), {
          nodeIds: arrayUnion(nodeId),
          anchorNodeId: nextAnchorNodeId ?? deleteField(),
          ...(nextPortalPosition ? { portalX: nextPortalPosition.x, portalY: nextPortalPosition.y } : {}),
          updatedAt: serverTimestamp(),
        });
        if (linked) {
          hydrateRefEditor({
            ...linked,
            nodeIds: nextNodeIds,
            anchorNodeId: nextAnchorNodeId,
            portalX: nextPortalPosition?.x ?? linked.portalX,
            portalY: nextPortalPosition?.y ?? linked.portalY,
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
    [buildDefaultPortalPosition, hydrateRefEditor, refs, user.uid]
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
        const nextPortalPosition =
          typeof existingExact.portalX === "number" && typeof existingExact.portalY === "number"
            ? { x: existingExact.portalX, y: existingExact.portalY }
            : buildDefaultPortalPosition(nextAnchorNodeId, existingExact.id);
        await updateDoc(doc(db, "users", user.uid, "crossRefs", existingExact.id), {
          nodeIds: arrayUnion(selectedNodeId),
          anchorNodeId: nextAnchorNodeId ?? deleteField(),
          ...(nextPortalPosition ? { portalX: nextPortalPosition.x, portalY: nextPortalPosition.y } : {}),
          entityType: existingExact.entityType === "entity" ? newRefType : existingExact.entityType,
          updatedAt: serverTimestamp(),
        });
        hydrateRefEditor({
          ...existingExact,
          nodeIds: nextNodeIds,
          anchorNodeId: nextAnchorNodeId,
          portalX: nextPortalPosition?.x ?? existingExact.portalX,
          portalY: nextPortalPosition?.y ?? existingExact.portalY,
          entityType: existingExact.entityType === "entity" ? newRefType : existingExact.entityType,
        });
        setActivePortalRefId(existingExact.id);
      } else {
        const newDoc = doc(collection(db, "users", user.uid, "crossRefs"));
        const portalPosition = buildDefaultPortalPosition(selectedNodeId, newDoc.id);
        await setDoc(doc(db, "users", user.uid, "crossRefs", newDoc.id), {
          label,
          code,
          nodeIds: [selectedNodeId],
          anchorNodeId: selectedNodeId,
          ...(portalPosition ? { portalX: portalPosition.x, portalY: portalPosition.y } : {}),
          entityType: newRefType,
          tags: [],
          notes: "",
          contact: "",
          links: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies CrossRefDoc & { createdAt: unknown; updatedAt: unknown });
        hydrateRefEditor({
          id: newDoc.id,
          label,
          code,
          nodeIds: [selectedNodeId],
          anchorNodeId: selectedNodeId,
          portalX: portalPosition?.x ?? null,
          portalY: portalPosition?.y ?? null,
          entityType: newRefType,
          tags: [],
          notes: "",
          contact: "",
          links: [],
          createdAtMs: 0,
          updatedAtMs: 0,
        });
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
  }, [buildDefaultPortalPosition, hydrateRefEditor, newRefCode, newRefLabel, newRefType, refs, selectedNodeId, user.uid]);

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
      const duplicatePortalPosition =
        typeof source.portalX === "number" && typeof source.portalY === "number"
          ? { x: source.portalX + 34, y: source.portalY + 34 }
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
          createdAtMs: 0,
          updatedAtMs: 0,
        });
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not duplicate bubble.");
      } finally {
        setBusyAction(false);
      }
    },
    [buildDefaultPortalPosition, hydrateRefEditor, refs, user.uid]
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
    const mergedPortalPosition =
      typeof primary.portalX === "number" && typeof primary.portalY === "number"
        ? { x: primary.portalX, y: primary.portalY }
        : typeof duplicate.portalX === "number" && typeof duplicate.portalY === "number"
          ? { x: duplicate.portalX, y: duplicate.portalY }
          : buildDefaultPortalPosition(mergedAnchorNodeId, primary.id);

    setBusyAction(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", user.uid, "crossRefs", primary.id), {
        nodeIds: mergedNodeIds,
        anchorNodeId: mergedAnchorNodeId ?? deleteField(),
        ...(mergedPortalPosition ? { portalX: mergedPortalPosition.x, portalY: mergedPortalPosition.y } : {}),
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
  }, [activePortalRefId, buildDefaultPortalPosition, editRefId, hydrateRefEditor, mergeFromRefId, refs, user.uid]);

  const deleteCrossRefBubble = useCallback(async () => {
    if (!db || !editRefId) return;
    setBusyAction(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "users", user.uid, "crossRefs", editRefId));
      if (activePortalRefId === editRefId) {
        setActivePortalRefId(null);
      }
      hydrateRefEditor(null);
      setLinkNodeQuery("");
      setLinkTargetNodeId("");
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not delete bubble.");
    } finally {
      setBusyAction(false);
    }
  }, [activePortalRefId, editRefId, hydrateRefEditor, user.uid]);

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
          await updateDoc(doc(db, "users", user.uid, "crossRefs", refId), {
            nodeIds: remainingNodeIds,
            anchorNodeId: nextAnchorNodeId ?? deleteField(),
            updatedAt: serverTimestamp(),
          });
          if (editRefId === refId) {
            hydrateRefEditor({
              ...target,
              nodeIds: remainingNodeIds,
              anchorNodeId: nextAnchorNodeId,
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
    [editRefId, hydrateRefEditor, refs, user.uid]
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

  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      if (!db) return;

      if (node.id.startsWith("portal:")) {
        const refId = node.id.replace("portal:", "");
        try {
          await updateDoc(doc(db, "users", user.uid, "crossRefs", refId), {
            portalX: node.position.x,
            portalY: node.position.y,
            updatedAt: serverTimestamp(),
          });
        } catch (actionError: unknown) {
          showSaveError();
          setError(actionError instanceof Error ? actionError.message : "Could not save bubble position.");
        }
        return;
      }

      // Save regular node positions silently unless there is an error.
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
    [showSaveError, user.uid]
  );

  const onSelectionDragStop = useCallback(
    async (_: React.MouseEvent, draggedNodes: Node[]) => {
      if (!db) return;
      const movedTreeNodes = draggedNodes.filter((entry) => !entry.id.startsWith("portal:"));
      const movedPortals = draggedNodes.filter((entry) => entry.id.startsWith("portal:"));
      if (movedTreeNodes.length === 0 && movedPortals.length === 0) return;
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
        for (const entry of movedPortals) {
          const refId = entry.id.replace("portal:", "");
          batch.update(doc(db, "users", user.uid, "crossRefs", refId), {
            portalX: entry.position.x,
            portalY: entry.position.y,
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
    [showSaveError, user.uid]
  );

  // Context menu handlers
  const handleContextAddChild = useCallback(
    async (nodeId: string) => {
      if (!db) return;
      const parentPosition = resolveNodePosition(nodeId);
      const siblingCount = (childrenByParent.get(nodeId) || []).length;

      const newDoc = doc(collection(db, "users", user.uid, "nodes"));
      setBusyAction(true);
      setError(null);
      try {
        await setDoc(doc(db, "users", user.uid, "nodes", newDoc.id), {
          title: "New Node",
          parentId: nodeId,
          kind: "item",
          x: parentPosition.x + 280,
          y: parentPosition.y + 20 + siblingCount * 96,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies TreeNodeDoc & { createdAt: unknown; updatedAt: unknown });
        setPendingSelectedNodeId(newDoc.id);
        setPendingRenameNodeId(newDoc.id);
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not create node.");
      } finally {
        setBusyAction(false);
      }
    },
    [childrenByParent, resolveNodePosition, user.uid]
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
              batch.update(doc(db, "users", user.uid, "crossRefs", ref.id), {
                nodeIds: keep,
                anchorNodeId: nextAnchorNodeId ?? deleteField(),
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
    [childrenByParent, currentRootId, nodesById, refs, rootNodeId, selectedNodeId, user.uid]
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
    [applyLocalNodePatch, nodesById, user.uid]
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
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || contextMenu || portalContextMenu) {
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
        if (portalContextMenu) {
          setPortalContextMenu(null);
          return;
        }
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
    portalContextMenu,
    mobileQuickEditorOpen,
    mobileSidebarOpen,
    runPaletteAction,
    searchQuery,
    selectedNodeId,
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
          {isMobileLayout ? "Close" : sidebarIsCollapsed ? "→" : "←"}
        </button>
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
          <h3>Cross-Reference Bubbles</h3>
          <p className="planner-subtle">
            Use these for shared entities across branches (e.g., vendor, partner, person).
          </p>
          <p className="planner-subtle">
            Anchor node: <strong>{selectedNode ? buildNodePath(selectedNode.id, nodesById) : "Select a node first"}</strong>
          </p>
          <input
            ref={newRefLabelInputRef}
            value={newRefLabel}
            onChange={(event) => setNewRefLabel(event.target.value)}
            placeholder="Reference name (e.g., Vendor, Partner, Person)"
          />
          <input
            value={newRefCode}
            onChange={(event) => setNewRefCode(event.target.value)}
            placeholder="Bubble code (optional, e.g., VN)"
          />
          <select value={newRefType} onChange={(event) => setNewRefType(event.target.value as EntityType)}>
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
          <button onClick={createCrossRef} disabled={busyAction || !selectedNodeId || newRefLabel.trim().length === 0}>
            Create bubble and attach to selected
          </button>

          {newRefSuggestions.length > 0 ? (
            <>
              <div className="planner-row-label">Attach an existing bubble</div>
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
                    {`${ref.code} - ${ref.label} (${ref.entityType})`}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <div className="planner-row-label">Attached to selected node</div>
          <div className="planner-chip-list">
            {selectedNodeRefs.length === 0 || !selectedNodeId ? (
              <span className="planner-subtle">No bubbles attached to selected node.</span>
            ) : (
              selectedNodeRefs.map((ref) => (
                <div key={ref.id} className="chip with-action">
                  <button
                    onClick={() => selectRefForEditing(ref.id)}
                    title={describeRefTargets(ref, 4)}
                  >{`${ref.code} - ${ref.label} (${ref.nodeIds.length})`}</button>
                  <button
                    className="chip-action"
                    onClick={() => detachCrossRef(ref.id, selectedNodeId)}
                    title="Detach from selected node"
                  >
                    x
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="planner-row-label">Active bubble</div>
          <select
            value={editRefId}
            onChange={(event) => {
              const refId = event.target.value;
              if (!refId) {
                hydrateRefEditor(null);
                setActivePortalRefId(null);
                setLinkNodeQuery("");
                setLinkTargetNodeId("");
                return;
              }
              selectRefForEditing(refId);
            }}
          >
            <option value="">Select active bubble...</option>
            {refs.map((ref) => (
              <option key={ref.id} value={ref.id}>
                {`${ref.code} - ${ref.label} (${ref.nodeIds.length})`}
              </option>
            ))}
          </select>
          <div className="planner-inline-buttons">
            <button
              onClick={() => {
                if (!editRefId) return;
                void duplicateCrossRef(editRefId);
              }}
              disabled={busyAction || !editRefId}
            >
              Duplicate active
            </button>
            <button
              onClick={() => {
                if (!editRefId || !selectedNodeId) return;
                if (editedRefLinkedOnSelected) {
                  void detachCrossRef(editRefId, selectedNodeId);
                } else {
                  void linkCrossRefToNode(editRefId, selectedNodeId);
                }
              }}
              disabled={busyAction || !editRefId || !selectedNodeId}
            >
              {!selectedNodeId
                ? "Select node first"
                : editedRefLinkedOnSelected
                  ? "Unlink active"
                  : "Link active"}
            </button>
          </div>

          <details className="planner-advanced-tools">
            <summary>Open bubble manager</summary>
            <div className="planner-advanced-tools-content">
              <div className="planner-row-label">Bubble scope</div>
              <div className="planner-filter-toggle">
                <button
                  type="button"
                  className={refScopeFilter === "view" ? "active" : ""}
                  onClick={() => setRefScopeFilter("view")}
                >
                  Current view
                </button>
                <button
                  type="button"
                  className={refScopeFilter === "all" ? "active" : ""}
                  onClick={() => setRefScopeFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={refCategoryFilter === "people" ? "active" : ""}
                  onClick={() => setRefCategoryFilter(refCategoryFilter === "people" ? "all" : "people")}
                >
                  People only
                </button>
              </div>

              <div className="planner-row-label">All bubbles</div>
              <input
                value={refSearchQuery}
                onChange={(event) => setRefSearchQuery(event.target.value)}
                placeholder="Search bubbles by code or name..."
              />
              <div className="planner-reference-list">
                {filteredRefs.length === 0 ? (
                  <span className="planner-subtle">
                    {refs.length === 0 ? "No bubbles created yet." : "No bubbles match this view/filter."}
                  </span>
                ) : (
                  filteredRefs.map((ref) => {
                    const linkedOnSelected = selectedNodeId ? selectedNodeRefIds.has(ref.id) : false;
                    return (
                      <div key={ref.id} className="planner-reference-item">
                        <button onClick={() => selectRefForEditing(ref.id)}>{`${ref.code} - ${ref.label}`}</button>
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
                            {!selectedNodeId
                              ? "Select node first"
                              : linkedOnSelected
                                ? "Unlink selected"
                                : "Link to selected"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="planner-row-label">Edit active bubble</div>
              <input
                value={editRefLabel}
                onChange={(event) => setEditRefLabel(event.target.value)}
                placeholder="Bubble name"
                disabled={!editRefId}
              />
              <input
                value={editRefCode}
                onChange={(event) => setEditRefCode(event.target.value)}
                placeholder="Bubble code"
                disabled={!editRefId}
              />
              <select
                value={editRefType}
                onChange={(event) => setEditRefType(event.target.value as EntityType)}
                disabled={!editRefId}
              >
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
              <input
                value={editRefTags}
                onChange={(event) => setEditRefTags(event.target.value)}
                placeholder="Tags (comma-separated)"
                disabled={!editRefId}
              />
              <input
                value={editRefContact}
                onChange={(event) => setEditRefContact(event.target.value)}
                placeholder="Contact info (email / phone / person)"
                disabled={!editRefId}
              />
              <textarea
                value={editRefLinks}
                onChange={(event) => setEditRefLinks(event.target.value)}
                placeholder="One URL per line"
                rows={3}
                disabled={!editRefId}
              />
              <textarea
                value={editRefNotes}
                onChange={(event) => setEditRefNotes(event.target.value)}
                placeholder="Entity notes"
                rows={4}
                disabled={!editRefId}
              />
              <button onClick={saveCrossRefEdits} disabled={busyAction || !editRefId || editRefLabel.trim().length === 0}>
                Save changes
              </button>

          <details className="planner-advanced-tools">
            <summary>Advanced bubble tools</summary>
            <div className="planner-advanced-tools-content">
              <div className="planner-row-label">Recent bubbles</div>
              <div className="planner-chip-list">
                {recentEntityRefs.length === 0 ? (
                  <span className="planner-subtle">No recent bubbles yet.</span>
                ) : (
                  recentEntityRefs.map((ref) => (
                    <button
                      key={ref.id}
                      className="chip"
                      onClick={() => selectRefForEditing(ref.id)}
                      title={describeRefTargets(ref, 4)}
                    >
                      {`${ref.code} · ${formatUpdatedTime(ref.updatedAtMs)}`}
                    </button>
                  ))
                )}
              </div>

              <div className="planner-row-label">Merge likely duplicate</div>
              <select value={mergeFromRefId} onChange={(event) => setMergeFromRefId(event.target.value)} disabled={!editRefId}>
                <option value="">
                  {editRefId ? "Select duplicate bubble..." : "Select a bubble first..."}
                </option>
                {mergeCandidateRefs.map((ref) => (
                  <option key={ref.id} value={ref.id}>
                    {`${ref.code} - ${ref.label} (${ref.entityType})`}
                  </option>
                ))}
              </select>
              <button onClick={mergeCrossRefIntoEdited} disabled={busyAction || !editRefId || !mergeFromRefId}>
                Merge duplicate
              </button>

              <div className="planner-row-label">Link selected bubble to another node</div>
              <input
                value={linkNodeQuery}
                onChange={(event) => setLinkNodeQuery(event.target.value)}
                placeholder="Search node path across all projects..."
                disabled={!editRefId}
              />
              <select
                value={linkTargetNodeId}
                onChange={(event) => setLinkTargetNodeId(event.target.value)}
                disabled={!editRefId}
              >
                <option value="">
                  {editRefId ? "Choose node to link..." : "Select a bubble first..."}
                </option>
                {linkableNodeOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.path}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (!editRefId || !linkTargetNodeId) return;
                  linkCrossRefToNode(editRefId, linkTargetNodeId);
                }}
                disabled={busyAction || !editRefId || !linkTargetNodeId}
              >
                Link node
              </button>

              <div className="planner-row-label">Linked nodes</div>
              <div className="planner-reference-list">
                {!editRefId ? (
                  <span className="planner-subtle">Select a bubble to manage links.</span>
                ) : editableRefTargets.length === 0 ? (
                  <span className="planner-subtle">This bubble is not linked yet.</span>
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

              <div className="planner-row-label">Danger zone</div>
              <button className="danger" onClick={deleteCrossRefBubble} disabled={busyAction || !editRefId}>
                Delete bubble
              </button>
            </div>
          </details>
            </div>
          </details>
        </div>
        ) : null}

        {showBubblesSection && activePortalRef ? (
          <div className="planner-panel-block">
            <h3>{`${activePortalRef.code} - ${activePortalRef.label}`}</h3>
            <p className="planner-subtle">
              {`${activePortalRef.entityType}${activePortalRef.tags.length > 0 ? ` · ${activePortalRef.tags.join(", ")}` : ""}`}
            </p>
            {activePortalRef.contact ? <p className="planner-subtle">{`Contact: ${activePortalRef.contact}`}</p> : null}
            {activePortalRef.notes ? <p className="planner-subtle">{activePortalRef.notes}</p> : null}
            {activePortalRef.links.length > 0 ? (
              <div className="planner-reference-list">
                {activePortalRef.links.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    {url}
                  </a>
                ))}
              </div>
            ) : null}
            <p className="planner-subtle">All locations where this bubble exists:</p>
            <div className="planner-reference-list">
              {activePortalTargets.map((target) => (
                <button key={target.id} onClick={() => jumpToReferencedNode(target.id)}>
                  {buildNodePath(target.id, nodesById)}
                </button>
              ))}
            </div>
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
        <section className="planner-mobile-sheet" role="dialog" aria-label="Quick node editor">
          <div className="planner-mobile-sheet-handle" />
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
              Controls
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
              +Child
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
              {selectedNode?.taskStatus === "done" ? "Todo" : "Done"}
            </button>
            <button onClick={goGrandmotherView} disabled={!rootNodeId}>
              Home
            </button>
            <button onClick={goUpOneView} disabled={!currentRootNode?.parentId}>
              Up
            </button>
          </div>
        ) : null}

        <ReactFlow
          nodes={displayNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          nodesConnectable={false}
          selectionOnDrag={!isMobileLayout}
          selectionMode={isMobileLayout ? SelectionMode.Full : SelectionMode.Partial}
          multiSelectionKeyCode={["Shift", "Meta", "Control"]}
          onInit={setRfInstance}
          onNodesChange={handleNodesChange}
          onNodeClick={(_, node) => {
            setContextMenu(null);
            setPortalContextMenu(null);
            if (node.id.startsWith("portal:")) {
              selectRefForEditing(node.id.replace("portal:", ""));
              if (isMobileLayout) {
                setMobileSidebarSection("bubbles");
                setMobileSidebarOpen(true);
              }
              return;
            }
            setSelectedNodeId(node.id);
            setActivePortalRefId(null);
            if (isMobileLayout) setMobileSidebarOpen(false);
          }}
          onNodeDoubleClick={(_, node) => {
            if (node.id.startsWith("portal:")) return;
            if (isMobileLayout) return;
            // Zoom only; changing view root is an explicit action.
            onNodeDoubleClick(_, node);
          }}
          onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
          onEdgeMouseLeave={() => setHoveredEdgeId(null)}
          onNodeDragStop={onNodeDragStop}
          onSelectionDragStop={onSelectionDragStop}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            if (node.id.startsWith("portal:")) {
              const refId = node.id.replace("portal:", "");
              setPortalContextMenu({
                x: event.clientX,
                y: event.clientY,
                refId,
              });
              setContextMenu(null);
              return;
            }
            if (isMobileLayout) {
              setSelectedNodeId(node.id);
              setActivePortalRefId(null);
              setPortalContextMenu(null);
              setMobileSidebarOpen(false);
              setMobileQuickEditorOpen(true);
              return;
            }
            setSelectedNodeId(node.id);
            setActivePortalRefId(null);
            setPortalContextMenu(null);
            setContextMenu({
              x: event.clientX,
              y: event.clientY,
              nodeId: node.id,
            });
          }}
          onPaneClick={() => {
            setContextMenu(null);
            setPortalContextMenu(null);
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

        {portalContextMenu ? (
          (() => {
            const ref = refs.find((entry) => entry.id === portalContextMenu.refId);
            if (!ref) return null;
            const linkedOnSelected = selectedNodeId ? ref.nodeIds.includes(selectedNodeId) : false;
            return (
              <div
                style={{
                  position: "fixed",
                  left: portalContextMenu.x,
                  top: portalContextMenu.y,
                  zIndex: 10001,
                  background: "rgba(20, 26, 38, 0.98)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  borderRadius: "8px",
                  minWidth: "190px",
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.42)",
                  color: "rgba(245, 248, 255, 0.95)",
                  padding: "4px",
                }}
              >
                <button
                  style={{ width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", color: "inherit" }}
                  onClick={() => {
                    selectRefForEditing(ref.id);
                    setMobileSidebarSection("bubbles");
                    setMobileSidebarOpen(true);
                    setPortalContextMenu(null);
                  }}
                >
                  Edit bubble
                </button>
                <button
                  style={{ width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", color: "inherit" }}
                  onClick={() => {
                    void duplicateCrossRef(ref.id);
                    setPortalContextMenu(null);
                  }}
                >
                  Duplicate bubble
                </button>
                {selectedNodeId ? (
                  <button
                    style={{ width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", color: "inherit" }}
                    onClick={() => {
                      if (!selectedNodeId) return;
                      if (linkedOnSelected) {
                        void detachCrossRef(ref.id, selectedNodeId);
                      } else {
                        void linkCrossRefToNode(ref.id, selectedNodeId);
                      }
                      setPortalContextMenu(null);
                    }}
                  >
                    {linkedOnSelected ? "Unlink from selected node" : "Link to selected node"}
                  </button>
                ) : null}
              </div>
            );
          })()
        ) : null}

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
