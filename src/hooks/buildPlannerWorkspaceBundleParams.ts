import type { usePlannerPageState } from "./usePlannerPageState";
import type { usePlannerWorkspacePropsBundle } from "./usePlannerWorkspacePropsBundle";

type PlannerState = ReturnType<typeof usePlannerPageState>;
type WorkspaceBundleParams = Parameters<typeof usePlannerWorkspacePropsBundle>[0];
type CanvasSurfaceParams = WorkspaceBundleParams["canvasSurface"];
type SidebarMobilePanelsParams = WorkspaceBundleParams["sidebarMobilePanels"];
type SidebarChromeParams = WorkspaceBundleParams["sidebarChrome"];

type BuildPlannerWorkspaceBundleParamsInput = {
  plannerState: PlannerState;
  crossReferencesEnabled: CanvasSurfaceParams["crossReferencesEnabled"];
  bubblesSimplifiedMode: SidebarMobilePanelsParams["bubblesSimplifiedMode"];
  selectedNode: CanvasSurfaceParams["selectedNode"];
  currentRootHasParent: CanvasSurfaceParams["currentRootHasParent"];
  reactFlowNodes: CanvasSurfaceParams["reactFlowNodes"];
  flowEdges: CanvasSurfaceParams["flowEdges"];
  nodeTypes: CanvasSurfaceParams["nodeTypes"];
  edgeTypes: CanvasSurfaceParams["edgeTypes"];
  handleNodesChange: CanvasSurfaceParams["onNodesChange"];
  onSelectRefForEditing: CanvasSurfaceParams["onSelectRefForEditing"];
  onOpenBubblesPanel: CanvasSurfaceParams["onOpenBubblesPanel"];
  onNodeDoubleClick: CanvasSurfaceParams["onNodeDoubleClick"];
  onNodeDrag: CanvasSurfaceParams["onNodeDrag"];
  onNodeDragStop: CanvasSurfaceParams["onNodeDragStop"];
  onSelectionDragStop: CanvasSurfaceParams["onSelectionDragStop"];
  nodesById: CanvasSurfaceParams["nodesById"];
  childrenByParent: CanvasSurfaceParams["childrenByParent"];
  onContextAddChild: CanvasSurfaceParams["onContextAddChild"];
  onContextAddStorySibling: CanvasSurfaceParams["onContextAddStorySibling"];
  onContextDelete: CanvasSurfaceParams["onContextDelete"];
  onContextDuplicate: CanvasSurfaceParams["onContextDuplicate"];
  onContextRename: CanvasSurfaceParams["onContextRename"];
  onContextAddCrossRef: CanvasSurfaceParams["onContextAddCrossRef"];
  onContextChangeType: CanvasSurfaceParams["onContextChangeType"];
  onContextToggleTaskStatus: CanvasSurfaceParams["onContextToggleTaskStatus"];
  refs: CanvasSurfaceParams["refs"];
  paletteItems: CanvasSurfaceParams["paletteItems"];
  onRunPaletteAction: CanvasSurfaceParams["onRunPaletteAction"];
  showSaveErrorToast: CanvasSurfaceParams["showSaveErrorToast"];
  onToolbarToggleOpen: CanvasSurfaceParams["onToolbarToggleOpen"];
  onToolbarOpenMenu: CanvasSurfaceParams["onToolbarOpenMenu"];
  onToolbarOpenEditor: CanvasSurfaceParams["onToolbarOpenEditor"];
  onToolbarOpenBubble: CanvasSurfaceParams["onToolbarOpenBubble"];
  onToolbarAddChild: CanvasSurfaceParams["onToolbarAddChild"];
  onToolbarToggleTaskStatus: CanvasSurfaceParams["onToolbarToggleTaskStatus"];
  onToolbarGoHome: CanvasSurfaceParams["onToolbarGoHome"];
  onToolbarGoUp: CanvasSurfaceParams["onToolbarGoUp"];
  onDeletePortalByRefIdAsync: CanvasSurfaceParams["onDeletePortalByRefIdAsync"];
  selectedNodeRefs: SidebarMobilePanelsParams["selectedNodeRefs"];
  canCreateBubbleFromInput: SidebarMobilePanelsParams["canCreateBubbleFromInput"];
  nextAutoBubbleCode: SidebarMobilePanelsParams["nextAutoBubbleCode"];
  bubblePrefixSuggestions: SidebarMobilePanelsParams["bubblePrefixSuggestions"];
  selectedNodeChildrenCount: SidebarMobilePanelsParams["selectedNodeChildrenCount"];
  selectedNodeCollapsed: SidebarMobilePanelsParams["selectedNodeCollapsed"];
  effectiveNewBubbleCode: SidebarMobilePanelsParams["effectiveNewBubbleCode"];
  activePortalRef: SidebarMobilePanelsParams["activePortalRef"];
  defaultBubbleColor: SidebarMobilePanelsParams["defaultBubbleColor"];
  renameSelected: SidebarMobilePanelsParams["renameSelected"];
  createCrossRef: SidebarMobilePanelsParams["createCrossRef"];
  openMobileQuickBubble: SidebarMobilePanelsParams["openMobileQuickBubble"];
  saveSelectedBody: SidebarMobilePanelsParams["saveSelectedBody"];
  applyBubbleSuggestion: SidebarMobilePanelsParams["applyBubbleSuggestion"];
  setNodeTaskStatus: SidebarMobilePanelsParams["setNodeTaskStatus"];
  toggleNodeCollapse: SidebarMobilePanelsParams["toggleNodeCollapse"];
  createChild: SidebarMobilePanelsParams["createChild"];
  openSelectedAsStoryLane: SidebarMobilePanelsParams["openSelectedAsStoryLane"];
  focusMobileQuickBubbleInput: SidebarMobilePanelsParams["focusMobileQuickBubbleInput"];
  blurActiveInput: SidebarMobilePanelsParams["blurActiveInput"];
  saveMobileQuickBubbleName: SidebarMobilePanelsParams["saveMobileQuickBubbleName"];
  updateCrossRefColor: SidebarMobilePanelsParams["updateCrossRefColor"];
  deletePortalByRefId: SidebarMobilePanelsParams["deletePortalByRefId"];
  showProjectSection: SidebarMobilePanelsParams["showProjectSection"];
  showNodeSection: SidebarMobilePanelsParams["showNodeSection"];
  showSimpleBubblesSection: SidebarMobilePanelsParams["showSimpleBubblesSection"];
  showBubblesSection: SidebarMobilePanelsParams["showBubblesSection"];
  profileName: SidebarMobilePanelsParams["profileName"];
  userEmail: SidebarMobilePanelsParams["userEmail"];
  currentRootPath: SidebarMobilePanelsParams["currentRootPath"];
  projectPages: SidebarMobilePanelsParams["projectPages"];
  activeProjectPageId: SidebarMobilePanelsParams["activeProjectPageId"];
  activeProjectPageIndex: SidebarMobilePanelsParams["activeProjectPageIndex"];
  currentRootKind: SidebarMobilePanelsParams["currentRootKind"];
  visibleTreeCount: SidebarMobilePanelsParams["visibleTreeCount"];
  goPrevProjectPage: SidebarMobilePanelsParams["goPrevProjectPage"];
  goNextProjectPage: SidebarMobilePanelsParams["goNextProjectPage"];
  openProjectPage: SidebarMobilePanelsParams["openProjectPage"];
  goGrandmotherView: SidebarMobilePanelsParams["goGrandmotherView"];
  goUpOneView: SidebarMobilePanelsParams["goUpOneView"];
  openSelectedAsMaster: SidebarMobilePanelsParams["openSelectedAsMaster"];
  organizeVisibleTree: SidebarMobilePanelsParams["organizeVisibleTree"];
  organizeSelectedBranch: SidebarMobilePanelsParams["organizeSelectedBranch"];
  cleanUpCrossRefs: SidebarMobilePanelsParams["cleanUpCrossRefs"];
  selectedNodeHasStoryChildren: SidebarMobilePanelsParams["selectedNodeHasStoryChildren"];
  selectedNodeChildren: SidebarMobilePanelsParams["selectedNodeChildren"];
  setNodeColor: SidebarMobilePanelsParams["setNodeColor"];
  deleteSelected: SidebarMobilePanelsParams["deleteSelected"];
  handleContextAddCrossRef: SidebarMobilePanelsParams["handleContextAddCrossRef"];
  toggleStoryStepDone: SidebarMobilePanelsParams["toggleStoryStepDone"];
  moveStoryStep: SidebarMobilePanelsParams["moveStoryStep"];
  deleteStoryStep: SidebarMobilePanelsParams["deleteStoryStep"];
  addStoryStep: SidebarMobilePanelsParams["addStoryStep"];
  bubbleTargetNode: SidebarMobilePanelsParams["bubbleTargetNode"];
  effectiveBubbleTargetId: SidebarMobilePanelsParams["effectiveBubbleTargetId"];
  activePortalTargets: SidebarMobilePanelsParams["activePortalTargets"];
  newRefSuggestions: SidebarMobilePanelsParams["newRefSuggestions"];
  describeRefTargets: SidebarMobilePanelsParams["describeRefTargets"];
  linkCrossRefToNode: SidebarMobilePanelsParams["linkCrossRefToNode"];
  detachCrossRef: SidebarMobilePanelsParams["detachCrossRef"];
  jumpToReferencedNode: SidebarMobilePanelsParams["jumpToReferencedNode"];
  filteredRefs: SidebarMobilePanelsParams["filteredRefs"];
  selectedNodeRefIds: SidebarMobilePanelsParams["selectedNodeRefIds"];
  describeRefLibraryPreview: SidebarMobilePanelsParams["describeRefLibraryPreview"];
  saveCrossRefEdits: SidebarMobilePanelsParams["saveCrossRefEdits"];
  duplicateCrossRef: SidebarMobilePanelsParams["duplicateCrossRef"];
  linkableNodeOptions: SidebarMobilePanelsParams["linkableNodeOptions"];
  editableRefTargets: SidebarMobilePanelsParams["editableRefTargets"];
  mergeCandidateRefs: SidebarMobilePanelsParams["mergeCandidateRefs"];
  mergeCrossRefIntoEdited: SidebarMobilePanelsParams["mergeCrossRefIntoEdited"];
  deleteCrossRefBubble: SidebarMobilePanelsParams["deleteCrossRefBubble"];
  sidebarIsCollapsed: SidebarChromeParams["sidebarIsCollapsed"];
  canUndo: SidebarChromeParams["canUndo"];
  canRedo: SidebarChromeParams["canRedo"];
  undoLabel: SidebarChromeParams["undoLabel"];
  redoLabel: SidebarChromeParams["redoLabel"];
  searchMatchCount: SidebarChromeParams["searchMatchCount"];
  undo: SidebarChromeParams["undo"];
  redo: SidebarChromeParams["redo"];
  applyLocalOps: SidebarChromeParams["applyLocalOps"];
};

