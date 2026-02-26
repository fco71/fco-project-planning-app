import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Firestore } from "firebase/firestore";
import type { CrossRef, EntityType, TreeNode } from "../types/planner";
import type { HistoryEntry } from "./useUndoRedo";
import { useCrossRefCreationActions } from "./useCrossRefCreationActions";
import { useCrossRefDeleteDetachActions } from "./useCrossRefDeleteDetachActions";
import { useCrossRefEditActions } from "./useCrossRefEditActions";
import { useCrossRefMaintenanceActions } from "./useCrossRefMaintenanceActions";
import { useCrossRefMergeActions } from "./useCrossRefMergeActions";

type Position = { x: number; y: number };
type ResolveNodePosition = (nodeId: string) => Position;
type ChooseAnchorNodeId = (nodeIds: string[], ...preferredIds: Array<string | null | undefined>) => string | null;
type ResolvePortalFollowPosition = (
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: Position | null,
  seed: string
) => Position;
type BuildDefaultPortalPosition = (anchorNodeId: string | null, seed: string) => Position | null;

type UsePlannerCrossRefActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  refs: CrossRef[];
  nodesById: Map<string, TreeNode>;
  activePortalRefId: string | null;
  editRefId: string;
  resolveNodePosition: ResolveNodePosition;
  chooseAnchorNodeId: ChooseAnchorNodeId;
  resolvePortalFollowPosition: ResolvePortalFollowPosition;
  hydrateRefEditor: (ref: CrossRef | null) => void;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  effectiveBubbleTargetId: string | null;
  newRefCode: string;
  newRefLabel: string;
  newRefColor: string;
  newRefType: EntityType;
  nextAutoBubbleCode: string;
  bubblesSimplifiedMode: boolean;
  defaultBubbleColor: string;
  newRefLabelInputRef: MutableRefObject<HTMLInputElement | null>;
  pushHistory: (entry: HistoryEntry) => void;
  buildDefaultPortalPosition: BuildDefaultPortalPosition;
  setLinkNodeQuery: Dispatch<SetStateAction<string>>;
  setLinkTargetNodeId: Dispatch<SetStateAction<string>>;
  setNewRefLabel: Dispatch<SetStateAction<string>>;
  setNewRefCode: Dispatch<SetStateAction<string>>;
  setNewRefColor: Dispatch<SetStateAction<string>>;
  setNewRefType: Dispatch<SetStateAction<EntityType>>;
  setRefs: Dispatch<SetStateAction<CrossRef[]>>;
  mergeFromRefId: string;
  setMergeFromRefId: Dispatch<SetStateAction<string>>;
  editRefLabel: string;
  editRefCode: string;
  editRefType: EntityType;
  editRefTags: string;
  editRefNotes: string;
  editRefContact: string;
  editRefLinks: string;
  activePortalRef: CrossRef | null;
  mobileQuickBubbleEditName: string;
  setEditRefCode: Dispatch<SetStateAction<string>>;
  setEditRefTags: Dispatch<SetStateAction<string>>;
  setEditRefLinks: Dispatch<SetStateAction<string>>;
  setEditRefLabel: Dispatch<SetStateAction<string>>;
  crossRefToFirestoreSetData: (ref: CrossRef) => Record<string, unknown>;
  closePortalContextMenu: () => void;
};

