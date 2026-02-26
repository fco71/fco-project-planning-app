import { useMemo } from "react";
import { buildNodePath } from "../utils/treeUtils";
import type { TreeNode } from "../types/planner";

type UsePlannerViewDerivedStateParams = {
  currentRootId: string | null;
  rootNodeId: string | null;
  selectedNodeId: string | null;
  nodesById: Map<string, TreeNode>;
  childrenByParent: Map<string, string[]>;
  collapsedNodeIds: Set<string>;
};

export function usePlannerViewDerivedState({
  currentRootId,
  rootNodeId,
  selectedNodeId,
  nodesById,
  childrenByParent,
  collapsedNodeIds,
}: UsePlannerViewDerivedStateParams) {
  const currentRootNode = useMemo(
    () => (currentRootId ? nodesById.get(currentRootId) || null : null),
    [currentRootId, nodesById]
  );

  const currentRootPath = useMemo(
    () => (currentRootId ? buildNodePath(currentRootId, nodesById) : ""),
    [currentRootId, nodesById]
  );

  const projectPages = useMemo(() => {
    if (!rootNodeId) return [] as TreeNode[];
    return (childrenByParent.get(rootNodeId) || [])
      .map((id) => nodesById.get(id))
      .filter((node): node is TreeNode => !!node && node.kind === "project")
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [childrenByParent, nodesById, rootNodeId]);

  const activeProjectPageIndex = useMemo(
    () => (currentRootId ? projectPages.findIndex((project) => project.id === currentRootId) : -1),
    [currentRootId, projectPages]
  );

  const activeProjectPageId = activeProjectPageIndex >= 0 ? projectPages[activeProjectPageIndex].id : "";

  const selectedNodeChildren = useMemo(() => {
    if (!selectedNodeId) return [] as TreeNode[];
    return (childrenByParent.get(selectedNodeId) || [])
      .map((id) => nodesById.get(id))
      .filter((node): node is TreeNode => !!node);
  }, [childrenByParent, nodesById, selectedNodeId]);

  const selectedNodeCollapsed = useMemo(
    () => (selectedNodeId ? collapsedNodeIds.has(selectedNodeId) : false),
    [collapsedNodeIds, selectedNodeId]
  );

  const selectedNodeHasStoryChildren = useMemo(() => {
    if (!selectedNodeId) return false;
    return (childrenByParent.get(selectedNodeId) || []).some((childId) => nodesById.get(childId)?.kind === "story");
  }, [childrenByParent, nodesById, selectedNodeId]);

  return {
    currentRootNode,
    currentRootPath,
    projectPages,
    activeProjectPageIndex,
    activeProjectPageId,
    selectedNodeChildren,
    selectedNodeCollapsed,
    selectedNodeHasStoryChildren,
  };
}
