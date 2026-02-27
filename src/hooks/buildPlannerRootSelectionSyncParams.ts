import type { usePlannerPageState } from "./usePlannerPageState";
import type { usePlannerRootSelectionSync } from "./usePlannerRootSelectionSync";

type PlannerState = ReturnType<typeof usePlannerPageState>;
type RootSelectionSyncParams = Parameters<typeof usePlannerRootSelectionSync>[0];

type BuildPlannerRootSelectionSyncParamsInput = {
  plannerState: PlannerState;
  nodesById: RootSelectionSyncParams["nodesById"];
};

export function buildPlannerRootSelectionSyncParams({
  plannerState,
  nodesById,
}: BuildPlannerRootSelectionSyncParamsInput): RootSelectionSyncParams {
  return {
    rootNodeId: plannerState.rootNodeId,
    loading: plannerState.loading,
    nodesById,
    currentRootId: plannerState.currentRootId,
    setCurrentRootId: plannerState.setCurrentRootId,
    selectedNodeId: plannerState.selectedNodeId,
    setSelectedNodeId: plannerState.setSelectedNodeId,
    pendingSelectedNodeId: plannerState.pendingSelectedNodeId,
    setPendingSelectedNodeId: plannerState.setPendingSelectedNodeId,
    isMobileLayout: plannerState.isMobileLayout,
    setRenameTitle: plannerState.setRenameTitle,
    setBodyDraft: plannerState.setBodyDraft,
    storyLaneMode: plannerState.storyLaneMode,
    setStoryLaneMode: plannerState.setStoryLaneMode,
    pendingRenameNodeId: plannerState.pendingRenameNodeId,
    setPendingRenameNodeId: plannerState.setPendingRenameNodeId,
    renameInputRef: plannerState.renameInputRef,
  };
}
