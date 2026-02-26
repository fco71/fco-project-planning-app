import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TreeNode } from "../types/planner";

type PlannerNodePatch = Partial<
  Pick<TreeNode, "title" | "parentId" | "kind" | "x" | "y" | "width" | "height" | "color" | "taskStatus" | "storySteps" | "body">
>;

type UsePlannerLocalNodePatchParams = {
  setNodes: Dispatch<SetStateAction<TreeNode[]>>;
};

export function usePlannerLocalNodePatch({ setNodes }: UsePlannerLocalNodePatchParams) {
  return useCallback(
    (nodeId: string, patch: PlannerNodePatch) => {
      setNodes((prevNodes) => prevNodes.map((entry) => (entry.id === nodeId ? { ...entry, ...patch } : entry)));
    },
    [setNodes]
  );
}
