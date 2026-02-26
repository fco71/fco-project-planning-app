import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TreeNode } from "../types/planner";

type ProjectPageLike = {
  id: string;
};

type UsePlannerNavigationActionsParams = {
  nodesById: Map<string, TreeNode>;
  rootNodeId: string | null;
  currentRootParentId: string | null;
  selectedNodeId: string | null;
  projectPages: ProjectPageLike[];
  activeProjectPageIndex: number;
  setCurrentRootId: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setStoryLaneMode: Dispatch<SetStateAction<boolean>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
};

export function usePlannerNavigationActions({
  nodesById,
  rootNodeId,
  currentRootParentId,
  selectedNodeId,
  projectPages,
  activeProjectPageIndex,
  setCurrentRootId,
  setSelectedNodeId,
  setStoryLaneMode,
  setActivePortalRefId,
}: UsePlannerNavigationActionsParams) {
  const openProjectPage = useCallback((nodeId: string) => {
    if (!nodesById.has(nodeId)) return;
    setCurrentRootId(nodeId);
    setSelectedNodeId(nodeId);
    setStoryLaneMode(false);
    setActivePortalRefId(null);
  }, [nodesById, setActivePortalRefId, setCurrentRootId, setSelectedNodeId, setStoryLaneMode]);

  const goPrevProjectPage = useCallback(() => {
    if (projectPages.length === 0) return;
    const fallback = activeProjectPageIndex < 0 ? 0 : activeProjectPageIndex;
    const previousIndex = (fallback - 1 + projectPages.length) % projectPages.length;
    openProjectPage(projectPages[previousIndex].id);
  }, [activeProjectPageIndex, openProjectPage, projectPages]);

  const goNextProjectPage = useCallback(() => {
    if (projectPages.length === 0) return;
    const fallback = activeProjectPageIndex < 0 ? 0 : activeProjectPageIndex;
    const nextIndex = (fallback + 1) % projectPages.length;
    openProjectPage(projectPages[nextIndex].id);
  }, [activeProjectPageIndex, openProjectPage, projectPages]);

  const goGrandmotherView = useCallback(() => {
    if (!rootNodeId) return;
    setCurrentRootId(rootNodeId);
    setStoryLaneMode(false);
    setActivePortalRefId(null);
  }, [rootNodeId, setActivePortalRefId, setCurrentRootId, setStoryLaneMode]);

  const goUpOneView = useCallback(() => {
    if (!currentRootParentId) return;
    setCurrentRootId(currentRootParentId);
    setStoryLaneMode(false);
    setActivePortalRefId(null);
  }, [currentRootParentId, setActivePortalRefId, setCurrentRootId, setStoryLaneMode]);

  const openSelectedAsMaster = useCallback(() => {
    if (!selectedNodeId) return;
    openProjectPage(selectedNodeId);
  }, [openProjectPage, selectedNodeId]);

  const openSelectedAsStoryLane = useCallback(() => {
    if (!selectedNodeId) return;
    const selected = nodesById.get(selectedNodeId);
    if (!selected || selected.kind !== "story") return;
    setCurrentRootId(selectedNodeId);
    setStoryLaneMode(true);
    setActivePortalRefId(null);
  }, [nodesById, selectedNodeId, setActivePortalRefId, setCurrentRootId, setStoryLaneMode]);

  return {
    openProjectPage,
    goPrevProjectPage,
    goNextProjectPage,
    goGrandmotherView,
    goUpOneView,
    openSelectedAsMaster,
    openSelectedAsStoryLane,
  };
}
