import { useEffect } from "react";
import { useUndoRedo } from "../hooks/useUndoRedo";
import type { EdgeTypes } from "reactflow";
import type { User } from "firebase/auth";
import { db } from "../firebase";
import {
  bubbleDisplayToken,
  chooseAnchorNodeId,
  crossRefToFirestoreSetData,
  defaultPortalPositionForAnchor,
  resolvePortalFollowPosition,
} from "../utils/crossRefUtils";
import {
  rgbaFromHex,
} from "../utils/normalize";
import {
  BUBBLES_SIMPLIFIED_MODE,
  CROSS_REFERENCES_ENABLED,
  DEFAULT_BUBBLE_COLOR,
  nextNodeKind,
  STORY_NODE_MAX_HEIGHT,
  STORY_NODE_MAX_WIDTH,
  STORY_NODE_MIN_HEIGHT,
  STORY_NODE_MIN_WIDTH,
} from "../utils/plannerConfig";
import { usePlannerRealtimeSync } from "../hooks/usePlannerRealtimeSync";
import { usePlannerResponsiveUi } from "../hooks/usePlannerResponsiveUi";
import { useStoryNodeContentActions } from "../hooks/useStoryNodeContentActions";
import { usePlannerBubbleUiActions } from "../hooks/usePlannerBubbleUiActions";
import { usePlannerFlowUiFeedback } from "../hooks/usePlannerFlowUiFeedback";
import { usePlannerRootSelectionSync } from "../hooks/usePlannerRootSelectionSync";
import { usePlannerCanvasGraphState } from "../hooks/usePlannerCanvasGraphState";
import { usePlannerApplyLocalOps } from "../hooks/usePlannerApplyLocalOps";
import { usePlannerNodeIndex } from "../hooks/usePlannerNodeIndex";
import { usePlannerStoryCardState } from "../hooks/usePlannerStoryCardState";
import { usePlannerLocalNodePatch } from "../hooks/usePlannerLocalNodePatch";
import { usePlannerNavigationCommandBundle } from "../hooks/usePlannerNavigationCommandBundle";
import { usePlannerMutationContextBundle } from "../hooks/usePlannerMutationContextBundle";
import { usePlannerDerivedCrossRefBundle } from "../hooks/usePlannerDerivedCrossRefBundle";
import { usePlannerWorkspacePropsBundle } from "../hooks/usePlannerWorkspacePropsBundle";
import { usePlannerPageState } from "../hooks/usePlannerPageState";
import { buildPlannerMutationBundleParams } from "../hooks/buildPlannerMutationBundleParams";
import { buildPlannerNavigationBundleParams } from "../hooks/buildPlannerNavigationBundleParams";
import { buildPlannerWorkspaceBundleParams } from "../hooks/buildPlannerWorkspaceBundleParams";
import { PlannerWorkspaceLayout } from "../components/Planner/PlannerWorkspaceLayout";
import { plannerNodeTypes } from "../components/Planner/PortalNode";
import "reactflow/dist/style.css";

type PlannerPageProps = {
  user: User;
};

const edgeTypes: EdgeTypes = Object.freeze({});

