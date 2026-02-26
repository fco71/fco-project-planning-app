import { describe, expect, it, vi } from "vitest";
import { buildStoryNodeContentActionsParams } from "./buildStoryNodeContentActionsParams";
import type { usePlannerPageState } from "./usePlannerPageState";

type PlannerState = ReturnType<typeof usePlannerPageState>;

describe("buildStoryNodeContentActionsParams", () => {
  it("maps planner state and external dependencies into story content action params", () => {
    const plannerState = {
      setBusyAction: vi.fn(),
      setError: vi.fn(),
      setNodes: vi.fn(),
    } as unknown as PlannerState;

    const pushHistory = vi.fn();
    const applyLocalNodePatch = vi.fn();
    const params = buildStoryNodeContentActionsParams({
      plannerState,
      firestore: null,
      userUid: "user-1",
      nodesById: new Map(),
      pushHistory,
      applyLocalNodePatch,
      storyNodeMinWidth: 220,
      storyNodeMaxWidth: 780,
      storyNodeMinHeight: 120,
      storyNodeMaxHeight: 920,
    });

    expect(params.userUid).toBe("user-1");
    expect(params.pushHistory).toBe(pushHistory);
    expect(params.applyLocalNodePatch).toBe(applyLocalNodePatch);
    expect(params.setBusyAction).toBe(plannerState.setBusyAction);
    expect(params.storyNodeMaxHeight).toBe(920);
  });
});
