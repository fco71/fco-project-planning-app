import { useCallback, useEffect, useMemo } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { doc, setDoc, type Firestore } from "firebase/firestore";
import type { NodeKind, TreeNode } from "../types/planner";
import { collectDescendants } from "../utils/treeUtils";

type UsePlannerTreeViewStateParams = {
  firestore: Firestore | null;
  userUid: string;
  currentRootId: string | null;
  nodesById: Map<string, TreeNode>;
  childrenByParent: Map<string, string[]>;
  collapsedNodeIds: Set<string>;
  setCollapsedNodeIds: Dispatch<SetStateAction<Set<string>>>;
  collapsedHydrated: boolean;
  syncedCollapsedKeyRef: MutableRefObject<string>;
  searchQuery: string;
  storyLaneMode: boolean;
};

export function usePlannerTreeViewState({
  firestore,
  userUid,
  currentRootId,
  nodesById,
  childrenByParent,
  collapsedNodeIds,
  setCollapsedNodeIds,
  collapsedHydrated,
  syncedCollapsedKeyRef,
  searchQuery,
  storyLaneMode,
}: UsePlannerTreeViewStateParams) {
  const visibleTreeIds = useMemo(() => {
    if (!currentRootId) return [] as string[];
    return collectDescendants(currentRootId, childrenByParent);
  }, [childrenByParent, currentRootId]);

  const visibleTreeIdSet = useMemo(() => new Set(visibleTreeIds), [visibleTreeIds]);

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
  }, [setCollapsedNodeIds]);

  useEffect(() => {
    if (!firestore || !userUid || !collapsedHydrated) return;
    const collapsedArray = Array.from(collapsedNodeIds).sort();
    const nextKey = collapsedArray.join("|");
    if (syncedCollapsedKeyRef.current === nextKey) return;
    setDoc(
      doc(firestore, "users", userUid),
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
  }, [collapsedHydrated, collapsedNodeIds, firestore, syncedCollapsedKeyRef, userUid]);

  const filteredTreeIds = useMemo(() => {
    if (collapsedNodeIds.size === 0) return visibleTreeIds;

    const hiddenIds = new Set<string>();
    collapsedNodeIds.forEach((collapsedId) => {
      const descendants = collectDescendants(collapsedId, childrenByParent);
      descendants.forEach((id) => {
        if (id !== collapsedId) {
          hiddenIds.add(id);
        }
      });
    });

    return visibleTreeIds.filter((id) => !hiddenIds.has(id));
  }, [childrenByParent, collapsedNodeIds, visibleTreeIds]);

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

  const currentRootKind: NodeKind | null = currentRootId ? nodesById.get(currentRootId)?.kind || null : null;

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

  return {
    visibleTreeIds,
    visibleTreeIdSet,
    toggleNodeCollapse,
    filteredTreeIds,
    searchMatchingIds,
    currentRootKind,
    treeLayout,
    resolveNodePosition,
  };
}
