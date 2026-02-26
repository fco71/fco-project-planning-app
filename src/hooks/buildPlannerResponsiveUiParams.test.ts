import { describe, expect, it, vi } from "vitest";
import { buildPlannerResponsiveUiParams } from "./buildPlannerResponsiveUiParams";
import type { usePlannerPageState } from "./usePlannerPageState";

type PlannerState = ReturnType<typeof usePlannerPageState>;

describe("buildPlannerResponsiveUiParams", () => {
  it("maps planner state into responsive UI params", () => {
    const plannerState = {
      isMobileLayout: true,
      mobileSidebarOpen: false,
      mobileQuickEditorOpen: true,
      mobileQuickBubbleOpen: false,
      selectedNodeId: "node-1",
      setIsMobileLayout: vi.fn(),
      setSidebarCollapsed: vi.fn(),
      setMobileSidebarOpen: vi.fn(),
      setMobileQuickEditorOpen: vi.fn(),
      setMobileQuickBubbleOpen: vi.fn(),
      setMobileToolbarOpen: vi.fn(),
    } as unknown as PlannerState;

    const params = buildPlannerResponsiveUiParams({
      plannerState,
    });

    expect(params.isMobileLayout).toBe(true);
    expect(params.selectedNodeId).toBe("node-1");
    expect(params.setMobileSidebarOpen).toBe(plannerState.setMobileSidebarOpen);
    expect(params.setMobileToolbarOpen).toBe(plannerState.setMobileToolbarOpen);
  });
});