export function usePlannerCrossRefActions({
  firestore,
  userUid,
  refs,
  nodesById,
  activePortalRefId,
  editRefId,
  resolveNodePosition,
  chooseAnchorNodeId,
  resolvePortalFollowPosition,
  hydrateRefEditor,
  setActivePortalRefId,
  setBusyAction,
  setError,
  effectiveBubbleTargetId,
  newRefCode,
  newRefLabel,
  newRefColor,
  newRefType,
  nextAutoBubbleCode,
  bubblesSimplifiedMode,
  defaultBubbleColor,
  newRefLabelInputRef,
  pushHistory,
  buildDefaultPortalPosition,
  setLinkNodeQuery,
  setLinkTargetNodeId,
  setNewRefLabel,
  setNewRefCode,
  setNewRefColor,
  setNewRefType,
  setRefs,
  mergeFromRefId,
  setMergeFromRefId,
  editRefLabel,
  editRefCode,
  editRefType,
  editRefTags,
  editRefNotes,
  editRefContact,
  editRefLinks,
  activePortalRef,
  mobileQuickBubbleEditName,
  setEditRefCode,
  setEditRefTags,
  setEditRefLinks,
  setEditRefLabel,
  crossRefToFirestoreSetData,
  closePortalContextMenu,
}: UsePlannerCrossRefActionsParams) {
  const { cleanUpCrossRefs } = useCrossRefMaintenanceActions({
    firestore,
    userUid,
    refs,
    nodesById,
    activePortalRefId,
    editRefId,
    resolveNodePosition,
    chooseAnchorNodeId,
    resolvePortalFollowPosition,
    hydrateRefEditor,
    setActivePortalRefId,
    setBusyAction,
    setError,
  });

  const { linkCrossRefToNode, applyBubbleSuggestion, createCrossRef } = useCrossRefCreationActions({
    firestore,
    userUid,
    refs,
    effectiveBubbleTargetId,
    newRefCode,
    newRefLabel,
    newRefColor,
    newRefType,
    nextAutoBubbleCode,
    bubblesSimplifiedMode,
    defaultBubbleColor,
    newRefLabelInputRef,
    pushHistory,
    chooseAnchorNodeId,
    resolveNodePosition,
    resolvePortalFollowPosition,
    buildDefaultPortalPosition,
    hydrateRefEditor,
    setBusyAction,
    setError,
    setActivePortalRefId,
    setLinkNodeQuery,
    setLinkTargetNodeId,
    setNewRefLabel,
    setNewRefCode,
    setNewRefColor,
    setNewRefType,
    setRefs,
  });

  const { duplicateCrossRef, mergeCrossRefIntoEdited } = useCrossRefMergeActions({
    firestore,
    userUid,
    refs,
    editRefId,
    mergeFromRefId,
    activePortalRefId,
    buildDefaultPortalPosition,
    chooseAnchorNodeId,
    resolveNodePosition,
    resolvePortalFollowPosition,
    hydrateRefEditor,
    setBusyAction,
    setError,
    setMergeFromRefId,
    setActivePortalRefId,
  });

  const { saveCrossRefEdits, saveMobileQuickBubbleName, updateCrossRefColor } = useCrossRefEditActions({
    firestore,
    userUid,
    editRefId,
    editRefLabel,
    editRefCode,
    editRefType,
    editRefTags,
    editRefNotes,
    editRefContact,
    editRefLinks,
    activePortalRef,
    mobileQuickBubbleEditName,
    setBusyAction,
    setError,
    setActivePortalRefId,
    setEditRefCode,
    setEditRefTags,
    setEditRefLinks,
    setEditRefLabel,
    setRefs,
  });

  const { deleteCrossRefBubble, deletePortalByRefId, detachCrossRef } = useCrossRefDeleteDetachActions({
    firestore,
    userUid,
    refs,
    editRefId,
    activePortalRefId,
    pushHistory,
    crossRefToFirestoreSetData,
    hydrateRefEditor,
    chooseAnchorNodeId,
    resolveNodePosition,
    resolvePortalFollowPosition,
    closePortalContextMenu,
    setBusyAction,
    setError,
    setRefs,
    setActivePortalRefId,
    setLinkNodeQuery,
    setLinkTargetNodeId,
  });

  return {
    cleanUpCrossRefs,
    linkCrossRefToNode,
    applyBubbleSuggestion,
    createCrossRef,
    duplicateCrossRef,
    mergeCrossRefIntoEdited,
    saveCrossRefEdits,
    saveMobileQuickBubbleName,
    updateCrossRefColor,
    deleteCrossRefBubble,
    deletePortalByRefId,
    detachCrossRef,
  };
}
