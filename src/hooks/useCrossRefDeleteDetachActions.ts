import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { arrayRemove, deleteField, deleteDoc, doc, serverTimestamp, updateDoc, type Firestore } from "firebase/firestore";
import type { CrossRef } from "../types/planner";
import { firestoreDeleteField, type HistoryEntry } from "./useUndoRedo";

type Position = { x: number; y: number };
type ResolveNodePosition = (nodeId: string) => Position;
type ChooseAnchorNodeId = (nodeIds: string[], ...preferredIds: Array<string | null | undefined>) => string | null;
type ResolvePortalFollowPosition = (
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: Position | null,
  seed: string
) => Position;

type UseCrossRefDeleteDetachActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  refs: CrossRef[];
  editRefId: string;
  activePortalRefId: string | null;
  pushHistory: (entry: HistoryEntry) => void;
  crossRefToFirestoreSetData: (ref: CrossRef) => Record<string, unknown>;
  hydrateRefEditor: (ref: CrossRef | null) => void;
  chooseAnchorNodeId: ChooseAnchorNodeId;
  resolveNodePosition: ResolveNodePosition;
  resolvePortalFollowPosition: ResolvePortalFollowPosition;
  closePortalContextMenu: () => void;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setRefs: Dispatch<SetStateAction<CrossRef[]>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  setLinkNodeQuery: Dispatch<SetStateAction<string>>;
  setLinkTargetNodeId: Dispatch<SetStateAction<string>>;
};

