import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { collection, doc, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import type { TreeNode, TreeNodeDoc } from "../types/planner";
import type { HistoryEntry } from "./useUndoRedo";

type ResolveNodePosition = (nodeId: string) => { x: number; y: number };

type UsePlannerContextCreateActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  childrenByParent: Map<string, string[]>;
  nodesById: Map<string, TreeNode>;
  newNodeDocId: () => string;
  pushHistory: (entry: HistoryEntry) => void;
  resolveNodePosition: ResolveNodePosition;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setPendingSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setPendingRenameNodeId: Dispatch<SetStateAction<string | null>>;
};

export function usePlannerContextCreateActions({
  firestore,
  userUid,
  childrenByParent,
  nodesById,
  newNodeDocId,
  pushHistory,
  resolveNodePosition,
  setBusyAction,
  setError,
  setPendingSelectedNodeId,
  setPendingRenameNodeId,
}: UsePlannerContextCreateActionsParams) {
  const handleContextAddChild = useCallback(
    async (nodeId: string) => {
      if (!firestore) return;
      const parentPosition = resolveNodePosition(nodeId);
      const siblingCount = (childrenByParent.get(nodeId) || []).length;
      const newId = newNodeDocId();
      const nodeData: TreeNodeDoc = {
        title: "New Node",
        parentId: nodeId,
        kind: "item",
        x: parentPosition.x + 280,
        y: parentPosition.y + 20 + siblingCount * 96,
      };

      pushHistory({
        id: crypto.randomUUID(),
        label: `Create "New Node"`,
        forwardLocal: [{ target: "nodes", op: "add", node: { ...nodeData, id: newId } }],
        forwardFirestore: [{ kind: "setNode", nodeId: newId, data: nodeData }],
        inverseLocal: [{ target: "nodes", op: "remove", nodeIds: [newId] }],
        inverseFirestore: [{ kind: "deleteNode", nodeId: newId }],
      });

      setBusyAction(true);
      setError(null);
      try {
        await setDoc(doc(firestore, "users", userUid, "nodes", newId), {
          ...nodeData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies TreeNodeDoc & { createdAt: unknown; updatedAt: unknown });
        setPendingSelectedNodeId(newId);
        setPendingRenameNodeId(newId);
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not create node.");
      } finally {
        setBusyAction(false);
      }
    },
    [
      childrenByParent,
      firestore,
      newNodeDocId,
      pushHistory,
      resolveNodePosition,
      setBusyAction,
      setError,
      setPendingRenameNodeId,
      setPendingSelectedNodeId,
      userUid,
    ]
  );

  const handleContextAddStorySibling = useCallback(
    async (nodeId: string) => {
      if (!firestore) return;
      const baseNode = nodesById.get(nodeId);
      if (!baseNode || baseNode.kind !== "story") return;
      const basePosition = resolveNodePosition(nodeId);
      const directStoryChildren = (childrenByParent.get(nodeId) || [])
        .map((id) => nodesById.get(id))
        .filter((entry): entry is TreeNode => !!entry && entry.kind === "story");
      const maxBeatX = directStoryChildren.reduce(
        (maxX, storyChild) => Math.max(maxX, resolveNodePosition(storyChild.id).x),
        basePosition.x
      );

      const newDoc = doc(collection(firestore, "users", userUid, "nodes"));
      setBusyAction(true);
      setError(null);
      try {
        await setDoc(doc(firestore, "users", userUid, "nodes", newDoc.id), {
          title: "New Story Beat",
          parentId: nodeId,
          kind: "story",
          x: maxBeatX + 320,
          y: basePosition.y,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies TreeNodeDoc & { createdAt: unknown; updatedAt: unknown });
        setPendingSelectedNodeId(newDoc.id);
        setPendingRenameNodeId(newDoc.id);
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not create story sibling.");
      } finally {
        setBusyAction(false);
      }
    },
    [
      childrenByParent,
      firestore,
      nodesById,
      resolveNodePosition,
      setBusyAction,
      setError,
      setPendingRenameNodeId,
      setPendingSelectedNodeId,
      userUid,
    ]
  );

  const handleContextDuplicate = useCallback(
    async (nodeId: string) => {
      if (!firestore) return;
      const original = nodesById.get(nodeId);
      if (!original) return;

      const newDoc = doc(collection(firestore, "users", userUid, "nodes"));
      setBusyAction(true);
      setError(null);
      try {
        await setDoc(doc(firestore, "users", userUid, "nodes", newDoc.id), {
          title: `${original.title} (Copy)`,
          parentId: original.parentId,
          kind: original.kind,
          x: (typeof original.x === "number" ? original.x : 0) + 80,
          y: (typeof original.y === "number" ? original.y : 0) + 80,
          ...(typeof original.width === "number" ? { width: original.width } : {}),
          ...(typeof original.height === "number" ? { height: original.height } : {}),
          ...(original.color ? { color: original.color } : {}),
          ...(original.taskStatus && original.taskStatus !== "none" ? { taskStatus: original.taskStatus } : {}),
          ...(original.storySteps && original.storySteps.length > 0 ? { storySteps: original.storySteps } : {}),
          ...(original.body ? { body: original.body } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies TreeNodeDoc & { createdAt: unknown; updatedAt: unknown });
        setPendingSelectedNodeId(newDoc.id);
        setPendingRenameNodeId(newDoc.id);
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not duplicate node.");
      } finally {
        setBusyAction(false);
      }
    },
    [firestore, nodesById, setBusyAction, setError, setPendingRenameNodeId, setPendingSelectedNodeId, userUid]
  );

  return {
    handleContextAddChild,
    handleContextAddStorySibling,
    handleContextDuplicate,
  };
}
