import { useCallback } from "react";
import type { Dispatch, MouseEvent as ReactMouseEvent, MutableRefObject, SetStateAction } from "react";
import { doc, serverTimestamp, writeBatch, type Firestore } from "firebase/firestore";
import type { Node, ReactFlowInstance } from "reactflow";
import type { TreeNode } from "../types/planner";
import type { FirestoreOp, HistoryEntry, LocalOp } from "./useUndoRedo";

type UsePlannerNodeDragActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  rfInstance: ReactFlowInstance | null;
  nodesById: Map<string, TreeNode>;
  collapsedNodeIds: Set<string>;
  rootNodeId: string | null;
  collectNodeDescendants: (nodeId: string) => string[];
  pushHistory: (entry: HistoryEntry) => void;
  setNodes: Dispatch<SetStateAction<TreeNode[]>>;
  setDropTargetNodeId: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  showSaveError: () => void;
  isDraggingRef: MutableRefObject<boolean>;
  draggedNodeIdRef: MutableRefObject<string | null>;
  dropTargetIdRef: MutableRefObject<string | null>;
};

export function usePlannerNodeDragActions({
  firestore,
  userUid,
  rfInstance,
  nodesById,
  collapsedNodeIds,
  rootNodeId,
  collectNodeDescendants,
  pushHistory,
  setNodes,
  setDropTargetNodeId,
  setError,
  showSaveError,
  isDraggingRef,
  draggedNodeIdRef,
  dropTargetIdRef,
}: UsePlannerNodeDragActionsParams) {
  const onNodeDrag = useCallback(
    (_: ReactMouseEvent, node: Node) => {
      isDraggingRef.current = true;
      if (node.id.startsWith("portal:")) {
        dropTargetIdRef.current = null;
        return;
      }
      const selectedCount = rfInstance?.getNodes().filter((n) => n.selected && !n.id.startsWith("portal:")).length ?? 0;
      if (selectedCount > 1) {
        draggedNodeIdRef.current = null;
        dropTargetIdRef.current = null;
        return;
      }
      draggedNodeIdRef.current = node.id;
      if (!rfInstance) {
        dropTargetIdRef.current = null;
        return;
      }
      const forbiddenIds = new Set(collectNodeDescendants(node.id));
      const currentParentId = nodesById.get(node.id)?.parentId ?? null;
      const intersecting = rfInstance.getIntersectingNodes(node).filter((c) => !c.id.startsWith("portal:"));
      let bestTarget: string | null = null;
      for (const candidate of intersecting) {
        if (forbiddenIds.has(candidate.id)) continue;
        if (candidate.id === currentParentId) continue;
        bestTarget = candidate.id;
        break;
      }
      dropTargetIdRef.current = bestTarget;
    },
    [collectNodeDescendants, dropTargetIdRef, draggedNodeIdRef, isDraggingRef, nodesById, rfInstance]
  );

  const onNodeDragStop = useCallback(
    async (_: ReactMouseEvent, node: Node) => {
      isDraggingRef.current = false;
      if (!firestore) return;

      if (node.id.startsWith("portal:")) return;

      draggedNodeIdRef.current = null;
      const capturedDropTarget = dropTargetIdRef.current;
      dropTargetIdRef.current = null;
      setDropTargetNodeId(null);

      const prevNode = nodesById.get(node.id);
      if (!prevNode) return;
      const oldX = typeof prevNode.x === "number" ? prevNode.x : 0;
      const oldY = typeof prevNode.y === "number" ? prevNode.y : 0;
      const newX = node.position.x;
      const newY = node.position.y;
      const deltaX = newX - oldX;
      const deltaY = newY - oldY;
      const shouldMoveCollapsedDescendants = collapsedNodeIds.has(node.id) && (deltaX !== 0 || deltaY !== 0);
      const descendantMoves = shouldMoveCollapsedDescendants
        ? collectNodeDescendants(node.id)
            .slice(1)
            .map((descendantId) => {
              const descendant = nodesById.get(descendantId);
              if (!descendant) return null;
              const descendantOldX = typeof descendant.x === "number" ? descendant.x : 0;
              const descendantOldY = typeof descendant.y === "number" ? descendant.y : 0;
              return {
                id: descendantId,
                oldX: descendantOldX,
                oldY: descendantOldY,
                newX: descendantOldX + deltaX,
                newY: descendantOldY + deltaY,
              };
            })
            .filter((entry): entry is { id: string; oldX: number; oldY: number; newX: number; newY: number } => !!entry)
        : [];

      if (capturedDropTarget) {
        if (prevNode && prevNode.id !== rootNodeId) {
          const oldParentId = prevNode.parentId;
          const newParentId = capturedDropTarget;
          const newParentTitle = nodesById.get(newParentId)?.title ?? newParentId;
          const forwardLocal: LocalOp[] = [
            { target: "nodes", op: "patch", nodeId: node.id, patch: { parentId: newParentId, x: newX, y: newY } },
            ...descendantMoves.map(
              (entry): LocalOp => ({ target: "nodes", op: "patch", nodeId: entry.id, patch: { x: entry.newX, y: entry.newY } })
            ),
          ];
          const inverseLocal: LocalOp[] = [
            { target: "nodes", op: "patch", nodeId: node.id, patch: { parentId: oldParentId, x: oldX, y: oldY } },
            ...descendantMoves.map(
              (entry): LocalOp => ({ target: "nodes", op: "patch", nodeId: entry.id, patch: { x: entry.oldX, y: entry.oldY } })
            ),
          ];
          const forwardFirestore: FirestoreOp[] = [
            { kind: "updateNode", nodeId: node.id, data: { parentId: newParentId, x: newX, y: newY } },
            ...descendantMoves.map(
              (entry): FirestoreOp => ({ kind: "updateNode", nodeId: entry.id, data: { x: entry.newX, y: entry.newY } })
            ),
          ];
          const inverseFirestore: FirestoreOp[] = [
            { kind: "updateNode", nodeId: node.id, data: { parentId: oldParentId, x: oldX, y: oldY } },
            ...descendantMoves.map(
              (entry): FirestoreOp => ({ kind: "updateNode", nodeId: entry.id, data: { x: entry.oldX, y: entry.oldY } })
            ),
          ];
          pushHistory({
            id: crypto.randomUUID(),
            label: `Re-parent "${prevNode.title}" \u2192 "${newParentTitle}"`,
            forwardLocal,
            forwardFirestore,
            inverseLocal,
            inverseFirestore,
          });
          setNodes((previous) =>
            previous.map((entry) => {
              if (entry.id === node.id) return { ...entry, parentId: newParentId, x: newX, y: newY };
              const descendantMove = descendantMoves.find((move) => move.id === entry.id);
              if (!descendantMove) return entry;
              return { ...entry, x: descendantMove.newX, y: descendantMove.newY };
            })
          );
          try {
            const batch = writeBatch(firestore);
            batch.update(doc(firestore, "users", userUid, "nodes", node.id), {
              parentId: newParentId,
              x: newX,
              y: newY,
              updatedAt: serverTimestamp(),
            });
            descendantMoves.forEach((entry) => {
              batch.update(doc(firestore, "users", userUid, "nodes", entry.id), {
                x: entry.newX,
                y: entry.newY,
                updatedAt: serverTimestamp(),
              });
            });
            await batch.commit();
          } catch (actionError: unknown) {
            showSaveError();
            setError(actionError instanceof Error ? actionError.message : "Could not re-parent node.");
          }
          return;
        }
      }

      const movedEntries = [
        { id: node.id, title: prevNode.title || node.id, oldX, oldY, newX, newY },
        ...descendantMoves.map((entry) => ({
          id: entry.id,
          title: nodesById.get(entry.id)?.title || entry.id,
          oldX: entry.oldX,
          oldY: entry.oldY,
          newX: entry.newX,
          newY: entry.newY,
        })),
      ].filter((entry) => entry.oldX !== entry.newX || entry.oldY !== entry.newY);
      if (movedEntries.length > 0) {
        pushHistory({
          id: crypto.randomUUID(),
          label:
            movedEntries.length === 1
              ? `Move "${movedEntries[0].title}"`
              : `Move "${prevNode.title || node.id}" subtree`,
          forwardLocal: movedEntries.map(
            (entry): LocalOp => ({ target: "nodes", op: "patch", nodeId: entry.id, patch: { x: entry.newX, y: entry.newY } })
          ),
          forwardFirestore: movedEntries.map(
            (entry): FirestoreOp => ({ kind: "updateNode", nodeId: entry.id, data: { x: entry.newX, y: entry.newY } })
          ),
          inverseLocal: movedEntries.map(
            (entry): LocalOp => ({ target: "nodes", op: "patch", nodeId: entry.id, patch: { x: entry.oldX, y: entry.oldY } })
          ),
          inverseFirestore: movedEntries.map(
            (entry): FirestoreOp => ({ kind: "updateNode", nodeId: entry.id, data: { x: entry.oldX, y: entry.oldY } })
          ),
        });
      }
      const movedMap = new Map(movedEntries.map((entry) => [entry.id, { x: entry.newX, y: entry.newY }] as const));
      if (movedMap.size > 0) {
        setNodes((previous) =>
          previous.map((entry) => {
            const next = movedMap.get(entry.id);
            return next ? { ...entry, x: next.x, y: next.y } : entry;
          })
        );
      }
      try {
        if (movedEntries.length > 0) {
          const batch = writeBatch(firestore);
          movedEntries.forEach((entry) => {
            batch.update(doc(firestore, "users", userUid, "nodes", entry.id), {
              x: entry.newX,
              y: entry.newY,
              updatedAt: serverTimestamp(),
            });
          });
          await batch.commit();
        }
      } catch (actionError: unknown) {
        showSaveError();
        setError(actionError instanceof Error ? actionError.message : "Could not save node position.");
      }
    },
    [
      collectNodeDescendants,
      collapsedNodeIds,
      draggedNodeIdRef,
      dropTargetIdRef,
      firestore,
      isDraggingRef,
      nodesById,
      pushHistory,
      rootNodeId,
      setDropTargetNodeId,
      setError,
      setNodes,
      showSaveError,
      userUid,
    ]
  );

  return {
    onNodeDrag,
    onNodeDragStop,
  };
}
