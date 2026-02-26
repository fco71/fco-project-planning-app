import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { Edge, Node } from "reactflow";
import type { CrossRef, NodeKind, TreeNode } from "../types/planner";

type UsePlannerBaseGraphDataParams = {
  filteredTreeIds: string[];
  nodesById: Map<string, TreeNode>;
  childrenByParent: Map<string, string[]>;
  collapsedNodeIds: Set<string>;
  treeLayout: Map<string, { x: number; y: number }>;
  rootNodeId: string | null;
  searchMatchingIds: Set<string>;
  storyLaneMode: boolean;
  currentRootKind: NodeKind | null;
  currentRootId: string | null;
  expandedStoryNodeIds: Set<string>;
  isMobileLayout: boolean;
  refs: CrossRef[];
  filteredTreeIdSet: Set<string>;
  crossReferencesEnabled: boolean;
  storyNodeMinWidth: number;
  storyNodeMaxWidth: number;
  storyNodeMinHeight: number;
  storyNodeMaxHeight: number;
};

function clamp(value: number, min: number, max: number): number {
  if (min > max) return value;
  return Math.min(max, Math.max(min, value));
}

export function usePlannerBaseGraphData({
  filteredTreeIds,
  nodesById,
  childrenByParent,
  collapsedNodeIds,
  treeLayout,
  rootNodeId,
  searchMatchingIds,
  storyLaneMode,
  currentRootKind,
  currentRootId,
  expandedStoryNodeIds,
  isMobileLayout,
  refs,
  filteredTreeIdSet,
  crossReferencesEnabled,
  storyNodeMinWidth,
  storyNodeMaxWidth,
  storyNodeMinHeight,
  storyNodeMaxHeight,
}: UsePlannerBaseGraphDataParams) {
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
        const storyWidth = clamp(storedWidth ?? storyDefaultWidth, storyNodeMinWidth, storyNodeMaxWidth);
        const storyHeight = clamp(storedHeight ?? storyDefaultHeight, storyNodeMinHeight, storyNodeMaxHeight);
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
            minHeight: showStoryBody ? storyNodeMinHeight : undefined,
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
          } as CSSProperties,
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
    storyNodeMaxHeight,
    storyNodeMaxWidth,
    storyNodeMinHeight,
    storyNodeMinWidth,
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

  const basePortalEdges = useMemo((): Edge[] => {
    if (!crossReferencesEnabled) return [];
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
  }, [crossReferencesEnabled, refs, filteredTreeIdSet]);

  const baseEdges = useMemo(() => [...baseTreeEdges, ...basePortalEdges], [basePortalEdges, baseTreeEdges]);

  return {
    baseTreeNodes,
    baseEdges,
  };
}
