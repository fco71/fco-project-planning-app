import type { MutableRefObject } from "react";
import type { Firestore } from "firebase/firestore";
import type { CrossRef, TreeNode } from "../types/planner";
import type { HistoryEntry } from "./useUndoRedo";
import type { usePlannerPageState } from "./usePlannerPageState";
import type { usePlannerMutationContextBundle } from "./usePlannerMutationContextBundle";

type PlannerState = ReturnType<typeof usePlannerPageState>;
type MutationBundleParams = Parameters<typeof usePlannerMutationContextBundle>[0];

type BuildPlannerMutationBundleParamsInput = {
  firestore: Firestore | null;
  userUid: string;
  plannerState: PlannerState;
  selectedNode: TreeNode | null;
  nodesById: Map<string, TreeNode>;
  childrenByParent: Map<string, string[]>;
  refs: CrossRef[];
  newNodeDocId: () => string;
  pushHistory: (entry: HistoryEntry) => void;
  resolveNodePosition: (nodeId: string) => { x: number; y: number };
  chooseAnchorNodeId: (nodeIds: string[], ...preferredIds: Array<string | null | undefined>) => string | null;
  resolvePortalFollowPosition: (
    ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
    anchor: { x: number; y: number } | null,
    seed: string
  ) => { x: number; y: number };
  crossRefToFirestoreSetData: (ref: CrossRef) => Record<string, unknown>;
  applyLocalNodePatch: (nodeId: string, patch: Partial<TreeNode>) => void;
  hydrateRefEditor: (ref: CrossRef | null) => void;
  buildDefaultPortalPosition: (anchorNodeId: string | null, seed: string) => { x: number; y: number } | null;
  nextAutoBubbleCode: string;
  activePortalRef: CrossRef | null;
  showSaveError: () => void;
  draggedNodeIdRef: MutableRefObject<string | null>;
  crossReferencesEnabled: boolean;
  bubblesSimplifiedMode: boolean;
  defaultBubbleColor: string;
  nextNodeKind: (kind: TreeNode["kind"]) => TreeNode["kind"];
  openBubblesPanel: (focusInput?: boolean) => void;
  openMobileQuickBubble: (nodeId?: string, focusInput?: boolean) => void;
};

