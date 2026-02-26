import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CrossRef, TreeNode } from "../types/planner";
import type { LocalOp } from "./useUndoRedo";

type UsePlannerApplyLocalOpsParams = {
  setNodes: Dispatch<SetStateAction<TreeNode[]>>;
  setRefs: Dispatch<SetStateAction<CrossRef[]>>;
};

export function usePlannerApplyLocalOps({ setNodes, setRefs }: UsePlannerApplyLocalOpsParams) {
  return useCallback((ops: LocalOp[]) => {
    const nodeOps = ops.filter((op) => op.target === "nodes");
    const refOps = ops.filter((op) => op.target === "refs");

    if (nodeOps.length > 0) {
      setNodes((prev) => {
        let next = prev;
        for (const op of nodeOps) {
          if (op.op === "patch") next = next.map((node) => (node.id === op.nodeId ? { ...node, ...op.patch } as TreeNode : node));
          if (op.op === "add") next = [...next, op.node as TreeNode];
          if (op.op === "remove") {
            const ids = new Set(op.nodeIds);
            next = next.filter((node) => !ids.has(node.id));
          }
        }
        return next;
      });
    }

    if (refOps.length > 0) {
      setRefs((prev) => {
        let next = prev;
        for (const op of refOps) {
          if (op.op === "patch") next = next.map((ref) => (ref.id === op.refId ? { ...ref, ...op.patch } as CrossRef : ref));
          if (op.op === "add") next = [...next, op.ref as CrossRef];
          if (op.op === "remove") {
            const ids = new Set(op.refIds);
            next = next.filter((ref) => !ids.has(ref.id));
          }
        }
        return next;
      });
    }
  }, [setNodes, setRefs]);
}
