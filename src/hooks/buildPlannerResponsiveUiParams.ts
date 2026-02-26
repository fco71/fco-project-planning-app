import type { usePlannerPageState } from "./usePlannerPageState";
import type { usePlannerResponsiveUi } from "./usePlannerResponsiveUi";

type PlannerState = ReturnType<typeof usePlannerPageState>;
type ResponsiveUiParams = Parameters<typeof usePlannerResponsiveUi>[0];

type BuildPlannerResponsiveUiParamsInput = {
  plannerState: PlannerState;
};

export function buildPlannerResponsiveUiParams({
  plannerState,
}: BuildPlannerResponsiveUiParamsInput): ResponsiveUiParams {
  return {
    isMobileLayout: plannerState.isMobileLayout,
    mobileSidebarOpen: plannerState.mobileSidebarOpen,
    mobileQuickEditorOpen: plannerState.mobileQuickEditorOpen,
    mobileQuickBubbleOpen: plannerState.mobileQuickBubbleOpen,
    selectedNodeId: plannerState.selectedNodeId,
    setIsMobileLayout: plannerState.setIsMobileLayout,
    setSidebarCollapsed: plannerState.setSidebarCollapsed,
    setMobileSidebarOpen: plannerState.setMobileSidebarOpen,
    setMobileQuickEditorOpen: plannerState.setMobileQuickEditorOpen,
    setMobileQuickBubbleOpen: plannerState.setMobileQuickBubbleOpen,
    setMobileToolbarOpen: plannerState.setMobileToolbarOpen,
  };
}
