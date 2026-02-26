import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { deleteField, doc, serverTimestamp, writeBatch, type Firestore } from "firebase/firestore";
import type { CrossRef, TreeNode } from "../types/planner";

type ResolveNodePosition = (nodeId: string) => { x: number; y: number };
type ChooseAnchorNodeId = (nodeIds: string[], ...preferredIds: Array<string | null | undefined>) => string | null;
type ResolvePortalFollowPosition = (
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: { x: number; y: number } | null,
  seed: string
) => { x: number; y: number };

type UseCrossRefMaintenanceActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  refs: CrossRef[];
  nodesById: Map<string, TreeNode>;
  activePortalRefId: string | null;
  editRefId: string | null;
  resolveNodePosition: ResolveNodePosition;
  chooseAnchorNodeId: ChooseAnchorNodeId;
  resolvePortalFollowPosition: ResolvePortalFollowPosition;
  hydrateRefEditor: (ref: CrossRef | null) => void;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
};

export function useCrossRefMaintenanceActions({
  firestore,
  userUid,
  refs,
  nodesById,
  activePortalRefId,
  editRefId,
  resolveNodePosition,
  chooseAnchorNodeId,
  resolvePortalFollowPosition,
  hydrateRefEditor,
  setActivePortalRefId,
  setBusyAction,
  setError,
}: UseCrossRefMaintenanceActionsParams) {
  const cleanUpCrossRefs = useCallback(async () => {
    if (!firestore) return;
    const operations = refs
      .map((ref) => {
        const cleanedNodeIds = Array.from(new Set(ref.nodeIds.filter((id) => nodesById.has(id))));
        if (cleanedNodeIds.length === 0) {
          return { type: "delete" as const, refId: ref.id };
        }
        const cleanedAnchorNodeId = chooseAnchorNodeId(cleanedNodeIds, ref.anchorNodeId);
        const cleanedAnchorPosition = cleanedAnchorNodeId ? resolveNodePosition(cleanedAnchorNodeId) : null;
        const cleanedPortalPosition = resolvePortalFollowPosition(ref, cleanedAnchorPosition, `${ref.id}:cleanup`);
        const unchanged =
          cleanedNodeIds.length === ref.nodeIds.length &&
          cleanedNodeIds.every((id, index) => id === ref.nodeIds[index]) &&
          cleanedAnchorNodeId === (ref.anchorNodeId || null);
        if (unchanged) return null;
        return {
          type: "update" as const,
          refId: ref.id,
          nodeIds: cleanedNodeIds,
          anchorNodeId: cleanedAnchorNodeId,
          portalX: cleanedPortalPosition.x,
          portalY: cleanedPortalPosition.y,
          portalAnchorX: cleanedAnchorPosition?.x ?? null,
          portalAnchorY: cleanedAnchorPosition?.y ?? null,
        };
      })
      .filter(
        (
          entry
        ): entry is
          | {
              type: "update";
              refId: string;
              nodeIds: string[];
              anchorNodeId: string | null;
              portalX: number;
              portalY: number;
              portalAnchorX: number | null;
              portalAnchorY: number | null;
            }
          | { type: "delete"; refId: string } =>
          !!entry
      );

    if (operations.length === 0) return;

    setBusyAction(true);
    setError(null);
    try {
      let batch = writeBatch(firestore);
      let count = 0;
      for (const entry of operations) {
        const refDoc = doc(firestore, "users", userUid, "crossRefs", entry.refId);
        if (entry.type === "delete") {
          batch.delete(refDoc);
        } else {
          batch.update(refDoc, {
            nodeIds: entry.nodeIds,
            anchorNodeId: entry.anchorNodeId ?? deleteField(),
            portalX: entry.portalX,
            portalY: entry.portalY,
            portalAnchorX: entry.portalAnchorX ?? deleteField(),
            portalAnchorY: entry.portalAnchorY ?? deleteField(),
            updatedAt: serverTimestamp(),
          });
        }
        count += 1;
        if (count >= 450) {
          await batch.commit();
          batch = writeBatch(firestore);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
      if (activePortalRefId && operations.some((entry) => entry.type === "delete" && entry.refId === activePortalRefId)) {
        setActivePortalRefId(null);
      }
      if (editRefId && operations.some((entry) => entry.type === "delete" && entry.refId === editRefId)) {
        hydrateRefEditor(null);
      }
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not clean up cross-reference bubbles.");
    } finally {
      setBusyAction(false);
    }
  }, [
    activePortalRefId,
    chooseAnchorNodeId,
    editRefId,
    firestore,
    hydrateRefEditor,
    nodesById,
    refs,
    resolveNodePosition,
    resolvePortalFollowPosition,
    setActivePortalRefId,
    setBusyAction,
    setError,
    userUid,
  ]);

  return {
    cleanUpCrossRefs,
  };
}
