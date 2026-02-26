import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlannerWorkspacePropsBundle } from "./usePlannerWorkspacePropsBundle";

const {
  mockUsePlannerCanvasSurfaceProps,
  mockUsePlannerSidebarMobilePanelsBundle,
  mockUsePlannerSidebarChromeProps,
} = vi.hoisted(() => ({
  mockUsePlannerCanvasSurfaceProps: vi.fn(),
  mockUsePlannerSidebarMobilePanelsBundle: vi.fn(),
  mockUsePlannerSidebarChromeProps: vi.fn(),
}));

vi.mock("./usePlannerCanvasSurfaceProps", () => ({
  usePlannerCanvasSurfaceProps: mockUsePlannerCanvasSurfaceProps,
}));

vi.mock("./usePlannerSidebarMobilePanelsBundle", () => ({
  usePlannerSidebarMobilePanelsBundle: mockUsePlannerSidebarMobilePanelsBundle,
}));

vi.mock("./usePlannerSidebarChromeProps", () => ({
  usePlannerSidebarChromeProps: mockUsePlannerSidebarChromeProps,
}));

describe("usePlannerWorkspacePropsBundle", () => {
  beforeEach(() => {
    mockUsePlannerCanvasSurfaceProps.mockReset();
    mockUsePlannerSidebarMobilePanelsBundle.mockReset();
    mockUsePlannerSidebarChromeProps.mockReset();
  });

  it("delegates to each props hook and returns composed workspace props", () => {
    const canvasSurfaceProps = { canvas: true };
    const mobilePanels = { plannerMobilePanelsProps: { mobile: true }, plannerSidebarPanelsProps: { sidebar: true } };
    const sidebarChrome = { chrome: true };
    mockUsePlannerCanvasSurfaceProps.mockReturnValue(canvasSurfaceProps);
    mockUsePlannerSidebarMobilePanelsBundle.mockReturnValue(mobilePanels);
    mockUsePlannerSidebarChromeProps.mockReturnValue(sidebarChrome);

    const params = {
      canvasSurface: { marker: "canvas" },
      sidebarMobilePanels: { marker: "panels" },
      sidebarChrome: { marker: "chrome" },
    } as unknown as Parameters<typeof usePlannerWorkspacePropsBundle>[0];

    const result = usePlannerWorkspacePropsBundle(params);

    expect(mockUsePlannerCanvasSurfaceProps).toHaveBeenCalledWith(params.canvasSurface);
    expect(mockUsePlannerSidebarMobilePanelsBundle).toHaveBeenCalledWith(params.sidebarMobilePanels);
    expect(mockUsePlannerSidebarChromeProps).toHaveBeenCalledWith(params.sidebarChrome);
    expect(result).toEqual({
      plannerCanvasSurfaceProps: canvasSurfaceProps,
      plannerMobilePanelsProps: mobilePanels.plannerMobilePanelsProps,
      plannerSidebarPanelsProps: mobilePanels.plannerSidebarPanelsProps,
      plannerSidebarChromeProps: sidebarChrome,
    });
  });
});
