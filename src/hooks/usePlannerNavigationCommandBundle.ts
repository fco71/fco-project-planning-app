import { usePlannerNavigationLayoutToolbar } from "./usePlannerNavigationLayoutToolbar";
import { usePlannerCommandPalette } from "./usePlannerCommandPalette";

type UsePlannerNavigationCommandBundleParams = {
  navigationLayoutToolbar: Parameters<typeof usePlannerNavigationLayoutToolbar>[0];
  commandPalette: Omit<
    Parameters<typeof usePlannerCommandPalette>[0],
    | "goGrandmotherView"
    | "goUpOneView"
    | "organizeVisibleTree"
    | "openSelectedAsMaster"
    | "organizeSelectedBranch"
    | "openSelectedAsStoryLane"
  >;
};

export function usePlannerNavigationCommandBundle({
  navigationLayoutToolbar,
  commandPalette,
}: UsePlannerNavigationCommandBundleParams) {
  const navigation = usePlannerNavigationLayoutToolbar(navigationLayoutToolbar);

  const command = usePlannerCommandPalette({
    ...commandPalette,
    goGrandmotherView: navigation.goGrandmotherView,
    goUpOneView: navigation.goUpOneView,
    organizeVisibleTree: navigation.organizeVisibleTree,
    openSelectedAsMaster: navigation.openSelectedAsMaster,
    organizeSelectedBranch: navigation.organizeSelectedBranch,
    openSelectedAsStoryLane: navigation.openSelectedAsStoryLane,
  });

  return {
    ...navigation,
    ...command,
  };
}