export function useCrossRefDeleteDetachActions({
  firestore,
  userUid,
  refs,
  editRefId,
  activePortalRefId,
  pushHistory,
  crossRefToFirestoreSetData,
  hydrateRefEditor,
  chooseAnchorNodeId,
  resolveNodePosition,
  resolvePortalFollowPosition,
  closePortalContextMenu,
  setBusyAction,
  setError,
  setRefs,
  setActivePortalRefId,
  setLinkNodeQuery,
  setLinkTargetNodeId,
}: UseCrossRefDeleteDetachActionsParams) {
  const deleteCrossRefBubble = useCallback(async () => {
    if (!firestore || !editRefId) return;
    const existing = refs.find((entry) => entry.id === editRefId);
    if (!existing) return;
    const snapshot: CrossRef = {
      ...existing,
      nodeIds: [...existing.nodeIds],
      tags: [...existing.tags],
      links: [...existing.links],
    };
    pushHistory({
      id: crypto.randomUUID(),
      label: `Delete bubble "${existing.label}"`,
      forwardLocal: [{ target: "refs", op: "remove", refIds: [existing.id] }],
      forwardFirestore: [{ kind: "deleteRef", refId: existing.id }],
      inverseLocal: [{ target: "refs", op: "add", ref: snapshot }],
      inverseFirestore: [{ kind: "setRef", refId: existing.id, data: crossRefToFirestoreSetData(snapshot) }],
    });
    setBusyAction(true);
    setError(null);
    const idToDelete = existing.id;
    setRefs((prev) => prev.filter((r) => r.id !== idToDelete));
    if (activePortalRefId === idToDelete) setActivePortalRefId(null);
    hydrateRefEditor(null);
    setLinkNodeQuery("");
    setLinkTargetNodeId("");
    try {
      await deleteDoc(doc(firestore, "users", userUid, "crossRefs", idToDelete));
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not delete bubble.");
    } finally {
      setBusyAction(false);
    }
  }, [
    activePortalRefId,
    crossRefToFirestoreSetData,
    editRefId,
    firestore,
    hydrateRefEditor,
    pushHistory,
    refs,
    setActivePortalRefId,
    setBusyAction,
    setError,
    setLinkNodeQuery,
    setLinkTargetNodeId,
    setRefs,
    userUid,
  ]);

  const deletePortalByRefId = useCallback(async (refId: string) => {
    if (!firestore || !refId) return;
    const existing = refs.find((entry) => entry.id === refId);
    if (!existing) return;
    const snapshot: CrossRef = {
      ...existing,
      nodeIds: [...existing.nodeIds],
      tags: [...existing.tags],
      links: [...existing.links],
    };
    pushHistory({
      id: crypto.randomUUID(),
      label: `Delete bubble "${existing.label}"`,
      forwardLocal: [{ target: "refs", op: "remove", refIds: [existing.id] }],
      forwardFirestore: [{ kind: "deleteRef", refId: existing.id }],
      inverseLocal: [{ target: "refs", op: "add", ref: snapshot }],
      inverseFirestore: [{ kind: "setRef", refId: existing.id, data: crossRefToFirestoreSetData(snapshot) }],
    });
    setBusyAction(true);
    setError(null);
    closePortalContextMenu();
    setRefs((prev) => prev.filter((r) => r.id !== refId));
    if (activePortalRefId === refId) setActivePortalRefId(null);
    if (editRefId === refId) {
      hydrateRefEditor(null);
      setLinkNodeQuery("");
      setLinkTargetNodeId("");
    }
    try {
      await deleteDoc(doc(firestore, "users", userUid, "crossRefs", refId));
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not delete cross-reference.");
    } finally {
      setBusyAction(false);
    }
  }, [
    activePortalRefId,
    closePortalContextMenu,
    crossRefToFirestoreSetData,
    editRefId,
    firestore,
    hydrateRefEditor,
    pushHistory,
    refs,
    setActivePortalRefId,
    setBusyAction,
    setError,
    setLinkNodeQuery,
    setLinkTargetNodeId,
    setRefs,
    userUid,
  ]);

  const detachCrossRef = useCallback(
    async (refId: string, nodeId: string) => {
      if (!firestore) return;
      const target = refs.find((entry) => entry.id === refId);
      setBusyAction(true);
      setError(null);
      try {
        if (target) {
          const remainingNodeIds = target.nodeIds.filter((id) => id !== nodeId);
          const nextAnchorNodeId = chooseAnchorNodeId(remainingNodeIds, target.anchorNodeId);
          const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
          const nextPortalPosition = resolvePortalFollowPosition(target, nextAnchorPosition, target.id);

          const prevData: Record<string, unknown> = {
            nodeIds: target.nodeIds,
            anchorNodeId: target.anchorNodeId ?? firestoreDeleteField(),
            portalX: target.portalX,
            portalY: target.portalY,
            portalAnchorX: target.portalAnchorX ?? firestoreDeleteField(),
            portalAnchorY: target.portalAnchorY ?? firestoreDeleteField(),
          };
          const nextData: Record<string, unknown> = {
            nodeIds: remainingNodeIds,
            anchorNodeId: nextAnchorNodeId ?? firestoreDeleteField(),
            portalX: nextPortalPosition.x,
            portalY: nextPortalPosition.y,
            portalAnchorX: nextAnchorPosition?.x ?? firestoreDeleteField(),
            portalAnchorY: nextAnchorPosition?.y ?? firestoreDeleteField(),
          };
          pushHistory({
            id: crypto.randomUUID(),
            label: "Detach bubble from node",
            forwardLocal: [
              {
                target: "refs",
                op: "patch",
                refId,
                patch: {
                  nodeIds: remainingNodeIds,
                  anchorNodeId: nextAnchorNodeId,
                  portalX: nextPortalPosition.x,
                  portalY: nextPortalPosition.y,
                },
              },
            ],
            forwardFirestore: [{ kind: "updateRef", refId, data: nextData }],
            inverseLocal: [
              {
                target: "refs",
                op: "patch",
                refId,
                patch: {
                  nodeIds: target.nodeIds,
                  anchorNodeId: target.anchorNodeId,
                  portalX: target.portalX,
                  portalY: target.portalY,
                },
              },
            ],
            inverseFirestore: [{ kind: "updateRef", refId, data: prevData }],
          });

          await updateDoc(doc(firestore, "users", userUid, "crossRefs", refId), {
            nodeIds: remainingNodeIds,
            anchorNodeId: nextAnchorNodeId ?? deleteField(),
            ...(nextPortalPosition ? { portalX: nextPortalPosition.x, portalY: nextPortalPosition.y } : {}),
            ...(nextAnchorPosition ? { portalAnchorX: nextAnchorPosition.x, portalAnchorY: nextAnchorPosition.y } : {}),
            updatedAt: serverTimestamp(),
          });
          if (editRefId === refId) {
            hydrateRefEditor({
              ...target,
              nodeIds: remainingNodeIds,
              anchorNodeId: nextAnchorNodeId,
              portalX: nextPortalPosition.x,
              portalY: nextPortalPosition.y,
              portalAnchorX: nextAnchorPosition?.x ?? target.portalAnchorX,
              portalAnchorY: nextAnchorPosition?.y ?? target.portalAnchorY,
            });
          }
        } else {
          await updateDoc(doc(firestore, "users", userUid, "crossRefs", refId), {
            nodeIds: arrayRemove(nodeId),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not detach cross-reference.");
      } finally {
        setBusyAction(false);
      }
    },
    [
      chooseAnchorNodeId,
      editRefId,
      firestore,
      hydrateRefEditor,
      pushHistory,
      refs,
      resolveNodePosition,
      resolvePortalFollowPosition,
      setBusyAction,
      setError,
      userUid,
    ]
  );

  return {
    deleteCrossRefBubble,
    deletePortalByRefId,
    detachCrossRef,
  };
}
