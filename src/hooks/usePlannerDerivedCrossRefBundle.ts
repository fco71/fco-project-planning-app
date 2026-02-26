import { usePlannerViewDerivedState } from "./usePlannerViewDerivedState";
import { usePlannerCrossRefDerivedState } from "./usePlannerCrossRefDerivedState";
import { usePlannerCrossRefUiSync } from "./usePlannerCrossRefUiSync";
import { usePlannerDefaultPortalPosition } from "./usePlannerDefaultPortalPosition";
import { usePlannerBodySaveActions } from "./usePlannerBodySaveActions";

type UsePlannerDerivedCrossRefBundleParams = {
  viewDerived: Parameters<typeof usePlannerViewDerivedState>[0];
  crossRefDerived: Parameters<typeof usePlannerCrossRefDerivedState>[0];
  crossRefUiSync: Omit<
    Parameters<typeof usePlannerCrossRefUiSync>[0],
    "activePortalRef" | "selectedNodeRefs" | "linkableNodeOptions"
  >;
  defaultPortalPosition: Parameters<typeof usePlannerDefaultPortalPosition>[0];
  bodySave: Parameters<typeof usePlannerBodySaveActions>[0];
};

export function usePlannerDerivedCrossRefBundle({
  viewDerived,
  crossRefDerived,
  crossRefUiSync,
  defaultPortalPosition,
  bodySave,
}: UsePlannerDerivedCrossRefBundleParams) {
  const viewDerivedState = usePlannerViewDerivedState(viewDerived);
  const crossRefDerivedState = usePlannerCrossRefDerivedState(crossRefDerived);
  const { hydrateRefEditor } = usePlannerCrossRefUiSync({
    ...crossRefUiSync,
    activePortalRef: crossRefDerivedState.activePortalRef,
    selectedNodeRefs: crossRefDerivedState.selectedNodeRefs,
    linkableNodeOptions: crossRefDerivedState.linkableNodeOptions,
  });
  const buildDefaultPortalPosition = usePlannerDefaultPortalPosition(defaultPortalPosition);
  const { saveSelectedBody } = usePlannerBodySaveActions(bodySave);

  return {
    ...viewDerivedState,
    ...crossRefDerivedState,
    hydrateRefEditor,
    buildDefaultPortalPosition,
    saveSelectedBody,
  };
}
