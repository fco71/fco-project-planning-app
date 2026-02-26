import type { usePlannerPageState } from "./usePlannerPageState";
import type { usePlannerCanvasGraphState } from "./usePlannerCanvasGraphState";

type PlannerState = ReturnType<typeof usePlannerPageState>;
type CanvasGraphStateParams = Parameters<typeof usePlannerCanvasGraphState>[0];
type TreeViewParams = CanvasGraphStateParams["treeView"];
type BaseGraphParams = CanvasGraphStateParams["baseGraph"];
type FlowNodesParams = CanvasGraphStateParams["flowNodes"];
type VisiblePortalsParams = CanvasGraphStateParams["visiblePortals"];

type BuildPlannerCanvasGraphStateParamsInput = {
  plannerState: PlannerState;
  firestore: TreeViewParams["firestore"];
  userUid: TreeViewParams["userUid"];
  nodesById: TreeViewParams["nodesById"];
  childrenByParent: TreeViewParams["childrenByParent"];
  expandedStoryNodeIds: BaseGraphParams["expandedStoryNodeIds"];
  persistNodeBody: FlowNodesParams["persistNodeBody"];
  toggleStoryCardExpand: FlowNodesParams["toggleStoryCardExpand"];
  startStoryNodeResize: FlowNodesParams["startStoryNodeResize"];
  resetStoryNodeSize: FlowNodesParams["resetStoryNodeSize"];
  crossReferencesEnabled: BaseGraphParams["crossReferencesEnabled"];
  storyNodeMinWidth: BaseGraphParams["storyNodeMinWidth"];
  storyNodeMaxWidth: BaseGraphParams["storyNodeMaxWidth"];
  storyNodeMinHeight: BaseGraphParams["storyNodeMinHeight"];
  storyNodeMaxHeight: BaseGraphParams["storyNodeMaxHeight"];
  defaultBubbleColor: VisiblePortalsParams["defaultBubbleColor"];
  chooseAnchorNodeId: VisiblePortalsParams["chooseAnchorNodeId"];
  bubbleDisplayToken: VisiblePortalsParams["bubbleDisplayToken"];
  rgbaFromHex: VisiblePortalsParams["rgbaFromHex"];
};

export function buildPlannerCanvasGraphStateParams({
  plannerState,
  firestore,
  userUid,
  nodesById,
  childrenByParent,
  expandedStoryNodeIds,
  persistNodeBody,
  toggleStoryCardExpand,
  startStoryNodeResize,
  resetStoryNodeSize,
  crossReferencesEnabled,
  storyNodeMinWidth,
  storyNodeMaxWidth,
  storyNodeMinHeight,
  storyNodeMaxHeight,
  defaultBubbleColor,
  chooseAnchorNodeId,
  bubbleDisplayToken,
  rgbaFromHex,
}: BuildPlannerCanvasGraphStateParamsInput): CanvasGraphStateParams {
  return {
    treeView: {
      firestore,
      userUid,
      currentRootId: plannerState.currentRootId,
      nodesById,
      childrenByParent,
      collapsedNodeIds: plannerState.collapsedNodeIds,
      setCollapsedNodeIds: plannerState.setCollapsedNodeIds,
      collapsedHydrated: plannerState.collapsedHydrated,
      syncedCollapsedKeyRef: plannerState.syncedCollapsedKeyRef,
      searchQuery: plannerState.searchQuery,
      storyLaneMode: plannerState.storyLaneMode,
    },
    baseGraph: {
      nodesById,
      childrenByParent,
      collapsedNodeIds: plannerState.collapsedNodeIds,
      rootNodeId: plannerState.rootNodeId,
      storyLaneMode: plannerState.storyLaneMode,
      currentRootId: plannerState.currentRootId,
      expandedStoryNodeIds,
      isMobileLayout: plannerState.isMobileLayout,
      refs: plannerState.refs,
      crossReferencesEnabled,
      storyNodeMinWidth,
      storyNodeMaxWidth,
      storyNodeMinHeight,
      storyNodeMaxHeight,
    },
    edgeHover: {
      hoveredNodeId: plannerState.hoveredNodeId,
      hoveredEdgeId: plannerState.hoveredEdgeId,
      activePortalRefId: plannerState.activePortalRefId,
      refs: plannerState.refs,
    },
    flowNodes: {
      selectedNodeId: plannerState.selectedNodeId,
      dropTargetNodeId: plannerState.dropTargetNodeId,
      hoveredNodeId: plannerState.hoveredNodeId,
      hoveredEdgeId: plannerState.hoveredEdgeId,
      isMobileLayout: plannerState.isMobileLayout,
      setSelectedNodeId: plannerState.setSelectedNodeId,
      persistNodeBody,
      toggleStoryCardExpand,
      startStoryNodeResize,
      resetStoryNodeSize,
    },
    visiblePortals: {
      crossReferencesEnabled,
      refs: plannerState.refs,
      isMobileLayout: plannerState.isMobileLayout,
      activePortalRefId: plannerState.activePortalRefId,
      defaultBubbleColor,
      chooseAnchorNodeId,
      bubbleDisplayToken,
      rgbaFromHex,
    },
    flowGraph: {
      hoveredEdgeId: plannerState.hoveredEdgeId,
      hoveredNodeId: plannerState.hoveredNodeId,
    },
  };
}
