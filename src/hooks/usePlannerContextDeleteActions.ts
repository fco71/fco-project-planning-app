import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { deleteField, doc, serverTimestamp, writeBatch, type Firestore } from "firebase/firestore";
import type { CrossRef, TreeNode } from "../types/planner";
import { collectDescendants } from "../utils/treeUtils";
import type { FirestoreOp, HistoryEntry, LocalOp } from "./useUndoRedo";
import {
  buildRefDeleteHistoryOps,
  buildRefDeletePlans,
  getRefDeleteImpacts,
  toNodeFirestoreSetData,
} from "./plannerDeleteHelpers";

type ResolveNodePosition = (nodeId: string) => { x: number; y: number };
type ChooseAnchorNodeId = (nodeIds: string[], ...preferredIds: Array<string | null | undefined>) => string | null;
type ResolvePortalFollowPosition = (
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: { x: number; y: number } | null,
  seed: string
) => { x: number; y: number };

type UsePlannerContextDeleteActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  rootNodeId: string | null;
  currentRootId: string | null;
  selectedNodeId: string | null;
  childrenByParent: Map<string, string[]>;
  nodesById: Map<string, TreeNode>;
  refs: CrossRef[];
  pushHistory: (entry: HistoryEntry) => void;
  resolveNodePosition: ResolveNodePosition;
  chooseAnchorNodeId: ChooseAnchorNodeId;
  resolvePortalFollowPosition: ResolvePortalFollowPosition;
  crossRefToFirestoreSetData: (ref: CrossRef) => Record<string, unknown>;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setCurrentRootId: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
};

export function usePlannerContextDeleteActions({
  firestore,
  userUid,
  rootNodeId,
  currentRootId,
  selectedNodeId,
  childrenByParent,
  nodesById,
  refs,
  pushHistory,
  resolveNodePosition,
  chooseAnchorNodeId,
  resolvePortalFollowPosition,
  crossRefToFirestoreSetData,
  setBusyAction,
  setError,
  setCurrentRootId,
  setSelectedNodeId,
  setActivePortalRefId,
}: UsePlannerContextDeleteActionsParams) {
  const handleContextDelete = useCallback(
    async (nodeId: string) => {
      if (!firestore || nodeId === rootNodeId) return;
      const ids = collectDescendants(nodeId, childrenByParent);
      const idSet = new Set(ids);
      const fallbackId = nodesById.get(nodeId)?.parentId || rootNodeId || null;

      const deletedNodes = ids.map((id) => nodesById.get(id)).filter(Boolean) as TreeNode[];
      const refDeleteImpacts = getRefDeleteImpacts(refs, idSet);
      const refDeletePlans = buildRefDeletePlans({
        impacts: refDeleteImpacts,
        chooseAnchorNodeId,
        resolveNodePosition,
        resolvePortalFollowPosition,
      });

      const fwdLocalNodes: LocalOp[] = [{ target: "nodes", op: "remove", nodeIds: ids }];
      const fwdFirestoreNodes: FirestoreOp[] = ids.map((id) => ({ kind: "deleteNode" as const, nodeId: id }));
      const { fwdLocalRefs, fwdFirestoreRefs, invLocalRefs, invFirestoreRefs } = buildRefDeleteHistoryOps({
        plans: refDeletePlans,
        crossRefToFirestoreSetData,
      });

      const deletedTitle = nodesById.get(nodeId)?.title ?? nodeId;
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
          ...deletedNodes.map(
            (n): FirestoreOp => ({
              kind: "setNode",
              nodeId: n.id,
              data: toNodeFirestoreSetData(n),
            })
          ),
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
        refDeletePlans.forEach((plan) => {
          const { ref, keepNodeIds, removeCompletely } = plan;
          if (removeCompletely) {
            batch.delete(doc(firestore, "users", userUid, "crossRefs", ref.id));
          } else {
            const nextPortalPosition = plan.nextPortalPosition as { x: number; y: number };
            batch.update(doc(firestore, "users", userUid, "crossRefs", ref.id), {
              nodeIds: keepNodeIds,
              anchorNodeId: plan.nextAnchorNodeId ?? deleteField(),
              portalX: nextPortalPosition.x,
              portalY: nextPortalPosition.y,
              portalAnchorX: plan.nextAnchorPosition?.x ?? deleteField(),
              portalAnchorY: plan.nextAnchorPosition?.y ?? deleteField(),
              updatedAt: serverTimestamp(),
            });
          }
        });
        await batch.commit();
        if (currentRootId && idSet.has(currentRootId)) {
          setCurrentRootId(fallbackId);
        }
        if (selectedNodeId === nodeId || idSet.has(selectedNodeId || "")) {
          setSelectedNodeId(fallbackId);
        }
        setActivePortalRefId(null);
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not delete node.");
      } finally {
        setBusyAction(false);
      }
    },
    [
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
    ]
  );

  return { handleContextDelete };
}
