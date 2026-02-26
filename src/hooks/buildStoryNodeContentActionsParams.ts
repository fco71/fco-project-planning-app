import type { Firestore } from "firebase/firestore";
import type { usePlannerPageState } from "./usePlannerPageState";
import type { HistoryEntry } from "./useUndoRedo";
import type { useStoryNodeContentActions } from "./useStoryNodeContentActions";

type PlannerState = ReturnType<typeof usePlannerPageState>;
type StoryNodeContentActionsParams = Parameters<typeof useStoryNodeContentActions>[0];

type BuildStoryNodeContentActionsParamsInput = {
  plannerState: PlannerState;
  firestore: Firestore | null;
  userUid: string;
  nodesById: StoryNodeContentActionsParams["nodesById"];
  pushHistory: (entry: HistoryEntry) => void;
  applyLocalNodePatch: StoryNodeContentActionsParams["applyLocalNodePatch"];
  storyNodeMinWidth: number;
  storyNodeMaxWidth: number;
  storyNodeMinHeight: number;
  storyNodeMaxHeight: number;
};

export function buildStoryNodeContentActionsParams({
  plannerState,
  firestore,
  userUid,
  nodesById,
  pushHistory,
  applyLocalNodePatch,
  storyNodeMinWidth,
  storyNodeMaxWidth,
  storyNodeMinHeight,
  storyNodeMaxHeight,
}: BuildStoryNodeContentActionsParamsInput): StoryNodeContentActionsParams {
  return {
    firestore,
    userUid,
    nodesById,
    pushHistory,
    applyLocalNodePatch,
    setBusyAction: plannerState.setBusyAction,
    setError: plannerState.setError,
    setNodes: plannerState.setNodes,
    storyNodeMinWidth,
    storyNodeMaxWidth,
    storyNodeMinHeight,
    storyNodeMaxHeight,
  };
}
