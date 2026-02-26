import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { collection, deleteField, doc, serverTimestamp, setDoc, updateDoc, writeBatch, type Firestore } from "firebase/firestore";
import type { NodeKind, TaskStatus, TreeNode, TreeNodeDoc, CrossRef } from "../types/planner";
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

type UsePlannerContextNodeActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  rootNodeId: string | null;
  currentRootId: string | null;
  selectedNodeId: string | null;
  childrenByParent: Map<string, string[]>;
  nodesById: Map<string, TreeNode>;
  refs: CrossRef[];
  newNodeDocId: () => string;
  pushHistory: (entry: HistoryEntry) => void;
  resolveNodePosition: ResolveNodePosition;
  chooseAnchorNodeId: ChooseAnchorNodeId;
  resolvePortalFollowPosition: ResolvePortalFollowPosition;
  crossRefToFirestoreSetData: (ref: CrossRef) => Record<string, unknown>;
  nextNodeKind: (kind: NodeKind) => NodeKind;
  applyLocalNodePatch: (nodeId: string, patch: Partial<TreeNode>) => void;
  setNodeTaskStatus: (nodeId: string, status: TaskStatus) => Promise<void>;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setCurrentRootId: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  setPendingSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setPendingRenameNodeId: Dispatch<SetStateAction<string | null>>;
};

export function usePlannerContextNodeActions({
  firestore,
  userUid,
  rootNodeId,
  currentRootId,
  selectedNodeId,
  childrenByParent,
  nodesById,
  refs,
  newNodeDocId,
  pushHistory,
  resolveNodePosition,
  chooseAnchorNodeId,
  resolvePortalFollowPosition,
  crossRefToFirestoreSetData,
  nextNodeKind,
  applyLocalNodePatch,
  setNodeTaskStatus,
  setBusyAction,
  setError,
  setCurrentRootId,
  setSelectedNodeId,
  setActivePortalRefId,
  setPendingSelectedNodeId,
  setPendingRenameNodeId,
}: UsePlannerContextNodeActionsParams) {
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
    handleContextAddChild,
    handleContextAddStorySibling,
    handleContextDelete,
    handleContextDuplicate,
    handleContextChangeType,
    handleContextToggleTaskStatus,
  };
}
