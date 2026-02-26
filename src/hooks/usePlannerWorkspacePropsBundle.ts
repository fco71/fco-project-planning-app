import { usePlannerCanvasSurfaceProps } from "./usePlannerCanvasSurfaceProps";
import { usePlannerSidebarMobilePanelsBundle } from "./usePlannerSidebarMobilePanelsBundle";
import { usePlannerSidebarChromeProps } from "./usePlannerSidebarChromeProps";

type UsePlannerWorkspacePropsBundleParams = {
  canvasSurface: Parameters<typeof usePlannerCanvasSurfaceProps>[0];
  sidebarMobilePanels: Parameters<typeof usePlannerSidebarMobilePanelsBundle>[0];
  sidebarChrome: Parameters<typeof usePlannerSidebarChromeProps>[0];
};

export function usePlannerWorkspacePropsBundle({
  canvasSurface,
  sidebarMobilePanels,
  sidebarChrome,
}: UsePlannerWorkspacePropsBundleParams) {
  const plannerCanvasSurfaceProps = usePlannerCanvasSurfaceProps(canvasSurface);
  const { plannerMobilePanelsProps, plannerSidebarPanelsProps } = usePlannerSidebarMobilePanelsBundle(sidebarMobilePanels);
  const plannerSidebarChromeProps = usePlannerSidebarChromeProps(sidebarChrome);

  return {
    plannerCanvasSurfaceProps,
    plannerMobilePanelsProps,
    plannerSidebarPanelsProps,
    plannerSidebarChromeProps,
  };
}
