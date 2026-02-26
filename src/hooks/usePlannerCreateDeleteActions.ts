import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { collectDescendants } from "../utils/treeUtils";
import type { CrossRef, TreeNode, TreeNodeDoc } from "../types/planner";
import { firestoreDeleteField, type FirestoreOp, type HistoryEntry, type LocalOp } from "./useUndoRedo";

type UsePlannerCreateDeleteActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  newChildTitle: string;
  selectedNodeId: string | null;
  currentRootId: string | null;
  rootNodeId: string | null;
  childrenByParent: Map<string, string[]>;
  nodesById: Map<string, TreeNode>;
  refs: CrossRef[];
  newNodeDocId: () => string;
  resolveNodePosition: (nodeId: string) => { x: number; y: number };
  chooseAnchorNodeId: (nodeIds: string[], ...preferredIds: Array<string | null | undefined>) => string | null;
  resolvePortalFollowPosition: (
    ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
    anchor: { x: number; y: number } | null,
    seed: string
  ) => { x: number; y: number };
  crossRefToFirestoreSetData: (ref: CrossRef) => Record<string, unknown>;
  pushHistory: (entry: HistoryEntry) => void;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNewChildTitle: Dispatch<SetStateAction<string>>;
  setPendingSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setPendingRenameNodeId: Dispatch<SetStateAction<string | null>>;
  setCurrentRootId: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
};