export function buildPlannerWorkspaceBundleParams({
  plannerState,
  crossReferencesEnabled,
  bubblesSimplifiedMode,
  selectedNode,
  currentRootHasParent,
  reactFlowNodes,
  flowEdges,
  nodeTypes,
  edgeTypes,
  handleNodesChange,
  onSelectRefForEditing,
  onOpenBubblesPanel,
  onNodeDoubleClick,
  onNodeDrag,
  onNodeDragStop,
  onSelectionDragStop,
  nodesById,
  childrenByParent,
  onContextAddChild,
  onContextAddStorySibling,
  onContextDelete,
  onContextDuplicate,
  onContextRename,
  onContextAddCrossRef,
  onContextChangeType,
  onContextToggleTaskStatus,
  refs,
  paletteItems,
  onRunPaletteAction,
  showSaveErrorToast,
  onToolbarToggleOpen,
  onToolbarOpenMenu,
  onToolbarOpenEditor,
  onToolbarOpenBubble,
  onToolbarAddChild,
  onToolbarToggleTaskStatus,
  onToolbarGoHome,
  onToolbarGoUp,
  onDeletePortalByRefIdAsync,
  selectedNodeRefs,
  canCreateBubbleFromInput,
  nextAutoBubbleCode,
  bubblePrefixSuggestions,
  selectedNodeChildrenCount,
  selectedNodeCollapsed,
  effectiveNewBubbleCode,
  activePortalRef,
  defaultBubbleColor,
  renameSelected,
  createCrossRef,
  openMobileQuickBubble,
  saveSelectedBody,
  applyBubbleSuggestion,
  setNodeTaskStatus,
  toggleNodeCollapse,
  createChild,
  openSelectedAsStoryLane,
  focusMobileQuickBubbleInput,
  blurActiveInput,
  saveMobileQuickBubbleName,
  updateCrossRefColor,
  deletePortalByRefId,
  showProjectSection,
  showNodeSection,
  showSimpleBubblesSection,
  showBubblesSection,
  profileName,
  userEmail,
  currentRootPath,
  projectPages,
  activeProjectPageId,
  activeProjectPageIndex,
  currentRootKind,
  visibleTreeCount,
  goPrevProjectPage,
  goNextProjectPage,
  openProjectPage,
  goGrandmotherView,
  goUpOneView,
  openSelectedAsMaster,
  organizeVisibleTree,
  organizeSelectedBranch,
  cleanUpCrossRefs,
  selectedNodeHasStoryChildren,
  selectedNodeChildren,
  setNodeColor,
  deleteSelected,
  handleContextAddCrossRef,
  toggleStoryStepDone,
  moveStoryStep,
  deleteStoryStep,
  addStoryStep,
  bubbleTargetNode,
  effectiveBubbleTargetId,
  activePortalTargets,
  newRefSuggestions,
  describeRefTargets,
  linkCrossRefToNode,
  detachCrossRef,
  jumpToReferencedNode,
  filteredRefs,
  selectedNodeRefIds,
  describeRefLibraryPreview,
  saveCrossRefEdits,
  duplicateCrossRef,
  linkableNodeOptions,
  editableRefTargets,
  mergeCandidateRefs,
  mergeCrossRefIntoEdited,
  deleteCrossRefBubble,
  sidebarIsCollapsed,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  searchMatchCount,
  undo,
  redo,
  applyLocalOps,
}: BuildPlannerWorkspaceBundleParamsInput): WorkspaceBundleParams {
  return {
    canvasSurface: {
      isMobileLayout: plannerState.isMobileLayout,
      mobileToolbarOpen: plannerState.mobileToolbarOpen,
      selectedNodeId: plannerState.selectedNodeId,
      selectedNode,
      crossReferencesEnabled,
      rootNodeId: plannerState.rootNodeId,
      currentRootHasParent,
      reactFlowNodes,
      flowEdges,
      nodeTypes,
      edgeTypes,
      onInit: plannerState.setRfInstance,
      onNodesChange: handleNodesChange,
      activePortalRefId: plannerState.activePortalRefId,
      onSetActivePortalRefId: plannerState.setActivePortalRefId,
      onSelectRefForEditing,
      onOpenBubblesPanel,
      onSetSelectedNodeId: plannerState.setSelectedNodeId,
      onSetMobileQuickEditorMode: plannerState.setMobileQuickEditorMode,
      onNodeDoubleClick,
      scheduleHoverUpdate: plannerState.scheduleHoverUpdate,
      hoveredEdgeId: plannerState.hoveredEdgeId,
      hoveredNodeId: plannerState.hoveredNodeId,
      isDraggingRef: plannerState.isDraggingRef,
      onNodeDrag,
      onNodeDragStop,
      onSelectionDragStop,
      onSetPortalContextMenu: plannerState.setPortalContextMenu,
      portalContextMenu: plannerState.portalContextMenu,
      onSetContextMenu: plannerState.setContextMenu,
      contextMenu: plannerState.contextMenu,
      nodesById,
      childrenByParent,
      onContextAddChild,
      onContextAddStorySibling,
      onContextDelete,
      onContextDuplicate,
      onContextRename,
      onContextAddCrossRef,
      onContextChangeType,
      onContextToggleTaskStatus,
      refs,
      busyAction: plannerState.busyAction,
      paletteOpen: plannerState.paletteOpen,
      paletteQuery: plannerState.paletteQuery,
      paletteIndex: plannerState.paletteIndex,
      paletteItems,
      paletteInputRef: plannerState.paletteInputRef,
      onPaletteQueryChange: plannerState.setPaletteQuery,
      onSetPaletteIndex: plannerState.setPaletteIndex,
      onRunPaletteAction,
      showSaveErrorToast,
      onToolbarToggleOpen,
      onToolbarOpenMenu,
      onToolbarOpenEditor,
      onToolbarOpenBubble,
      onToolbarAddChild,
      onToolbarToggleTaskStatus,
      onToolbarGoHome,
      onToolbarGoUp,
      setMobileSidebarOpen: plannerState.setMobileSidebarOpen,
      setMobileToolbarOpen: plannerState.setMobileToolbarOpen,
      setMobileQuickBubbleOpen: plannerState.setMobileQuickBubbleOpen,
      setMobileQuickEditorOpen: plannerState.setMobileQuickEditorOpen,
      setPaletteOpen: plannerState.setPaletteOpen,
      setPaletteQuery: plannerState.setPaletteQuery,
      setPaletteIndex: plannerState.setPaletteIndex,
      onDeletePortalByRefIdAsync,
    },
    sidebarMobilePanels: {
      isMobileLayout: plannerState.isMobileLayout,
      mobileSidebarOpen: plannerState.mobileSidebarOpen,
      mobileQuickEditorOpen: plannerState.mobileQuickEditorOpen,
      mobileQuickBubbleOpen: plannerState.mobileQuickBubbleOpen,
      mobileQuickEditorMode: plannerState.mobileQuickEditorMode,
      selectedNode,
      selectedNodeId: plannerState.selectedNodeId,
      nodesById,
      renameTitle: plannerState.renameTitle,
      busyAction: plannerState.busyAction,
      selectedNodeRefs,
      crossReferencesEnabled,
      newRefLabel: plannerState.newRefLabel,
      canCreateBubbleFromInput,
      bodyDraft: plannerState.bodyDraft,
      newRefCode: plannerState.newRefCode,
      nextAutoBubbleCode,
      newRefColor: plannerState.newRefColor,
      bubblePrefixSuggestions,
      selectedNodeChildrenCount,
      selectedNodeCollapsed,
      effectiveNewBubbleCode,
      mobileQuickBubbleInputRef: plannerState.mobileQuickBubbleInputRef,
      activePortalRef,
      mobileQuickBubbleEditName: plannerState.mobileQuickBubbleEditName,
      defaultBubbleColor,
      renameSelected,
      createCrossRef,
      openMobileQuickBubble,
      saveSelectedBody,
      applyBubbleSuggestion,
      openBubblesPanel: onOpenBubblesPanel,
      setNodeTaskStatus,
      handleContextChangeType: onContextChangeType,
      toggleNodeCollapse,
      setCurrentRootId: plannerState.setCurrentRootId,
      handleContextAddChild: onContextAddChild,
      openSelectedAsStoryLane,
      focusMobileQuickBubbleInput,
      blurActiveInput,
      selectRefForEditing: onSelectRefForEditing,
      saveMobileQuickBubbleName,
      updateCrossRefColor,
      deletePortalByRefId,
      setMobileSidebarOpen: plannerState.setMobileSidebarOpen,
      setMobileQuickEditorMode: plannerState.setMobileQuickEditorMode,
      setRenameTitle: plannerState.setRenameTitle,
      setNewRefLabel: plannerState.setNewRefLabel,
      setBodyDraft: plannerState.setBodyDraft,
      setNewRefCode: plannerState.setNewRefCode,
      setNewRefColor: plannerState.setNewRefColor,
      setMobileSidebarSection: plannerState.setMobileSidebarSection,
      setMobileQuickEditorOpen: plannerState.setMobileQuickEditorOpen,
      setMobileQuickBubbleOpen: plannerState.setMobileQuickBubbleOpen,
      setMobileQuickBubbleEditName: plannerState.setMobileQuickBubbleEditName,
      showProjectSection,
      showNodeSection,
      showSimpleBubblesSection,
      showBubblesSection,
      error: plannerState.error,
      profileName,
      userEmail,
      currentRootPath,
      currentRootId: plannerState.currentRootId,
      rootNodeId: plannerState.rootNodeId,
      projectPages,
      activeProjectPageId,
      activeProjectPageIndex,
      selectedNodeKind: selectedNode?.kind,
      currentRootHasParent,
      currentRootKind,
      storyLaneMode: plannerState.storyLaneMode,
      visibleTreeCount,
      bubblesSimplifiedMode,
      newChildTitle: plannerState.newChildTitle,
      setNewChildTitle: plannerState.setNewChildTitle,
      goPrevProjectPage,
      goNextProjectPage,
      openProjectPage,
      goGrandmotherView,
      goUpOneView,
      openSelectedAsMaster,
      setStoryLaneMode: plannerState.setStoryLaneMode,
      organizeVisibleTree,
      organizeSelectedBranch,
      cleanUpCrossRefs,
      createChild,
      renameInputRef: plannerState.renameInputRef,
      selectedNodeHasStoryChildren,
      selectedNodeChildren,
      newStoryStepText: plannerState.newStoryStepText,
      setNewStoryStepText: plannerState.setNewStoryStepText,
      setNodeColor,
      deleteSelected,
      setSelectedNodeId: plannerState.setSelectedNodeId,
      setActivePortalRefId: plannerState.setActivePortalRefId,
      handleContextAddCrossRef,
      toggleStoryStepDone,
      moveStoryStep,
      deleteStoryStep,
      addStoryStep,
      bubbleTargetNode,
      effectiveBubbleTargetId,
      newRefLabelInputRef: plannerState.newRefLabelInputRef,
      refs,
      activePortalTargets,
      newRefType: plannerState.newRefType,
      setNewRefType: plannerState.setNewRefType,
      newRefSuggestions,
      describeRefTargets,
      linkCrossRefToNode,
      detachCrossRef,
      jumpToReferencedNode,
      refScopeFilter: plannerState.refScopeFilter,
      setRefScopeFilter: plannerState.setRefScopeFilter,
      refCategoryFilter: plannerState.refCategoryFilter,
      setRefCategoryFilter: plannerState.setRefCategoryFilter,
      refSearchQuery: plannerState.refSearchQuery,
      setRefSearchQuery: plannerState.setRefSearchQuery,
      filteredRefs,
      selectedNodeRefIds,
      describeRefLibraryPreview,
      editRefId: plannerState.editRefId,
      editRefLabel: plannerState.editRefLabel,
      setEditRefLabel: plannerState.setEditRefLabel,
      editRefCode: plannerState.editRefCode,
      setEditRefCode: plannerState.setEditRefCode,
      editRefType: plannerState.editRefType,
      setEditRefType: plannerState.setEditRefType,
      editRefTags: plannerState.editRefTags,
      setEditRefTags: plannerState.setEditRefTags,
      editRefContact: plannerState.editRefContact,
      setEditRefContact: plannerState.setEditRefContact,
      editRefNotes: plannerState.editRefNotes,
      setEditRefNotes: plannerState.setEditRefNotes,
      editRefLinks: plannerState.editRefLinks,
      setEditRefLinks: plannerState.setEditRefLinks,
      saveCrossRefEdits,
      duplicateCrossRef,
      linkNodeQuery: plannerState.linkNodeQuery,
      setLinkNodeQuery: plannerState.setLinkNodeQuery,
      linkTargetNodeId: plannerState.linkTargetNodeId,
      setLinkTargetNodeId: plannerState.setLinkTargetNodeId,
      linkableNodeOptions,
      editableRefTargets,
      mergeCandidateRefs,
      mergeFromRefId: plannerState.mergeFromRefId,
      setMergeFromRefId: plannerState.setMergeFromRefId,
      mergeCrossRefIntoEdited,
      deleteCrossRefBubble,
    },
    sidebarChrome: {
      sidebarIsCollapsed,
      isMobileLayout: plannerState.isMobileLayout,
      canUndo,
      canRedo,
      busyAction: plannerState.busyAction,
      undoLabel,
      redoLabel,
      searchInputRef: plannerState.searchInputRef,
      searchQuery: plannerState.searchQuery,
      searchMatchCount,
      selectedNodeId: plannerState.selectedNodeId,
      crossReferencesEnabled,
      bubblesSimplifiedMode,
      mobileSidebarSection: plannerState.mobileSidebarSection,
      undo,
      redo,
      applyLocalOps,
      organizeSelectedBranch,
      cleanUpCrossRefs,
      openBubblesPanel: onOpenBubblesPanel,
      setMobileSidebarOpen: plannerState.setMobileSidebarOpen,
      setSidebarCollapsed: plannerState.setSidebarCollapsed,
      setSearchQuery: plannerState.setSearchQuery,
      setPaletteOpen: plannerState.setPaletteOpen,
      setPaletteQuery: plannerState.setPaletteQuery,
      setPaletteIndex: plannerState.setPaletteIndex,
      setMobileSidebarSection: plannerState.setMobileSidebarSection,
    },
  };
}
