import { useCallback } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { TreeNode } from "../types/planner";
import { getMasterNodeFor } from "../utils/treeUtils";
import type { PaletteItem } from "./usePlannerPaletteItems";

type MobileSidebarSection = "project" | "node" | "bubbles";

type UsePlannerCommandActionsParams = {
  rootNodeId: string | null;
  nodesById: Map<string, TreeNode>;
  setCurrentRootId: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  setStoryLaneMode: Dispatch<SetStateAction<boolean>>;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  setMobileSidebarSection: Dispatch<SetStateAction<MobileSidebarSection>>;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  setPaletteOpen: Dispatch<SetStateAction<boolean>>;
  setPaletteQuery: Dispatch<SetStateAction<string>>;
  setPaletteIndex: Dispatch<SetStateAction<number>>;
};

export function usePlannerCommandActions({
  rootNodeId,
  nodesById,
  setCurrentRootId,
  setSelectedNodeId,
  setActivePortalRefId,
  setStoryLaneMode,
  setSidebarCollapsed,
  setMobileSidebarSection,
  setMobileSidebarOpen,
  searchInputRef,
  setPaletteOpen,
  setPaletteQuery,
  setPaletteIndex,
}: UsePlannerCommandActionsParams) {
  const jumpToReferencedNode = useCallback(
    (nodeId: string) => {
      const masterId = getMasterNodeFor(nodeId, rootNodeId, nodesById);
      setCurrentRootId(masterId);
      setSelectedNodeId(nodeId);
      setActivePortalRefId(null);
    },
    [nodesById, rootNodeId, setActivePortalRefId, setCurrentRootId, setSelectedNodeId]
  );

  const toggleStoryLane = useCallback(() => {
    setStoryLaneMode((prev) => !prev);
  }, [setStoryLaneMode]);

  const focusNodeSearch = useCallback(() => {
    setSidebarCollapsed(false);
    setMobileSidebarSection("project");
    setMobileSidebarOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 30);
  }, [searchInputRef, setMobileSidebarOpen, setMobileSidebarSection, setSidebarCollapsed]);

  const runPaletteAction = useCallback((item: PaletteItem) => {
    item.action();
    setPaletteOpen(false);
    setPaletteQuery("");
    setPaletteIndex(0);
  }, [setPaletteIndex, setPaletteOpen, setPaletteQuery]);

  return {
    jumpToReferencedNode,
    toggleStoryLane,
    focusNodeSearch,
    runPaletteAction,
  };
}
