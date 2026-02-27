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
import { buildPlannerBubbleUiActionsParams } from "../hooks/buildPlannerBubbleUiActionsParams";
import { buildPlannerCanvasGraphStateParams } from "../hooks/buildPlannerCanvasGraphStateParams";
import { buildPlannerDerivedCrossRefBundleParams } from "../hooks/buildPlannerDerivedCrossRefBundleParams";
import { buildPlannerMutationBundleParams } from "../hooks/buildPlannerMutationBundleParams";
import { buildPlannerNavigationBundleParams } from "../hooks/buildPlannerNavigationBundleParams";
import { buildPlannerRealtimeSyncParams } from "../hooks/buildPlannerRealtimeSyncParams";
import { buildPlannerResponsiveUiParams } from "../hooks/buildPlannerResponsiveUiParams";
import { buildPlannerRootSelectionSyncParams } from "../hooks/buildPlannerRootSelectionSyncParams";
import { buildStoryNodeContentActionsParams } from "../hooks/buildStoryNodeContentActionsParams";
import { buildPlannerWorkspaceBundleParamsFromBundles } from "../hooks/buildPlannerWorkspaceBundleParamsFromBundles";
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
