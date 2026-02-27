import type { usePlannerPageState } from "./usePlannerPageState";
import type { usePlannerNavigationCommandBundle } from "./usePlannerNavigationCommandBundle";

type PlannerState = ReturnType<typeof usePlannerPageState>;
type NavigationBundleParams = Parameters<typeof usePlannerNavigationCommandBundle>[0];
type NavigationLayoutParams = NavigationBundleParams["navigationLayoutToolbar"];
type CommandPaletteParams = NavigationBundleParams["commandPalette"];

type BuildPlannerNavigationBundleParamsInput = {
  plannerState: PlannerState;
  firestore: NavigationLayoutParams["layout"]["firestore"];
  userUid: NavigationLayoutParams["layout"]["userUid"];
  selectedNode: NavigationLayoutParams["toolbar"]["selectedNode"];
  nodesById: NavigationLayoutParams["navigation"]["nodesById"];
  childrenByParent: NavigationLayoutParams["layout"]["childrenByParent"];
  currentRootParentId: NavigationLayoutParams["navigation"]["currentRootParentId"];
  projectPages: NavigationLayoutParams["navigation"]["projectPages"];
  activeProjectPageIndex: NavigationLayoutParams["navigation"]["activeProjectPageIndex"];
  treeLayout: NavigationLayoutParams["layout"]["treeLayout"];
  filteredTreeIds: NavigationLayoutParams["layout"]["filteredTreeIds"];
  filteredTreeIdSet: NavigationLayoutParams["layout"]["filteredTreeIdSet"];
  pushHistory: NavigationLayoutParams["layout"]["pushHistory"];
  crossReferencesEnabled: NavigationLayoutParams["sidebarVisibility"]["crossReferencesEnabled"];
  bubblesSimplifiedMode: NavigationLayoutParams["sidebarVisibility"]["bubblesSimplifiedMode"];
  openMobileQuickBubble: NavigationLayoutParams["toolbar"]["openMobileQuickBubble"];
  handleContextAddChild: CommandPaletteParams["handleContextAddChild"];
  setNodeTaskStatus: NavigationLayoutParams["toolbar"]["setNodeTaskStatus"];
  currentRootKind: CommandPaletteParams["currentRootKind"];
  cleanUpCrossRefs: CommandPaletteParams["cleanUpCrossRefs"];
  handleContextAddStorySibling: CommandPaletteParams["handleContextAddStorySibling"];
  handleContextChangeType: CommandPaletteParams["handleContextChangeType"];
  handleContextToggleTaskStatus: CommandPaletteParams["handleContextToggleTaskStatus"];
  openBubblesPanel: CommandPaletteParams["openBubblesPanel"];
  selectRefForEditing: CommandPaletteParams["selectRefForEditing"];
  linkCrossRefToNode: CommandPaletteParams["linkCrossRefToNode"];
  nextNodeKind: CommandPaletteParams["nextNodeKind"];
  contextMenuOpen: CommandPaletteParams["contextMenuOpen"];
  activePortalRefId: CommandPaletteParams["activePortalRefId"];
  deletePortalByRefId: CommandPaletteParams["deletePortalByRefId"];
  handleContextDelete: CommandPaletteParams["handleContextDelete"];
  handleContextDuplicate: CommandPaletteParams["handleContextDuplicate"];
  canUndo: CommandPaletteParams["canUndo"];
  canRedo: CommandPaletteParams["canRedo"];
  undo: CommandPaletteParams["undo"];
  redo: CommandPaletteParams["redo"];
  applyLocalOps: CommandPaletteParams["applyLocalOps"];
};

