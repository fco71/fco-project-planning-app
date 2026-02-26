import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Firestore } from "firebase/firestore";
import type { ReactFlowInstance } from "reactflow";
import type { TreeNode } from "../types/planner";
import type { HistoryEntry } from "./useUndoRedo";
import { collectDescendants } from "../utils/treeUtils";
import { usePlannerNodeDragActions } from "./usePlannerNodeDragActions";
import { usePlannerSelectionDragActions } from "./usePlannerSelectionDragActions";

type UsePlannerDragActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  rfInstance: ReactFlowInstance | null;
  childrenByParent: Map<string | null, string[]>;
  nodesById: Map<string, TreeNode>;
  collapsedNodeIds: Set<string>;
  rootNodeId: string | null;
  pushHistory: (entry: HistoryEntry) => void;
  setNodes: Dispatch<SetStateAction<TreeNode[]>>;
  setDropTargetNodeId: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  showSaveError: () => void;
  isDraggingRef: MutableRefObject<boolean>;
  draggedNodeIdRef: MutableRefObject<string | null>;
  dropTargetIdRef: MutableRefObject<string | null>;
};

export function usePlannerDragActions({
  firestore,
  userUid,
  rfInstance,
  childrenByParent,
  nodesById,
  collapsedNodeIds,
  rootNodeId,
  pushHistory,
  setNodes,
  setDropTargetNodeId,
  setError,
  showSaveError,
  isDraggingRef,
  draggedNodeIdRef,
  dropTargetIdRef,
}: UsePlannerDragActionsParams) {
  const collectNodeDescendants = useCallback(
    (nodeId: string) => collectDescendants(nodeId, childrenByParent as unknown as Map<string, string[]>),
    [childrenByParent]
  );

  const { onNodeDrag, onNodeDragStop } = usePlannerNodeDragActions({
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
  });

  const { onSelectionDragStop } = usePlannerSelectionDragActions({
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
  });

  return {
    onNodeDrag,
    onNodeDragStop,
    onSelectionDragStop,
  };
}
