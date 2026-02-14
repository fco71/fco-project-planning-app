import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
} from "reactflow";
import {
  arrayRemove,
  arrayUnion,
  collection,
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
import {
  buildNodePath,
  collectDescendants,
  getMasterNodeFor,
  normalizeCode,
  initialsFromLabel,
  type TreeNode,
} from "../utils/treeUtils";
import { adjustPortalPosition, buildTreeNodeBounds } from "../utils/portalUtils";
import PlannerCanvas from "../components/Planner/PlannerCanvas";
import PlannerSidebar from "../components/Planner/PlannerSidebar";
import "reactflow/dist/style.css";

type PlannerPageProps = {
  user: User;
};

type TreeNodeDoc = {
  title: string;
  parentId: string | null;
  kind: "root" | "project" | "item";
  x?: number;
  y?: number;
};

type CrossRefDoc = {
  label: string;
  code: string;
  nodeIds: string[];
};

type CrossRef = CrossRefDoc & { id: string };

type PortalData = {
  label: string;
  title: string;
};

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

export default function PlannerPage({ user }: PlannerPageProps) {
  const [profileName, setProfileName] = useState("");
  const [rootNodeId, setRootNodeId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [refs, setRefs] = useState<CrossRef[]>([]);
  const [currentRootId, setCurrentRootId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingSelectedNodeId, setPendingSelectedNodeId] = useState<string | null>(null);
  const [newChildTitle, setNewChildTitle] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [newRefLabel, setNewRefLabel] = useState("");
  const [newRefCode, setNewRefCode] = useState("");
  const [attachRefId, setAttachRefId] = useState("");
  const [activePortalRefId, setActivePortalRefId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
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
              const value = entry.data() as Partial<CrossRefDoc>;
              return {
                id: entry.id,
                label: typeof value.label === "string" ? value.label : entry.id,
                code: typeof value.code === "string" ? normalizeCode(value.code) : "REF",
                nodeIds: Array.isArray(value.nodeIds)
                  ? value.nodeIds.filter((item): item is string => typeof item === "string")
                  : [],
              } satisfies CrossRef;
            });
            nextRefs.sort((a, b) => a.code.localeCompare(b.code) || a.label.localeCompare(b.label));
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
    if (!currentRootId) setCurrentRootId(rootNodeId);
  }, [rootNodeId, currentRootId]);

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

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      // G: Grandmother view (main root)
      if (key === "g" && rootNodeId) {
        event.preventDefault();
        setCurrentRootId(rootNodeId);
        setActivePortalRefId(null);
      }

      // U: Up one level
      if (key === "u" && currentRootId) {
        const currentNode = nodesById.get(currentRootId);
        if (currentNode?.parentId) {
          event.preventDefault();
          setCurrentRootId(currentNode.parentId);
          setActivePortalRefId(null);
        }
      }

      // O: Open selected as master
      if (key === "o" && selectedNodeId) {
        event.preventDefault();
        setCurrentRootId(selectedNodeId);
        setActivePortalRefId(null);
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [rootNodeId, currentRootId, selectedNodeId, nodesById]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodesById.get(selectedNodeId) || null : null),
    [selectedNodeId, nodesById]
  );

  useEffect(() => {
    setRenameTitle(selectedNode?.title || "");
  }, [selectedNode?.id, selectedNode?.title]);

  const visibleTreeIds = useMemo(() => {
    if (!currentRootId) return [] as string[];
    return collectDescendants(currentRootId, childrenByParent);
  }, [childrenByParent, currentRootId]);

  const visibleTreeIdSet = useMemo(() => new Set(visibleTreeIds), [visibleTreeIds]);

  const treeLayout = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    if (!currentRootId) return map;
    let nextRow = 0;
    const xGap = 280;
    const yGap = 140;

    const walk = (nodeId: string, depth: number): number => {
      const children = (childrenByParent.get(nodeId) || []).filter((child) => visibleTreeIdSet.has(child));
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
  }, [childrenByParent, currentRootId, visibleTreeIdSet]);

  const baseTreeNodes = useMemo(() => {
    return visibleTreeIds
      .map((id) => nodesById.get(id))
      .filter((node): node is TreeNode => !!node)
      .map((node) => {
        const childCount = (childrenByParent.get(node.id) || []).length;
        const autoPosition = treeLayout.get(node.id) || { x: 0, y: 0 };
        const position = {
          x: typeof node.x === "number" ? node.x : autoPosition.x,
          y: typeof node.y === "number" ? node.y : autoPosition.y,
        };
        const isRoot = node.id === rootNodeId;
        return {
          id: node.id,
          position,
          data: {
            label: (
              <div className="planner-node-label">
                <span>{node.title}</span>
                {childCount > 0 ? <span className="planner-node-count">{childCount}</span> : null}
              </div>
            ),
          },
          style: {
            border: isRoot ? "2px solid rgba(253, 228, 129, 0.9)" : "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: 14,
            width: 260,
            padding: 10,
            background: isRoot ? "rgba(58, 44, 14, 0.92)" : "rgba(16, 20, 28, 0.94)",
            color: "rgba(250, 252, 255, 0.95)",
            boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
            fontWeight: 700,
            fontSize: 12.5,
          } as React.CSSProperties,
          draggable: true,
          selectable: true,
        } as Node;
      });
  }, [childrenByParent, nodesById, rootNodeId, treeLayout, visibleTreeIds]);

  const baseTreeEdges = useMemo(() => {
    return visibleTreeIds
      .map((id) => nodesById.get(id))
      .filter((node): node is TreeNode => !!node && !!node.parentId && visibleTreeIdSet.has(node.parentId))
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
  }, [nodesById, visibleTreeIds, visibleTreeIdSet]);

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
    // Build collision bounds for tree nodes
    const treeNodeBounds = buildTreeNodeBounds(baseTreeNodes);
    const portalSize = { width: 48, height: 48 };
    const positionedPortals: Array<{ x: number; y: number }> = [];

    return visiblePortals.map((entry, index) => {
      // Calculate initial position (no collision detection)
      const initialPosition = {
        x: treeBounds.maxX + 220,
        y: treeBounds.minY + index * 84,
      };

      // Adjust position to avoid collisions with tree nodes and other portals
      const adjustedPosition = adjustPortalPosition(
        initialPosition,
        portalSize,
        treeNodeBounds,
        positionedPortals
      );

      // Track this portal's position for future collision checks
      positionedPortals.push(adjustedPosition);

      return {
        id: `portal:${entry.ref.id}`,
        type: "portal",
        position: adjustedPosition,
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
        } as React.CSSProperties,
        draggable: false,
        selectable: true,
      } as Node<PortalData>;
    });
  }, [treeBounds.maxX, treeBounds.minY, visiblePortals, baseTreeNodes]);

  const basePortalEdges = useMemo(() => {
    return visiblePortals
      .map((entry) => {
        const source = entry.inView[0];
        if (!source) return null;
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
      .filter((edge): edge is Edge => !!edge);
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

  const flowNodes = useMemo(() => {
    const treeNodes = baseTreeNodes.map((node) => {
      const isSelected = selectedNodeId === node.id;
      const isHoverRelated = hoverNodeIds.has(node.id);
      return {
        ...node,
        style: {
          ...(node.style || {}),
          border: isSelected
            ? "2px solid rgba(253, 224, 71, 0.95)"
            : (node.style as React.CSSProperties)?.border,
          boxShadow: isSelected
            ? "0 0 0 3px rgba(253, 224, 71, 0.18), 0 14px 32px rgba(0,0,0,0.45)"
            : isHoverRelated
              ? "0 0 0 2px rgba(125,211,252,0.22), 0 14px 30px rgba(0,0,0,0.42)"
              : (node.style as React.CSSProperties)?.boxShadow,
          opacity: hoveredNodeId || hoveredEdgeId ? (isHoverRelated ? 1 : 0.4) : 1,
          transition: "opacity 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
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
        },
      } as Node;
    });

    return [...treeNodes, ...portalNodes];
  }, [activePortalRefId, basePortalNodes, baseTreeNodes, hoverNodeIds, hoveredEdgeId, hoveredNodeId, selectedNodeId]);

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
          transition: "opacity 200ms ease, stroke 200ms ease, stroke-width 200ms ease",
        },
      } as Edge;
    });
  }, [baseEdges, hoverEdgeIds, hoveredEdgeId, hoveredNodeId]);

  useEffect(() => {
    if (!rfInstance || !selectedNodeId) return;
    const key = `${currentRootId || ""}:${selectedNodeId}`;
    if (lastFocusKeyRef.current === key) return;
    const target = flowNodes.find((node) => node.id === selectedNodeId);
    if (!target) return;
    rfInstance.fitView({ nodes: [target], duration: 400, padding: 0.45 });
    lastFocusKeyRef.current = key;
  }, [currentRootId, flowNodes, rfInstance, selectedNodeId]);

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

  const attachableRefs = useMemo(() => {
    if (!selectedNodeId) return [] as CrossRef[];
    return refs.filter((ref) => !ref.nodeIds.includes(selectedNodeId));
  }, [refs, selectedNodeId]);

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
    const parent = nodesById.get(parentId);
    setBusyAction(true);
    setError(null);
    try {
      await setDoc(doc(db, "users", user.uid, "nodes", newDoc.id), {
        title,
        parentId,
        kind: "item",
        x: (typeof parent?.x === "number" ? parent.x : 0) + 260,
        y: (typeof parent?.y === "number" ? parent.y : 0) + 20,
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
  }, [currentRootId, newChildTitle, nodesById, rootNodeId, selectedNodeId, user.uid]);

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

  const createCrossRef = useCallback(async () => {
    if (!db || !selectedNodeId) return;
    const label = newRefLabel.trim();
    if (!label) return;
    const code = newRefCode.trim() ? normalizeCode(newRefCode) : initialsFromLabel(label);
    setBusyAction(true);
    setError(null);
    try {
      const newDoc = doc(collection(db, "users", user.uid, "crossRefs"));
      await setDoc(doc(db, "users", user.uid, "crossRefs", newDoc.id), {
        label,
        code,
        nodeIds: [selectedNodeId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } satisfies CrossRefDoc & { createdAt: unknown; updatedAt: unknown });
      setNewRefLabel("");
      setNewRefCode("");
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not create cross-reference.");
    } finally {
      setBusyAction(false);
    }
  }, [newRefCode, newRefLabel, selectedNodeId, user.uid]);

  const attachCrossRef = useCallback(async () => {
    if (!db || !selectedNodeId || !attachRefId) return;
    setBusyAction(true);
    setError(null);
    try {
      await updateDoc(doc(db, "users", user.uid, "crossRefs", attachRefId), {
        nodeIds: arrayUnion(selectedNodeId),
        updatedAt: serverTimestamp(),
      });
      setAttachRefId("");
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not attach cross-reference.");
    } finally {
      setBusyAction(false);
    }
  }, [attachRefId, selectedNodeId, user.uid]);

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
      if (!db || node.id.startsWith("portal:")) return;
      try {
        await updateDoc(doc(db, "users", user.uid, "nodes", node.id), {
          x: node.position.x,
          y: node.position.y,
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not save node position.");
      }
    },
    [user.uid]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id.startsWith("portal:")) {
        setActivePortalRefId(node.id.replace("portal:", ""));
        return;
      }
      setSelectedNodeId(node.id);
      setActivePortalRefId(null);
    },
    []
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id.startsWith("portal:")) return;
      const hasChildren = (childrenByParent.get(node.id) || []).length > 0;
      if (!hasChildren) return;
      setCurrentRootId(node.id);
      setSelectedNodeId(node.id);
      setActivePortalRefId(null);
    },
    [childrenByParent]
  );

  const handleNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    setHoveredNodeId(node.id);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const handleEdgeMouseEnter = useCallback((_: React.MouseEvent, edge: Edge) => {
    setHoveredEdgeId(edge.id);
  }, []);

  const handleEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null);
  }, []);

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
    <div className="planner-shell">
      <PlannerSidebar hasError={!!error}>
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

        <div className="planner-panel-block">
          <h3>Selected Node</h3>
          {selectedNode ? (
            <>
              <div className="planner-row-label">Path</div>
              <div className="planner-path">{buildNodePath(selectedNode.id, nodesById)}</div>
              <input value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} />
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

        <div className="planner-panel-block">
          <h3>Cross-Reference Bubbles</h3>
          <p className="planner-subtle">
            Use these for entities shared across branches (e.g., investor Mario Pinto / MP).
          </p>
          <input
            value={newRefLabel}
            onChange={(event) => setNewRefLabel(event.target.value)}
            placeholder="Reference name"
          />
          <input
            value={newRefCode}
            onChange={(event) => setNewRefCode(event.target.value)}
            placeholder="Bubble code (optional, e.g., MP)"
          />
          <button onClick={createCrossRef} disabled={busyAction || !selectedNodeId || newRefLabel.trim().length === 0}>
            Create bubble and attach to selected
          </button>

          <div className="planner-inline-buttons">
            <select value={attachRefId} onChange={(event) => setAttachRefId(event.target.value)}>
              <option value="">Attach existing bubble...</option>
              {attachableRefs.map((ref) => (
                <option key={ref.id} value={ref.id}>
                  {ref.code} - {ref.label}
                </option>
              ))}
            </select>
            <button onClick={attachCrossRef} disabled={busyAction || !selectedNodeId || !attachRefId}>
              Attach
            </button>
          </div>

          <div className="planner-row-label">Bubbles on selected node</div>
          <div className="planner-chip-list">
            {selectedNodeRefs.length === 0 || !selectedNodeId ? (
              <span className="planner-subtle">No bubbles attached.</span>
            ) : (
              selectedNodeRefs.map((ref) => (
                <div key={ref.id} className="chip with-action">
                  <button
                    onClick={() => setActivePortalRefId(ref.id)}
                  >{`${ref.code} - ${ref.label}`}</button>
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
        </div>

        {activePortalRef ? (
          <div className="planner-panel-block">
            <h3>{`${activePortalRef.code} - ${activePortalRef.label}`}</h3>
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
      </PlannerSidebar>

      <PlannerCanvas
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onInit={setRfInstance}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onEdgeMouseEnter={handleEdgeMouseEnter}
        onEdgeMouseLeave={handleEdgeMouseLeave}
        onNodeDragStop={onNodeDragStop}
      />
    </div>
  );
}
