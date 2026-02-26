import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Firestore } from "firebase/firestore";
import type { CrossRef, NodeKind, TaskStatus, TreeNode } from "../types/planner";
import type { HistoryEntry } from "./useUndoRedo";
import { usePlannerContextNodeActions } from "./usePlannerContextNodeActions";
import { usePlannerContextUiActions } from "./usePlannerContextUiActions";

type ResolveNodePosition = (nodeId: string) => { x: number; y: number };
type ChooseAnchorNodeId = (nodeIds: string[], ...preferredIds: Array<string | null | undefined>) => string | null;
type ResolvePortalFollowPosition = (
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: { x: number; y: number } | null,
  seed: string
) => { x: number; y: number };

type MobileSidebarSection = "project" | "node" | "bubbles";

type UsePlannerContextActionsParams = {
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
  crossReferencesEnabled: boolean;
  isMobileLayout: boolean;
  newRefCode: string;
  newRefColor: string;
  nextAutoBubbleCode: string;
  defaultBubbleColor: string;
  renameInputRef: MutableRefObject<HTMLInputElement | null>;
  openBubblesPanel: (focusInput?: boolean) => void;
  openMobileQuickBubble: (nodeId?: string, focusInput?: boolean) => void;
  hydrateRefEditor: (ref: CrossRef | null) => void;
  setNewRefLabel: Dispatch<SetStateAction<string>>;
  setNewRefCode: Dispatch<SetStateAction<string>>;
  setNewRefColor: Dispatch<SetStateAction<string>>;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  setMobileSidebarSection: Dispatch<SetStateAction<MobileSidebarSection>>;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setLinkNodeQuery: Dispatch<SetStateAction<string>>;
  setLinkTargetNodeId: Dispatch<SetStateAction<string>>;
};

export function usePlannerContextActions({
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
  crossReferencesEnabled,
  isMobileLayout,
  newRefCode,
  newRefColor,
  nextAutoBubbleCode,
  defaultBubbleColor,
  renameInputRef,
  openBubblesPanel,
  openMobileQuickBubble,
  hydrateRefEditor,
  setNewRefLabel,
  setNewRefCode,
  setNewRefColor,
  setSidebarCollapsed,
  setMobileSidebarSection,
  setMobileSidebarOpen,
  setLinkNodeQuery,
  setLinkTargetNodeId,
}: UsePlannerContextActionsParams) {
  const nodeActions = usePlannerContextNodeActions({
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
  });

  const uiActions = usePlannerContextUiActions({
    crossReferencesEnabled,
    isMobileLayout,
    newRefCode,
    newRefColor,
    nextAutoBubbleCode,
    defaultBubbleColor,
    nodesById,
    refs,
    renameInputRef,
    openBubblesPanel,
    openMobileQuickBubble,
    hydrateRefEditor,
    setSelectedNodeId,
    setActivePortalRefId,
    setNewRefLabel,
    setNewRefCode,
    setNewRefColor,
    setSidebarCollapsed,
    setMobileSidebarSection,
    setMobileSidebarOpen,
    setLinkNodeQuery,
    setLinkTargetNodeId,
  });

  return {
    ...nodeActions,
    ...uiActions,
  };
}
