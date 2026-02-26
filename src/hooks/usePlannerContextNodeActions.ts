import type { Dispatch, SetStateAction } from "react";
import type { Firestore } from "firebase/firestore";
import type { NodeKind, TaskStatus, TreeNode, CrossRef } from "../types/planner";
import type { HistoryEntry } from "./useUndoRedo";
import { usePlannerContextCreateActions } from "./usePlannerContextCreateActions";
import { usePlannerContextDeleteActions } from "./usePlannerContextDeleteActions";
import { usePlannerContextMutationActions } from "./usePlannerContextMutationActions";

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
  const {
    handleContextAddChild,
    handleContextAddStorySibling,
    handleContextDuplicate,
  } = usePlannerContextCreateActions({
    firestore,
    userUid,
    childrenByParent,
    nodesById,
    newNodeDocId,
    pushHistory,
    resolveNodePosition,
    setBusyAction,
    setError,
    setPendingSelectedNodeId,
    setPendingRenameNodeId,
  });

  const { handleContextDelete } = usePlannerContextDeleteActions({
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
  });

  const {
    handleContextChangeType,
    handleContextToggleTaskStatus,
  } = usePlannerContextMutationActions({
    firestore,
    userUid,
    nodesById,
    nextNodeKind,
    pushHistory,
    applyLocalNodePatch,
    setNodeTaskStatus,
    setBusyAction,
    setError,
    setSelectedNodeId,
    setActivePortalRefId,
  });

  return {
    handleContextAddChild,
    handleContextAddStorySibling,
    handleContextDelete,
    handleContextDuplicate,
    handleContextChangeType,
    handleContextToggleTaskStatus,
  };
}
