/* eslint-disable react-hooks/set-state-in-effect */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUndoRedo, type LocalOp } from "../hooks/useUndoRedo";
import ReactFlow, {
  Background,
  Handle,
  Position,
  SelectionMode,
  applyNodeChanges,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
  type OnNodesChange,
} from "reactflow";
import { doc, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../firebase";
import {
  normalizeCode,
  initialsFromLabel,
  buildNodePath,
  buildNodePathTail,
  collectDescendants,
  getMasterNodeFor,
} from "../utils/treeUtils";
import {
  rgbaFromHex,
} from "../utils/normalize";
import type {
  NodeKind,
  TaskStatus,
  EntityType,
  TreeNode,
  CrossRef,
} from "../types/planner";
import { usePlannerRealtimeSync } from "../hooks/usePlannerRealtimeSync";
import { usePlannerResponsiveUi } from "../hooks/usePlannerResponsiveUi";
import { usePlannerNavigationActions } from "../hooks/usePlannerNavigationActions";
import { usePlannerCrossRefDerivedState } from "../hooks/usePlannerCrossRefDerivedState";
import { usePlannerViewDerivedState } from "../hooks/usePlannerViewDerivedState";
import { useStoryNodeContentActions } from "../hooks/useStoryNodeContentActions";
import { usePlannerNodeMutationActions } from "../hooks/usePlannerNodeMutationActions";
import { usePlannerLayoutActions } from "../hooks/usePlannerLayoutActions";
import { useCrossRefMaintenanceActions } from "../hooks/useCrossRefMaintenanceActions";
import { useCrossRefCreationActions } from "../hooks/useCrossRefCreationActions";
import { useCrossRefEditActions } from "../hooks/useCrossRefEditActions";
import { useCrossRefDeleteDetachActions } from "../hooks/useCrossRefDeleteDetachActions";
import { useCrossRefMergeActions } from "../hooks/useCrossRefMergeActions";
import { usePlannerDragActions } from "../hooks/usePlannerDragActions";
import { usePlannerContextNodeActions } from "../hooks/usePlannerContextNodeActions";
import { usePlannerContextUiActions } from "../hooks/usePlannerContextUiActions";
import { usePlannerKeyboardShortcuts } from "../hooks/usePlannerKeyboardShortcuts";
import { usePlannerPaletteItems, type PaletteItem } from "../hooks/usePlannerPaletteItems";
import { usePlannerCreateDeleteActions } from "../hooks/usePlannerCreateDeleteActions";
import { usePlannerCrossRefUiSync } from "../hooks/usePlannerCrossRefUiSync";
import { NodeContextMenu } from "../components/Planner/NodeContextMenu";
import "reactflow/dist/style.css";

type PlannerPageProps = {
  user: User;
};

type RefCategoryFilter = "all" | "people" | "other";
type RefScopeFilter = "view" | "all";

const DEFAULT_BUBBLE_COLOR = "#40B6FF";
const STORY_NODE_MIN_WIDTH = 220;
const STORY_NODE_MAX_WIDTH = 760;
const STORY_NODE_MIN_HEIGHT = 150;
const STORY_NODE_MAX_HEIGHT = 940;

function defaultNodeColor(kind: NodeKind): string {
  if (kind === "root") return "#52340A";
  if (kind === "project") return "#0A1A50";
  if (kind === "story") return "#063428";
  return "#141624";
}

function storyContainerColor(): string {
  return "#3A166C";
}

function nextNodeKind(kind: NodeKind): NodeKind {
  if (kind === "project") return "item";
  if (kind === "item") return "story";
  if (kind === "story") return "project";
  return "root";
}

function bubbleDisplayToken(label: string, fallbackCode: string): string {
  const words = label
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return normalizeCode(fallbackCode).slice(0, 3);
  if (words.length === 1) {
    const cleaned = words[0].replace(/[^a-zA-Z0-9]/g, "");
    if (!cleaned) return normalizeCode(fallbackCode).slice(0, 3);
    return cleaned.slice(0, Math.min(2, cleaned.length)).toUpperCase();
  }
  const initials = `${words[0][0] || ""}${words[1][0] || ""}`;
  return normalizeCode(initials).slice(0, 2);
}

function crossRefToFirestoreSetData(ref: CrossRef): Record<string, unknown> {
  return {
    label: ref.label,
    code: ref.code,
    nodeIds: [...ref.nodeIds],
    ...(ref.anchorNodeId ? { anchorNodeId: ref.anchorNodeId } : {}),
    ...(ref.color ? { color: ref.color } : {}),
    ...(typeof ref.portalX === "number" ? { portalX: ref.portalX } : {}),
    ...(typeof ref.portalY === "number" ? { portalY: ref.portalY } : {}),
    ...(typeof ref.portalAnchorX === "number" ? { portalAnchorX: ref.portalAnchorX } : {}),
    ...(typeof ref.portalAnchorY === "number" ? { portalAnchorY: ref.portalAnchorY } : {}),
    entityType: ref.entityType,
    tags: [...ref.tags],
    notes: ref.notes,
    contact: ref.contact,
    links: [...ref.links],
  };
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

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) return value;
  return Math.min(max, Math.max(min, value));
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

// ── Portal bubble node ─────────────────────────────────────────────────────
// Ventovault-style simple portal node: wrapper carries the orb styles and the
// node body only renders text + hidden handles for stable edge anchoring.
const PortalNode = memo(function PortalNode({
  data,
}: NodeProps<{
  display: string;
  tooltip: string;
  isActive: boolean;
}>) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="portal-target"
        isConnectable={false}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          border: "none",
          background: "transparent",
          pointerEvents: "none",
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="portal-source"
        isConnectable={false}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          border: "none",
          background: "transparent",
          pointerEvents: "none",
        }}
      />
      <div className={`planner-portal-label${data.isActive ? " active" : ""}`} data-tooltip={data.tooltip}>
        {data.display}
      </div>
    </div>
  );
});

