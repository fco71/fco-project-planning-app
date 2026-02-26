import { describe, expect, it, vi } from "vitest";
import { buildPlannerRootSelectionSyncParams } from "./buildPlannerRootSelectionSyncParams";
import type { usePlannerPageState } from "./usePlannerPageState";

type PlannerState = ReturnType<typeof usePlannerPageState>;

describe("buildPlannerRootSelectionSyncParams", () => {
  it("maps planner state into root selection sync params", () => {
    const plannerState = {
      rootNodeId: "root-1",
      loading: false,
      currentRootId: "root-1",
      setCurrentRootId: vi.fn(),
      selectedNodeId: "node-1",
      setSelectedNodeId: vi.fn(),
      pendingSelectedNodeId: "node-2",
      setPendingSelectedNodeId: vi.fn(),
      isMobileLayout: true,
      setRenameTitle: vi.fn(),
      setBodyDraft: vi.fn(),
      storyLaneMode: false,
      setStoryLaneMode: vi.fn(),
      pendingRenameNodeId: "node-3",
      setPendingRenameNodeId: vi.fn(),
      setSidebarCollapsed: vi.fn(),
      setMobileSidebarSection: vi.fn(),
      setMobileSidebarOpen: vi.fn(),
      renameInputRef: { current: null },
    } as unknown as PlannerState;

    const nodesById = new Map();
    const params = buildPlannerRootSelectionSyncParams({
      plannerState,
      nodesById,
    });

    expect(params.rootNodeId).toBe("root-1");
    expect(params.nodesById).toBe(nodesById);
    expect(params.setCurrentRootId).toBe(plannerState.setCurrentRootId);
    expect(params.renameInputRef).toBe(plannerState.renameInputRef);
  });
});
