import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  arrayUnion,
  deleteField,
  doc,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import type { CrossRef } from "../types/planner";
import type { FirestoreOp, HistoryEntry, LocalOp } from "./useUndoRedo";
import { firestoreDeleteField } from "./useUndoRedo";

type Position = { x: number; y: number };
type ResolveNodePosition = (nodeId: string) => Position;
type ChooseAnchorNodeId = (
  nodeIds: string[],
  ...preferredIds: Array<string | null | undefined>
) => string | null;
type ResolvePortalFollowPosition = (
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: Position | null,
  seed: string
) => Position;
type BuildDefaultPortalPosition = (anchorNodeId: string | null, seed: string) => Position | null;

type UseCrossRefLinkActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  refs: CrossRef[];
  pushHistory: (entry: HistoryEntry) => void;
  chooseAnchorNodeId: ChooseAnchorNodeId;
  resolveNodePosition: ResolveNodePosition;
  resolvePortalFollowPosition: ResolvePortalFollowPosition;
  buildDefaultPortalPosition: BuildDefaultPortalPosition;
  hydrateRefEditor: (ref: CrossRef | null) => void;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  setLinkNodeQuery: Dispatch<SetStateAction<string>>;
  setLinkTargetNodeId: Dispatch<SetStateAction<string>>;
};

export function useCrossRefLinkActions({
  firestore,
  userUid,
  refs,
  pushHistory,
  chooseAnchorNodeId,
  resolveNodePosition,
  resolvePortalFollowPosition,
  buildDefaultPortalPosition,
  hydrateRefEditor,
  setBusyAction,
  setError,
  setActivePortalRefId,
  setLinkNodeQuery,
  setLinkTargetNodeId,
}: UseCrossRefLinkActionsParams) {
  const linkCrossRefToNode = useCallback(
    async (refId: string, nodeId: string) => {
      if (!firestore) return;
      const linked = refs.find((entry) => entry.id === refId);
      if (linked?.nodeIds.includes(nodeId)) return;

      const nextNodeIds = linked ? [...linked.nodeIds, nodeId] : [nodeId];
      const nextAnchorNodeId = chooseAnchorNodeId(nextNodeIds, linked?.anchorNodeId, nodeId);
      const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
      const nextPortalPosition = linked
        ? resolvePortalFollowPosition(linked, nextAnchorPosition, refId)
        : buildDefaultPortalPosition(nextAnchorNodeId, refId);

      if (linked) {
        const prevData: Record<string, unknown> = {
          nodeIds: linked.nodeIds,
          anchorNodeId: linked.anchorNodeId ?? firestoreDeleteField(),
          portalX: linked.portalX,
          portalY: linked.portalY,
          portalAnchorX: linked.portalAnchorX ?? firestoreDeleteField(),
          portalAnchorY: linked.portalAnchorY ?? firestoreDeleteField(),
        };
        const nextData: Record<string, unknown> = {
          nodeIds: nextNodeIds,
          anchorNodeId: nextAnchorNodeId ?? firestoreDeleteField(),
          portalX: nextPortalPosition?.x ?? linked.portalX,
          portalY: nextPortalPosition?.y ?? linked.portalY,
          portalAnchorX: nextAnchorPosition?.x ?? firestoreDeleteField(),
          portalAnchorY: nextAnchorPosition?.y ?? firestoreDeleteField(),
        };
        pushHistory({
          id: crypto.randomUUID(),
          label: "Link bubble to node",
          forwardLocal: [
            {
              target: "refs",
              op: "patch",
              refId,
              patch: {
                nodeIds: nextNodeIds,
                anchorNodeId: nextAnchorNodeId,
                portalX: nextData.portalX as number,
                portalY: nextData.portalY as number,
              },
            },
          ] as LocalOp[],
          forwardFirestore: [{ kind: "updateRef", refId, data: nextData }] as FirestoreOp[],
          inverseLocal: [
            {
              target: "refs",
              op: "patch",
              refId,
              patch: {
                nodeIds: linked.nodeIds,
                anchorNodeId: linked.anchorNodeId,
                portalX: linked.portalX,
                portalY: linked.portalY,
              },
            },
          ] as LocalOp[],
          inverseFirestore: [{ kind: "updateRef", refId, data: prevData }] as FirestoreOp[],
        });
      }

      setBusyAction(true);
      setError(null);
      try {
        await updateDoc(doc(firestore, "users", userUid, "crossRefs", refId), {
          nodeIds: arrayUnion(nodeId),
          anchorNodeId: nextAnchorNodeId ?? deleteField(),
          ...(nextPortalPosition ? { portalX: nextPortalPosition.x, portalY: nextPortalPosition.y } : {}),
          ...(nextAnchorPosition
            ? { portalAnchorX: nextAnchorPosition.x, portalAnchorY: nextAnchorPosition.y }
            : {}),
          updatedAt: serverTimestamp(),
        });
        if (linked) {
          hydrateRefEditor({
            ...linked,
            nodeIds: nextNodeIds,
            anchorNodeId: nextAnchorNodeId,
            portalX: nextPortalPosition?.x ?? linked.portalX,
            portalY: nextPortalPosition?.y ?? linked.portalY,
            portalAnchorX: nextAnchorPosition?.x ?? linked.portalAnchorX,
            portalAnchorY: nextAnchorPosition?.y ?? linked.portalAnchorY,
          });
        }
        setActivePortalRefId(refId);
        setLinkNodeQuery("");
        setLinkTargetNodeId("");
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not link bubble to node.");
      } finally {
        setBusyAction(false);
      }
    },
    [
      buildDefaultPortalPosition,
      chooseAnchorNodeId,
      firestore,
      hydrateRefEditor,
      pushHistory,
      refs,
      resolveNodePosition,
      resolvePortalFollowPosition,
      setActivePortalRefId,
      setBusyAction,
      setError,
      setLinkNodeQuery,
      setLinkTargetNodeId,
      userUid,
    ]
  );

  return { linkCrossRefToNode };
}
