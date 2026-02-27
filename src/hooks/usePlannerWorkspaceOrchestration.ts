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
import {
  bubbleDisplayToken,
  chooseAnchorNodeId,
  crossRefToFirestoreSetData,
  defaultPortalPositionForAnchor,
  resolvePortalFollowPosition,
} from "../utils/crossRefUtils";
import { rgbaFromHex } from "../utils/normalize";
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
    selectedNodeId,
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
      crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
      bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
    })
  );

  const { selectedNode } = usePlannerRootSelectionSync(
    buildPlannerRootSelectionSyncParams({
      plannerState,
      nodesById,
    })
  );

  const effectiveBubbleTargetId = selectedNodeId || null;

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
      storyNodeMinWidth: STORY_NODE_MIN_WIDTH,
      storyNodeMaxWidth: STORY_NODE_MAX_WIDTH,
      storyNodeMinHeight: STORY_NODE_MIN_HEIGHT,
      storyNodeMaxHeight: STORY_NODE_MAX_HEIGHT,
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
      crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
      storyNodeMinWidth: STORY_NODE_MIN_WIDTH,
      storyNodeMaxWidth: STORY_NODE_MAX_WIDTH,
      storyNodeMinHeight: STORY_NODE_MIN_HEIGHT,
      storyNodeMaxHeight: STORY_NODE_MAX_HEIGHT,
      defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
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
      effectiveBubbleTargetId,
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
      crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
      bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
      defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
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
      crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
      bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
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
      crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
      bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
      defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
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
