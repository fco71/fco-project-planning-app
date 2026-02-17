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

type EntityType = "entity" | "investor" | "partner" | "vendor" | "contact" | "client" | "organization";

type TreeNodeDoc = {
  title: string;
  parentId: string | null;
  kind: "root" | "project" | "item";
  x?: number;
  y?: number;
  color?: string;
};

type TreeNode = TreeNodeDoc & { id: string };

type CrossRefDoc = {
  label: string;
  code: string;
  nodeIds: string[];
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

function defaultNodeColor(kind: "root" | "project" | "item"): string {
  if (kind === "root") return "#3A2C0E";
  if (kind === "project") return "#101F3E";
  return "#10141C";
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
    <div className="planner-portal-label" title={data.title}>
      <Handle type="target" position={Position.Top} isConnectable={false} className="planner-handle-hidden" />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="planner-handle-hidden" />
      {data.label}
    </div>
  );
});

const nodeTypes: NodeTypes = Object.freeze({ portal: PortalNode });
const edgeTypes: EdgeTypes = Object.freeze({});
const ENTITY_TYPES: EntityType[] = ["entity", "investor", "partner", "vendor", "contact", "client", "organization"];

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
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [newChildTitle, setNewChildTitle] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [newRefLabel, setNewRefLabel] = useState("");
  const [newRefCode, setNewRefCode] = useState("");
  const [newRefType, setNewRefType] = useState<EntityType>("entity");
  const [refSearchQuery, setRefSearchQuery] = useState("");
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
  }, [isMobileLayout]);

  useEffect(() => {
    if (!isMobileLayout || !mobileSidebarOpen || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileLayout, mobileSidebarOpen]);

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
                kind: value.kind === "root" || value.kind === "project" || value.kind === "item" ? value.kind : "item",
                x: typeof value.x === "number" ? value.x : undefined,
                y: typeof value.y === "number" ? value.y : undefined,
                color: normalizeHexColor(value.color),
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
    (nodeId: string, patch: Partial<Pick<TreeNode, "title" | "parentId" | "kind" | "x" | "y" | "color">>) => {
      setNodes((prevNodes) => prevNodes.map((entry) => (entry.id === nodeId ? { ...entry, ...patch } : entry)));
    },
    []
  );

  useEffect(() => {
    setRenameTitle(selectedNode?.title || "");
  }, [selectedNode?.id, selectedNode?.title]);

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

  const treeLayout = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    if (!currentRootId) return map;
    let nextRow = 0;
    const xGap = 280;
    const yGap = 140;
    const filteredIdSet = new Set(filteredTreeIds);

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
  }, [childrenByParent, collapsedNodeIds, currentRootId, filteredTreeIds]);

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

  const baseTreeNodes = useMemo(() => {
    return filteredTreeIds
      .map((id) => nodesById.get(id))
      .filter((node): node is TreeNode => !!node)
      .map((node) => {
        const childCount = (childrenByParent.get(node.id) || []).length;
        const isCollapsed = collapsedNodeIds.has(node.id);
        const autoPosition = treeLayout.get(node.id) || { x: 0, y: 0 };
        const position = {
          x: typeof node.x === "number" ? node.x : autoPosition.x,
          y: typeof node.y === "number" ? node.y : autoPosition.y,
        };
        const isRoot = node.id === rootNodeId;
        const isSearchMatch = searchMatchingIds.has(node.id);
        const isProject = node.kind === "project";
        const baseBackground = isRoot
          ? "rgba(58, 44, 14, 0.92)"
          : isProject
            ? "rgba(16, 31, 62, 0.95)"
            : "rgba(16, 20, 28, 0.94)";
        const background = node.color || baseBackground;
        return {
          id: node.id,
          position,
          data: {
            label: (
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
                <span>{node.title}</span>
                {!isRoot ? <span className={`planner-kind-badge ${node.kind}`}>{node.kind}</span> : null}
                {childCount > 0 ? <span className="planner-node-count">{childCount}</span> : null}
              </div>
            ),
          },
          style: {
            border: isSearchMatch
              ? "2px solid rgba(34, 197, 94, 0.9)"
              : isRoot
                ? "2px solid rgba(253, 228, 129, 0.9)"
                : isProject
                  ? "1px solid rgba(96, 165, 250, 0.6)"
                : "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: 14,
            width: 260,
            padding: 10,
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
  }, [childrenByParent, collapsedNodeIds, filteredTreeIds, nodesById, rootNodeId, searchMatchingIds, toggleNodeCollapse, treeLayout]);

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

  const treeBounds = useMemo(() => {
    if (baseTreeNodes.length === 0) return { minY: 0, maxX: 0 };
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    baseTreeNodes.forEach((node) => {
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x);
    });
    return { minY: Number.isFinite(minY) ? minY : 0, maxX: Number.isFinite(maxX) ? maxX : 0 };
  }, [baseTreeNodes]);

  const visiblePortals = useMemo(() => {
    return refs
      .map((ref) => ({ ref, inView: ref.nodeIds.filter((id) => visibleTreeIdSet.has(id)) }))
      .filter((entry) => entry.inView.length > 0)
      .sort((a, b) => a.ref.code.localeCompare(b.ref.code) || a.ref.label.localeCompare(b.ref.label));
  }, [refs, visibleTreeIdSet]);

  const basePortalNodes = useMemo(() => {
    return visiblePortals.map((entry, index) => {
      // Compute initial position (will be preserved by displayNodes logic if dragged)
      const position = {
        x: treeBounds.maxX + 220,
        y: treeBounds.minY + index * 84,
      };

      return {
        id: `portal:${entry.ref.id}`,
        type: "portal",
        position,
        data: {
          label: entry.ref.code,
          title: `${entry.ref.label} (${entry.ref.nodeIds.length} links)`,
        } satisfies PortalData,
        style: {
          width: 48,
          height: 48,
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
  }, [treeBounds.maxX, treeBounds.minY, visiblePortals]);

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
    setDisplayNodes((prevDisplayNodes) => {
      // Preserve portal positions that may have been manually dragged
      const portalPositions = new Map<string, { x: number; y: number }>();
      prevDisplayNodes.forEach((node) => {
        if (node.id.startsWith("portal:")) {
          portalPositions.set(node.id, node.position);
        }
      });

      // Apply flowNodes but preserve portal positions
      return flowNodes.map((node) => {
        if (node.id.startsWith("portal:") && portalPositions.has(node.id)) {
          return { ...node, position: portalPositions.get(node.id)! };
        }
        return node;
      });
    });
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
      if (paths.length === 0) return "No linked nodes yet.";
      const preview = paths.slice(0, limit).join(" | ");
      const remaining = paths.length - limit;
      return remaining > 0 ? `${preview} +${remaining} more` : preview;
    },
    [refTargetPathsById]
  );

  const filteredRefs = useMemo(() => {
    const queryText = refSearchQuery.trim().toLowerCase();
    if (!queryText) return refs;
    return refs.filter((ref) =>
      `${ref.code} ${ref.label} ${ref.entityType} ${ref.tags.join(" ")} ${ref.notes} ${ref.contact} ${ref.links.join(" ")}`
        .toLowerCase()
        .includes(queryText)
    );
  }, [refSearchQuery, refs]);

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

  const goGrandmotherView = useCallback(() => {
    if (!rootNodeId) return;
    setCurrentRootId(rootNodeId);
    setActivePortalRefId(null);
  }, [rootNodeId]);

  const goUpOneView = useCallback(() => {
    if (!currentRootNode?.parentId) return;
    setCurrentRootId(currentRootNode.parentId);
    setActivePortalRefId(null);
  }, [currentRootNode?.parentId]);

  const openSelectedAsMaster = useCallback(() => {
    if (!selectedNodeId) return;
    setCurrentRootId(selectedNodeId);
    setActivePortalRefId(null);
  }, [selectedNodeId]);

  const createChild = useCallback(async () => {
    if (!db) return;
    const title = newChildTitle.trim();
    if (!title) return;
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
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not create node.");
    } finally {
      setBusyAction(false);
    }
  }, [childrenByParent, currentRootId, newChildTitle, resolveNodePosition, rootNodeId, selectedNodeId, user.uid]);

  const renameSelected = useCallback(async () => {
    if (!db || !selectedNodeId) return;
    const title = renameTitle.trim();
    if (!title) return;
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
  }, [renameTitle, selectedNodeId, user.uid]);

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
        const unchanged =
          cleanedNodeIds.length === ref.nodeIds.length &&
          cleanedNodeIds.every((id, index) => id === ref.nodeIds[index]);
        if (unchanged) return null;
        return { type: "update" as const, refId: ref.id, nodeIds: cleanedNodeIds };
      })
      .filter((entry): entry is { type: "update"; refId: string; nodeIds: string[] } | { type: "delete"; refId: string } => !!entry);

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
          batch.update(refDoc, { nodeIds: remaining, updatedAt: serverTimestamp() });
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

  const linkCrossRefToNode = useCallback(
    async (refId: string, nodeId: string) => {
      if (!db) return;
      setBusyAction(true);
      setError(null);
      try {
        await updateDoc(doc(db, "users", user.uid, "crossRefs", refId), {
          nodeIds: arrayUnion(nodeId),
          updatedAt: serverTimestamp(),
        });
        const linked = refs.find((entry) => entry.id === refId);
        if (linked) hydrateRefEditor(linked);
        setActivePortalRefId(refId);
        setLinkNodeQuery("");
        setLinkTargetNodeId("");
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not link bubble to node.");
      } finally {
        setBusyAction(false);
      }
    },
    [hydrateRefEditor, refs, user.uid]
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
        await updateDoc(doc(db, "users", user.uid, "crossRefs", existingExact.id), {
          nodeIds: arrayUnion(selectedNodeId),
          entityType: existingExact.entityType === "entity" ? newRefType : existingExact.entityType,
          updatedAt: serverTimestamp(),
        });
        hydrateRefEditor({
          ...existingExact,
          entityType: existingExact.entityType === "entity" ? newRefType : existingExact.entityType,
        });
        setActivePortalRefId(existingExact.id);
      } else {
        const newDoc = doc(collection(db, "users", user.uid, "crossRefs"));
        await setDoc(doc(db, "users", user.uid, "crossRefs", newDoc.id), {
          label,
          code,
          nodeIds: [selectedNodeId],
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
  }, [hydrateRefEditor, newRefCode, newRefLabel, newRefType, refs, selectedNodeId, user.uid]);

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

    setBusyAction(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", user.uid, "crossRefs", primary.id), {
        nodeIds: mergedNodeIds,
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
  }, [activePortalRefId, editRefId, hydrateRefEditor, mergeFromRefId, refs, user.uid]);

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
      setBusyAction(true);
      setError(null);
      try {
        await updateDoc(doc(db, "users", user.uid, "crossRefs", refId), {
          nodeIds: arrayRemove(nodeId),
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not detach cross-reference.");
      } finally {
        setBusyAction(false);
      }
    },
    [user.uid]
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

      // Only save tree node positions (not portals)
      if (node.id.startsWith("portal:")) {
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
      if (movedTreeNodes.length === 0) return;
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
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not create node.");
      } finally {
        setBusyAction(false);
      }
    },
    [childrenByParent, resolveNodePosition, user.uid]
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
              batch.update(doc(db, "users", user.uid, "crossRefs", ref.id), {
                nodeIds: keep,
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
          color: original.color,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies TreeNodeDoc & { createdAt: unknown; updatedAt: unknown });
        setPendingSelectedNodeId(newDoc.id);
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
      // Select the node and scroll to cross-ref section in sidebar
      setSelectedNodeId(nodeId);
      setActivePortalRefId(null);
      setSidebarCollapsed(false);
      setMobileSidebarSection("bubbles");
      setMobileSidebarOpen(true);
      // User can then add cross-ref through sidebar
    },
    []
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

      // Toggle between project and item
      const previousKind = node.kind;
      const newKind = previousKind === "project" ? "item" : "project";

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

  const paletteItems = useMemo(() => {
    const items: PaletteItem[] = [];
    const queryText = paletteQuery.trim().toLowerCase();
    const includesQuery = (value: string) => !queryText || value.toLowerCase().includes(queryText);

    const addItem = (id: string, label: string, hint: string | undefined, action: () => void, searchBlob = label) => {
      if (!includesQuery(searchBlob)) return;
      items.push({ id, label, hint, action });
    };

    addItem("cmd-grandmother", "Open grandmother view", "Navigation", goGrandmotherView, "grandmother root home");
    addItem("cmd-up", "Go up one level", "Navigation", goUpOneView, "up parent back");
    addItem("cmd-organize-tree", "Organize visible tree", "Layout", organizeVisibleTree, "cleanup organize layout tidy tree");
    addItem(
      "cmd-clean-bubbles",
      "Clean up cross-reference bubbles",
      "Cross-reference",
      cleanUpCrossRefs,
      "cleanup cross reference bubbles stale deleted"
    );
    if (selectedNodeId) {
      addItem("cmd-open-master", "Open selected as master", "Navigation", openSelectedAsMaster, "open selected master");
      addItem(
        "cmd-add-child",
        "Add child to selected node",
        "Create",
        () => handleContextAddChild(selectedNodeId),
        "add child create node"
      );
      const selected = nodesById.get(selectedNodeId);
      if (selected && selected.kind !== "root") {
        addItem(
          "cmd-toggle-type",
          selected.kind === "project" ? "Set selected node as item" : "Set selected node as project",
          "Node type",
          () => handleContextChangeType(selectedNodeId),
          "toggle type project item"
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
    goGrandmotherView,
    goUpOneView,
    handleContextAddChild,
    handleContextChangeType,
    jumpToReferencedNode,
    linkCrossRefToNode,
    nodes,
    nodesById,
    openSelectedAsMaster,
    organizeVisibleTree,
    paletteQuery,
    refs,
    selectRefForEditing,
    selectedNodeId,
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
            style={{ marginTop: "8px", width: "100%" }}
            onClick={() => {
              setPaletteOpen(true);
              setPaletteQuery("");
              setPaletteIndex(0);
            }}
          >
            Command palette (Cmd/Ctrl+K)
          </button>
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
        <div className="planner-panel-block">
          <h2>{profileName || "Main Node"}</h2>
          <p className="planner-subtle">{user.email}</p>
          <p className="planner-subtle">
            Current view: <strong>{currentRootPath || "No selection"}</strong>
          </p>
          <div className="planner-inline-buttons">
            <button onClick={goGrandmotherView} disabled={!rootNodeId}>
              Grandmother view
            </button>
            <button onClick={goUpOneView} disabled={!currentRootNode?.parentId}>
              Up one level
            </button>
          </div>
          <button onClick={openSelectedAsMaster} disabled={!selectedNodeId}>
            Open selected as master
          </button>
          <button onClick={organizeVisibleTree} disabled={busyAction || filteredTreeIds.length === 0}>
            Organize visible tree
          </button>
        </div>

        <div className="planner-panel-block">
          <h3>Add Child Node</h3>
          <input
            value={newChildTitle}
            onChange={(event) => setNewChildTitle(event.target.value)}
            placeholder="Film Production, Education, Finance..."
          />
          <button onClick={createChild} disabled={busyAction || newChildTitle.trim().length === 0}>
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
                  {selectedNode.kind === "project" ? "Set as item" : selectedNode.kind === "item" ? "Set as project" : "Root"}
                </button>
                <button disabled>{selectedNode.kind}</button>
              </div>
              <div className="planner-row-label">Color</div>
              <div className="planner-inline-buttons">
                <input
                  type="color"
                  value={selectedNode.color || defaultNodeColor(selectedNode.kind)}
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
                  if (busyAction || renameTitle.trim().length === 0) return;
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
                      {child.title}
                    </button>
                  ))
                )}
              </div>
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
            Use these for entities shared across branches (e.g., Vendor / VN or Partner / PT).
          </p>
          <button onClick={cleanUpCrossRefs} disabled={busyAction}>
            Clean up stale bubbles
          </button>
          <p className="planner-subtle">
            Anchor node: <strong>{selectedNode ? buildNodePath(selectedNode.id, nodesById) : "Select a node first"}</strong>
          </p>
          <input
            value={newRefLabel}
            onChange={(event) => setNewRefLabel(event.target.value)}
            placeholder="Reference name (e.g., Vendor, Investor, Partner)"
          />
          <input
            value={newRefCode}
            onChange={(event) => setNewRefCode(event.target.value)}
            placeholder="Bubble code (optional, e.g., VN)"
          />
          <select value={newRefType} onChange={(event) => setNewRefType(event.target.value as EntityType)}>
            {ENTITY_TYPES.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType}
              </option>
            ))}
          </select>
          <button onClick={createCrossRef} disabled={busyAction || !selectedNodeId || newRefLabel.trim().length === 0}>
            Create bubble and attach to selected
          </button>

          {newRefSuggestions.length > 0 ? (
            <>
              <div className="planner-row-label">Use an existing bubble instead</div>
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

          <div className="planner-row-label">Bubbles on selected node</div>
          <div className="planner-chip-list">
            {selectedNodeRefs.length === 0 || !selectedNodeId ? (
              <span className="planner-subtle">No bubbles attached.</span>
            ) : (
              selectedNodeRefs.map((ref) => (
                <div key={ref.id} className="chip with-action">
                  <button
                    onClick={() => selectRefForEditing(ref.id)}
                    title={describeRefTargets(ref, 4)}
                  >{`${ref.code} - ${ref.label} (${ref.entityType}, ${ref.nodeIds.length})`}</button>
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

          <div className="planner-row-label">Bubble library</div>
          <input
            value={refSearchQuery}
            onChange={(event) => setRefSearchQuery(event.target.value)}
            placeholder="Search bubbles by code or name..."
          />
          <div className="planner-reference-list">
            {filteredRefs.length === 0 ? (
              <span className="planner-subtle">
                {refs.length === 0 ? "No bubbles created yet." : "No bubbles match this search."}
              </span>
            ) : (
              filteredRefs.map((ref) => {
                const linkedOnSelected = selectedNodeId ? selectedNodeRefIds.has(ref.id) : false;
                return (
                  <div key={ref.id} className="planner-reference-item">
                    <button onClick={() => selectRefForEditing(ref.id)}>{`${ref.code} - ${ref.label}`}</button>
                    <div className="planner-reference-preview">
                      {`${ref.entityType}${ref.tags.length > 0 ? ` · ${ref.tags.join(", ")}` : ""} · ${describeRefTargets(ref, 2)}`}
                    </div>
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

          <div className="planner-row-label">Recent entities</div>
          <div className="planner-chip-list">
            {recentEntityRefs.length === 0 ? (
              <span className="planner-subtle">No recent entities yet.</span>
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

          <div className="planner-row-label">Edit bubble</div>
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
            <option value="">Select bubble to edit...</option>
            {refs.map((ref) => (
              <option key={ref.id} value={ref.id}>
                {`${ref.code} - ${ref.label} (${ref.entityType})`}
              </option>
            ))}
          </select>
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
          <select value={editRefType} onChange={(event) => setEditRefType(event.target.value as EntityType)} disabled={!editRefId}>
            {ENTITY_TYPES.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType}
              </option>
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
          <div className="planner-inline-buttons">
            <button onClick={saveCrossRefEdits} disabled={busyAction || !editRefId || editRefLabel.trim().length === 0}>
              Save bubble
            </button>
            <button className="danger" onClick={deleteCrossRefBubble} disabled={busyAction || !editRefId}>
              Delete bubble
            </button>
          </div>

          <div className="planner-row-label">Merge duplicate into this entity</div>
          <select value={mergeFromRefId} onChange={(event) => setMergeFromRefId(event.target.value)} disabled={!editRefId}>
            <option value="">
              {editRefId ? "Select duplicate entity..." : "Select an entity to enable merging..."}
            </option>
            {mergeCandidateRefs.map((ref) => (
              <option key={ref.id} value={ref.id}>
                {`${ref.code} - ${ref.label} (${ref.entityType})`}
              </option>
            ))}
          </select>
          <button onClick={mergeCrossRefIntoEdited} disabled={busyAction || !editRefId || !mergeFromRefId}>
            Merge selected duplicate
          </button>

          <div className="planner-row-label">Link this bubble to any node</div>
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
              {editRefId ? "Choose a node to link..." : "Select a bubble first..."}
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

          <div className="planner-row-label">Linked nodes in this bubble</div>
          <div className="planner-reference-list">
            {!editRefId ? (
              <span className="planner-subtle">Select a bubble to manage its links.</span>
            ) : editableRefTargets.length === 0 ? (
              <span className="planner-subtle">This bubble is not linked to any node yet.</span>
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

      <main className="planner-canvas">
        {isMobileLayout ? (
          <div className="planner-mobile-toolbar">
            <button onClick={() => setMobileSidebarOpen(true)}>Controls</button>
            <button onClick={goGrandmotherView} disabled={!rootNodeId}>
              Home
            </button>
            <button onClick={goUpOneView} disabled={!currentRootNode?.parentId}>
              Up
            </button>
            <button onClick={openSelectedAsMaster} disabled={!selectedNodeId}>
              Focus
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
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          multiSelectionKeyCode={["Shift", "Meta", "Control"]}
          onInit={setRfInstance}
          onNodesChange={handleNodesChange}
          onNodeClick={(_, node) => {
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
            if (node.id.startsWith("portal:")) return;
            setSelectedNodeId(node.id);
            setActivePortalRefId(null);
            setContextMenu({
              x: event.clientX,
              y: event.clientY,
              nodeId: node.id,
            });
          }}
          onPaneClick={() => setContextMenu(null)}
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
            hasChildren={(childrenByParent.get(contextMenu.nodeId) || []).length > 0}
            onClose={() => setContextMenu(null)}
            onAddChild={handleContextAddChild}
            onDelete={handleContextDelete}
            onDuplicate={handleContextDuplicate}
            onRename={handleContextRename}
            onAddCrossRef={handleContextAddCrossRef}
            onChangeType={handleContextChangeType}
          />
        )}

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
