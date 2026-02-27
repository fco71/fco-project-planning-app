import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { CrossRef, NodeKind, TreeNode } from "../types/planner";
import type { LocalOp } from "./useUndoRedo";
import { usePlannerCommandActions } from "./usePlannerCommandActions";
import { usePlannerKeyboardShortcuts } from "./usePlannerKeyboardShortcuts";
import { usePlannerPaletteItems } from "./usePlannerPaletteItems";

type MobileSidebarSection = "project" | "node" | "bubbles";

type UsePlannerCommandPaletteParams = {
  rootNodeId: string | null;
  nodesById: Map<string, TreeNode>;
  setCurrentRootId: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  setStoryLaneMode: Dispatch<SetStateAction<boolean>>;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  setMobileSidebarSection: Dispatch<SetStateAction<MobileSidebarSection>>;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  searchInputRef: MutableRefObject<HTMLInputElement | null>;
  setPaletteOpen: Dispatch<SetStateAction<boolean>>;
  setPaletteQuery: Dispatch<SetStateAction<string>>;
  setPaletteIndex: Dispatch<SetStateAction<number>>;
  paletteOpen: boolean;
  paletteQuery: string;
  paletteIndex: number;
  paletteInputRef: MutableRefObject<HTMLInputElement | null>;
  crossReferencesEnabled: boolean;
  bubblesSimplifiedMode: boolean;
  currentRootKind: NodeKind | null;
  storyLaneMode: boolean;
  selectedNodeId: string | null;
  nodes: TreeNode[];
  refs: CrossRef[];
  goGrandmotherView: () => void;
  goUpOneView: () => void;
  organizeVisibleTree: () => void | Promise<void>;
  cleanUpCrossRefs: () => void | Promise<void>;
  openSelectedAsMaster: () => void;
  organizeSelectedBranch: () => void | Promise<void>;
  openSelectedAsStoryLane: () => void;
  handleContextAddStorySibling: (nodeId: string) => void | Promise<void>;
  handleContextAddChild: (nodeId: string) => void | Promise<void>;
  handleContextChangeType: (nodeId: string, targetKind?: NodeKind) => void | Promise<void>;
  handleContextToggleTaskStatus: (nodeId: string) => void;
  openBubblesPanel: (focusInput?: boolean) => void;
  selectRefForEditing: (refId: string) => void;
  linkCrossRefToNode: (refId: string, nodeId: string) => void | Promise<void>;
  nextNodeKind: (kind: NodeKind) => NodeKind;
  contextMenuOpen: boolean;
  activePortalRefId: string | null;
  deletePortalByRefId: (refId: string) => Promise<void>;
  handleContextDelete: (nodeId: string) => void | Promise<void>;
  handleContextDuplicate: (nodeId: string) => void | Promise<void>;
  mobileQuickEditorOpen: boolean;
  setMobileQuickEditorOpen: Dispatch<SetStateAction<boolean>>;
  mobileSidebarOpen: boolean;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  canUndo: boolean;
  canRedo: boolean;
  undo: (applyLocalOps: (ops: LocalOp[]) => void) => void;
  redo: (applyLocalOps: (ops: LocalOp[]) => void) => void;
  applyLocalOps: (ops: LocalOp[]) => void;
  busyAction: boolean;
};

export function usePlannerCommandPalette({
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
  paletteOpen,
  paletteQuery,
  paletteIndex,
  paletteInputRef,
  crossReferencesEnabled,
  bubblesSimplifiedMode,
  currentRootKind,
  storyLaneMode,
  selectedNodeId,
  nodes,
  refs,
  goGrandmotherView,
  goUpOneView,
  organizeVisibleTree,
  cleanUpCrossRefs,
  openSelectedAsMaster,
  organizeSelectedBranch,
  openSelectedAsStoryLane,
  handleContextAddStorySibling,
  handleContextAddChild,
  handleContextChangeType,
  handleContextToggleTaskStatus,
  openBubblesPanel,
  selectRefForEditing,
  linkCrossRefToNode,
  nextNodeKind,
  contextMenuOpen,
  activePortalRefId,
  deletePortalByRefId,
  handleContextDelete,
  handleContextDuplicate,
  mobileQuickEditorOpen,
  setMobileQuickEditorOpen,
  mobileSidebarOpen,
  searchQuery,
  setSearchQuery,
  canUndo,
  canRedo,
  undo,
  redo,
  applyLocalOps,
  busyAction,
}: UsePlannerCommandPaletteParams) {
  const {
    jumpToReferencedNode,
    toggleStoryLane,
    focusNodeSearch,
    runPaletteAction,
  } = usePlannerCommandActions({
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
  });

  const paletteItems = usePlannerPaletteItems({
    paletteQuery,
    crossReferencesEnabled,
    bubblesSimplifiedMode,
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

  usePlannerKeyboardShortcuts({
    paletteOpen,
    setPaletteOpen,
    paletteIndex,
    setPaletteIndex,
    setPaletteQuery,
    paletteItems,
    paletteInputRef,
    runPaletteAction,
    contextMenuOpen,
    activePortalRefId,
    deletePortalByRefId,
    handleContextAddChild,
    handleContextAddStorySibling,
    handleContextDelete,
    handleContextDuplicate,
    selectedNodeId,
    selectedNodeKind: selectedNodeId ? nodesById.get(selectedNodeId)?.kind || null : null,
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

  return {
    jumpToReferencedNode,
    toggleStoryLane,
    focusNodeSearch,
    runPaletteAction,
    paletteItems,
  };
}