export function buildPlannerMutationBundleParams({
  firestore,
  userUid,
  plannerState,
  selectedNode,
  nodesById,
  childrenByParent,
  refs,
  newNodeDocId,
  pushHistory,
  resolveNodePosition,
  chooseAnchorNodeId,
  resolvePortalFollowPosition,
  crossRefToFirestoreSetData,
  applyLocalNodePatch,
  hydrateRefEditor,
  buildDefaultPortalPosition,
  nextAutoBubbleCode,
  activePortalRef,
  showSaveError,
  draggedNodeIdRef,
  crossReferencesEnabled,
  bubblesSimplifiedMode,
  defaultBubbleColor,
  nextNodeKind,
  openBubblesPanel,
  openMobileQuickBubble,
}: BuildPlannerMutationBundleParamsInput): MutationBundleParams {
  return {
    createDelete: {
      firestore,
      userUid,
      newChildTitle: plannerState.newChildTitle,
      selectedNodeId: plannerState.selectedNodeId,
      currentRootId: plannerState.currentRootId,
      rootNodeId: plannerState.rootNodeId,
      childrenByParent,
      nodesById,
      refs,
      newNodeDocId,
      resolveNodePosition,
      chooseAnchorNodeId,
      resolvePortalFollowPosition,
      crossRefToFirestoreSetData,
      pushHistory,
      setBusyAction: plannerState.setBusyAction,
      setError: plannerState.setError,
      setNewChildTitle: plannerState.setNewChildTitle,
      setPendingSelectedNodeId: plannerState.setPendingSelectedNodeId,
      setPendingRenameNodeId: plannerState.setPendingRenameNodeId,
      setCurrentRootId: plannerState.setCurrentRootId,
      setSelectedNodeId: plannerState.setSelectedNodeId,
      setActivePortalRefId: plannerState.setActivePortalRefId,
    },
    nodeMutation: {
      firestore,
      userUid,
      selectedNodeId: plannerState.selectedNodeId,
      selectedNode,
      renameTitle: plannerState.renameTitle,
      setRenameTitle: plannerState.setRenameTitle,
      newStoryStepText: plannerState.newStoryStepText,
      setNewStoryStepText: plannerState.setNewStoryStepText,
      nodesById,
      pushHistory,
      applyLocalNodePatch,
      setBusyAction: plannerState.setBusyAction,
      setError: plannerState.setError,
    },
    crossRef: {
      firestore,
      userUid,
      refs,
      nodesById,
      activePortalRefId: plannerState.activePortalRefId,
      editRefId: plannerState.editRefId,
      resolveNodePosition,
      chooseAnchorNodeId,
      resolvePortalFollowPosition,
      hydrateRefEditor,
      setActivePortalRefId: plannerState.setActivePortalRefId,
      setBusyAction: plannerState.setBusyAction,
      setError: plannerState.setError,
      selectedNodeId: plannerState.selectedNodeId,
      newRefCode: plannerState.newRefCode,
      newRefLabel: plannerState.newRefLabel,
      newRefColor: plannerState.newRefColor,
      newRefType: plannerState.newRefType,
      nextAutoBubbleCode,
      bubblesSimplifiedMode,
      defaultBubbleColor,
      newRefLabelInputRef: plannerState.newRefLabelInputRef,
      pushHistory,
      buildDefaultPortalPosition,
      setLinkNodeQuery: plannerState.setLinkNodeQuery,
      setLinkTargetNodeId: plannerState.setLinkTargetNodeId,
      setNewRefLabel: plannerState.setNewRefLabel,
      setNewRefCode: plannerState.setNewRefCode,
      setNewRefColor: plannerState.setNewRefColor,
      setNewRefType: plannerState.setNewRefType,
      setRefs: plannerState.setRefs,
      mergeFromRefId: plannerState.mergeFromRefId,
      setMergeFromRefId: plannerState.setMergeFromRefId,
      editRefLabel: plannerState.editRefLabel,
      editRefCode: plannerState.editRefCode,
      editRefType: plannerState.editRefType,
      editRefTags: plannerState.editRefTags,
      editRefNotes: plannerState.editRefNotes,
      editRefContact: plannerState.editRefContact,
      editRefLinks: plannerState.editRefLinks,
      activePortalRef,
      mobileQuickBubbleEditName: plannerState.mobileQuickBubbleEditName,
      setEditRefCode: plannerState.setEditRefCode,
      setEditRefTags: plannerState.setEditRefTags,
      setEditRefLinks: plannerState.setEditRefLinks,
      setEditRefLabel: plannerState.setEditRefLabel,
      crossRefToFirestoreSetData,
      closePortalContextMenu: () => plannerState.setPortalContextMenu(null),
    },
    drag: {
      firestore,
      userUid,
      rfInstance: plannerState.rfInstance,
      childrenByParent,
      nodesById,
      collapsedNodeIds: plannerState.collapsedNodeIds,
      rootNodeId: plannerState.rootNodeId,
      pushHistory,
      setNodes: plannerState.setNodes,
      setDropTargetNodeId: plannerState.setDropTargetNodeId,
      setError: plannerState.setError,
      showSaveError,
      isDraggingRef: plannerState.isDraggingRef,
      draggedNodeIdRef,
      dropTargetIdRef: plannerState.dropTargetIdRef,
    },
    context: {
      firestore,
      userUid,
      rootNodeId: plannerState.rootNodeId,
      currentRootId: plannerState.currentRootId,
      selectedNodeId: plannerState.selectedNodeId,
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
      setBusyAction: plannerState.setBusyAction,
      setError: plannerState.setError,
      setCurrentRootId: plannerState.setCurrentRootId,
      setSelectedNodeId: plannerState.setSelectedNodeId,
      setActivePortalRefId: plannerState.setActivePortalRefId,
      setPendingSelectedNodeId: plannerState.setPendingSelectedNodeId,
      setPendingRenameNodeId: plannerState.setPendingRenameNodeId,
      crossReferencesEnabled,
      isMobileLayout: plannerState.isMobileLayout,
      newRefCode: plannerState.newRefCode,
      newRefColor: plannerState.newRefColor,
      nextAutoBubbleCode,
      defaultBubbleColor,
      renameInputRef: plannerState.renameInputRef,
      openBubblesPanel,
      openMobileQuickBubble,
      hydrateRefEditor,
      setNewRefLabel: plannerState.setNewRefLabel,
      setNewRefCode: plannerState.setNewRefCode,
      setNewRefColor: plannerState.setNewRefColor,
      setSidebarCollapsed: plannerState.setSidebarCollapsed,
      setMobileSidebarSection: plannerState.setMobileSidebarSection,
      setMobileSidebarOpen: plannerState.setMobileSidebarOpen,
      setLinkNodeQuery: plannerState.setLinkNodeQuery,
      setLinkTargetNodeId: plannerState.setLinkTargetNodeId,
    },
  };
}
