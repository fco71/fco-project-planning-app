import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlannerNavigationCommandBundle } from "./usePlannerNavigationCommandBundle";

const {
  mockUsePlannerNavigationLayoutToolbar,
  mockUsePlannerCommandPalette,
} = vi.hoisted(() => ({
  mockUsePlannerNavigationLayoutToolbar: vi.fn(),
  mockUsePlannerCommandPalette: vi.fn(),
}));

vi.mock("./usePlannerNavigationLayoutToolbar", () => ({
  usePlannerNavigationLayoutToolbar: mockUsePlannerNavigationLayoutToolbar,
}));

vi.mock("./usePlannerCommandPalette", () => ({
  usePlannerCommandPalette: mockUsePlannerCommandPalette,
}));

describe("usePlannerNavigationCommandBundle", () => {
  beforeEach(() => {
    mockUsePlannerNavigationLayoutToolbar.mockReset();
    mockUsePlannerCommandPalette.mockReset();
  });

  it("wires navigation actions into command palette and merges outputs", () => {
    const navigationResult = {
      goGrandmotherView: vi.fn(),
      goUpOneView: vi.fn(),
      organizeVisibleTree: vi.fn(),
      openSelectedAsMaster: vi.fn(),
      organizeSelectedBranch: vi.fn(),
      openSelectedAsStoryLane: vi.fn(),
      showProjectSection: vi.fn(),
    };
    const commandResult = {
      runPaletteAction: vi.fn(),
      paletteItems: [{ id: "p1" }],
    };

    mockUsePlannerNavigationLayoutToolbar.mockReturnValue(navigationResult);
    mockUsePlannerCommandPalette.mockReturnValue(commandResult);

    const params = {
      navigationLayoutToolbar: { marker: "nav" },
      commandPalette: { marker: "cmd" },
    } as unknown as Parameters<typeof usePlannerNavigationCommandBundle>[0];

    const result = usePlannerNavigationCommandBundle(params);

    expect(mockUsePlannerNavigationLayoutToolbar).toHaveBeenCalledWith(params.navigationLayoutToolbar);
    expect(mockUsePlannerCommandPalette).toHaveBeenCalledWith(
      expect.objectContaining({
        marker: "cmd",
        goGrandmotherView: navigationResult.goGrandmotherView,
        goUpOneView: navigationResult.goUpOneView,
        organizeVisibleTree: navigationResult.organizeVisibleTree,
        openSelectedAsMaster: navigationResult.openSelectedAsMaster,
        organizeSelectedBranch: navigationResult.organizeSelectedBranch,
        openSelectedAsStoryLane: navigationResult.openSelectedAsStoryLane,
      })
    );
    expect(result).toEqual({
      ...navigationResult,
      ...commandResult,
    });
  });
});
