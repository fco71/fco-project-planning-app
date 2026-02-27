import { useEffect } from "react";
import type { User } from "firebase/auth";
import type { EdgeTypes } from "reactflow";
import { useUndoRedo } from "./useUndoRedo";
import { usePlannerRealtimeSync } from "./usePlannerRealtimeSync";
import { usePlannerResponsiveUi } from "./usePlannerResponsiveUi";
import { useStoryNodeContentActions } from "./useStoryNodeContentActions";
import { usePlannerBubbleUiActions } from "./usePlannerBubbleUiActions";
import { usePlannerFlowUiFeedback } from "./usePlannerFlowUiFeedback";
import { usePlannerRootSelectionSync } from "./usePlannerRootSelectionSync";
import { usePlannerCanvasGraphState } from "./usePlannerCanvasGraphState";
import { usePlannerApplyLocalOps } from "./usePlannerApplyLocalOps";
import { usePlannerNodeIndex } from "./usePlannerNodeIndex";
import { usePlannerStoryCardState } from "./usePlannerStoryCardState";
import { usePlannerLocalNodePatch } from "./usePlannerLocalNodePatch";
import { usePlannerNavigationCommandBundle } from "./usePlannerNavigationCommandBundle";
import { usePlannerMutationContextBundle } from "./usePlannerMutationContextBundle";
import { usePlannerDerivedCrossRefBundle } from "./usePlannerDerivedCrossRefBundle";
import { usePlannerWorkspacePropsBundle } from "./usePlannerWorkspacePropsBundle";
import { usePlannerPageState } from "./usePlannerPageState";
import { buildPlannerBubbleUiActionsParams } from "./buildPlannerBubbleUiActionsParams";
import { buildPlannerCanvasGraphStateParams } from "./buildPlannerCanvasGraphStateParams";
import { buildPlannerDerivedCrossRefBundleParams } from "./buildPlannerDerivedCrossRefBundleParams";
import { buildPlannerMutationBundleParams } from "./buildPlannerMutationBundleParams";
import { buildPlannerNavigationBundleParams } from "./buildPlannerNavigationBundleParams";
import { buildPlannerRealtimeSyncParams } from "./buildPlannerRealtimeSyncParams";
import { buildPlannerResponsiveUiParams } from "./buildPlannerResponsiveUiParams";
import { buildPlannerRootSelectionSyncParams } from "./buildPlannerRootSelectionSyncParams";
import { buildStoryNodeContentActionsParams } from "./buildStoryNodeContentActionsParams";
import { buildPlannerWorkspaceBundleParamsFromBundles } from "./buildPlannerWorkspaceBundleParamsFromBundles";
import { plannerWorkspaceConstants } from "./plannerWorkspaceConstants";
import {
  bubbleDisplayToken,
  chooseAnchorNodeId,
  crossRefToFirestoreSetData,
  defaultPortalPositionForAnchor,
  resolvePortalFollowPosition,
} from "../utils/crossRefUtils";
import { rgbaFromHex } from "../utils/normalize";
import {
  nextNodeKind,
} from "../utils/plannerConfig";
import { plannerNodeTypes } from "../components/Planner/PortalNode";
import { db } from "../firebase";

const edgeTypes: EdgeTypes = Object.freeze({});

type PlannerState = ReturnType<typeof usePlannerPageState>;

type UsePlannerWorkspaceOrchestrationParams = {
  user: User;
  plannerState: PlannerState;
};