export default function PlannerPage({ user }: PlannerPageProps) {
  const plannerState = usePlannerPageState({
    defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
  });
  const {
    profileName, setProfileName,
    rootNodeId, setRootNodeId,
    nodes, setNodes,
    refs, setRefs,
    currentRootId, setCurrentRootId,
    selectedNodeId, setSelectedNodeId,
    pendingSelectedNodeId, setPendingSelectedNodeId,
    sidebarCollapsed, setSidebarCollapsed,
    isMobileLayout, setIsMobileLayout,
    mobileSidebarOpen, setMobileSidebarOpen,
    mobileSidebarSection, setMobileSidebarSection,
    mobileQuickEditorOpen, setMobileQuickEditorOpen,
    mobileQuickBubbleOpen, setMobileQuickBubbleOpen,
    setMobileToolbarOpen,
    searchQuery,
    renameInputRef, newRefLabelInputRef, mobileQuickBubbleInputRef,
    setNewStoryStepText,
    setRenameTitle,
    bodyDraft, setBodyDraft,
    pendingRenameNodeId, setPendingRenameNodeId,
    storyLaneMode, setStoryLaneMode,
    setMobileQuickBubbleEditName,
    newRefLabel, newRefCode,
    refSearchQuery, refCategoryFilter, refScopeFilter,
    editRefId, setEditRefId, setEditRefLabel, setEditRefCode, setEditRefType,
    setEditRefTags, setEditRefNotes, setEditRefContact,
    setEditRefLinks, setMergeFromRefId,
    linkNodeQuery, setLinkNodeQuery, linkTargetNodeId, setLinkTargetNodeId,
    activePortalRefId, setActivePortalRefId, portalContextMenu, setPortalContextMenu,
    collapsedNodeIds, setCollapsedNodeIds,
    hoveredNodeId, hoveredEdgeId,
    dropTargetNodeId,
    contextMenu,
    setBusyAction,
    loading, setLoading,
    setError,
    rfInstance,
    collapsedHydrated, setCollapsedHydrated, syncedCollapsedKeyRef,
  } = plannerState;

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

  const applyLocalOps = usePlannerApplyLocalOps({
    setNodes,
    setRefs,
  });

  const { nodesById, childrenByParent } = usePlannerNodeIndex(nodes);
  const { expandedStoryNodeIds, toggleStoryCardExpand } = usePlannerStoryCardState();
  const applyLocalNodePatch = usePlannerLocalNodePatch({ setNodes });

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

  const { selectedNode } = usePlannerRootSelectionSync({
    rootNodeId,
    loading,
    nodesById,
    currentRootId,
    setCurrentRootId,
    selectedNodeId,
    setSelectedNodeId,
    pendingSelectedNodeId,
    setPendingSelectedNodeId,
    isMobileLayout,
    setRenameTitle,
    setBodyDraft,
    storyLaneMode,
    setStoryLaneMode,
    pendingRenameNodeId,
    setPendingRenameNodeId,
    setSidebarCollapsed,
    setMobileSidebarSection,
    setMobileSidebarOpen,
    renameInputRef,
  });

  const effectiveBubbleTargetId = selectedNodeId || null;
  const bubbleTargetNode = selectedNode;

  const {
    openBubblesPanel,
    focusMobileQuickBubbleInput,
    openMobileQuickBubble,
    blurActiveInput,
  } = usePlannerBubbleUiActions({
    isMobileLayout,
    selectedNodeId,
    mobileSidebarOpen,
    mobileSidebarSection,
    mobileQuickBubbleOpen,
    newRefLabelInputRef,
    mobileQuickBubbleInputRef,
    setSelectedNodeId,
    setActivePortalRefId,
    setSidebarCollapsed,
    setMobileSidebarSection,
    setMobileSidebarOpen,
    setMobileQuickEditorOpen,
    setMobileQuickBubbleOpen,
  });

  useEffect(() => {
    setNewStoryStepText("");
  }, [selectedNode?.id, setNewStoryStepText]);

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

  const {
    visibleTreeIdSet,
    toggleNodeCollapse,
    filteredTreeIds,
    searchMatchingIds,
    currentRootKind,
    treeLayout,
    resolveNodePosition,
    filteredTreeIdSet,
    handleNodesChange,
    draggedNodeIdRef,
    flowEdges,
    reactFlowNodes,
  } = usePlannerCanvasGraphState({
    treeView: {
      firestore: db,
      userUid: user.uid,
      currentRootId,
      nodesById,
      childrenByParent,
      collapsedNodeIds,
      setCollapsedNodeIds,
      collapsedHydrated,
      syncedCollapsedKeyRef,
      searchQuery,
      storyLaneMode,
    },
    baseGraph: {
      nodesById,
      childrenByParent,
      collapsedNodeIds,
      rootNodeId,
      storyLaneMode,
      currentRootId,
      expandedStoryNodeIds,
      isMobileLayout,
      refs,
      crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
      storyNodeMinWidth: STORY_NODE_MIN_WIDTH,
      storyNodeMaxWidth: STORY_NODE_MAX_WIDTH,
      storyNodeMinHeight: STORY_NODE_MIN_HEIGHT,
      storyNodeMaxHeight: STORY_NODE_MAX_HEIGHT,
    },
    edgeHover: {
      hoveredNodeId,
      hoveredEdgeId,
      activePortalRefId,
      refs,
    },
    flowNodes: {
      selectedNodeId,
      dropTargetNodeId,
      hoveredNodeId,
      hoveredEdgeId,
      isMobileLayout,
      setSelectedNodeId,
      persistNodeBody,
      toggleStoryCardExpand,
      startStoryNodeResize,
      resetStoryNodeSize,
    },
    visiblePortals: {
      crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
      refs,
      isMobileLayout,
      activePortalRefId,
      defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
      chooseAnchorNodeId,
      bubbleDisplayToken,
      rgbaFromHex,
    },
    flowGraph: {
      hoveredEdgeId,
      hoveredNodeId,
    },
  });

  const { saveStatus, showSaveError, onNodeDoubleClick } = usePlannerFlowUiFeedback(rfInstance);

  const {
    currentRootNode,
    currentRootPath,
    projectPages,
    activeProjectPageIndex,
    activeProjectPageId,
    selectedNodeChildren,
    selectedNodeCollapsed,
    selectedNodeHasStoryChildren,
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
    hydrateRefEditor,
    buildDefaultPortalPosition,
    saveSelectedBody,
  } = usePlannerDerivedCrossRefBundle({
    viewDerived: {
      currentRootId,
      rootNodeId,
      selectedNodeId,
      nodesById,
      childrenByParent,
      collapsedNodeIds,
    },
    crossRefDerived: {
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
    },
    crossRefUiSync: {
      isMobileLayout,
      mobileQuickBubbleOpen,
      selectedNodeId,
      editRefId,
      refs,
      linkTargetNodeId,
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
    },
    defaultPortalPosition: {
      resolveNodePosition,
      defaultPortalPositionForAnchor,
    },
    bodySave: {
      persistNodeBody,
      selectedNodeId,
      bodyDraft,
    },
  });

  const {
    createChild,
    deleteSelected,
    renameSelected,
    setNodeTaskStatus,
    addStoryStep,
    toggleStoryStepDone,
    deleteStoryStep,
    moveStoryStep,
    setNodeColor,
    cleanUpCrossRefs,
    linkCrossRefToNode,
    applyBubbleSuggestion,
    createCrossRef,
    duplicateCrossRef,
    mergeCrossRefIntoEdited,
    saveCrossRefEdits,
    saveMobileQuickBubbleName,
    updateCrossRefColor,
    deleteCrossRefBubble,
    deletePortalByRefId,
    detachCrossRef,
    onNodeDrag,
    onNodeDragStop,
    onSelectionDragStop,
    handleContextAddChild,
    handleContextAddStorySibling,
    handleContextDelete,
    handleContextDuplicate,
    handleContextChangeType,
    handleContextToggleTaskStatus,
    handleContextAddCrossRef,
    handleContextRename,
    selectRefForEditing,
  } = usePlannerMutationContextBundle(
    buildPlannerMutationBundleParams({
      firestore: db,
      userUid: user.uid,
      plannerState,
      selectedNode,
      nodesById,
      childrenByParent,
      refs,
      newNodeDocId,
      pushHistory,
      resolveNodePosition,
      chooseAnchorNodeId,
      resolvePortalFollowPosition,
      crossRefToFirestoreSetData,
      applyLocalNodePatch,
      hydrateRefEditor,
      buildDefaultPortalPosition,
      nextAutoBubbleCode,
      activePortalRef,
      showSaveError,
      draggedNodeIdRef,
      crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
      bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
      defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
      nextNodeKind,
      openBubblesPanel,
      openMobileQuickBubble,
    })
  );

  const {
    openProjectPage,
    goPrevProjectPage,
    goNextProjectPage,
    goGrandmotherView,
    goUpOneView,
    openSelectedAsMaster,
    openSelectedAsStoryLane,
    organizeVisibleTree,
    organizeSelectedBranch,
    showProjectSection,
    showNodeSection,
    showBubblesSection,
    showSimpleBubblesSection,
    onToolbarToggleOpen,
    onToolbarOpenMenu,
    onToolbarOpenEditor,
    onToolbarOpenBubble,
    onToolbarAddChild,
    onToolbarToggleTaskStatus,
    onToolbarGoHome,
    onToolbarGoUp,
    jumpToReferencedNode,
    runPaletteAction,
    paletteItems,
  } = usePlannerNavigationCommandBundle(
    buildPlannerNavigationBundleParams({
      plannerState,
      firestore: db,
      userUid: user.uid,
      selectedNode,
      nodesById,
      childrenByParent,
      currentRootParentId: currentRootNode?.parentId || null,
      projectPages,
      activeProjectPageIndex,
      treeLayout,
      filteredTreeIds,
      filteredTreeIdSet,
      pushHistory,
      crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
      bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
      openMobileQuickBubble,
      handleContextAddChild,
      setNodeTaskStatus,
      currentRootKind,
      cleanUpCrossRefs,
      handleContextAddStorySibling,
      handleContextChangeType,
      handleContextToggleTaskStatus,
      openBubblesPanel,
      selectRefForEditing,
      linkCrossRefToNode,
      nextNodeKind,
      contextMenuOpen: !!contextMenu,
      activePortalRefId,
      deletePortalByRefId,
      handleContextDelete,
      handleContextDuplicate,
      canUndo,
      canRedo,
      undo,
      redo,
      applyLocalOps,
    })
  );

  const sidebarIsCollapsed = !isMobileLayout && sidebarCollapsed;

  const {
    plannerCanvasSurfaceProps,
    plannerMobilePanelsProps,
    plannerSidebarPanelsProps,
    plannerSidebarChromeProps,
  } = usePlannerWorkspacePropsBundle(
    buildPlannerWorkspaceBundleParams({
      plannerState,
      crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
      bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
      selectedNode,
      currentRootHasParent: !!currentRootNode?.parentId,
      reactFlowNodes,
      flowEdges,
      nodeTypes: plannerNodeTypes,
      edgeTypes,
      handleNodesChange,
      onSelectRefForEditing: selectRefForEditing,
      onOpenBubblesPanel: openBubblesPanel,
      onNodeDoubleClick,
      onNodeDrag,
      onNodeDragStop,
      onSelectionDragStop,
      nodesById,
      childrenByParent,
      onContextAddChild: handleContextAddChild,
      onContextAddStorySibling: handleContextAddStorySibling,
      onContextDelete: handleContextDelete,
      onContextDuplicate: handleContextDuplicate,
      onContextRename: handleContextRename,
      onContextAddCrossRef: CROSS_REFERENCES_ENABLED ? handleContextAddCrossRef : undefined,
      onContextChangeType: handleContextChangeType,
      onContextToggleTaskStatus: handleContextToggleTaskStatus,
      refs,
      paletteItems,
      onRunPaletteAction: runPaletteAction,
      showSaveErrorToast: saveStatus === "error",
      onToolbarToggleOpen,
      onToolbarOpenMenu,
      onToolbarOpenEditor,
      onToolbarOpenBubble,
      onToolbarAddChild,
      onToolbarToggleTaskStatus,
      onToolbarGoHome,
      onToolbarGoUp,
      onDeletePortalByRefIdAsync: deletePortalByRefId,
      selectedNodeRefs,
      canCreateBubbleFromInput,
      nextAutoBubbleCode,
      bubblePrefixSuggestions,
      selectedNodeChildrenCount: selectedNodeChildren.length,
      selectedNodeCollapsed,
      effectiveNewBubbleCode,
      activePortalRef,
      defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
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
      userEmail: user.email,
      currentRootPath,
      projectPages,
      activeProjectPageId,
      activeProjectPageIndex,
      currentRootKind,
      visibleTreeCount: filteredTreeIds.length,
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
      searchMatchCount: searchMatchingIds.size,
      undo,
      redo,
      applyLocalOps,
    })
  );

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
    <PlannerWorkspaceLayout
      sidebarIsCollapsed={sidebarIsCollapsed}
      isMobileLayout={isMobileLayout}
      mobileSidebarOpen={mobileSidebarOpen}
      sidebarChromeProps={plannerSidebarChromeProps}
      sidebarPanelsProps={plannerSidebarPanelsProps}
      mobilePanelsProps={plannerMobilePanelsProps}
      canvasSurfaceProps={plannerCanvasSurfaceProps}
    />
  );
}