export function buildPlannerNavigationBundleParams({
  plannerState,
  firestore,
  userUid,
  selectedNode,
  nodesById,
  childrenByParent,
  currentRootParentId,
  projectPages,
  activeProjectPageIndex,
  treeLayout,
  filteredTreeIds,
  filteredTreeIdSet,
  pushHistory,
  crossReferencesEnabled,
  bubblesSimplifiedMode,
  currentRootKind,
  cleanUpCrossRefs,
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
  canUndo,
  canRedo,
  undo,
  redo,
  applyLocalOps,
  openMobileQuickBubble,
  setNodeTaskStatus,
}: BuildPlannerNavigationBundleParamsInput): NavigationBundleParams {
  return {
    navigationLayoutToolbar: {
      navigation: {
        nodesById,
        rootNodeId: plannerState.rootNodeId,
        currentRootParentId,
        selectedNodeId: plannerState.selectedNodeId,
        projectPages,
        activeProjectPageIndex,
        setCurrentRootId: plannerState.setCurrentRootId,
        setSelectedNodeId: plannerState.setSelectedNodeId,
        setStoryLaneMode: plannerState.setStoryLaneMode,
        setActivePortalRefId: plannerState.setActivePortalRefId,
      },
      layout: {
        firestore,
        userUid,
        treeLayout,
        filteredTreeIds,
        filteredTreeIdSet,
        selectedNodeId: plannerState.selectedNodeId,
        nodesById,
        childrenByParent,
        pushHistory,
        setBusyAction: plannerState.setBusyAction,
        setError: plannerState.setError,
        setNodes: plannerState.setNodes,
      },
      sidebarVisibility: {
        isMobileLayout: plannerState.isMobileLayout,
        mobileSidebarSection: plannerState.mobileSidebarSection,
        crossReferencesEnabled,
        bubblesSimplifiedMode,
      },
      toolbar: {
        selectedNodeId: plannerState.selectedNodeId,
        selectedNode,
        setMobileToolbarOpen: plannerState.setMobileToolbarOpen,
        setMobileSidebarSection: plannerState.setMobileSidebarSection,
        setMobileSidebarOpen: plannerState.setMobileSidebarOpen,
        setMobileQuickEditorMode: plannerState.setMobileQuickEditorMode,
        setMobileQuickEditorOpen: plannerState.setMobileQuickEditorOpen,
        setMobileQuickBubbleOpen: plannerState.setMobileQuickBubbleOpen,
      setActivePortalRefId: plannerState.setActivePortalRefId,
      openMobileQuickBubble,
      handleContextAddChild,
      handleContextAddStorySibling,
      setNodeTaskStatus,
    },
    },
    commandPalette: {
      rootNodeId: plannerState.rootNodeId,
      nodesById,
      setCurrentRootId: plannerState.setCurrentRootId,
      setSelectedNodeId: plannerState.setSelectedNodeId,
      setActivePortalRefId: plannerState.setActivePortalRefId,
      setStoryLaneMode: plannerState.setStoryLaneMode,
      setSidebarCollapsed: plannerState.setSidebarCollapsed,
      setMobileSidebarSection: plannerState.setMobileSidebarSection,
      setMobileSidebarOpen: plannerState.setMobileSidebarOpen,
      searchInputRef: plannerState.searchInputRef,
      setPaletteOpen: plannerState.setPaletteOpen,
      setPaletteQuery: plannerState.setPaletteQuery,
      setPaletteIndex: plannerState.setPaletteIndex,
      paletteOpen: plannerState.paletteOpen,
      paletteQuery: plannerState.paletteQuery,
      paletteIndex: plannerState.paletteIndex,
      paletteInputRef: plannerState.paletteInputRef,
      crossReferencesEnabled,
      bubblesSimplifiedMode,
      currentRootKind,
      storyLaneMode: plannerState.storyLaneMode,
      selectedNodeId: plannerState.selectedNodeId,
      nodes: plannerState.nodes,
      refs: plannerState.refs,
      cleanUpCrossRefs,
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
      mobileQuickEditorOpen: plannerState.mobileQuickEditorOpen,
      setMobileQuickEditorOpen: plannerState.setMobileQuickEditorOpen,
      mobileSidebarOpen: plannerState.mobileSidebarOpen,
      searchQuery: plannerState.searchQuery,
      setSearchQuery: plannerState.setSearchQuery,
      canUndo,
      canRedo,
      undo,
      redo,
      applyLocalOps,
      busyAction: plannerState.busyAction,
    },
  };
}
