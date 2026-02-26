import { describe, expect, it, vi } from "vitest";
import { buildPlannerBubbleUiActionsParams } from "./buildPlannerBubbleUiActionsParams";
import type { usePlannerPageState } from "./usePlannerPageState";

type PlannerState = ReturnType<typeof usePlannerPageState>;

describe("buildPlannerBubbleUiActionsParams", () => {
  it("maps planner state into bubble UI action params", () => {
    const plannerState = {
      isMobileLayout: true,
      selectedNodeId: "node-1",
      mobileSidebarOpen: true,
      mobileSidebarSection: "bubbles",
      mobileQuickBubbleOpen: false,
      newRefLabelInputRef: { current: null },
      mobileQuickBubbleInputRef: { current: null },
      setSelectedNodeId: vi.fn(),
      setActivePortalRefId: vi.fn(),
      setSidebarCollapsed: vi.fn(),
      setMobileSidebarSection: vi.fn(),
      setMobileSidebarOpen: vi.fn(),
      setMobileQuickEditorOpen: vi.fn(),
      setMobileQuickBubbleOpen: vi.fn(),
    } as unknown as PlannerState;

    const params = buildPlannerBubbleUiActionsParams({
      plannerState,
    });

    expect(params.isMobileLayout).toBe(true);
    expect(params.selectedNodeId).toBe("node-1");
    expect(params.setActivePortalRefId).toBe(plannerState.setActivePortalRefId);
    expect(params.mobileQuickBubbleInputRef).toBe(plannerState.mobileQuickBubbleInputRef);
  });
});
