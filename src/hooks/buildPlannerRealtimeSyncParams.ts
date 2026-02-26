import type { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { usePlannerPageState } from "./usePlannerPageState";
import type { usePlannerRealtimeSync } from "./usePlannerRealtimeSync";

type PlannerState = ReturnType<typeof usePlannerPageState>;
type RealtimeSyncParams = Parameters<typeof usePlannerRealtimeSync>[0];

type BuildPlannerRealtimeSyncParamsInput = {
  plannerState: PlannerState;
  user: User;
  firestore: Firestore | null;
  suppressSnapshotRef: RealtimeSyncParams["suppressSnapshotRef"];
  crossReferencesEnabled: RealtimeSyncParams["crossReferencesEnabled"];
  bubblesSimplifiedMode: RealtimeSyncParams["bubblesSimplifiedMode"];
};

export function buildPlannerRealtimeSyncParams({
  plannerState,
  user,
  firestore,
  suppressSnapshotRef,
  crossReferencesEnabled,
  bubblesSimplifiedMode,
}: BuildPlannerRealtimeSyncParamsInput): RealtimeSyncParams {
  return {
    user,
    firestore,
    suppressSnapshotRef,
    setLoading: plannerState.setLoading,
    setError: plannerState.setError,
    setCollapsedHydrated: plannerState.setCollapsedHydrated,
    syncedCollapsedKeyRef: plannerState.syncedCollapsedKeyRef,
    setCollapsedNodeIds: plannerState.setCollapsedNodeIds,
    setProfileName: plannerState.setProfileName,
    setRootNodeId: plannerState.setRootNodeId,
    setNodes: plannerState.setNodes,
    setRefs: plannerState.setRefs,
    crossReferencesEnabled,
    bubblesSimplifiedMode,
  };
}
