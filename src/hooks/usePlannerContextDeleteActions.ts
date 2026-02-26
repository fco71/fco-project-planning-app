import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { deleteField, doc, serverTimestamp, writeBatch, type Firestore } from "firebase/firestore";
import type { CrossRef, TreeNode } from "../types/planner";
import { collectDescendants } from "../utils/treeUtils";
import type { FirestoreOp, HistoryEntry, LocalOp } from "./useUndoRedo";
import { firestoreDeleteField } from "./useUndoRedo";

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
      const affectedRefs = refs.filter((ref) => ref.nodeIds.some((id) => idSet.has(id)));

      const fwdLocalNodes: LocalOp[] = [{ target: "nodes", op: "remove", nodeIds: ids }];
      const fwdFirestoreNodes: FirestoreOp[] = ids.map((id) => ({ kind: "deleteNode" as const, nodeId: id }));
      const fwdLocalRefs: LocalOp[] = [];
      const fwdFirestoreRefs: FirestoreOp[] = [];
      const invLocalRefs: LocalOp[] = [];
      const invFirestoreRefs: FirestoreOp[] = [];

      affectedRefs.forEach((ref) => {
        const keep = ref.nodeIds.filter((id) => !idSet.has(id));
        if (keep.length === 0) {
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
          const nextAnchorNodeId = chooseAnchorNodeId(keep, ref.anchorNodeId);
          const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
          const nextPortalPosition = resolvePortalFollowPosition(ref, nextAnchorPosition, `${ref.id}:context-delete`);
          fwdLocalRefs.push({
            target: "refs",
            op: "patch",
            refId: ref.id,
            patch: { nodeIds: keep, anchorNodeId: nextAnchorNodeId, portalX: nextPortalPosition.x, portalY: nextPortalPosition.y },
          });
          fwdFirestoreRefs.push({
            kind: "updateRef",
            refId: ref.id,
            data: {
              nodeIds: keep,
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
            patch: { nodeIds: ref.nodeIds, anchorNodeId: ref.anchorNodeId, portalX: ref.portalX, portalY: ref.portalY },
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
        refs.forEach((ref) => {
          const keep = ref.nodeIds.filter((id) => !idSet.has(id));
          if (keep.length !== ref.nodeIds.length) {
            if (keep.length === 0) {
              batch.delete(doc(firestore, "users", userUid, "crossRefs", ref.id));
            } else {
              const nextAnchorNodeId = chooseAnchorNodeId(keep, ref.anchorNodeId);
              const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
              const nextPortalPosition = resolvePortalFollowPosition(ref, nextAnchorPosition, `${ref.id}:context-delete`);
              batch.update(doc(firestore, "users", userUid, "crossRefs", ref.id), {
                nodeIds: keep,
                anchorNodeId: nextAnchorNodeId ?? deleteField(),
                portalX: nextPortalPosition.x,
                portalY: nextPortalPosition.y,
                portalAnchorX: nextAnchorPosition?.x ?? deleteField(),
                portalAnchorY: nextAnchorPosition?.y ?? deleteField(),
                updatedAt: serverTimestamp(),
              });
            }
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
