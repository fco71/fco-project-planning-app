import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import type { CrossRef, CrossRefDoc, EntityType } from "../types/planner";
import { resolveCreateCrossRefPlan } from "./plannerCrossRefCreationHelpers";
import {
  buildCrossRefDocData,
  buildLocalCrossRef,
  computeExistingExactUpdate,
  findExistingExactRef,
  nextBubbleCode,
} from "./plannerCrossRefCreateExecutionHelpers";

type Position = { x: number; y: number };
type ResolveNodePosition = (nodeId: string) => Position;
type ChooseAnchorNodeId = (
  nodeIds: string[],
  ...preferredIds: Array<string | null | undefined>
) => string | null;
type ResolvePortalFollowPosition = (
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: Position | null,
  seed: string
) => Position;
type BuildDefaultPortalPosition = (anchorNodeId: string | null, seed: string) => Position | null;

type UseCrossRefCreateActionsParams = {
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
  chooseAnchorNodeId: ChooseAnchorNodeId;
  resolveNodePosition: ResolveNodePosition;
  resolvePortalFollowPosition: ResolvePortalFollowPosition;
  buildDefaultPortalPosition: BuildDefaultPortalPosition;
  hydrateRefEditor: (ref: CrossRef | null) => void;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  setNewRefLabel: Dispatch<SetStateAction<string>>;
  setNewRefCode: Dispatch<SetStateAction<string>>;
  setNewRefColor: Dispatch<SetStateAction<string>>;
  setNewRefType: Dispatch<SetStateAction<EntityType>>;
  setRefs: Dispatch<SetStateAction<CrossRef[]>>;
};

export function useCrossRefCreateActions({
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
}: UseCrossRefCreateActionsParams) {
  const createCrossRef = useCallback(
    async (targetNodeIdOverride?: unknown) => {
      if (!firestore) return;

      const plan = resolveCreateCrossRefPlan({
        targetNodeIdOverride,
        effectiveBubbleTargetId,
        refs,
        newRefCode,
        newRefLabel,
        newRefColor,
        newRefType,
        nextAutoBubbleCode,
        bubblesSimplifiedMode,
        defaultBubbleColor,
      });
      if (!plan) return;
      const { targetNodeId, label, code, color, entityType, tags, notes, contact, links } = plan;

      if (bubblesSimplifiedMode) {
        setBusyAction(true);
        setError(null);
        try {
          const newDoc = doc(collection(firestore, "users", userUid, "crossRefs"));
          const anchorPosition = resolveNodePosition(targetNodeId);
          const portalPosition = buildDefaultPortalPosition(targetNodeId, newDoc.id);
          const newRef: CrossRef = buildLocalCrossRef({
            id: newDoc.id,
            label,
            code,
            targetNodeId,
            color,
            portalPosition,
            anchorPosition,
            entityType,
            tags,
            notes,
            contact,
            links,
          });
          await setDoc(doc(firestore, "users", userUid, "crossRefs", newDoc.id), {
            ...buildCrossRefDocData({
              label,
              code,
              targetNodeId,
              color,
              portalPosition,
              anchorPosition,
              entityType,
              tags,
              notes,
              contact,
              links,
            }),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          } satisfies CrossRefDoc & { createdAt: unknown; updatedAt: unknown });
          setRefs((previous) => {
            if (previous.some((entry) => entry.id === newRef.id)) return previous;
            return [...previous, newRef];
          });
          hydrateRefEditor(newRef);
          setActivePortalRefId(newDoc.id);
          setNewRefLabel("");
          setNewRefCode(nextBubbleCode([code, ...refs.map((entry) => entry.code)]));
          setNewRefColor(color);
          setNewRefType(entityType);
        } catch (actionError: unknown) {
          setError(actionError instanceof Error ? actionError.message : "Could not create bubble.");
        } finally {
          setBusyAction(false);
        }
        return;
      }

      const existingExact = findExistingExactRef(refs, code, label);
      setBusyAction(true);
      setError(null);
      try {
        if (existingExact) {
          const {
            nextNodeIds,
            nextAnchorNodeId,
            nextAnchorPosition,
            nextPortalPosition,
            nextEntityType,
          } = computeExistingExactUpdate({
            existingExact,
            targetNodeId,
            newRefType,
            chooseAnchorNodeId,
            resolveNodePosition,
            resolvePortalFollowPosition,
          });
          await updateDoc(doc(firestore, "users", userUid, "crossRefs", existingExact.id), {
            nodeIds: arrayUnion(targetNodeId),
            anchorNodeId: nextAnchorNodeId ?? deleteField(),
            ...(nextPortalPosition ? { portalX: nextPortalPosition.x, portalY: nextPortalPosition.y } : {}),
            ...(nextAnchorPosition
              ? { portalAnchorX: nextAnchorPosition.x, portalAnchorY: nextAnchorPosition.y }
              : {}),
            entityType: nextEntityType,
            updatedAt: serverTimestamp(),
          });
          hydrateRefEditor({
            ...existingExact,
            nodeIds: nextNodeIds,
            anchorNodeId: nextAnchorNodeId,
            portalX: nextPortalPosition?.x ?? existingExact.portalX,
            portalY: nextPortalPosition?.y ?? existingExact.portalY,
            portalAnchorX: nextAnchorPosition?.x ?? existingExact.portalAnchorX,
            portalAnchorY: nextAnchorPosition?.y ?? existingExact.portalAnchorY,
            entityType: nextEntityType,
          });
          setActivePortalRefId(existingExact.id);
        } else {
          const newDoc = doc(collection(firestore, "users", userUid, "crossRefs"));
          const anchorPosition = resolveNodePosition(targetNodeId);
          const portalPosition = buildDefaultPortalPosition(targetNodeId, newDoc.id);
          await setDoc(doc(firestore, "users", userUid, "crossRefs", newDoc.id), {
            ...buildCrossRefDocData({
              label,
              code,
              targetNodeId,
              color,
              portalPosition,
              anchorPosition,
              entityType,
              tags,
              notes,
              contact,
              links,
            }),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          } satisfies CrossRefDoc & { createdAt: unknown; updatedAt: unknown });
          const newRef: CrossRef = buildLocalCrossRef({
            id: newDoc.id,
            label,
            code,
            targetNodeId,
            color,
            portalPosition,
            anchorPosition,
            entityType,
            tags,
            notes,
            contact,
            links,
          });
          setRefs((prev) => [...prev, newRef]);
          hydrateRefEditor(newRef);
          setActivePortalRefId(newDoc.id);
        }
        setNewRefLabel("");
        setNewRefCode("");
        setNewRefColor(defaultBubbleColor);
        setNewRefType("entity");
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not create cross-reference.");
      } finally {
        setBusyAction(false);
      }
    },
    [
      bubblesSimplifiedMode,
      buildDefaultPortalPosition,
      chooseAnchorNodeId,
      defaultBubbleColor,
      effectiveBubbleTargetId,
      firestore,
      hydrateRefEditor,
      newRefCode,
      newRefColor,
      newRefLabel,
      newRefType,
      nextAutoBubbleCode,
      refs,
      resolveNodePosition,
      resolvePortalFollowPosition,
      setActivePortalRefId,
      setBusyAction,
      setError,
      setNewRefCode,
      setNewRefColor,
      setNewRefLabel,
      setNewRefType,
      setRefs,
      userUid,
    ]
  );

  return { createCrossRef };
}
