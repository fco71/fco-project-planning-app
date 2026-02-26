import { useCallback } from "react";
import type { Dispatch, MouseEvent as ReactMouseEvent, MutableRefObject, SetStateAction } from "react";
import type { Firestore } from "firebase/firestore";
import type { Node, ReactFlowInstance } from "reactflow";
import type { TreeNode } from "../types/planner";
import type { HistoryEntry } from "./useUndoRedo";
import {
  buildMoveOps,
  buildMovedEntries,
  buildPositionNodeUpdates,
  buildReparentOps,
  buildReparentNodeUpdates,
  computeCollapsedDescendantMoves,
  pickNodeDropTarget,
} from "./plannerDragHelpers";
import { persistNodeFirestoreUpdates } from "./plannerDragPersistence";

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
      const intersectingIds = rfInstance
        .getIntersectingNodes(node)
        .filter((candidate) => !candidate.id.startsWith("portal:"))
        .map((candidate) => candidate.id);
      dropTargetIdRef.current = pickNodeDropTarget(intersectingIds, forbiddenIds, currentParentId);
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
      const descendantMoves = computeCollapsedDescendantMoves({
        nodeId: node.id,
        deltaX,
        deltaY,
        collapsedNodeIds,
        collectNodeDescendants,
        nodesById,
      });

      if (capturedDropTarget) {
        if (prevNode && prevNode.id !== rootNodeId) {
          const oldParentId = prevNode.parentId;
          const newParentId = capturedDropTarget;
          const newParentTitle = nodesById.get(newParentId)?.title ?? newParentId;
          const { forwardLocal, forwardFirestore, inverseLocal, inverseFirestore } = buildReparentOps({
            nodeId: node.id,
            oldParentId,
            newParentId,
            oldX,
            oldY,
            newX,
            newY,
            descendantMoves,
          });
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
            await persistNodeFirestoreUpdates({
              firestore,
              userUid,
              updates: buildReparentNodeUpdates({
                nodeId: node.id,
                newParentId,
                newX,
                newY,
                descendantMoves,
              }),
            });
          } catch (actionError: unknown) {
            showSaveError();
            setError(actionError instanceof Error ? actionError.message : "Could not re-parent node.");
          }
          return;
        }
      }

      const movedEntries = buildMovedEntries({
        nodeId: node.id,
        nodeTitle: prevNode.title,
        oldX,
        oldY,
        newX,
        newY,
        descendantMoves,
        nodesById,
      });
      if (movedEntries.length > 0) {
        const moveOps = buildMoveOps(movedEntries);
        pushHistory({
          id: crypto.randomUUID(),
          label:
            movedEntries.length === 1
              ? `Move "${movedEntries[0].title}"`
              : `Move "${prevNode.title || node.id}" subtree`,
          ...moveOps,
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
        await persistNodeFirestoreUpdates({
          firestore,
          userUid,
          updates: buildPositionNodeUpdates(movedEntries),
        });
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
