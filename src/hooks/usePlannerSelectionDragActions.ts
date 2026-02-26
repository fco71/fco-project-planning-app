import { useCallback } from "react";
import type { Dispatch, MouseEvent as ReactMouseEvent, MutableRefObject, SetStateAction } from "react";
import type { Firestore } from "firebase/firestore";
import type { Node } from "reactflow";
import type { TreeNode } from "../types/planner";
import type { HistoryEntry } from "./useUndoRedo";
import {
  buildMoveEntriesFromPositionMap,
  buildMoveOps,
  buildPositionNodeUpdates,
  buildSelectionMovedPositionMap,
} from "./plannerDragHelpers";
import { persistNodeFirestoreUpdates } from "./plannerDragPersistence";

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
      const allMovedPositions = buildSelectionMovedPositionMap({
        movedTreeNodes,
        collapsedNodeIds,
        nodesById,
        collectNodeDescendants,
      });
      const movedEntries = buildMoveEntriesFromPositionMap(allMovedPositions, nodesById);
      if (movedEntries.length === 0) return;
      const moveOps = buildMoveOps(movedEntries);

      pushHistory({
        id: crypto.randomUUID(),
        label: movedEntries.length === 1 ? `Move "${movedEntries[0].title}"` : `Move ${movedEntries.length} nodes`,
        ...moveOps,
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
        await persistNodeFirestoreUpdates({
          firestore,
          userUid,
          updates: buildPositionNodeUpdates(movedEntries),
        });
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