const nodeTypes: NodeTypes = { portal: PortalNode };
const edgeTypes: EdgeTypes = Object.freeze({});
const ENTITY_TYPE_GROUPS: Array<{ label: string; options: EntityType[] }> = [
  { label: "General", options: ["entity", "organization", "partner", "vendor", "investor"] },
  { label: "People", options: ["person", "contact", "client"] },
];
const CROSS_REFERENCES_ENABLED = true;
const BUBBLES_SIMPLIFIED_MODE = true;

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
  const [mobileQuickBubbleOpen, setMobileQuickBubbleOpen] = useState(false);
  const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false);
  const [mobileQuickEditorMode, setMobileQuickEditorMode] = useState<"compact" | "full">("compact");
  const [mobileQuickBubbleEditName, setMobileQuickBubbleEditName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newRefLabelInputRef = useRef<HTMLInputElement>(null);
  const mobileQuickBubbleInputRef = useRef<HTMLInputElement>(null);
  const [newChildTitle, setNewChildTitle] = useState("");
  const [newStoryStepText, setNewStoryStepText] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [pendingRenameNodeId, setPendingRenameNodeId] = useState<string | null>(null);
  const [storyLaneMode, setStoryLaneMode] = useState(false);
  const [expandedStoryNodeIds, setExpandedStoryNodeIds] = useState<Set<string>>(new Set());
  const [newRefLabel, setNewRefLabel] = useState("");
  const [newRefCode, setNewRefCode] = useState("");
  const [newRefColor, setNewRefColor] = useState(DEFAULT_BUBBLE_COLOR);
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
  const bubbleSheetTouchStartY = useRef<number | null>(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  // RAF-batch hover updates so rapid mouse events don't trigger a React
  // re-render on every frame, and suppress them entirely during drag.
  const hoverRafRef = useRef<number | null>(null);
  const hoverPendingRef = useRef<{ nodeId: string | null; edgeId: string | null } | null>(null);
  const isDraggingRef = useRef(false);
  const scheduleHoverUpdate = useCallback((nodeId: string | null, edgeId: string | null) => {
    if (isDraggingRef.current) return;
    hoverPendingRef.current = { nodeId, edgeId };
    if (hoverRafRef.current !== null) return;
    hoverRafRef.current = window.requestAnimationFrame(() => {
      const pending = hoverPendingRef.current;
      hoverPendingRef.current = null;
      hoverRafRef.current = null;
      if (isDraggingRef.current) return;
      setHoveredNodeId(pending?.nodeId ?? null);
      setHoveredEdgeId(pending?.edgeId ?? null);
    });
  }, []);
  const [dropTargetNodeId, setDropTargetNodeId] = useState<string | null>(null);
  // Track drop target via ref during drag — avoids calling setDropTargetNodeId
  // on every mousemove frame which would recompute flowNodes each frame.
  const dropTargetIdRef = useRef<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "error">("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [collapsedHydrated, setCollapsedHydrated] = useState(false);
  const syncedCollapsedKeyRef = useRef("");
  const initialPageParamHydratedRef = useRef(false);

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

  usePlannerResponsiveUi({
    isMobileLayout,
    mobileSidebarOpen,
    mobileQuickEditorOpen,
    mobileQuickBubbleOpen,
    selectedNodeId,
    setIsMobileLayout,
    setSidebarCollapsed,
    setMobileSidebarOpen,
    setMobileQuickEditorOpen,
    setMobileQuickBubbleOpen,
    setMobileToolbarOpen,
  });

  usePlannerRealtimeSync({
    user,
    firestore: db,
    suppressSnapshotRef,
    setLoading,
    setError,
    setCollapsedHydrated,
    syncedCollapsedKeyRef,
    setCollapsedNodeIds,
    setProfileName,
    setRootNodeId,
    setNodes,
    setRefs,
    crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
    bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
  });

  useEffect(() => {
    if (!rootNodeId || loading) return;
    if (!initialPageParamHydratedRef.current) {
      initialPageParamHydratedRef.current = true;
      if (typeof window !== "undefined") {
        const pageParam = new URLSearchParams(window.location.search).get("page");
        if (pageParam && nodesById.has(pageParam)) {
          setCurrentRootId(pageParam);
          return;
        }
      }
    }
    if (!currentRootId) {
      setCurrentRootId(rootNodeId);
      return;
    }
    // Recover gracefully if the current view root was deleted or became stale.
    if (!nodesById.has(currentRootId) && nodesById.has(rootNodeId)) {
      setCurrentRootId(rootNodeId);
    }
  }, [currentRootId, loading, nodesById, rootNodeId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!rootNodeId || !currentRootId) return;
    const url = new URL(window.location.href);
    if (currentRootId === rootNodeId) {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("page", currentRootId);
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) {
      window.history.replaceState({}, "", next);
    }
  }, [currentRootId, rootNodeId]);

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
    // On mobile, keep selection explicit (don't silently snap back to root),
    // so sidebar actions always stay node-scoped to what the user tapped.
    if (isMobileLayout) return;
    if (!selectedNodeId && currentRootId) {
      setSelectedNodeId(currentRootId);
    }
  }, [selectedNodeId, currentRootId, isMobileLayout]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodesById.get(selectedNodeId) || null : null),
    [selectedNodeId, nodesById]
  );

  const effectiveBubbleTargetId = selectedNodeId || null;
  const bubbleTargetNode = selectedNode;

  const applyLocalNodePatch = useCallback(
    (
      nodeId: string,
      patch: Partial<Pick<TreeNode, "title" | "parentId" | "kind" | "x" | "y" | "width" | "height" | "color" | "taskStatus" | "storySteps" | "body">>
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

  const focusBubbleLabelInput = useCallback((delayMs = 60) => {
    window.setTimeout(() => {
      const input = newRefLabelInputRef.current;
      if (!input) return;
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
      input.select();
    }, delayMs);
  }, []);

  const openBubblesPanel = useCallback(
    (focusInput = true) => {
      setSidebarCollapsed(false);
      setMobileSidebarSection("bubbles");
      setMobileSidebarOpen(true);
      setMobileQuickEditorOpen(false);
      setMobileQuickBubbleOpen(false);
      if (focusInput) {
        focusBubbleLabelInput(isMobileLayout ? 90 : 20);
      }
    },
    [focusBubbleLabelInput, isMobileLayout]
  );

  const focusMobileQuickBubbleInput = useCallback((delayMs = 90) => {
    window.setTimeout(() => {
      const input = mobileQuickBubbleInputRef.current;
      if (!input) return;
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
      input.select();
    }, delayMs);
  }, []);

  const openMobileQuickBubble = useCallback(
    (nodeId?: string, focusInput = true) => {
      const targetId = nodeId || selectedNodeId;
      if (!targetId) return;
      setSelectedNodeId(targetId);
      setActivePortalRefId(null);
      setSidebarCollapsed(false);
      setMobileSidebarOpen(false);
      setMobileQuickEditorOpen(false);
      setMobileQuickBubbleOpen(true);
      if (focusInput) {
        focusMobileQuickBubbleInput(90);
      }
    },
    [focusMobileQuickBubbleInput, selectedNodeId]
  );

  const blurActiveInput = useCallback(() => {
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, []);

  useEffect(() => {
    if (!isMobileLayout) return;
    if (!mobileSidebarOpen || mobileSidebarSection !== "bubbles") return;
    focusBubbleLabelInput(90);
  }, [focusBubbleLabelInput, isMobileLayout, mobileSidebarOpen, mobileSidebarSection]);

  useEffect(() => {
    if (!isMobileLayout || !mobileQuickBubbleOpen) return;
    focusMobileQuickBubbleInput(90);
  }, [focusMobileQuickBubbleInput, isMobileLayout, mobileQuickBubbleOpen]);

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
        const parentNode = nodesById.get(parentId);
        const children = isCollapsed
          ? []
          : (childrenByParent.get(parentId) || []).filter((child) => filteredIdSet.has(child));
        let storyChainIndex = 0;
        let branchIndex = 0;
        children.forEach((childId) => {
          const childNode = nodesById.get(childId);
          const isStoryChain = parentNode?.kind === "story" && childNode?.kind === "story";
          const x = isStoryChain ? parentX + laneXGap * (storyChainIndex + 1) : parentX + branchXGap;
          const y = isStoryChain ? parentY : parentY + branchYGap + branchIndex * branchYGap;
          if (isStoryChain) {
            storyChainIndex += 1;
          } else {
            branchIndex += 1;
          }
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

  const {
    persistNodeBody,
    resetStoryNodeSize,
    startStoryNodeResize,
  } = useStoryNodeContentActions({
    firestore: db,
    userUid: user.uid,
    nodesById,
    pushHistory,
    applyLocalNodePatch,
    setBusyAction,
    setError,
    setNodes,
    storyNodeMinWidth: STORY_NODE_MIN_WIDTH,
    storyNodeMaxWidth: STORY_NODE_MAX_WIDTH,
    storyNodeMinHeight: STORY_NODE_MIN_HEIGHT,
    storyNodeMaxHeight: STORY_NODE_MAX_HEIGHT,
  });

  const filteredTreeIdSet = useMemo(() => new Set(filteredTreeIds), [filteredTreeIds]);

  // visiblePortals is computed after baseNodes so it reads live drag positions.

  // ── ventovault-map pattern: baseTreeNodes has NO JSX ──────────────────────
  // Plain data objects only. JSX labels are created later in flowNodes (viewNodes).
  // This ensures baseTreeNodes does not produce new object references every render
  // due to JSX instability, so the sync effect only fires on real data changes.
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
        const storyDefaultWidth = isStoryLaneBeat ? 320 : (isMobileLayout ? 320 : 300);
        const storyDefaultHeight = isExpandedStoryCard ? 320 : 210;
        const storedWidth = typeof node.width === "number" ? node.width : undefined;
        const storedHeight = typeof node.height === "number" ? node.height : undefined;
        const storyWidth = clamp(storedWidth ?? storyDefaultWidth, STORY_NODE_MIN_WIDTH, STORY_NODE_MAX_WIDTH);
        const storyHeight = clamp(storedHeight ?? storyDefaultHeight, STORY_NODE_MIN_HEIGHT, STORY_NODE_MAX_HEIGHT);
        const baseBackground = isRoot
          ? "rgba(82, 52, 6, 0.97)"
          : hasStoryChildren
            ? "rgba(58, 22, 108, 0.97)"
          : isProject
            ? "rgba(10, 26, 80, 0.97)"
          : isStory
            ? "rgba(6, 52, 42, 0.97)"
            : "rgba(20, 22, 36, 0.97)";
        const background = node.color || baseBackground;
        return {
          id: node.id,
          position,
          // Plain data — NO JSX. Label is created in flowNodes below.
          data: {
            nodeId: node.id,
            title: node.title,
            kind: node.kind,
            childCount,
            isCollapsed,
            isRoot,
            isSearchMatch,
            isProject,
            isStory,
            hasStoryChildren,
            isTaskTodo,
            isTaskDone,
            isStoryLaneBeat,
            showStoryBody,
            isExpandedStoryCard,
            bodyText,
            nodeWidth: storyWidth,
            nodeHeight: storyHeight,
            storedWidth,
            storedHeight,
          },
          style: {
            border: isSearchMatch
              ? "2px solid rgba(34, 197, 94, 0.95)"
              : isRoot
                ? "2px solid rgba(255, 200, 60, 0.95)"
                : hasStoryChildren
                  ? "1.5px solid rgba(192, 132, 252, 0.85)"
                : isProject
                  ? "1.5px solid rgba(99, 179, 255, 0.8)"
                : isStory
                  ? "1.5px solid rgba(52, 211, 153, 0.8)"
                : "1px solid rgba(100, 106, 140, 0.5)",
            borderRadius: isStoryLaneBeat ? 10 : 14,
            width: showStoryBody ? storyWidth : (isMobileLayout ? 280 : 260),
            height: showStoryBody ? storyHeight : undefined,
            minHeight: showStoryBody ? STORY_NODE_MIN_HEIGHT : undefined,
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

  // Dashed orange edges: one per (ref × visible linked node)
  const basePortalEdges = useMemo((): Edge[] => {
    if (!CROSS_REFERENCES_ENABLED) return [];
    const edges: Edge[] = [];
    for (const ref of refs) {
      for (const nodeId of ref.nodeIds) {
        if (!filteredTreeIdSet.has(nodeId)) continue;
        edges.push({
          id: `portal-edge:${ref.id}:${nodeId}`,
          source: nodeId,
          target: `portal:${ref.id}`,
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

  // ── ventovault-map pattern ─────────────────────────────────────────────────
  // baseNodes is the single source of truth for tree node positions.
  // onNodesChange (RAF-batched) writes directly into baseNodes via applyNodeChanges.
  // Portal positions are derived from baseNodes in a useMemo — no intermediate
  // displayNodes state, no competing useEffect, no flashing.
  const [baseNodes, setBaseNodes] = useState<Node[]>([]);
  const draggedNodeIdRef   = useRef<string | null>(null);
  const nodesChangeRafRef  = useRef<number | null>(null);
  const pendingNodeChangesRef = useRef<NodeChange[] | null>(null);

  // Sync baseTreeNodes → baseNodes. Fires on every baseTreeNodes change to pick
  // up metadata/style updates, BUT preserves live positions from baseNodes so
  // drag positions are never overwritten. This is safe because baseTreeNodes no
  // longer contains JSX — its reference only changes on real data changes.
  useEffect(() => {
    setBaseNodes((prev) => {
      if (prev.length === 0) return baseTreeNodes;
      // Preserve live positions from current baseNodes (what ReactFlow sees).
      const livePos = new Map(prev.map((n) => [n.id, n.position] as const));
      return baseTreeNodes.map((node) => {
        const live = livePos.get(node.id);
        return live ? ({ ...node, position: live } as Node) : node;
      });
    });
  }, [baseTreeNodes]);

  // Batch onNodesChange events through RAF — identical to ventovault-map.
  // Portals are stripped because they are derived nodes not in baseNodes.
  // Type-safe: NodeAddChange/NodeResetChange use c.item.id, others use c.id.
  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    const treeChanges = changes.filter((c: NodeChange) => {
      if (c.type === "add" || c.type === "reset") {
        return !c.item.id.startsWith("portal:");
      }
      return !c.id.startsWith("portal:");
    });
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

  // ── flowNodes (ventovault-map: viewNodes) ──────────────────────────────────
  // Creates JSX labels from plain data in baseNodes + applies selection/hover styling.
  // This is the equivalent of ventovault's viewNodes memo: JSX is created HERE,
  // not in the base data, so baseNodes stays reference-stable for applyNodeChanges.
  const flowNodes = useMemo(() => {
    return baseNodes.map((node) => {
      const d = node.data as {
        nodeId: string; title: string; kind: NodeKind;
        childCount: number; isCollapsed: boolean; isRoot: boolean;
        isSearchMatch: boolean; isProject: boolean; isStory: boolean;
        hasStoryChildren: boolean; isTaskTodo: boolean; isTaskDone: boolean;
        isStoryLaneBeat: boolean; showStoryBody: boolean;
        isExpandedStoryCard: boolean; bodyText: string;
        nodeWidth: number; nodeHeight: number;
        storedWidth?: number; storedHeight?: number;
      };
      const isSelected = selectedNodeId === node.id;
      const isActivePortalTarget = activeLinkedNodeIds.has(node.id);
      const isHoverRelated = hoverNodeIds.has(node.id);
      const isDropTarget = node.id === dropTargetNodeId;
      const isInlineStoryEditor = d.showStoryBody && d.isExpandedStoryCard;

      // Build JSX label from plain data (ventovault pattern: JSX created in viewNodes)
      const labelContent = (
        <div className={`planner-node-card${d.showStoryBody ? " story" : ""}`}>
          <div className="planner-node-label">
            {d.childCount > 0 && (
              <button
                className="nodrag nopan planner-collapse-toggle"
                type="button"
                aria-label={d.isCollapsed ? "Expand children" : "Collapse children"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNodeCollapse(d.nodeId);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                style={{
                  marginRight: "6px",
                  minWidth: isMobileLayout ? 30 : 24,
                  minHeight: isMobileLayout ? 28 : 22,
                  padding: isMobileLayout ? "4px 8px" : "2px 6px",
                  border: "none",
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "rgba(255, 255, 255, 0.8)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: isMobileLayout ? "12px" : "10px",
                  fontWeight: 700,
                  touchAction: "manipulation",
                  transition: "background 150ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = "rgba(255, 255, 255, 0.2)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = "rgba(255, 255, 255, 0.1)";
                }}
              >
                {d.isCollapsed ? "▶" : "▼"}
              </button>
            )}
            <span className={d.isTaskDone ? "planner-node-title done" : "planner-node-title"}>{d.title}</span>
            {!d.isRoot ? <span className={`planner-kind-badge ${d.kind}`}>{d.kind}</span> : null}
            {!d.isRoot && (d.isTaskTodo || d.isTaskDone) ? (
              <span className={`planner-task-badge ${d.isTaskDone ? "done" : "todo"}`}>
                {d.isTaskDone ? "Done" : "Task"}
              </span>
            ) : null}
            {d.childCount > 0 ? <span className="planner-node-count">{d.childCount}</span> : null}
          </div>
          {d.showStoryBody ? (
            <>
              {isInlineStoryEditor ? (
                <textarea
                  key={`story-inline:${d.nodeId}:${d.bodyText}`}
                  className={`planner-node-body-editor nodrag nopan ${d.isExpandedStoryCard ? "expanded" : ""}`}
                  defaultValue={d.bodyText}
                  placeholder="Write story text directly on the node..."
                  rows={1}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  onFocus={(event) => {
                    event.stopPropagation();
                    setSelectedNodeId(d.nodeId);
                  }}
                  onBlur={(event) => {
                    void persistNodeBody(d.nodeId, event.currentTarget.value);
                  }}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <div className={`planner-node-body-preview ${d.isExpandedStoryCard ? "expanded" : ""}`}>
                  {d.bodyText || "No body text yet. Select this node and write directly on the card."}
                </div>
              )}
              <button
                className="planner-story-card-expand"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleStoryCardExpand(d.nodeId);
                }}
                type="button"
              >
                {d.isExpandedStoryCard ? "Collapse text" : "Expand text"}
              </button>
              {isSelected ? (
                <button
                  className="planner-story-resize-handle nodrag nopan"
                  type="button"
                  title="Drag corner to resize. Double-click to reset size."
                  aria-label="Resize story card"
                  onPointerDown={(event) => {
                    startStoryNodeResize(
                      d.nodeId,
                      d.nodeWidth,
                      d.nodeHeight,
                      d.storedWidth,
                      d.storedHeight,
                      event
                    );
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void resetStoryNodeSize(d.nodeId);
                  }}
                >
                  ◢
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      );

      return {
        ...node,
        data: { ...node.data, label: labelContent },
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
  }, [activeLinkedNodeIds, baseNodes, dropTargetNodeId, hoverNodeIds, hoveredEdgeId, hoveredNodeId, isMobileLayout, persistNodeBody, resetStoryNodeSize, selectedNodeId, startStoryNodeResize, toggleNodeCollapse, toggleStoryCardExpand]);

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
  // Portals read positions directly from baseNodes (which has live drag positions
  // via applyNodeChanges). No portalPosRef, no portalPosTick — ventovault pattern.

  const visiblePortals = useMemo((): Node[] => {
    if (!CROSS_REFERENCES_ENABLED) return [];
    const PORTAL_SIZE = isMobileLayout ? 48 : 40;
    const PORTAL_GAP = isMobileLayout ? 54 : 50;
    const PORTAL_VERTICAL_GAP = isMobileLayout ? 34 : 30;
    const PORTAL_SIDE_GAP = isMobileLayout ? 56 : 52;
    const NODE_FALLBACK_WIDTH = isMobileLayout ? 280 : 260;
    const NODE_FALLBACK_HEIGHT = isMobileLayout ? 96 : 80;

    const nodeBounds = baseNodes.map((node) => {
      const style = (node.style || {}) as React.CSSProperties;
      const width = asFiniteNumber(style.width) ?? asFiniteNumber(node.width) ?? NODE_FALLBACK_WIDTH;
      const measuredHeight = asFiniteNumber(style.height) ?? asFiniteNumber(node.height) ?? NODE_FALLBACK_HEIGHT;
      const minHeight = asFiniteNumber(style.minHeight) ?? 0;
      return {
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width,
        height: Math.max(measuredHeight, minHeight, NODE_FALLBACK_HEIGHT),
      };
    });
    if (nodeBounds.length === 0) return [];
    const boundsByNodeId = new Map(nodeBounds.map((entry) => [entry.id, entry] as const));
    const sceneBounds = nodeBounds.reduce(
      (acc, rect) => ({
        minX: Math.min(acc.minX, rect.x),
        maxX: Math.max(acc.maxX, rect.x + rect.width),
        minY: Math.min(acc.minY, rect.y),
        maxY: Math.max(acc.maxY, rect.y + rect.height),
      }),
      { minX: nodeBounds[0].x, maxX: nodeBounds[0].x + nodeBounds[0].width, minY: nodeBounds[0].y, maxY: nodeBounds[0].y + nodeBounds[0].height }
    );
    const sceneMidX = (sceneBounds.minX + sceneBounds.maxX) / 2;
    const sceneMidY = (sceneBounds.minY + sceneBounds.maxY) / 2;
    const minX = sceneBounds.minX - (isMobileLayout ? 100 : 120);
    const maxX = sceneBounds.maxX + (isMobileLayout ? 100 : 140);
    const minY = sceneBounds.minY - (isMobileLayout ? 80 : 70);
    const maxY = sceneBounds.maxY + (isMobileLayout ? 100 : 80);

    const refsByAnchor = new Map<string, CrossRef[]>();
    for (const ref of refs) {
      const visibleNodeIds = ref.nodeIds.filter((nodeId) => filteredTreeIdSet.has(nodeId));
      if (visibleNodeIds.length === 0) continue;
      const anchorNodeId = chooseAnchorNodeId(visibleNodeIds, ref.anchorNodeId);
      if (!anchorNodeId || !boundsByNodeId.has(anchorNodeId)) continue;
      if (!refsByAnchor.has(anchorNodeId)) refsByAnchor.set(anchorNodeId, []);
      refsByAnchor.get(anchorNodeId)?.push(ref);
    }
    refsByAnchor.forEach((anchorRefs) =>
      anchorRefs.sort((a, b) => a.code.localeCompare(b.code) || a.label.localeCompare(b.label))
    );

    const result: Node[] = [];
    const anchorOrder = Array.from(refsByAnchor.keys()).sort((a, b) => {
      const aBounds = boundsByNodeId.get(a);
      const bBounds = boundsByNodeId.get(b);
      if (!aBounds || !bBounds) return a.localeCompare(b);
      if (aBounds.y !== bBounds.y) return aBounds.y - bBounds.y;
      if (aBounds.x !== bBounds.x) return aBounds.x - bBounds.x;
      return a.localeCompare(b);
    });

    for (const anchorNodeId of anchorOrder) {
      const anchorRefs = refsByAnchor.get(anchorNodeId);
      const anchorBounds = boundsByNodeId.get(anchorNodeId);
      if (!anchorRefs || anchorRefs.length === 0 || !anchorBounds) continue;
      const anchorNudge = getNudge(anchorNodeId, 12, 6);
      const stackHeight = (anchorRefs.length - 1) * PORTAL_GAP;
      const stackXBase = anchorBounds.x + anchorBounds.width / 2 - PORTAL_SIZE / 2 + anchorNudge.x;
      const placeBelow = anchorBounds.y + anchorBounds.height / 2 <= sceneMidY;
      let stackYBase = placeBelow
        ? anchorBounds.y + anchorBounds.height + PORTAL_VERTICAL_GAP
        : anchorBounds.y - PORTAL_VERTICAL_GAP - stackHeight - PORTAL_SIZE;
      stackYBase = clamp(stackYBase + anchorNudge.y, minY, maxY - stackHeight - PORTAL_SIZE);
      const sideXBase =
        anchorBounds.x +
        (anchorBounds.x + anchorBounds.width / 2 >= sceneMidX
          ? -(PORTAL_SIDE_GAP + PORTAL_SIZE)
          : anchorBounds.width + PORTAL_SIDE_GAP);
      let sideYBase = anchorBounds.y + anchorBounds.height / 2 - stackHeight / 2 + anchorNudge.y;
      sideYBase = clamp(sideYBase, minY, maxY - stackHeight - PORTAL_SIZE);
      const anchorRect = {
        x: anchorBounds.x,
        y: anchorBounds.y,
        width: anchorBounds.width,
        height: anchorBounds.height,
      };

      anchorRefs.forEach((ref, idx) => {
        const refNudge = getNudge(`${ref.id}:${anchorNodeId}`, 8, 8);
        let x = clamp(stackXBase + refNudge.x * 0.22, minX, maxX - PORTAL_SIZE);
        let y = clamp(stackYBase + idx * PORTAL_GAP + refNudge.y * 0.22, minY, maxY - PORTAL_SIZE);
        const overlapsAnchor = !(
          x + PORTAL_SIZE < anchorRect.x ||
          x > anchorRect.x + anchorRect.width ||
          y + PORTAL_SIZE < anchorRect.y ||
          y > anchorRect.y + anchorRect.height
        );
        if (overlapsAnchor) {
          x = clamp(sideXBase + refNudge.x * 0.2, minX, maxX - PORTAL_SIZE);
          y = clamp(sideYBase + idx * PORTAL_GAP + refNudge.y * 0.2, minY, maxY - PORTAL_SIZE);
        }
        const isActive = activePortalRefId === ref.id;
        const bubbleColor = ref.color || DEFAULT_BUBBLE_COLOR;
        result.push({
          id: `portal:${ref.id}`,
          position: { x, y },
          type: "portal",
          className: "planner-portal-node",
          data: {
            display: bubbleDisplayToken(ref.label, ref.code),
            tooltip:
              ref.nodeIds.length > 1
                ? `${ref.label}\n${ref.nodeIds.length} linked nodes`
                : ref.label,
            isActive,
          },
          draggable: false,
          selectable: true,
          zIndex: 10,
          style: {
            width: PORTAL_SIZE,
            height: PORTAL_SIZE,
            borderRadius: 999,
            border: isActive ? "2px solid rgba(251,191,36,0.95)" : `2px solid ${rgbaFromHex(bubbleColor, 0.95, "rgba(64,182,255,0.95)")}`,
            background: isActive ? "rgba(48,30,4,0.88)" : rgbaFromHex(bubbleColor, 0.26, "rgba(12,36,72,0.82)"),
            color: isActive ? "rgba(255,230,130,0.98)" : rgbaFromHex(bubbleColor, 0.98, "rgba(200,235,255,0.95)"),
            fontSize: PORTAL_SIZE >= 48 ? 11 : 10,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.50)",
            opacity: 1,
            visibility: "visible",
            pointerEvents: "all",
            padding: 0,
          },
        } as Node);
      });
    }
    return result;
  }, [refs, filteredTreeIdSet, baseNodes, isMobileLayout, activePortalRefId]);

  // Final node array — styled tree nodes + portal orbs (ventovault-map: viewNodes).
  const reactFlowNodes = useMemo(
    () => [...flowNodes, ...visiblePortals],
    [flowNodes, visiblePortals]
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

  const {
    currentRootNode,
    currentRootPath,
    projectPages,
    activeProjectPageIndex,
    activeProjectPageId,
    selectedNodeChildren,
    selectedNodeCollapsed,
    selectedNodeHasStoryChildren,
  } = usePlannerViewDerivedState({
    currentRootId,
    rootNodeId,
    selectedNodeId,
    nodesById,
    childrenByParent,
    collapsedNodeIds,
  });

  const {
    selectedNodeRefs,
    selectedNodeRefIds,
    describeRefTargets,
    describeRefLibraryPreview,
    filteredRefs,
    newRefSuggestions,
    nextAutoBubbleCode,
    effectiveNewBubbleCode,
    canCreateBubbleFromInput,
    bubblePrefixSuggestions,
    editableRefTargets,
    linkableNodeOptions,
    activePortalRef,
    activePortalTargets,
    mergeCandidateRefs,
  } = usePlannerCrossRefDerivedState({
    refs,
    nodes,
    nodesById,
    visibleTreeIdSet,
    selectedNodeId,
    activePortalRefId,
    effectiveBubbleTargetId,
    editRefId,
    refSearchQuery,
    refCategoryFilter,
    refScopeFilter,
    newRefLabel,
    newRefCode,
    linkNodeQuery,
  });

  const { hydrateRefEditor } = usePlannerCrossRefUiSync({
    activePortalRef,
    isMobileLayout,
    mobileQuickBubbleOpen,
    selectedNodeId,
    selectedNodeRefs,
    editRefId,
    refs,
    linkTargetNodeId,
    linkableNodeOptions,
    portalContextMenu,
    setPortalContextMenu,
    setActivePortalRefId,
    setMobileQuickBubbleEditName,
    setEditRefId,
    setEditRefLabel,
    setEditRefCode,
    setEditRefType,
    setEditRefTags,
    setEditRefNotes,
    setEditRefContact,
    setEditRefLinks,
    setMergeFromRefId,
    setLinkNodeQuery,
    setLinkTargetNodeId,
  });

  const buildDefaultPortalPosition = useCallback(
    (anchorNodeId: string | null, seed: string) => {
      if (!anchorNodeId) return null;
      return defaultPortalPositionForAnchor(resolveNodePosition(anchorNodeId), `${seed}:${anchorNodeId}`);
    },
    [resolveNodePosition]
  );

  const {
    openProjectPage,
    goPrevProjectPage,
    goNextProjectPage,
    goGrandmotherView,
    goUpOneView,
    openSelectedAsMaster,
    openSelectedAsStoryLane,
  } = usePlannerNavigationActions({
    nodesById,
    rootNodeId,
    currentRootParentId: currentRootNode?.parentId || null,
    selectedNodeId,
    projectPages,
    activeProjectPageIndex,
    setCurrentRootId,
    setSelectedNodeId,
    setStoryLaneMode,
    setActivePortalRefId,
  });

  const saveNodeBody = useCallback(
    async (nodeId: string, nextBody: string) => {
      await persistNodeBody(nodeId, nextBody);
    },
    [persistNodeBody]
  );

  const saveSelectedBody = useCallback(async () => {
    if (!selectedNodeId) return;
    await saveNodeBody(selectedNodeId, bodyDraft);
  }, [bodyDraft, saveNodeBody, selectedNodeId]);

  const { createChild, deleteSelected } = usePlannerCreateDeleteActions({
    firestore: db,
    userUid: user.uid,
    newChildTitle,
    selectedNodeId,
    currentRootId,
    rootNodeId,
    childrenByParent,
    nodesById,
    refs,
    newNodeDocId,
    resolveNodePosition,
    chooseAnchorNodeId,
    resolvePortalFollowPosition,
    crossRefToFirestoreSetData,
    pushHistory,
    setBusyAction,
    setError,
    setNewChildTitle,
    setPendingSelectedNodeId,
    setPendingRenameNodeId,
    setCurrentRootId,
    setSelectedNodeId,
    setActivePortalRefId,
  });

  const {
    renameSelected,
    setNodeTaskStatus,
    addStoryStep,
    toggleStoryStepDone,
    deleteStoryStep,
    moveStoryStep,
    setNodeColor,
  } = usePlannerNodeMutationActions({
    firestore: db,
    userUid: user.uid,
    selectedNodeId,
    selectedNode,
    renameTitle,
    setRenameTitle,
    newStoryStepText,
    setNewStoryStepText,
    nodesById,
    pushHistory,
    applyLocalNodePatch,
    setBusyAction,
    setError,
  });

  const {
    organizeVisibleTree,
    organizeSelectedBranch,
  } = usePlannerLayoutActions({
    firestore: db,
    userUid: user.uid,
    treeLayout,
    filteredTreeIds,
    filteredTreeIdSet,
    selectedNodeId,
    nodesById,
    childrenByParent,
    pushHistory,
    setBusyAction,
    setError,
    setNodes,
  });

  const { cleanUpCrossRefs } = useCrossRefMaintenanceActions({
    firestore: db,
    userUid: user.uid,
    refs,
    nodesById,
    activePortalRefId,
    editRefId,
    resolveNodePosition,
    chooseAnchorNodeId,
    resolvePortalFollowPosition,
    hydrateRefEditor,
    setActivePortalRefId,
    setBusyAction,
    setError,
  });

  const {
    linkCrossRefToNode,
    applyBubbleSuggestion,
    createCrossRef,
  } = useCrossRefCreationActions({
    firestore: db,
    userUid: user.uid,
    refs,
    effectiveBubbleTargetId,
    newRefCode,
    newRefLabel,
    newRefColor,
    newRefType,
    nextAutoBubbleCode,
    bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
    defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
    newRefLabelInputRef,
    pushHistory,
    chooseAnchorNodeId,
    resolveNodePosition,
    resolvePortalFollowPosition,
    buildDefaultPortalPosition,
    hydrateRefEditor,
    setBusyAction,
    setError,
    setActivePortalRefId,
    setLinkNodeQuery,
    setLinkTargetNodeId,
    setNewRefLabel,
    setNewRefCode,
    setNewRefColor,
    setNewRefType,
    setRefs,
  });

  const {
    duplicateCrossRef,
    mergeCrossRefIntoEdited,
  } = useCrossRefMergeActions({
    firestore: db,
    userUid: user.uid,
    refs,
    editRefId,
    mergeFromRefId,
    activePortalRefId,
    buildDefaultPortalPosition,
    chooseAnchorNodeId,
    resolveNodePosition,
    resolvePortalFollowPosition,
    hydrateRefEditor,
    setBusyAction,
    setError,
    setMergeFromRefId,
    setActivePortalRefId,
  });

  const {
    saveCrossRefEdits,
    saveMobileQuickBubbleName,
    updateCrossRefColor,
  } = useCrossRefEditActions({
    firestore: db,
    userUid: user.uid,
    editRefId,
    editRefLabel,
    editRefCode,
    editRefType,
    editRefTags,
    editRefNotes,
    editRefContact,
    editRefLinks,
    activePortalRef,
    mobileQuickBubbleEditName,
    setBusyAction,
    setError,
    setActivePortalRefId,
    setEditRefCode,
    setEditRefTags,
    setEditRefLinks,
    setEditRefLabel,
    setRefs,
  });

  const {
    deleteCrossRefBubble,
    deletePortalByRefId,
    detachCrossRef,
  } = useCrossRefDeleteDetachActions({
    firestore: db,
    userUid: user.uid,
    refs,
    editRefId,
    activePortalRefId,
    pushHistory,
    crossRefToFirestoreSetData,
    hydrateRefEditor,
    chooseAnchorNodeId,
    resolveNodePosition,
    resolvePortalFollowPosition,
    closePortalContextMenu: () => setPortalContextMenu(null),
    setBusyAction,
    setError,
    setRefs,
    setActivePortalRefId,
    setLinkNodeQuery,
    setLinkTargetNodeId,
  });

  const jumpToReferencedNode = useCallback(
    (nodeId: string) => {
      const masterId = getMasterNodeFor(nodeId, rootNodeId, nodesById);
      setCurrentRootId(masterId);
      setSelectedNodeId(nodeId);
      setActivePortalRefId(null);
    },
    [nodesById, rootNodeId]
  );

  const {
    onNodeDrag,
    onNodeDragStop,
    onSelectionDragStop,
  } = usePlannerDragActions({
    firestore: db,
    userUid: user.uid,
    rfInstance,
    childrenByParent,
    nodesById,
    collapsedNodeIds,
    rootNodeId,
    pushHistory,
    setNodes,
    setDropTargetNodeId,
    setError,
    showSaveError,
    isDraggingRef,
    draggedNodeIdRef,
    dropTargetIdRef,
  });

  // Context menu handlers
  const {
    handleContextAddChild,
    handleContextAddStorySibling,
    handleContextDelete,
    handleContextDuplicate,
    handleContextChangeType,
    handleContextToggleTaskStatus,
  } = usePlannerContextNodeActions({
    firestore: db,
    userUid: user.uid,
    rootNodeId,
    currentRootId,
    selectedNodeId,
    childrenByParent,
    nodesById,
    refs,
    newNodeDocId,
    pushHistory,
    resolveNodePosition,
    chooseAnchorNodeId,
    resolvePortalFollowPosition,
    crossRefToFirestoreSetData,
    nextNodeKind,
    applyLocalNodePatch,
    setNodeTaskStatus,
    setBusyAction,
    setError,
    setCurrentRootId,
    setSelectedNodeId,
    setActivePortalRefId,
    setPendingSelectedNodeId,
    setPendingRenameNodeId,
  });

  const {
    handleContextAddCrossRef,
    handleContextRename,
    selectRefForEditing,
  } = usePlannerContextUiActions({
    crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
    isMobileLayout,
    newRefCode,
    newRefColor,
    nextAutoBubbleCode,
    defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
    nodesById,
    refs,
    renameInputRef,
    openBubblesPanel,
    openMobileQuickBubble,
    hydrateRefEditor,
    setSelectedNodeId,
    setActivePortalRefId,
    setNewRefLabel,
    setNewRefCode,
    setNewRefColor,
    setSidebarCollapsed,
    setMobileSidebarSection,
    setMobileSidebarOpen,
    setLinkNodeQuery,
    setLinkTargetNodeId,
  });

  const toggleStoryLane = useCallback(() => {
    setStoryLaneMode((prev) => !prev);
  }, []);

  const focusNodeSearch = useCallback(() => {
    setSidebarCollapsed(false);
    setMobileSidebarSection("project");
    setMobileSidebarOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 30);
  }, []);

  const paletteItems = usePlannerPaletteItems({
    paletteQuery,
    crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
    bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
    currentRootKind,
    storyLaneMode,
    selectedNodeId,
    nodesById,
    nodes,
    refs,
    goGrandmotherView,
    goUpOneView,
    organizeVisibleTree,
    cleanUpCrossRefs,
    toggleStoryLane,
    openSelectedAsMaster,
    organizeSelectedBranch,
    openSelectedAsStoryLane,
    handleContextAddStorySibling,
    handleContextAddChild,
    handleContextChangeType,
    handleContextToggleTaskStatus,
    focusNodeSearch,
    jumpToReferencedNode,
    openBubblesPanel,
    selectRefForEditing,
    linkCrossRefToNode,
    nextNodeKind,
  });

  const runPaletteAction = useCallback((item: PaletteItem) => {
    item.action();
    setPaletteOpen(false);
    setPaletteQuery("");
    setPaletteIndex(0);
  }, []);

  usePlannerKeyboardShortcuts({
    paletteOpen,
    setPaletteOpen,
    paletteIndex,
    setPaletteIndex,
    setPaletteQuery,
    paletteItems,
    paletteInputRef,
    runPaletteAction,
    contextMenuOpen: !!contextMenu,
    activePortalRefId,
    deletePortalByRefId,
    handleContextAddChild,
    handleContextDelete,
    handleContextDuplicate,
    selectedNodeId,
    mobileQuickEditorOpen,
    setMobileQuickEditorOpen,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    searchQuery,
    setSearchQuery,
    setSelectedNodeId,
    setActivePortalRefId,
    searchInputRef,
    canUndo,
    canRedo,
    undo,
    redo,
    applyLocalOps,
    busyAction,
  });

  const sidebarIsCollapsed = !isMobileLayout && sidebarCollapsed;
  const showProjectSection = !isMobileLayout || mobileSidebarSection === "project";
  const showNodeSection = !isMobileLayout || mobileSidebarSection === "node";
  const showBubblesSection = CROSS_REFERENCES_ENABLED && !BUBBLES_SIMPLIFIED_MODE && (!isMobileLayout || mobileSidebarSection === "bubbles");
  const showSimpleBubblesSection = CROSS_REFERENCES_ENABLED && BUBBLES_SIMPLIFIED_MODE && (!isMobileLayout || mobileSidebarSection === "bubbles");

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
              <button onClick={organizeSelectedBranch} disabled={busyAction || !selectedNodeId}>
                Clean up selected branch
              </button>
              {CROSS_REFERENCES_ENABLED && !BUBBLES_SIMPLIFIED_MODE ? (
                <button onClick={cleanUpCrossRefs} disabled={busyAction}>
                  Clean stale bubbles
                </button>
              ) : null}
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
            {CROSS_REFERENCES_ENABLED ? (
              <button
                className={mobileSidebarSection === "bubbles" ? "active" : ""}
                onClick={() => openBubblesPanel(true)}
              >
                Bubbles
              </button>
            ) : null}
          </div>
        ) : null}

        {showProjectSection ? (
          <>
        <div id="project-overview-panel" className="planner-panel-block">
          <h2>{profileName || "Main Node"}</h2>
          <p className="planner-subtle">{user.email}</p>
          <p className="planner-subtle">
            Current view: <strong>{currentRootPath || "No selection"}</strong>
          </p>
          {currentRootId && rootNodeId && currentRootId !== rootNodeId ? (
            <p className="planner-subtle">Isolated view active. Use “Back to main workspace” to return.</p>
          ) : null}
          <div className="planner-row-label">Project pages</div>
          {projectPages.length === 0 ? (
            <p className="planner-subtle">No top-level project pages yet.</p>
          ) : (
            <>
              <div className="planner-inline-buttons">
                <button onClick={goPrevProjectPage} disabled={projectPages.length < 2}>
                  Previous project
                </button>
                <button onClick={goNextProjectPage} disabled={projectPages.length < 2}>
                  Next project
                </button>
              </div>
              <select
                value={activeProjectPageId}
                onChange={(event) => {
                  if (!event.target.value) return;
                  openProjectPage(event.target.value);
                }}
              >
                {activeProjectPageId === "" ? <option value="">Select a project page</option> : null}
                {projectPages.map((project, index) => (
                  <option key={project.id} value={project.id}>
                    {`${index + 1}. ${project.title}`}
                  </option>
                ))}
              </select>
              <p className="planner-subtle">
                {activeProjectPageIndex >= 0
                  ? `Page ${activeProjectPageIndex + 1} of ${projectPages.length} — URL keeps this page.`
                  : "You are outside top-level project pages. Pick one above to normalize."}
              </p>
            </>
          )}
          <div className="planner-inline-buttons">
            <button onClick={goGrandmotherView} disabled={!rootNodeId} title="Return to your full workspace root">
              Back to main workspace
            </button>
            <button onClick={goUpOneView} disabled={!currentRootNode?.parentId} title="Move one level up from the current view">
              Parent view
            </button>
          </div>
          <p className="planner-subtle">Back to main workspace returns to the root. Parent view moves one level up.</p>
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
              Clean up visible tree
            </button>
            <button onClick={organizeSelectedBranch} disabled={busyAction || !selectedNodeId}>
              Clean up selected branch
            </button>
            {CROSS_REFERENCES_ENABLED && !BUBBLES_SIMPLIFIED_MODE ? (
              <button onClick={cleanUpCrossRefs} disabled={busyAction}>
                Clean stale bubbles
              </button>
            ) : null}
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
              <div className="planner-inline-buttons">
                <button onClick={organizeSelectedBranch} disabled={busyAction}>
                  Clean up this branch
                </button>
              </div>
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
              {selectedNodeChildren.length > 0 ? (
                <button
                  onClick={() => toggleNodeCollapse(selectedNode.id)}
                  type="button"
                >
                  {selectedNodeCollapsed ? "Expand children" : "Collapse children"}
                </button>
              ) : null}
              {CROSS_REFERENCES_ENABLED ? (
                <>
                  <div className="planner-row-label">Bubbles</div>
                  <div className="planner-inline-buttons">
                    <button
                      onClick={() => {
                        void handleContextAddCrossRef(selectedNode.id);
                      }}
                    >
                      Add bubble to this node
                    </button>
                  </div>
                </>
              ) : null}

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

        {showSimpleBubblesSection ? (
        <div id="cross-ref-bubbles-panel" className="planner-panel-block">
          <h3>Bubbles</h3>
          <p className="planner-subtle">
            Local visual bubbles for each node. No cross-linking between nodes.
          </p>
          <div className="planner-row-label">Selected node target</div>
          <div className="planner-chip-list">
            {bubbleTargetNode ? (
              <button
                className="chip"
                onClick={() => {
                  setSelectedNodeId(bubbleTargetNode.id);
                  setActivePortalRefId(null);
                }}
                title={buildNodePath(bubbleTargetNode.id, nodesById)}
              >
                {bubbleTargetNode.title}
              </button>
            ) : (
              <span className="planner-subtle">Tap a node, then add a bubble.</span>
            )}
          </div>
          {bubbleTargetNode ? (
            <div className={`planner-path planner-bubble-target-path${isMobileLayout ? " planner-path-tail" : ""}`}>
              {isMobileLayout
                ? buildNodePathTail(bubbleTargetNode.id, nodesById, 3)
                : buildNodePath(bubbleTargetNode.id, nodesById)}
            </div>
          ) : (
            <p className="planner-subtle">
              Tap any node on the canvas. This panel always targets your current selection.
            </p>
          )}
          {isMobileLayout ? (
            <>
              <div className="planner-row-label">
                {bubbleTargetNode ? `Quick add to: ${bubbleTargetNode.title}` : "Tap a node first"}
              </div>
              <div className="planner-inline-buttons planner-mobile-bubble-aux-row">
                <button
                  type="button"
                  onClick={() => openMobileQuickBubble(effectiveBubbleTargetId || undefined, true)}
                  disabled={!effectiveBubbleTargetId}
                >
                  Quick Add Bubble
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileQuickBubbleOpen(false);
                    setMobileSidebarOpen(false);
                    setMobileQuickEditorOpen(false);
                  }}
                >
                  Pick Node
                </button>
              </div>
              <p className="planner-subtle">
                Quick Add opens a short sheet with one input and one Add button.
              </p>
              <details className="planner-advanced-tools">
                <summary>Advanced bubble options</summary>
                <div className="planner-advanced-tools-content">
                  <div className="planner-inline-buttons planner-mobile-bubble-input-row">
                    <input
                      ref={newRefLabelInputRef}
                      value={newRefLabel}
                      onChange={(event) => setNewRefLabel(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        if (busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput) return;
                        void createCrossRef();
                      }}
                      placeholder="Bubble name"
                    />
                    <button
                      onClick={() => {
                        void createCrossRef();
                      }}
                      disabled={busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput}
                    >
                      Add
                    </button>
                  </div>
                  <div className="planner-inline-buttons planner-mobile-bubble-aux-row">
                    <button type="button" onClick={blurActiveInput}>
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => openMobileQuickBubble(effectiveBubbleTargetId || undefined, true)}
                      disabled={!effectiveBubbleTargetId}
                    >
                      Open Quick Add
                    </button>
                  </div>
                  <div className="planner-inline-buttons">
                    <label style={{ display: "grid", gap: 4, alignItems: "center" }}>
                      <span className="planner-subtle" style={{ fontSize: 11 }}>Color</span>
                      <input
                        type="color"
                        value={newRefColor}
                        onChange={(event) => setNewRefColor(event.target.value)}
                        style={{ width: 54, height: 34, padding: "4px 6px" }}
                      />
                    </label>
                    <div style={{ display: "grid", gap: 4, flex: 1 }}>
                      <input
                        value={newRefCode}
                        onChange={(event) => setNewRefCode(event.target.value)}
                        placeholder={`Code (auto ${nextAutoBubbleCode})`}
                        style={{ flex: 1 }}
                      />
                      <span className="planner-subtle" style={{ fontSize: 11 }}>
                        New bubble code: <strong>{effectiveNewBubbleCode}</strong>
                      </span>
                    </div>
                  </div>
                  {bubblePrefixSuggestions.length > 0 ? (
                    <>
                      <div className="planner-row-label">Similar bubble styles</div>
                      <div className="planner-chip-list">
                        {bubblePrefixSuggestions.map((ref) => (
                          <button
                            key={`template:${ref.id}`}
                            className="chip"
                            onClick={() => applyBubbleSuggestion(ref)}
                            title={`Use style from ${ref.label} (${ref.code})`}
                            style={{
                              borderColor: rgbaFromHex(ref.color, 0.9, "rgba(64,182,255,0.88)"),
                              boxShadow: `0 0 0 1px ${rgbaFromHex(ref.color, 0.25, "rgba(64,182,255,0.2)")}`,
                            }}
                          >
                            {ref.label}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              </details>
            </>
          ) : (
            <>
              <div className="planner-row-label">
                {bubbleTargetNode ? `Add bubble to: ${bubbleTargetNode.title}` : "Tap a node first"}
              </div>
              <input
                ref={newRefLabelInputRef}
                value={newRefLabel}
                onChange={(event) => setNewRefLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput) return;
                  void createCrossRef();
                }}
                placeholder="Bubble name"
              />
              <button
                onClick={() => {
                  void createCrossRef();
                }}
                disabled={busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput}
              >
                {effectiveBubbleTargetId ? "Add Bubble to Selected Node" : "Select Node to Add Bubble"}
              </button>
              <div className="planner-inline-buttons">
                <label style={{ display: "grid", gap: 4, alignItems: "center" }}>
                  <span className="planner-subtle" style={{ fontSize: 11 }}>Color</span>
                  <input
                    type="color"
                    value={newRefColor}
                    onChange={(event) => setNewRefColor(event.target.value)}
                    style={{ width: 54, height: 34, padding: "4px 6px" }}
                  />
                </label>
                <div style={{ display: "grid", gap: 4, flex: 1 }}>
                  <input
                    value={newRefCode}
                    onChange={(event) => setNewRefCode(event.target.value)}
                    placeholder={`Code (auto ${nextAutoBubbleCode})`}
                    style={{ flex: 1 }}
                  />
                  <span className="planner-subtle" style={{ fontSize: 11 }}>
                    New bubble code: <strong>{effectiveNewBubbleCode}</strong>
                  </span>
                </div>
              </div>
              {bubblePrefixSuggestions.length > 0 ? (
                <>
                  <div className="planner-row-label">Similar bubble styles</div>
                  <div className="planner-chip-list">
                    {bubblePrefixSuggestions.map((ref) => (
                      <button
                        key={`template:${ref.id}`}
                        className="chip"
                        onClick={() => applyBubbleSuggestion(ref)}
                        title={`Use style from ${ref.label} (${ref.code})`}
                        style={{
                          borderColor: rgbaFromHex(ref.color, 0.9, "rgba(64,182,255,0.88)"),
                          boxShadow: `0 0 0 1px ${rgbaFromHex(ref.color, 0.25, "rgba(64,182,255,0.2)")}`,
                        }}
                      >
                        {ref.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
          <div className="planner-row-label">
            {bubbleTargetNode ? `Bubbles on ${bubbleTargetNode.title}` : "Bubbles on selected node"}
          </div>
          <div className="planner-chip-list">
            {selectedNodeRefs.length === 0 || !selectedNodeId ? (
              <span className="planner-subtle">No bubbles yet.</span>
            ) : (
              selectedNodeRefs.map((ref) => (
                <div key={ref.id} className="chip with-action">
                  <button
                    onClick={() => setActivePortalRefId((prev) => (prev === ref.id ? null : ref.id))}
                    title={ref.label}
                    style={{
                      borderColor: rgbaFromHex(ref.color, 0.9, "rgba(64,182,255,0.88)"),
                      boxShadow: `0 0 0 1px ${rgbaFromHex(ref.color, 0.25, "rgba(64,182,255,0.2)")}`,
                    }}
                  >
                    {ref.label}
                  </button>
                  <button
                    className="chip-action"
                    onClick={() => void deletePortalByRefId(ref.id)}
                    title="Delete bubble"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
          {activePortalRef ? (
            <div className="planner-panel-block" style={{ marginTop: 8, padding: "10px 12px" }}>
              <div className="planner-row-label">Selected bubble</div>
              <div className="planner-inline-buttons">
                <span className="planner-subtle" style={{ alignSelf: "center" }}>{`${activePortalRef.label} (${activePortalRef.code})`}</span>
                <input
                  type="color"
                  value={activePortalRef.color || DEFAULT_BUBBLE_COLOR}
                  onChange={(event) => {
                    void updateCrossRefColor(activePortalRef.id, event.target.value);
                  }}
                  style={{ width: 56, height: 34, padding: "4px 6px" }}
                />
              </div>
            </div>
          ) : null}
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
          <button
            onClick={() => {
              void createCrossRef();
            }}
            disabled={busyAction || !selectedNodeId || !canCreateBubbleFromInput}
          >
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

      {isMobileLayout && mobileQuickBubbleOpen ? (
        <button
          type="button"
          className="planner-mobile-backdrop planner-mobile-sheet-backdrop"
          aria-label="Close quick bubble add"
          onClick={() => setMobileQuickBubbleOpen(false)}
        />
      ) : null}

      {isMobileLayout && mobileQuickEditorOpen ? (
        <section
          className={`planner-mobile-sheet ${mobileQuickEditorMode === "compact" ? "compact" : "full"}`}
          role="dialog"
          aria-label="Quick node editor"
        >
          <div
            className="planner-mobile-sheet-handle"
            onClick={() => setMobileQuickEditorOpen(false)}
            role="button"
            aria-label="Close"
            onTouchStart={(e) => { sheetTouchStartY.current = e.touches[0]?.clientY ?? null; }}
            onTouchEnd={(e) => {
              const startY = sheetTouchStartY.current;
              if (startY === null) return;
              const endY = e.changedTouches[0]?.clientY ?? startY;
              sheetTouchStartY.current = null;
              // Swipe down on handle ≥ 60px → dismiss.
              if (endY - startY > 60) setMobileQuickEditorOpen(false);
            }}
          />
          {selectedNode ? (
            <>
              <div className="planner-mobile-sheet-header">
                <strong>{selectedNode.title}</strong>
                <span>{selectedNode.kind}</span>
              </div>
              <div className="planner-mobile-sheet-path">{buildNodePath(selectedNode.id, nodesById)}</div>
              <div className="planner-mobile-sheet-mode-toggle" role="tablist" aria-label="Editor detail level">
                <button
                  type="button"
                  className={mobileQuickEditorMode === "compact" ? "active" : ""}
                  onClick={() => setMobileQuickEditorMode("compact")}
                  aria-selected={mobileQuickEditorMode === "compact"}
                >
                  Compact
                </button>
                <button
                  type="button"
                  className={mobileQuickEditorMode === "full" ? "active" : ""}
                  onClick={() => setMobileQuickEditorMode("full")}
                  aria-selected={mobileQuickEditorMode === "full"}
                >
                  Full
                </button>
              </div>
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
              <button onClick={renameSelected} disabled={busyAction || renameTitle.trim().length === 0}>
                Save Name
              </button>
              {mobileQuickEditorMode === "compact" ? (
                <>
                  <div className="planner-mobile-sheet-compact-summary">
                    <div className="planner-row-label">Body preview</div>
                    <div className="planner-subtle">
                      {(selectedNode.body || "").trim().length > 0
                        ? ((selectedNode.body || "").trim().length > 120
                          ? `${(selectedNode.body || "").trim().slice(0, 120)}...`
                          : (selectedNode.body || "").trim())
                        : "No body text yet."}
                    </div>
                    {CROSS_REFERENCES_ENABLED ? (
                      <div className="planner-subtle">
                        {selectedNodeRefs.length} bubble{selectedNodeRefs.length === 1 ? "" : "s"} on this node
                      </div>
                    ) : null}
                  </div>
                  {CROSS_REFERENCES_ENABLED ? (
                    <>
                      <div className="planner-row-label">Quick bubble on this node</div>
                      <div className="planner-inline-buttons planner-mobile-quick-bubble-row">
                        <input
                          value={newRefLabel}
                          onChange={(event) => setNewRefLabel(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            if (busyAction || !canCreateBubbleFromInput) return;
                            void createCrossRef(selectedNode.id);
                          }}
                          placeholder="Bubble name"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void createCrossRef(selectedNode.id);
                          }}
                          disabled={busyAction || !canCreateBubbleFromInput}
                        >
                          Add bubble
                        </button>
                      </div>
                    </>
                  ) : null}
                  <div className="planner-mobile-sheet-grid planner-mobile-sheet-compact-grid">
                    <button
                      type="button"
                      onClick={() => setMobileQuickEditorMode("full")}
                    >
                      Expand Editor
                    </button>
                    {CROSS_REFERENCES_ENABLED ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileQuickEditorOpen(false);
                          openMobileQuickBubble(selectedNode.id, true);
                        }}
                      >
                        Add Bubble
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <textarea
                    value={bodyDraft}
                    onChange={(event) => setBodyDraft(event.target.value)}
                    placeholder={selectedNode.kind === "story" ? "Scene/story body..." : "Node notes..."}
                    rows={selectedNode.kind === "story" ? 6 : 4}
                  />
                  <button onClick={saveSelectedBody} disabled={busyAction || bodyDraft.trim() === (selectedNode.body || "").trim()}>
                    Save Body
                  </button>
                  {CROSS_REFERENCES_ENABLED ? (
                    <>
                      <div className="planner-row-label">Quick bubble on this node</div>
                      <input
                        value={newRefLabel}
                        onChange={(event) => setNewRefLabel(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          if (busyAction || !selectedNodeId || !canCreateBubbleFromInput) return;
                          void createCrossRef(selectedNode.id);
                        }}
                        placeholder="Bubble name"
                      />
                      <div className="planner-inline-buttons">
                        <input
                          value={newRefCode}
                          onChange={(event) => setNewRefCode(event.target.value)}
                          placeholder={`Code (auto ${nextAutoBubbleCode})`}
                          style={{ flex: 1 }}
                        />
                        <input
                          type="color"
                          value={newRefColor}
                          onChange={(event) => setNewRefColor(event.target.value)}
                          style={{ width: 54, height: 34, padding: "4px 6px" }}
                        />
                        <button
                          onClick={() => {
                            void createCrossRef(selectedNode.id);
                          }}
                          disabled={busyAction || !selectedNodeId || !canCreateBubbleFromInput}
                        >
                          Add Bubble
                        </button>
                      </div>
                      {bubblePrefixSuggestions.length > 0 ? (
                        <div className="planner-chip-list">
                          {bubblePrefixSuggestions.slice(0, 3).map((ref) => (
                            <button
                              key={`mobile-template:${ref.id}`}
                              className="chip"
                              onClick={() => applyBubbleSuggestion(ref)}
                              title={`Use style from ${ref.label} (${ref.code})`}
                              style={{
                                borderColor: rgbaFromHex(ref.color, 0.9, "rgba(64,182,255,0.88)"),
                                boxShadow: `0 0 0 1px ${rgbaFromHex(ref.color, 0.25, "rgba(64,182,255,0.2)")}`,
                              }}
                            >
                              {ref.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <button
                        onClick={() => {
                          setMobileQuickEditorOpen(false);
                          openBubblesPanel(false);
                        }}
                      >
                        Open Bubble Manager
                      </button>
                    </>
                  ) : null}
                </>
              )}
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
                  onClick={() => toggleNodeCollapse(selectedNode.id)}
                  disabled={selectedNodeChildren.length === 0}
                >
                  {selectedNodeCollapsed ? "Expand kids" : "Collapse kids"}
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
                    setMobileQuickEditorOpen(false);
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

      {isMobileLayout && mobileQuickBubbleOpen ? (
        <section
          className="planner-mobile-sheet compact planner-mobile-bubble-sheet"
          role="dialog"
          aria-label="Quick bubble add"
        >
          <div
            className="planner-mobile-sheet-handle"
            onClick={() => setMobileQuickBubbleOpen(false)}
            role="button"
            aria-label="Close"
            onTouchStart={(event) => { bubbleSheetTouchStartY.current = event.touches[0]?.clientY ?? null; }}
            onTouchEnd={(event) => {
              const startY = bubbleSheetTouchStartY.current;
              if (startY === null) return;
              const endY = event.changedTouches[0]?.clientY ?? startY;
              bubbleSheetTouchStartY.current = null;
              if (endY - startY > 60) setMobileQuickBubbleOpen(false);
            }}
          />
          {selectedNode ? (
            <>
              <div className="planner-mobile-sheet-header">
                <strong>{selectedNode.title}</strong>
                <span>bubble</span>
              </div>
              <div className="planner-mobile-sheet-path planner-mobile-sheet-path-tail">
                {buildNodePathTail(selectedNode.id, nodesById, 3)}
              </div>
              <div className="planner-row-label">Bubble name</div>
              <div className="planner-inline-buttons planner-mobile-bubble-input-row">
                <input
                  ref={mobileQuickBubbleInputRef}
                  value={newRefLabel}
                  onChange={(event) => setNewRefLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    if (busyAction || !canCreateBubbleFromInput) return;
                    void createCrossRef(selectedNode.id).then(() => {
                      focusMobileQuickBubbleInput(30);
                    });
                  }}
                  placeholder="Bubble name"
                />
                <button
                  type="button"
                  onClick={() => {
                    void createCrossRef(selectedNode.id).then(() => {
                      focusMobileQuickBubbleInput(30);
                    });
                  }}
                  disabled={busyAction || !canCreateBubbleFromInput}
                >
                  Add
                </button>
              </div>
              <div className="planner-inline-buttons planner-mobile-bubble-aux-row">
                <button type="button" onClick={blurActiveInput}>
                  Done
                </button>
                <button type="button" onClick={() => openBubblesPanel(false)}>
                  Manage
                </button>
              </div>
              <div className="planner-inline-buttons planner-mobile-bubble-meta-row">
                <details className="planner-advanced-tools" style={{ width: "100%" }}>
                  <summary>Advanced style and code (optional)</summary>
                  <div className="planner-advanced-tools-content">
                    <label style={{ display: "grid", gap: 4, alignItems: "center" }}>
                      <span className="planner-subtle" style={{ fontSize: 11 }}>Color</span>
                      <input
                        type="color"
                        value={newRefColor}
                        onChange={(event) => setNewRefColor(event.target.value)}
                        style={{ width: 58, height: 34, padding: "4px 6px" }}
                      />
                    </label>
                    <div style={{ display: "grid", gap: 4, flex: 1 }}>
                      <input
                        value={newRefCode}
                        onChange={(event) => setNewRefCode(event.target.value)}
                        placeholder={`Internal code (auto ${nextAutoBubbleCode})`}
                        style={{ flex: 1 }}
                      />
                      <span className="planner-subtle" style={{ fontSize: 11 }}>
                        Internal code: <strong>{effectiveNewBubbleCode}</strong>
                      </span>
                    </div>
                  </div>
                </details>
              </div>
              {bubblePrefixSuggestions.length > 0 ? (
                <div className="planner-chip-list">
                  {bubblePrefixSuggestions.slice(0, 4).map((ref) => (
                    <button
                      key={`mobile-quick-template:${ref.id}`}
                      className="chip"
                      onClick={() => applyBubbleSuggestion(ref)}
                      title={`Use style from ${ref.label} (${ref.code})`}
                      style={{
                        borderColor: rgbaFromHex(ref.color, 0.9, "rgba(64,182,255,0.88)"),
                        boxShadow: `0 0 0 1px ${rgbaFromHex(ref.color, 0.25, "rgba(64,182,255,0.2)")}`,
                      }}
                    >
                      {ref.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="planner-subtle">
                {selectedNodeRefs.length} bubble{selectedNodeRefs.length === 1 ? "" : "s"} currently on this node.
              </div>
              <div className="planner-row-label">Bubbles on this node</div>
              <div className="planner-chip-list">
                {selectedNodeRefs.length === 0 ? (
                  <span className="planner-subtle">No bubbles yet.</span>
                ) : (
                  selectedNodeRefs.map((ref) => (
                    <button
                      key={`mobile-quick-node-ref:${ref.id}`}
                      className="chip"
                      onClick={() => selectRefForEditing(ref.id)}
                      style={{
                        borderColor: rgbaFromHex(ref.color, 0.9, "rgba(64,182,255,0.88)"),
                        boxShadow: `0 0 0 1px ${rgbaFromHex(ref.color, 0.25, "rgba(64,182,255,0.2)")}`,
                        background:
                          activePortalRef?.id === ref.id
                            ? rgbaFromHex(ref.color, 0.22, "rgba(64,182,255,0.2)")
                            : undefined,
                      }}
                    >
                      {ref.label}
                    </button>
                  ))
                )}
              </div>
              {activePortalRef && activePortalRef.nodeIds.includes(selectedNode.id) ? (
                <>
                  <div className="planner-row-label">Edit selected bubble</div>
                  <input
                    value={mobileQuickBubbleEditName}
                    onChange={(event) => setMobileQuickBubbleEditName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      if (busyAction || mobileQuickBubbleEditName.trim().length === 0) return;
                      void saveMobileQuickBubbleName();
                    }}
                    placeholder="Bubble name"
                  />
                  <div className="planner-inline-buttons planner-mobile-bubble-edit-row">
                    <input
                      type="color"
                      value={activePortalRef.color || DEFAULT_BUBBLE_COLOR}
                      onChange={(event) => {
                        void updateCrossRefColor(activePortalRef.id, event.target.value);
                      }}
                      style={{ width: 58, height: 34, padding: "4px 6px" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void saveMobileQuickBubbleName();
                      }}
                      disabled={busyAction || mobileQuickBubbleEditName.trim().length === 0}
                    >
                      Save Name
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void deletePortalByRefId(activePortalRef.id);
                      }}
                      disabled={busyAction}
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : null}
              <div className="planner-mobile-sheet-actions">
                <button onClick={() => setMobileQuickBubbleOpen(false)}>Close</button>
              </div>
            </>
          ) : (
            <>
              <div className="planner-subtle">Select a node first, then use Bubble.</div>
              <div className="planner-mobile-sheet-actions">
                <button onClick={() => setMobileQuickBubbleOpen(false)}>Close</button>
              </div>
            </>
          )}
        </section>
      ) : null}

      <main className="planner-canvas">
        {isMobileLayout ? (
          <>
            <button
              type="button"
              className="planner-mobile-toolbar-launcher"
              aria-label={mobileToolbarOpen ? "Hide controls" : "Show controls"}
              onClick={() => setMobileToolbarOpen((previous) => !previous)}
            >
              {mobileToolbarOpen ? "×" : "☰"}
            </button>
            {mobileToolbarOpen ? (
              <div className="planner-mobile-toolbar">
                <button
                  onClick={() => {
                    setMobileSidebarSection(selectedNodeId ? "node" : "project");
                    setMobileSidebarOpen(true);
                    setMobileQuickEditorOpen(false);
                    setMobileQuickBubbleOpen(false);
                    setMobileToolbarOpen(false);
                  }}
                >
                  ☰ Menu
                </button>
                <button
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    setMobileQuickEditorMode("compact");
                    setMobileQuickEditorOpen(true);
                    setMobileQuickBubbleOpen(false);
                    setMobileToolbarOpen(false);
                  }}
                  disabled={!selectedNode}
                >
                  Edit
                </button>
                {CROSS_REFERENCES_ENABLED ? (
                  <button
                    onClick={() => {
                      if (!selectedNodeId) return;
                      setActivePortalRefId(null);
                      openMobileQuickBubble(selectedNodeId, true);
                      setMobileToolbarOpen(false);
                    }}
                    disabled={!selectedNodeId}
                  >
                    ◯ Bubble
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    if (!selectedNodeId) return;
                    void handleContextAddChild(selectedNodeId);
                    setMobileToolbarOpen(false);
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
                    setMobileToolbarOpen(false);
                  }}
                  disabled={!selectedNode || selectedNode.kind === "root"}
                >
                  {selectedNode?.taskStatus === "done" ? "↩ Todo" : "✓ Done"}
                </button>
                <button
                  onClick={() => {
                    goGrandmotherView();
                    setMobileToolbarOpen(false);
                  }}
                  disabled={!rootNodeId}
                >
                  ⌂ Home
                </button>
                <button
                  onClick={() => {
                    goUpOneView();
                    setMobileToolbarOpen(false);
                  }}
                  disabled={!currentRootNode?.parentId}
                >
                  ↑ Up
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        <ReactFlow
          nodes={reactFlowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: isMobileLayout ? 0.12 : 0.3, maxZoom: isMobileLayout ? 0.85 : 1 }}
          onlyRenderVisibleElements={false}
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
              const refId = node.id.split(":")[1];
              const nextSelected = activePortalRefId === refId ? null : refId;
              setActivePortalRefId(nextSelected);
              if (nextSelected) {
                selectRefForEditing(refId);
                openBubblesPanel(false);
                window.setTimeout(() => {
                  const section = document.getElementById("cross-ref-bubbles-panel");
                  section?.scrollIntoView({ block: "start", behavior: "smooth" });
                }, 20);
              }
              if (isMobileLayout) setMobileToolbarOpen(false);
              return;
            }
            setSelectedNodeId(node.id);
            setActivePortalRefId(null);
            if (isMobileLayout) {
              setMobileSidebarOpen(false);
              setMobileToolbarOpen(false);
            }
          }}
          onNodeDoubleClick={(_, node) => {
            if (isMobileLayout) return;
            // Zoom only; changing view root is an explicit action.
            onNodeDoubleClick(_, node);
          }}
          onNodeMouseEnter={(_, node) => {
            if (node.id.startsWith("portal:")) return;
            scheduleHoverUpdate(node.id, hoveredEdgeId);
          }}
          onNodeMouseLeave={(_, node) => {
            if (node.id.startsWith("portal:")) return;
            scheduleHoverUpdate(null, hoveredEdgeId);
          }}
          onEdgeMouseEnter={(_, edge) => scheduleHoverUpdate(hoveredNodeId, edge.id)}
          onEdgeMouseLeave={() => scheduleHoverUpdate(hoveredNodeId, null)}
          onNodeDragStart={(_, node) => {
            if (!node.id.startsWith("portal:")) isDraggingRef.current = true;
          }}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onSelectionDragStop={onSelectionDragStop}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            // Portal orb right-click → show portal delete menu
            if (node.id.startsWith("portal:")) {
              const refId = node.id.split(":")[1];
              setPortalContextMenu({ x: event.clientX, y: event.clientY, refId });
              return;
            }
            setPortalContextMenu(null);
            if (isMobileLayout) {
              setSelectedNodeId(node.id);
              setActivePortalRefId(null);
              setMobileSidebarOpen(false);
              setMobileQuickBubbleOpen(false);
              setMobileQuickEditorMode("compact");
              setMobileQuickEditorOpen(true);
              setMobileToolbarOpen(false);
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
            setActivePortalRefId(null);
            // On mobile, tapping the canvas background deselects and closes the sheet.
            if (isMobileLayout) {
              setSelectedNodeId(null);
              setMobileQuickEditorOpen(false);
              setMobileQuickBubbleOpen(false);
              setMobileToolbarOpen(false);
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
            onAddCrossRef={CROSS_REFERENCES_ENABLED ? handleContextAddCrossRef : undefined}
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
                    letterSpacing: "0.02em",
                    textTransform: "none",
                    color: "rgba(255,160,71,0.75)",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    marginBottom: 4,
                  }}
                >
                  {menuRef.label} ({menuRef.code})
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
                {busyAction ? "Deleting…" : "Delete bubble"}
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
