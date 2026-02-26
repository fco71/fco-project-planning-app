import { usePlannerTreeViewState } from "./usePlannerTreeViewState";
import { usePlannerFilteredTreeIdSet } from "./usePlannerFilteredTreeIdSet";
import { usePlannerBaseGraphData } from "./usePlannerBaseGraphData";
import { usePlannerEdgeHoverState } from "./usePlannerEdgeHoverState";
import { usePlannerBaseNodeState } from "./usePlannerBaseNodeState";
import { usePlannerFlowNodes } from "./usePlannerFlowNodes";
import { usePlannerVisiblePortals } from "./usePlannerVisiblePortals";
import { usePlannerFlowGraph } from "./usePlannerFlowGraph";

type UsePlannerCanvasGraphStateParams = {
  treeView: Parameters<typeof usePlannerTreeViewState>[0];
  baseGraph: Omit<
    Parameters<typeof usePlannerBaseGraphData>[0],
    "filteredTreeIds" | "treeLayout" | "searchMatchingIds" | "currentRootKind" | "filteredTreeIdSet"
  >;
  edgeHover: Omit<Parameters<typeof usePlannerEdgeHoverState>[0], "baseEdges">;
  flowNodes: Omit<
    Parameters<typeof usePlannerFlowNodes>[0],
    "baseNodes" | "activeLinkedNodeIds" | "hoverNodeIds" | "toggleNodeCollapse"
  >;
  visiblePortals: Omit<Parameters<typeof usePlannerVisiblePortals>[0], "filteredTreeIdSet" | "baseNodes">;
  flowGraph: Omit<Parameters<typeof usePlannerFlowGraph>[0], "baseEdges" | "hoverEdgeIds" | "flowNodes" | "visiblePortals">;
};

export function usePlannerCanvasGraphState({
  treeView,
  baseGraph,
  edgeHover,
  flowNodes: flowNodesParams,
  visiblePortals: visiblePortalsParams,
  flowGraph: flowGraphParams,
}: UsePlannerCanvasGraphStateParams) {
  const {
    visibleTreeIdSet,
    toggleNodeCollapse,
    filteredTreeIds,
    searchMatchingIds,
    currentRootKind,
    treeLayout,
    resolveNodePosition,
  } = usePlannerTreeViewState(treeView);

  const filteredTreeIdSet = usePlannerFilteredTreeIdSet(filteredTreeIds);

  const { baseTreeNodes, baseEdges } = usePlannerBaseGraphData({
    ...baseGraph,
    filteredTreeIds,
    treeLayout,
    searchMatchingIds,
    currentRootKind,
    filteredTreeIdSet,
  });

  const { hoverNodeIds, hoverEdgeIds, activeLinkedNodeIds } = usePlannerEdgeHoverState({
    ...edgeHover,
    baseEdges,
  });

  const { baseNodes, handleNodesChange, draggedNodeIdRef } = usePlannerBaseNodeState({
    baseTreeNodes,
  });

  const flowNodes = usePlannerFlowNodes({
    ...flowNodesParams,
    baseNodes,
    activeLinkedNodeIds,
    hoverNodeIds,
    toggleNodeCollapse,
  });

  const visiblePortals = usePlannerVisiblePortals({
    ...visiblePortalsParams,
    filteredTreeIdSet,
    baseNodes,
  });

  const { flowEdges, reactFlowNodes } = usePlannerFlowGraph({
    ...flowGraphParams,
    baseEdges,
    hoverEdgeIds,
    flowNodes,
    visiblePortals,
  });

  return {
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
  };
}