export function usePlannerWorkspaceOrchestration({
  user,
  plannerState,
}: UsePlannerWorkspaceOrchestrationParams) {
  const {
    nodes, setNodes,
    refs, setRefs,
    sidebarCollapsed,
    isMobileLayout,
    mobileSidebarOpen,
    setNewStoryStepText,
    activePortalRefId,
    contextMenu,
    loading,
    rfInstance,
  } = plannerState;

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

  usePlannerResponsiveUi(
    buildPlannerResponsiveUiParams({
      plannerState,
    })
  );

  usePlannerRealtimeSync(
    buildPlannerRealtimeSyncParams({
      plannerState,
      user,
      firestore: db,
      suppressSnapshotRef,
      crossReferencesEnabled: plannerWorkspaceConstants.crossReferencesEnabled,
      bubblesSimplifiedMode: plannerWorkspaceConstants.bubblesSimplifiedMode,
    })
  );

  const { selectedNode } = usePlannerRootSelectionSync(
    buildPlannerRootSelectionSyncParams({
      plannerState,
      nodesById,
    })
  );

  const {
    openBubblesPanel,
    focusMobileQuickBubbleInput,
    openMobileQuickBubble,
    blurActiveInput,
  } = usePlannerBubbleUiActions(
    buildPlannerBubbleUiActionsParams({
      plannerState,
    })
  );

  useEffect(() => {
    setNewStoryStepText("");
  }, [selectedNode?.id, setNewStoryStepText]);

  const {
    persistNodeBody,
    resetStoryNodeSize,
    startStoryNodeResize,
  } = useStoryNodeContentActions(
    buildStoryNodeContentActionsParams({
      plannerState,
      firestore: db,
      userUid: user.uid,
      nodesById,
      pushHistory,
      applyLocalNodePatch,
      storyNodeMinWidth: plannerWorkspaceConstants.storyNodeMinWidth,
      storyNodeMaxWidth: plannerWorkspaceConstants.storyNodeMaxWidth,
      storyNodeMinHeight: plannerWorkspaceConstants.storyNodeMinHeight,
      storyNodeMaxHeight: plannerWorkspaceConstants.storyNodeMaxHeight,
    })
  );

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
  } = usePlannerCanvasGraphState(
    buildPlannerCanvasGraphStateParams({
      plannerState,
      firestore: db,
      userUid: user.uid,
      nodesById,
      childrenByParent,
      expandedStoryNodeIds,
      persistNodeBody,
      toggleStoryCardExpand,
      startStoryNodeResize,
      resetStoryNodeSize,
      crossReferencesEnabled: plannerWorkspaceConstants.crossReferencesEnabled,
      storyNodeMinWidth: plannerWorkspaceConstants.storyNodeMinWidth,
      storyNodeMaxWidth: plannerWorkspaceConstants.storyNodeMaxWidth,
      storyNodeMinHeight: plannerWorkspaceConstants.storyNodeMinHeight,
      storyNodeMaxHeight: plannerWorkspaceConstants.storyNodeMaxHeight,
      defaultBubbleColor: plannerWorkspaceConstants.defaultBubbleColor,
      chooseAnchorNodeId,
      bubbleDisplayToken,
      rgbaFromHex,
    })
  );

  const { saveStatus, showSaveError, onNodeDoubleClick } = usePlannerFlowUiFeedback(rfInstance);

  const derivedBundle = usePlannerDerivedCrossRefBundle(
    buildPlannerDerivedCrossRefBundleParams({
      plannerState,
      nodes,
      nodesById,
      childrenByParent,
      visibleTreeIdSet,
      resolveNodePosition,
      defaultPortalPositionForAnchor,
      persistNodeBody,
    })
  );

  const mutationBundle = usePlannerMutationContextBundle(
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
      hydrateRefEditor: derivedBundle.hydrateRefEditor,
      buildDefaultPortalPosition: derivedBundle.buildDefaultPortalPosition,
      nextAutoBubbleCode: derivedBundle.nextAutoBubbleCode,
      activePortalRef: derivedBundle.activePortalRef,
      showSaveError,
      draggedNodeIdRef,
      crossReferencesEnabled: plannerWorkspaceConstants.crossReferencesEnabled,
      bubblesSimplifiedMode: plannerWorkspaceConstants.bubblesSimplifiedMode,
      defaultBubbleColor: plannerWorkspaceConstants.defaultBubbleColor,
      nextNodeKind,
      openBubblesPanel,
      openMobileQuickBubble,
    })
  );

  const navigationBundle = usePlannerNavigationCommandBundle(
    buildPlannerNavigationBundleParams({
      plannerState,
      firestore: db,
      userUid: user.uid,
      selectedNode,
      nodesById,
      childrenByParent,
      currentRootParentId: derivedBundle.currentRootNode?.parentId || null,
      projectPages: derivedBundle.projectPages,
      activeProjectPageIndex: derivedBundle.activeProjectPageIndex,
      treeLayout,
      filteredTreeIds,
      filteredTreeIdSet,
      pushHistory,
      crossReferencesEnabled: plannerWorkspaceConstants.crossReferencesEnabled,
      bubblesSimplifiedMode: plannerWorkspaceConstants.bubblesSimplifiedMode,
      openMobileQuickBubble,
      handleContextAddChild: mutationBundle.handleContextAddChild,
      setNodeTaskStatus: mutationBundle.setNodeTaskStatus,
      currentRootKind,
      cleanUpCrossRefs: mutationBundle.cleanUpCrossRefs,
      handleContextAddStorySibling: mutationBundle.handleContextAddStorySibling,
      handleContextChangeType: mutationBundle.handleContextChangeType,
      handleContextToggleTaskStatus: mutationBundle.handleContextToggleTaskStatus,
      openBubblesPanel,
      selectRefForEditing: mutationBundle.selectRefForEditing,
      linkCrossRefToNode: mutationBundle.linkCrossRefToNode,
      nextNodeKind,
      contextMenuOpen: !!contextMenu,
      activePortalRefId,
      deletePortalByRefId: mutationBundle.deletePortalByRefId,
      handleContextDelete: mutationBundle.handleContextDelete,
      handleContextDuplicate: mutationBundle.handleContextDuplicate,
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
    buildPlannerWorkspaceBundleParamsFromBundles({
      plannerState,
      selectedNode,
      currentRootHasParent: !!derivedBundle.currentRootNode?.parentId,
      canvasGraph: {
        reactFlowNodes,
        flowEdges,
        handleNodesChange,
        toggleNodeCollapse,
        filteredTreeIds,
        searchMatchingIds,
      },
      nodeTypes: plannerNodeTypes,
      edgeTypes,
      nodesById,
      childrenByParent,
      refs,
      derived: derivedBundle,
      mutation: mutationBundle,
      navigation: navigationBundle,
      showSaveErrorToast: saveStatus === "error",
      userEmail: user.email,
      sidebarIsCollapsed,
      currentRootKind,
      crossReferencesEnabled: plannerWorkspaceConstants.crossReferencesEnabled,
      bubblesSimplifiedMode: plannerWorkspaceConstants.bubblesSimplifiedMode,
      defaultBubbleColor: plannerWorkspaceConstants.defaultBubbleColor,
      canUndo,
      canRedo,
      undoLabel,
      redoLabel,
      undo,
      redo,
      applyLocalOps,
      onNodeDoubleClick,
      openBubblesPanel,
      openMobileQuickBubble,
      focusMobileQuickBubbleInput,
      blurActiveInput,
    })
  );

  return {
    loading,
    isMobileLayout,
    mobileSidebarOpen,
    sidebarIsCollapsed,
    plannerCanvasSurfaceProps,
    plannerMobilePanelsProps,
    plannerSidebarPanelsProps,
    plannerSidebarChromeProps,
  };
}
