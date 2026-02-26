import { usePlannerLayoutActions } from "./usePlannerLayoutActions";
import { usePlannerMobileToolbarActions } from "./usePlannerMobileToolbarActions";
import { usePlannerNavigationActions } from "./usePlannerNavigationActions";
import { usePlannerSidebarSectionVisibility } from "./usePlannerSidebarSectionVisibility";

type NavigationParams = Parameters<typeof usePlannerNavigationActions>[0];
type LayoutParams = Parameters<typeof usePlannerLayoutActions>[0];
type SidebarVisibilityParams = Parameters<typeof usePlannerSidebarSectionVisibility>[0];
type ToolbarParams = Omit<Parameters<typeof usePlannerMobileToolbarActions>[0], "goGrandmotherView" | "goUpOneView">;

type UsePlannerNavigationLayoutToolbarParams = {
  navigation: NavigationParams;
  layout: LayoutParams;
  sidebarVisibility: SidebarVisibilityParams;
  toolbar: ToolbarParams;
};

export function usePlannerNavigationLayoutToolbar({
  navigation,
  layout,
  sidebarVisibility,
  toolbar,
}: UsePlannerNavigationLayoutToolbarParams) {
  const navigationActions = usePlannerNavigationActions(navigation);
  const layoutActions = usePlannerLayoutActions(layout);
  const sectionVisibility = usePlannerSidebarSectionVisibility(sidebarVisibility);
  const toolbarActions = usePlannerMobileToolbarActions({
    ...toolbar,
    goGrandmotherView: navigationActions.goGrandmotherView,
    goUpOneView: navigationActions.goUpOneView,
  });

  return {
    ...navigationActions,
    ...layoutActions,
    ...sectionVisibility,
    ...toolbarActions,
  };
}
