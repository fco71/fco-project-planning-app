import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlannerDerivedCrossRefBundle } from "./usePlannerDerivedCrossRefBundle";

const {
  mockUsePlannerViewDerivedState,
  mockUsePlannerCrossRefDerivedState,
  mockUsePlannerCrossRefUiSync,
  mockUsePlannerDefaultPortalPosition,
  mockUsePlannerBodySaveActions,
} = vi.hoisted(() => ({
  mockUsePlannerViewDerivedState: vi.fn(),
  mockUsePlannerCrossRefDerivedState: vi.fn(),
  mockUsePlannerCrossRefUiSync: vi.fn(),
  mockUsePlannerDefaultPortalPosition: vi.fn(),
  mockUsePlannerBodySaveActions: vi.fn(),
}));

vi.mock("./usePlannerViewDerivedState", () => ({
  usePlannerViewDerivedState: mockUsePlannerViewDerivedState,
}));

vi.mock("./usePlannerCrossRefDerivedState", () => ({
  usePlannerCrossRefDerivedState: mockUsePlannerCrossRefDerivedState,
}));

vi.mock("./usePlannerCrossRefUiSync", () => ({
  usePlannerCrossRefUiSync: mockUsePlannerCrossRefUiSync,
}));

vi.mock("./usePlannerDefaultPortalPosition", () => ({
  usePlannerDefaultPortalPosition: mockUsePlannerDefaultPortalPosition,
}));

vi.mock("./usePlannerBodySaveActions", () => ({
  usePlannerBodySaveActions: mockUsePlannerBodySaveActions,
}));

describe("usePlannerDerivedCrossRefBundle", () => {
  beforeEach(() => {
    mockUsePlannerViewDerivedState.mockReset();
    mockUsePlannerCrossRefDerivedState.mockReset();
    mockUsePlannerCrossRefUiSync.mockReset();
    mockUsePlannerDefaultPortalPosition.mockReset();
    mockUsePlannerBodySaveActions.mockReset();
  });

  it("hydrates cross-ref UI sync dependencies from derived state and merges outputs", () => {
    const viewDerivedState = { currentRootPath: "Root / A" };
    const derivedCrossRefState = {
      activePortalRef: { id: "ref-1" },
      selectedNodeRefs: [{ id: "ref-1" }],
      linkableNodeOptions: [{ id: "n-1", path: "Root / A / n-1" }],
      filteredRefs: [],
    };
    const hydrateRefEditor = vi.fn();
    const buildDefaultPortalPosition = vi.fn();
    const saveSelectedBody = vi.fn();

    mockUsePlannerViewDerivedState.mockReturnValue(viewDerivedState);
    mockUsePlannerCrossRefDerivedState.mockReturnValue(derivedCrossRefState);
    mockUsePlannerCrossRefUiSync.mockReturnValue({ hydrateRefEditor });
    mockUsePlannerDefaultPortalPosition.mockReturnValue(buildDefaultPortalPosition);
    mockUsePlannerBodySaveActions.mockReturnValue({ saveSelectedBody });

    const params = {
      viewDerived: { marker: "view" },
      crossRefDerived: { marker: "derived" },
      crossRefUiSync: { marker: "sync" },
      defaultPortalPosition: { marker: "default-pos" },
      bodySave: { marker: "body-save" },
    } as unknown as Parameters<typeof usePlannerDerivedCrossRefBundle>[0];

    const result = usePlannerDerivedCrossRefBundle(params);

    expect(mockUsePlannerViewDerivedState).toHaveBeenCalledWith(params.viewDerived);
    expect(mockUsePlannerCrossRefDerivedState).toHaveBeenCalledWith(params.crossRefDerived);
    expect(mockUsePlannerCrossRefUiSync).toHaveBeenCalledWith(
      expect.objectContaining({
        marker: "sync",
        activePortalRef: derivedCrossRefState.activePortalRef,
        selectedNodeRefs: derivedCrossRefState.selectedNodeRefs,
        linkableNodeOptions: derivedCrossRefState.linkableNodeOptions,
      })
    );
    expect(mockUsePlannerDefaultPortalPosition).toHaveBeenCalledWith(params.defaultPortalPosition);
    expect(mockUsePlannerBodySaveActions).toHaveBeenCalledWith(params.bodySave);
    expect(result).toEqual({
      ...viewDerivedState,
      ...derivedCrossRefState,
      hydrateRefEditor,
      buildDefaultPortalPosition,
      saveSelectedBody,
    });
  });
});
