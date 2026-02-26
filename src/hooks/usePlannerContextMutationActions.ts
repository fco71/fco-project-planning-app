import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { doc, serverTimestamp, updateDoc, type Firestore } from "firebase/firestore";
import type { NodeKind, TaskStatus, TreeNode } from "../types/planner";
import type { HistoryEntry } from "./useUndoRedo";

type UsePlannerContextMutationActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  nodesById: Map<string, TreeNode>;
  nextNodeKind: (kind: NodeKind) => NodeKind;
  pushHistory: (entry: HistoryEntry) => void;
  applyLocalNodePatch: (nodeId: string, patch: Partial<TreeNode>) => void;
  setNodeTaskStatus: (nodeId: string, status: TaskStatus) => Promise<void>;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
};

export function usePlannerContextMutationActions({
  firestore,
  userUid,
  nodesById,
  nextNodeKind,
  pushHistory,
  applyLocalNodePatch,
  setNodeTaskStatus,
  setBusyAction,
  setError,
  setSelectedNodeId,
  setActivePortalRefId,
}: UsePlannerContextMutationActionsParams) {
  const handleContextChangeType = useCallback(
    async (nodeId: string, targetKind?: NodeKind) => {
      if (!firestore) return;
      const node = nodesById.get(nodeId);
      if (!node || node.kind === "root") return;

      const previousKind = node.kind;
      const newKind = targetKind && targetKind !== "root" ? targetKind : nextNodeKind(previousKind);
      if (newKind === previousKind) return;

      pushHistory({
        id: crypto.randomUUID(),
        label: `Change type to "${newKind}"`,
        forwardLocal: [{ target: "nodes", op: "patch", nodeId, patch: { kind: newKind } }],
        forwardFirestore: [{ kind: "updateNode", nodeId, data: { kind: newKind } }],
        inverseLocal: [{ target: "nodes", op: "patch", nodeId, patch: { kind: previousKind } }],
        inverseFirestore: [{ kind: "updateNode", nodeId, data: { kind: previousKind } }],
      });
      setBusyAction(true);
      setError(null);
      setSelectedNodeId(nodeId);
      setActivePortalRefId(null);
      applyLocalNodePatch(nodeId, { kind: newKind });
      try {
        await updateDoc(doc(firestore, "users", userUid, "nodes", nodeId), {
          kind: newKind,
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        applyLocalNodePatch(nodeId, { kind: previousKind });
        setError(actionError instanceof Error ? actionError.message : "Could not change node type.");
      } finally {
        setBusyAction(false);
      }
    },
    [
      applyLocalNodePatch,
      firestore,
      nextNodeKind,
      nodesById,
      pushHistory,
      setActivePortalRefId,
      setBusyAction,
      setError,
      setSelectedNodeId,
      userUid,
    ]
  );

  const handleContextToggleTaskStatus = useCallback(
    (nodeId: string) => {
      const node = nodesById.get(nodeId);
      if (!node || node.kind === "root") return;
      const current = node.taskStatus || "none";
      const nextStatus: TaskStatus = current === "done" ? "todo" : "done";
      void setNodeTaskStatus(nodeId, nextStatus);
    },
    [nodesById, setNodeTaskStatus]
  );

  return {
    handleContextChangeType,
    handleContextToggleTaskStatus,
  };
}
