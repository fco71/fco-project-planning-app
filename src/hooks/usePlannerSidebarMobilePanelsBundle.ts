import { usePlannerMobilePanelsProps } from "./usePlannerMobilePanelsProps";
import { usePlannerSidebarPanelsProps } from "./usePlannerSidebarPanelsProps";

type MobileParams = Parameters<typeof usePlannerMobilePanelsProps>[0];
type SidebarParams = Parameters<typeof usePlannerSidebarPanelsProps>[0];

type UsePlannerSidebarMobilePanelsBundleParams = MobileParams & SidebarParams;

export function usePlannerSidebarMobilePanelsBundle(params: UsePlannerSidebarMobilePanelsBundleParams) {
  const plannerMobilePanelsProps = usePlannerMobilePanelsProps(params);
  const plannerSidebarPanelsProps = usePlannerSidebarPanelsProps(params);

  return {
    plannerMobilePanelsProps,
    plannerSidebarPanelsProps,
  };
}
