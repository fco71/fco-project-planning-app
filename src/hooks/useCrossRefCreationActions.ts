import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
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
import { normalizeHexColor } from "../utils/normalize";
import { initialsFromLabel, normalizeCode } from "../utils/treeUtils";
import type { FirestoreOp, HistoryEntry, LocalOp } from "./useUndoRedo";
import { firestoreDeleteField } from "./useUndoRedo";

type Position = { x: number; y: number };
type ResolveNodePosition = (nodeId: string) => Position;
type ChooseAnchorNodeId = (nodeIds: string[], ...preferredIds: Array<string | null | undefined>) => string | null;
type ResolvePortalFollowPosition = (
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: Position | null,
  seed: string
) => Position;
type BuildDefaultPortalPosition = (anchorNodeId: string | null, seed: string) => Position | null;

function nextBubbleCode(codes: Iterable<string>): string {
  let maxSeen = 0;
  for (const raw of codes) {
    const match = /^B(\d{1,6})$/i.exec(raw.trim());
    if (!match) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed)) maxSeen = Math.max(maxSeen, parsed);
  }
  return `B${String(maxSeen + 1).padStart(3, "0")}`;
}

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
  const linkCrossRefToNode = useCallback(
    async (refId: string, nodeId: string) => {
      if (!firestore) return;
      const linked = refs.find((entry) => entry.id === refId);
      if (linked?.nodeIds.includes(nodeId)) return;

      const nextNodeIds = linked ? [...linked.nodeIds, nodeId] : [nodeId];
      const nextAnchorNodeId = chooseAnchorNodeId(nextNodeIds, linked?.anchorNodeId, nodeId);
      const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
      const nextPortalPosition = linked
        ? resolvePortalFollowPosition(linked, nextAnchorPosition, refId)
        : buildDefaultPortalPosition(nextAnchorNodeId, refId);

      if (linked) {
        const prevData: Record<string, unknown> = {
          nodeIds: linked.nodeIds,
          anchorNodeId: linked.anchorNodeId ?? firestoreDeleteField(),
          portalX: linked.portalX,
          portalY: linked.portalY,
          portalAnchorX: linked.portalAnchorX ?? firestoreDeleteField(),
          portalAnchorY: linked.portalAnchorY ?? firestoreDeleteField(),
        };
        const nextData: Record<string, unknown> = {
          nodeIds: nextNodeIds,
          anchorNodeId: nextAnchorNodeId ?? firestoreDeleteField(),
          portalX: nextPortalPosition?.x ?? linked.portalX,
          portalY: nextPortalPosition?.y ?? linked.portalY,
          portalAnchorX: nextAnchorPosition?.x ?? firestoreDeleteField(),
          portalAnchorY: nextAnchorPosition?.y ?? firestoreDeleteField(),
        };
        pushHistory({
          id: crypto.randomUUID(),
          label: "Link bubble to node",
          forwardLocal: [
            {
              target: "refs",
              op: "patch",
              refId,
              patch: {
                nodeIds: nextNodeIds,
                anchorNodeId: nextAnchorNodeId,
                portalX: nextData.portalX as number,
                portalY: nextData.portalY as number,
              },
            },
          ] as LocalOp[],
          forwardFirestore: [{ kind: "updateRef", refId, data: nextData }] as FirestoreOp[],
          inverseLocal: [
            {
              target: "refs",
              op: "patch",
              refId,
              patch: {
                nodeIds: linked.nodeIds,
                anchorNodeId: linked.anchorNodeId,
                portalX: linked.portalX,
                portalY: linked.portalY,
              },
            },
          ] as LocalOp[],
          inverseFirestore: [{ kind: "updateRef", refId, data: prevData }] as FirestoreOp[],
        });
      }

      setBusyAction(true);
      setError(null);
      try {
        await updateDoc(doc(firestore, "users", userUid, "crossRefs", refId), {
          nodeIds: arrayUnion(nodeId),
          anchorNodeId: nextAnchorNodeId ?? deleteField(),
          ...(nextPortalPosition ? { portalX: nextPortalPosition.x, portalY: nextPortalPosition.y } : {}),
          ...(nextAnchorPosition ? { portalAnchorX: nextAnchorPosition.x, portalAnchorY: nextAnchorPosition.y } : {}),
          updatedAt: serverTimestamp(),
        });
        if (linked) {
          hydrateRefEditor({
            ...linked,
            nodeIds: nextNodeIds,
            anchorNodeId: nextAnchorNodeId,
            portalX: nextPortalPosition?.x ?? linked.portalX,
            portalY: nextPortalPosition?.y ?? linked.portalY,
            portalAnchorX: nextAnchorPosition?.x ?? linked.portalAnchorX,
            portalAnchorY: nextAnchorPosition?.y ?? linked.portalAnchorY,
          });
        }
        setActivePortalRefId(refId);
        setLinkNodeQuery("");
        setLinkTargetNodeId("");
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not link bubble to node.");
      } finally {
        setBusyAction(false);
      }
    },
    [
      buildDefaultPortalPosition,
      chooseAnchorNodeId,
      firestore,
      hydrateRefEditor,
      pushHistory,
      refs,
      resolveNodePosition,
      resolvePortalFollowPosition,
      setActivePortalRefId,
      setBusyAction,
      setError,
      setLinkNodeQuery,
      setLinkTargetNodeId,
      userUid,
    ]
  );

  const applyBubbleSuggestion = useCallback(
    (ref: CrossRef) => {
      setNewRefLabel((previous) => (previous.trim().length > 0 ? previous : ref.label));
      setNewRefColor(ref.color || defaultBubbleColor);
      setNewRefType(ref.entityType);
      if (!newRefCode.trim()) {
        setNewRefCode(nextAutoBubbleCode);
      }
      window.setTimeout(() => {
        newRefLabelInputRef.current?.focus();
      }, 0);
    },
    [defaultBubbleColor, newRefCode, newRefLabelInputRef, nextAutoBubbleCode, setNewRefCode, setNewRefColor, setNewRefLabel, setNewRefType]
  );

  const createCrossRef = useCallback(
    async (targetNodeIdOverride?: unknown) => {
      const targetNodeId =
        typeof targetNodeIdOverride === "string" ? targetNodeIdOverride : effectiveBubbleTargetId;
      if (!firestore || !targetNodeId || typeof targetNodeId !== "string") return;

      const typedCode = newRefCode.trim() ? normalizeCode(newRefCode) : "";
      const templateByCode = typedCode ? refs.find((ref) => ref.code === typedCode) || null : null;
      const label = templateByCode ? templateByCode.label.trim() : newRefLabel.trim();
      if (!label) return;

      const code = typedCode
        ? (bubblesSimplifiedMode && templateByCode ? nextAutoBubbleCode : typedCode)
        : (bubblesSimplifiedMode ? nextAutoBubbleCode : initialsFromLabel(label));
      const color = normalizeHexColor(templateByCode?.color) || normalizeHexColor(newRefColor) || defaultBubbleColor;
      const entityType = templateByCode?.entityType ?? newRefType;
      const tags = templateByCode ? [...templateByCode.tags] : [];
      const notes = templateByCode?.notes ?? "";
      const contact = templateByCode?.contact ?? "";
      const links = templateByCode ? [...templateByCode.links] : [];

      if (bubblesSimplifiedMode) {
        setBusyAction(true);
        setError(null);
        try {
          const newDoc = doc(collection(firestore, "users", userUid, "crossRefs"));
          const anchorPosition = resolveNodePosition(targetNodeId);
          const portalPosition = buildDefaultPortalPosition(targetNodeId, newDoc.id);
          await setDoc(doc(firestore, "users", userUid, "crossRefs", newDoc.id), {
            label,
            code,
            nodeIds: [targetNodeId],
            anchorNodeId: targetNodeId,
            color,
            ...(portalPosition ? { portalX: portalPosition.x, portalY: portalPosition.y } : {}),
            portalAnchorX: anchorPosition.x,
            portalAnchorY: anchorPosition.y,
            entityType,
            tags,
            notes,
            contact,
            links,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          } satisfies CrossRefDoc & { createdAt: unknown; updatedAt: unknown });
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

      const existingExact = refs.find(
        (ref) => ref.code === code && ref.label.trim().toLowerCase() === label.toLowerCase()
      );
      setBusyAction(true);
      setError(null);
      try {
        if (existingExact) {
          const nextNodeIds = existingExact.nodeIds.includes(targetNodeId)
            ? existingExact.nodeIds
            : [...existingExact.nodeIds, targetNodeId];
          const nextAnchorNodeId = chooseAnchorNodeId(nextNodeIds, existingExact.anchorNodeId, targetNodeId);
          const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
          const nextPortalPosition = resolvePortalFollowPosition(existingExact, nextAnchorPosition, existingExact.id);
          await updateDoc(doc(firestore, "users", userUid, "crossRefs", existingExact.id), {
            nodeIds: arrayUnion(targetNodeId),
            anchorNodeId: nextAnchorNodeId ?? deleteField(),
            ...(nextPortalPosition ? { portalX: nextPortalPosition.x, portalY: nextPortalPosition.y } : {}),
            ...(nextAnchorPosition ? { portalAnchorX: nextAnchorPosition.x, portalAnchorY: nextAnchorPosition.y } : {}),
            entityType: existingExact.entityType === "entity" ? newRefType : existingExact.entityType,
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
            entityType: existingExact.entityType === "entity" ? newRefType : existingExact.entityType,
          });
          setActivePortalRefId(existingExact.id);
        } else {
          const newDoc = doc(collection(firestore, "users", userUid, "crossRefs"));
          const anchorPosition = resolveNodePosition(targetNodeId);
          const portalPosition = buildDefaultPortalPosition(targetNodeId, newDoc.id);
          await setDoc(doc(firestore, "users", userUid, "crossRefs", newDoc.id), {
            label,
            code,
            nodeIds: [targetNodeId],
            anchorNodeId: targetNodeId,
            color,
            ...(portalPosition ? { portalX: portalPosition.x, portalY: portalPosition.y } : {}),
            portalAnchorX: anchorPosition.x,
            portalAnchorY: anchorPosition.y,
            entityType,
            tags,
            notes,
            contact,
            links,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          } satisfies CrossRefDoc & { createdAt: unknown; updatedAt: unknown });
          const newRef: CrossRef = {
            id: newDoc.id,
            label,
            code,
            nodeIds: [targetNodeId],
            anchorNodeId: targetNodeId,
            color,
            portalX: portalPosition?.x ?? null,
            portalY: portalPosition?.y ?? null,
            portalAnchorX: anchorPosition.x,
            portalAnchorY: anchorPosition.y,
            portalOffsetX: null,
            portalOffsetY: null,
            entityType,
            tags,
            notes,
            contact,
            links,
            createdAtMs: 0,
            updatedAtMs: 0,
          };
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

  return {
    linkCrossRefToNode,
    applyBubbleSuggestion,
    createCrossRef,
  };
}
