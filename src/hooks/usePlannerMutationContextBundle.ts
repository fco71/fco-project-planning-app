import { usePlannerCreateDeleteActions } from "./usePlannerCreateDeleteActions";
import { usePlannerNodeMutationActions } from "./usePlannerNodeMutationActions";
import { usePlannerCrossRefActions } from "./usePlannerCrossRefActions";
import { usePlannerDragActions } from "./usePlannerDragActions";
import { usePlannerContextActions } from "./usePlannerContextActions";

type UsePlannerMutationContextBundleParams = {
  createDelete: Parameters<typeof usePlannerCreateDeleteActions>[0];
  nodeMutation: Parameters<typeof usePlannerNodeMutationActions>[0];
  crossRef: Parameters<typeof usePlannerCrossRefActions>[0];
  drag: Parameters<typeof usePlannerDragActions>[0];
  context: Omit<Parameters<typeof usePlannerContextActions>[0], "setNodeTaskStatus">;
};

export function usePlannerMutationContextBundle({
  createDelete,
  nodeMutation,
  crossRef,
  drag,
  context,
}: UsePlannerMutationContextBundleParams) {
  const createDeleteActions = usePlannerCreateDeleteActions(createDelete);
  const nodeMutationActions = usePlannerNodeMutationActions(nodeMutation);
  const crossRefActions = usePlannerCrossRefActions(crossRef);
  const dragActions = usePlannerDragActions(drag);
  const contextActions = usePlannerContextActions({
    ...context,
    setNodeTaskStatus: nodeMutationActions.setNodeTaskStatus,
  });

  return {
    ...createDeleteActions,
    ...nodeMutationActions,
    ...crossRefActions,
    ...dragActions,
    ...contextActions,
  };
}
