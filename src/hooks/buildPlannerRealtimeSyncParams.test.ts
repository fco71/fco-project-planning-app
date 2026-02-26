import { describe, expect, it, vi } from "vitest";
import { buildPlannerRealtimeSyncParams } from "./buildPlannerRealtimeSyncParams";
import type { usePlannerPageState } from "./usePlannerPageState";

type PlannerState = ReturnType<typeof usePlannerPageState>;

describe("buildPlannerRealtimeSyncParams", () => {
  it("maps planner state and external values into realtime sync params", () => {
    const plannerState = {
      setLoading: vi.fn(),
      setError: vi.fn(),
      setCollapsedHydrated: vi.fn(),
      syncedCollapsedKeyRef: { current: "" },
      setCollapsedNodeIds: vi.fn(),
      setProfileName: vi.fn(),
      setRootNodeId: vi.fn(),
      setNodes: vi.fn(),
      setRefs: vi.fn(),
    } as unknown as PlannerState;

    const user = { uid: "user-1" };
    const suppressSnapshotRef = { current: 0 };
    const params = buildPlannerRealtimeSyncParams({
      plannerState,
      user: user as never,
      firestore: null,
      suppressSnapshotRef,
      crossReferencesEnabled: true,
      bubblesSimplifiedMode: true,
    });

    expect(params.user).toBe(user);
    expect(params.suppressSnapshotRef).toBe(suppressSnapshotRef);
    expect(params.crossReferencesEnabled).toBe(true);
    expect(params.bubblesSimplifiedMode).toBe(true);
    expect(params.setRootNodeId).toBe(plannerState.setRootNodeId);
  });
});
