import type { usePlannerPageState } from "./usePlannerPageState";
import type { usePlannerBubbleUiActions } from "./usePlannerBubbleUiActions";

type PlannerState = ReturnType<typeof usePlannerPageState>;
type BubbleUiActionsParams = Parameters<typeof usePlannerBubbleUiActions>[0];

type BuildPlannerBubbleUiActionsParamsInput = {
  plannerState: PlannerState;
};

export function buildPlannerBubbleUiActionsParams({
  plannerState,
}: BuildPlannerBubbleUiActionsParamsInput): BubbleUiActionsParams {
  return {
    isMobileLayout: plannerState.isMobileLayout,
    selectedNodeId: plannerState.selectedNodeId,
    mobileSidebarOpen: plannerState.mobileSidebarOpen,
    mobileSidebarSection: plannerState.mobileSidebarSection,
    mobileQuickBubbleOpen: plannerState.mobileQuickBubbleOpen,
    newRefLabelInputRef: plannerState.newRefLabelInputRef,
    mobileQuickBubbleInputRef: plannerState.mobileQuickBubbleInputRef,
    setSelectedNodeId: plannerState.setSelectedNodeId,
    setActivePortalRefId: plannerState.setActivePortalRefId,
    setSidebarCollapsed: plannerState.setSidebarCollapsed,
    setMobileSidebarSection: plannerState.setMobileSidebarSection,
    setMobileSidebarOpen: plannerState.setMobileSidebarOpen,
    setMobileQuickEditorOpen: plannerState.setMobileQuickEditorOpen,
    setMobileQuickBubbleOpen: plannerState.setMobileQuickBubbleOpen,
  };
}
