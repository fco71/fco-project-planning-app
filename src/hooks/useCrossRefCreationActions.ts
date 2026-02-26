import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Firestore } from "firebase/firestore";
import type { CrossRef, EntityType } from "../types/planner";
import type { HistoryEntry } from "./useUndoRedo";
import { useCrossRefCreateActions } from "./useCrossRefCreateActions";
import { useCrossRefLinkActions } from "./useCrossRefLinkActions";
import { useCrossRefSuggestionActions } from "./useCrossRefSuggestionActions";

type Position = { x: number; y: number };
type ResolveNodePosition = (nodeId: string) => Position;
type ChooseAnchorNodeId = (nodeIds: string[], ...preferredIds: Array<string | null | undefined>) => string | null;
type ResolvePortalFollowPosition = (
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: Position | null,
  seed: string
) => Position;
type BuildDefaultPortalPosition = (anchorNodeId: string | null, seed: string) => Position | null;

type UseCrossRefCreationActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  refs: CrossRef[];
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
  chooseAnchorNodeId: ChooseAnchorNodeId;
  resolveNodePosition: ResolveNodePosition;
  resolvePortalFollowPosition: ResolvePortalFollowPosition;
  buildDefaultPortalPosition: BuildDefaultPortalPosition;
  hydrateRefEditor: (ref: CrossRef | null) => void;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  setLinkNodeQuery: Dispatch<SetStateAction<string>>;
  setLinkTargetNodeId: Dispatch<SetStateAction<string>>;
  setNewRefLabel: Dispatch<SetStateAction<string>>;
  setNewRefCode: Dispatch<SetStateAction<string>>;
  setNewRefColor: Dispatch<SetStateAction<string>>;
  setNewRefType: Dispatch<SetStateAction<EntityType>>;
  setRefs: Dispatch<SetStateAction<CrossRef[]>>;
};

export function useCrossRefCreationActions({
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
}: UseCrossRefCreationActionsParams) {
  const { linkCrossRefToNode } = useCrossRefLinkActions({
    firestore,
    userUid,
    refs,
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
  });

  const { applyBubbleSuggestion } = useCrossRefSuggestionActions({
    defaultBubbleColor,
    newRefCode,
    nextAutoBubbleCode,
    newRefLabelInputRef,
    setNewRefLabel,
    setNewRefCode,
    setNewRefColor,
    setNewRefType,
  });

  const { createCrossRef } = useCrossRefCreateActions({
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
    chooseAnchorNodeId,
    resolveNodePosition,
    resolvePortalFollowPosition,
    buildDefaultPortalPosition,
    hydrateRefEditor,
    setBusyAction,
    setError,
    setActivePortalRefId,
    setNewRefLabel,
    setNewRefCode,
    setNewRefColor,
    setNewRefType,
    setRefs,
  });

  return {
    linkCrossRefToNode,
    applyBubbleSuggestion,
    createCrossRef,
  };
}