export function usePlannerCreateDeleteActions({
  firestore,
  userUid,
  newChildTitle,
  selectedNodeId,
  currentRootId,
  rootNodeId,
  childrenByParent,
  nodesById,
  refs,
  newNodeDocId,
  resolveNodePosition,
  chooseAnchorNodeId,
  resolvePortalFollowPosition,
  crossRefToFirestoreSetData,
  pushHistory,
  setBusyAction,
  setError,
  setNewChildTitle,
  setPendingSelectedNodeId,
  setPendingRenameNodeId,
  setCurrentRootId,
  setSelectedNodeId,
  setActivePortalRefId,
}: UsePlannerCreateDeleteActionsParams) {
  const createChild = useCallback(async () => {
    if (!firestore) return;
    const title = newChildTitle.trim() || "New Node";
    const parentId = selectedNodeId || currentRootId || rootNodeId;
    if (!parentId) return;
    const newId = newNodeDocId();
    const parentPosition = resolveNodePosition(parentId);
    const siblingCount = (childrenByParent.get(parentId) || []).length;
    const nodeData: TreeNodeDoc = {
      title,
      parentId,
      kind: "item",
      x: parentPosition.x + 280,
      y: parentPosition.y + 20 + siblingCount * 96,
    };
    pushHistory({
      id: crypto.randomUUID(),
      label: `Create "${title}"`,
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
      setNewChildTitle("");
      setPendingSelectedNodeId(newId);
      setPendingRenameNodeId(newId);
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not create node.");
    } finally {
      setBusyAction(false);
    }
  }, [
    childrenByParent,
    currentRootId,
    firestore,
    newChildTitle,
    newNodeDocId,
    pushHistory,
    resolveNodePosition,
    rootNodeId,
    selectedNodeId,
    setBusyAction,
    setError,
    setNewChildTitle,
    setPendingRenameNodeId,
    setPendingSelectedNodeId,
    userUid,
  ]);

  const deleteSelected = useCallback(async () => {
    if (!firestore || !selectedNodeId || selectedNodeId === rootNodeId) return;
    const ids = collectDescendants(selectedNodeId, childrenByParent);
    const idSet = new Set(ids);
    const fallbackId = nodesById.get(selectedNodeId)?.parentId || rootNodeId || null;

    const deletedNodes = ids.map((id) => nodesById.get(id)).filter(Boolean) as TreeNode[];
    const affectedRefs = refs.filter((ref) => ref.nodeIds.some((id) => idSet.has(id)));

    const fwdLocalNodes: LocalOp[] = [{ target: "nodes", op: "remove", nodeIds: ids }];
    const fwdFirestoreNodes: FirestoreOp[] = ids.map((id) => ({ kind: "deleteNode" as const, nodeId: id }));
    const fwdLocalRefs: LocalOp[] = [];
    const fwdFirestoreRefs: FirestoreOp[] = [];
    const invLocalRefs: LocalOp[] = [];
    const invFirestoreRefs: FirestoreOp[] = [];

    affectedRefs.forEach((ref) => {
      const remaining = ref.nodeIds.filter((id) => !idSet.has(id));
      if (remaining.length === 0) {
        fwdLocalRefs.push({ target: "refs", op: "remove", refIds: [ref.id] });
        fwdFirestoreRefs.push({ kind: "deleteRef", refId: ref.id });
        invLocalRefs.push({
          target: "refs",
          op: "add",
          ref: {
            ...ref,
            nodeIds: [...ref.nodeIds],
            tags: [...ref.tags],
            links: [...ref.links],
          },
        });
        invFirestoreRefs.push({
          kind: "setRef",
          refId: ref.id,
          data: crossRefToFirestoreSetData(ref),
        });
      } else {
        const nextAnchorNodeId = chooseAnchorNodeId(remaining, ref.anchorNodeId);
        const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
        const nextPortalPosition = resolvePortalFollowPosition(ref, nextAnchorPosition, `${ref.id}:delete-selected`);
        fwdLocalRefs.push({
          target: "refs",
          op: "patch",
          refId: ref.id,
          patch: {
            nodeIds: remaining,
            anchorNodeId: nextAnchorNodeId,
            portalX: nextPortalPosition.x,
            portalY: nextPortalPosition.y,
          },
        });
        fwdFirestoreRefs.push({
          kind: "updateRef",
          refId: ref.id,
          data: {
            nodeIds: remaining,
            anchorNodeId: nextAnchorNodeId ?? firestoreDeleteField(),
            portalX: nextPortalPosition.x,
            portalY: nextPortalPosition.y,
            portalAnchorX: nextAnchorPosition?.x ?? firestoreDeleteField(),
            portalAnchorY: nextAnchorPosition?.y ?? firestoreDeleteField(),
          },
        });
        invLocalRefs.push({
          target: "refs",
          op: "patch",
          refId: ref.id,
          patch: {
            nodeIds: ref.nodeIds,
            anchorNodeId: ref.anchorNodeId,
            portalX: ref.portalX,
            portalY: ref.portalY,
          },
        });
        invFirestoreRefs.push({
          kind: "updateRef",
          refId: ref.id,
          data: {
            nodeIds: ref.nodeIds,
            anchorNodeId: ref.anchorNodeId ?? firestoreDeleteField(),
            portalX: ref.portalX,
            portalY: ref.portalY,
            portalAnchorX: ref.portalAnchorX ?? firestoreDeleteField(),
            portalAnchorY: ref.portalAnchorY ?? firestoreDeleteField(),
          },
        });
      }
    });

    const deletedTitle = nodesById.get(selectedNodeId)?.title ?? selectedNodeId;
    pushHistory({
      id: crypto.randomUUID(),
      label: `Delete "${deletedTitle}"`,
      forwardLocal: [...fwdLocalNodes, ...fwdLocalRefs],
      forwardFirestore: [...fwdFirestoreNodes, ...fwdFirestoreRefs],
      inverseLocal: [
        ...deletedNodes.map((n): LocalOp => ({ target: "nodes", op: "add", node: n })),
        ...invLocalRefs,
      ],
      inverseFirestore: [
        ...deletedNodes.map((n): FirestoreOp => ({
          kind: "setNode",
          nodeId: n.id,
          data: {
            title: n.title,
            parentId: n.parentId,
            kind: n.kind,
            x: n.x ?? 0,
            y: n.y ?? 0,
            ...(typeof n.width === "number" ? { width: n.width } : {}),
            ...(typeof n.height === "number" ? { height: n.height } : {}),
            ...(n.color ? { color: n.color } : {}),
            ...(n.taskStatus && n.taskStatus !== "none" ? { taskStatus: n.taskStatus } : {}),
            ...(n.body ? { body: n.body } : {}),
            ...(n.storySteps ? { storySteps: n.storySteps } : {}),
          },
        })),
        ...invFirestoreRefs,
      ],
    });

    setBusyAction(true);
    setError(null);
    try {
      const batch = writeBatch(firestore);
      ids.forEach((id) => {
        batch.delete(doc(firestore, "users", userUid, "nodes", id));
      });
      refs.forEach((ref) => {
        const remaining = ref.nodeIds.filter((id) => !idSet.has(id));
        if (remaining.length === ref.nodeIds.length) return;
        const refDoc = doc(firestore, "users", userUid, "crossRefs", ref.id);
        if (remaining.length === 0) {
          batch.delete(refDoc);
        } else {
          const nextAnchorNodeId = chooseAnchorNodeId(remaining, ref.anchorNodeId);
          const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
          const nextPortalPosition = resolvePortalFollowPosition(ref, nextAnchorPosition, `${ref.id}:delete-selected`);
          batch.update(refDoc, {
            nodeIds: remaining,
            anchorNodeId: nextAnchorNodeId ?? deleteField(),
            portalX: nextPortalPosition.x,
            portalY: nextPortalPosition.y,
            portalAnchorX: nextAnchorPosition?.x ?? deleteField(),
            portalAnchorY: nextAnchorPosition?.y ?? deleteField(),
            updatedAt: serverTimestamp(),
          });
        }
      });
      await batch.commit();
      if (currentRootId && idSet.has(currentRootId)) {
        setCurrentRootId(fallbackId);
      }
      setSelectedNodeId(fallbackId);
      setActivePortalRefId(null);
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not delete node.");
    } finally {
      setBusyAction(false);
    }
  }, [
    childrenByParent,
    chooseAnchorNodeId,
    crossRefToFirestoreSetData,
    currentRootId,
    firestore,
    nodesById,
    pushHistory,
    refs,
    resolveNodePosition,
    resolvePortalFollowPosition,
    rootNodeId,
    selectedNodeId,
    setActivePortalRefId,
    setBusyAction,
    setCurrentRootId,
    setError,
    setSelectedNodeId,
    userUid,
  ]);

  return {
    createChild,
    deleteSelected,
  };
}
