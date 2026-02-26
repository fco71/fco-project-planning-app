import { useCallback } from "react";
import type { Dispatch, MouseEvent as ReactMouseEvent, MutableRefObject, SetStateAction } from "react";
import { doc, serverTimestamp, writeBatch, type Firestore } from "firebase/firestore";
import type { Node } from "reactflow";
import type { TreeNode } from "../types/planner";
import type { FirestoreOp, HistoryEntry, LocalOp } from "./useUndoRedo";

type UsePlannerSelectionDragActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  nodesById: Map<string, TreeNode>;
  collapsedNodeIds: Set<string>;
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

export function usePlannerSelectionDragActions({
  firestore,
  userUid,
  nodesById,
  collapsedNodeIds,
  collectNodeDescendants,
  pushHistory,
  setNodes,
  setDropTargetNodeId,
  setError,
  showSaveError,
  isDraggingRef,
  draggedNodeIdRef,
  dropTargetIdRef,
}: UsePlannerSelectionDragActionsParams) {
  const onSelectionDragStop = useCallback(
    async (_: ReactMouseEvent, draggedNodes: Node[]) => {
      isDraggingRef.current = false;
      if (!firestore) return;

      draggedNodeIdRef.current = null;
      dropTargetIdRef.current = null;
      setDropTargetNodeId(null);

      const movedTreeNodes = draggedNodes.filter((n) => !n.id.startsWith("portal:"));
      if (movedTreeNodes.length === 0) return;
      const movedTreePositions = new Map(movedTreeNodes.map((entry) => [entry.id, entry.position] as const));
      const extraCollapsedPositions = new Map<string, { x: number; y: number }>();
      movedTreeNodes.forEach((entry) => {
        if (!collapsedNodeIds.has(entry.id)) return;
        const previous = nodesById.get(entry.id);
        if (!previous) return;
        const previousX = typeof previous.x === "number" ? previous.x : entry.position.x;
        const previousY = typeof previous.y === "number" ? previous.y : entry.position.y;
        const deltaX = entry.position.x - previousX;
        const deltaY = entry.position.y - previousY;
        if (deltaX === 0 && deltaY === 0) return;
        const descendants = collectNodeDescendants(entry.id).slice(1);
        descendants.forEach((descendantId) => {
          if (movedTreePositions.has(descendantId) || extraCollapsedPositions.has(descendantId)) return;
          const descendant = nodesById.get(descendantId);
          if (!descendant) return;
          const descendantX = typeof descendant.x === "number" ? descendant.x : 0;
          const descendantY = typeof descendant.y === "number" ? descendant.y : 0;
          extraCollapsedPositions.set(descendantId, { x: descendantX + deltaX, y: descendantY + deltaY });
        });
      });
      const allMovedPositions = new Map([...movedTreePositions, ...extraCollapsedPositions]);
      const movedEntries = Array.from(allMovedPositions.entries())
        .map(([id, position]) => {
          const previous = nodesById.get(id);
          if (!previous) return null;
          const oldX = typeof previous.x === "number" ? previous.x : 0;
          const oldY = typeof previous.y === "number" ? previous.y : 0;
          if (oldX === position.x && oldY === position.y) return null;
          return {
            id,
            title: previous.title || id,
            oldX,
            oldY,
            newX: position.x,
            newY: position.y,
          };
        })
        .filter(
          (entry): entry is { id: string; title: string; oldX: number; oldY: number; newX: number; newY: number } =>
            !!entry
        );
      if (movedEntries.length === 0) return;

      pushHistory({
        id: crypto.randomUUID(),
        label: movedEntries.length === 1 ? `Move "${movedEntries[0].title}"` : `Move ${movedEntries.length} nodes`,
        forwardLocal: movedEntries.map(
          (entry): LocalOp => ({
            target: "nodes",
            op: "patch",
            nodeId: entry.id,
            patch: { x: entry.newX, y: entry.newY },
          })
        ),
        forwardFirestore: movedEntries.map(
          (entry): FirestoreOp => ({
            kind: "updateNode",
            nodeId: entry.id,
            data: { x: entry.newX, y: entry.newY },
          })
        ),
        inverseLocal: movedEntries.map(
          (entry): LocalOp => ({
            target: "nodes",
            op: "patch",
            nodeId: entry.id,
            patch: { x: entry.oldX, y: entry.oldY },
          })
        ),
        inverseFirestore: movedEntries.map(
          (entry): FirestoreOp => ({
            kind: "updateNode",
            nodeId: entry.id,
            data: { x: entry.oldX, y: entry.oldY },
          })
        ),
      });

      if (allMovedPositions.size > 0) {
        setNodes((previous) =>
          previous.map((entry) => {
            const next = allMovedPositions.get(entry.id);
            return next ? { ...entry, x: next.x, y: next.y } : entry;
          })
        );
      }
      try {
        let batch = writeBatch(firestore);
        let count = 0;
        for (const entry of movedEntries) {
          batch.update(doc(firestore, "users", userUid, "nodes", entry.id), {
            x: entry.newX,
            y: entry.newY,
            updatedAt: serverTimestamp(),
          });
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
      } catch (actionError: unknown) {
        showSaveError();
        setError(actionError instanceof Error ? actionError.message : "Could not save node positions.");
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
      setDropTargetNodeId,
      setError,
      setNodes,
      showSaveError,
      userUid,
    ]
  );

  return {
    onSelectionDragStop,
  };
}
