import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { collection, deleteField, doc, serverTimestamp, setDoc, writeBatch, type Firestore } from "firebase/firestore";
import type { CrossRef, CrossRefDoc } from "../types/planner";

type Position = { x: number; y: number };
type ResolveNodePosition = (nodeId: string) => Position;
type ChooseAnchorNodeId = (nodeIds: string[], ...preferredIds: Array<string | null | undefined>) => string | null;
type ResolvePortalFollowPosition = (
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: Position | null,
  seed: string
) => Position;
type BuildDefaultPortalPosition = (anchorNodeId: string | null, seed: string) => Position | null;

type UseCrossRefMergeActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  refs: CrossRef[];
  editRefId: string;
  mergeFromRefId: string;
  activePortalRefId: string | null;
  buildDefaultPortalPosition: BuildDefaultPortalPosition;
  chooseAnchorNodeId: ChooseAnchorNodeId;
  resolveNodePosition: ResolveNodePosition;
  resolvePortalFollowPosition: ResolvePortalFollowPosition;
  hydrateRefEditor: (ref: CrossRef | null) => void;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setMergeFromRefId: Dispatch<SetStateAction<string>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
};

export function useCrossRefMergeActions({
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
}: UseCrossRefMergeActionsParams) {
  const duplicateCrossRef = useCallback(
    async (refId: string) => {
      if (!firestore) return;
      const source = refs.find((ref) => ref.id === refId);
      if (!source) return;
      const duplicateLabelBase = `${source.label} Copy`;
      let duplicateLabel = duplicateLabelBase;
      let index = 2;
      while (refs.some((ref) => ref.label.trim().toLowerCase() === duplicateLabel.trim().toLowerCase())) {
        duplicateLabel = `${duplicateLabelBase} ${index}`;
        index += 1;
      }
      const duplicateNodeIds = Array.from(new Set(source.nodeIds));
      const duplicateAnchorNodeId = chooseAnchorNodeId(duplicateNodeIds, source.anchorNodeId);
      const duplicateAnchorPosition = duplicateAnchorNodeId ? resolveNodePosition(duplicateAnchorNodeId) : null;
      const duplicatePortalPosition =
        typeof source.portalX === "number" && typeof source.portalY === "number"
          ? (() => {
              const sourceAnchorNodeId = chooseAnchorNodeId(source.nodeIds, source.anchorNodeId);
              const sourceAnchorPosition = sourceAnchorNodeId ? resolveNodePosition(sourceAnchorNodeId) : null;
              const sourcePosition = resolvePortalFollowPosition(source, sourceAnchorPosition, source.id);
              return { x: sourcePosition.x + 34, y: sourcePosition.y + 34 };
            })()
          : buildDefaultPortalPosition(duplicateAnchorNodeId, `${source.id}:copy:${duplicateLabel}`);
      setBusyAction(true);
      setError(null);
      try {
        const newDoc = doc(collection(firestore, "users", userUid, "crossRefs"));
        await setDoc(doc(firestore, "users", userUid, "crossRefs", newDoc.id), {
          label: duplicateLabel,
          code: source.code,
          nodeIds: duplicateNodeIds,
          ...(duplicateAnchorNodeId ? { anchorNodeId: duplicateAnchorNodeId } : {}),
          ...(source.color ? { color: source.color } : {}),
          ...(duplicatePortalPosition ? { portalX: duplicatePortalPosition.x, portalY: duplicatePortalPosition.y } : {}),
          ...(duplicateAnchorPosition ? { portalAnchorX: duplicateAnchorPosition.x, portalAnchorY: duplicateAnchorPosition.y } : {}),
          entityType: source.entityType,
          tags: source.tags,
          notes: source.notes,
          contact: source.contact,
          links: source.links,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies CrossRefDoc & { createdAt: unknown; updatedAt: unknown });
        setActivePortalRefId(newDoc.id);
        hydrateRefEditor({
          ...source,
          id: newDoc.id,
          label: duplicateLabel,
          nodeIds: duplicateNodeIds,
          anchorNodeId: duplicateAnchorNodeId,
          portalX: duplicatePortalPosition?.x ?? null,
          portalY: duplicatePortalPosition?.y ?? null,
          portalAnchorX: duplicateAnchorPosition?.x ?? source.portalAnchorX,
          portalAnchorY: duplicateAnchorPosition?.y ?? source.portalAnchorY,
          createdAtMs: 0,
          updatedAtMs: 0,
        });
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not duplicate bubble.");
      } finally {
        setBusyAction(false);
      }
    },
    [
      buildDefaultPortalPosition,
      chooseAnchorNodeId,
      firestore,
      hydrateRefEditor,
      refs,
      resolveNodePosition,
      resolvePortalFollowPosition,
      setActivePortalRefId,
      setBusyAction,
      setError,
      userUid,
    ]
  );

  const mergeCrossRefIntoEdited = useCallback(async () => {
    if (!firestore || !editRefId || !mergeFromRefId || editRefId === mergeFromRefId) return;
    const primary = refs.find((ref) => ref.id === editRefId);
    const duplicate = refs.find((ref) => ref.id === mergeFromRefId);
    if (!primary || !duplicate) return;

    const mergedNodeIds = Array.from(new Set([...primary.nodeIds, ...duplicate.nodeIds]));
    const mergedTags = Array.from(new Set([...primary.tags, ...duplicate.tags].map((tag) => tag.trim()).filter(Boolean)));
    const mergedLinks = Array.from(new Set([...primary.links, ...duplicate.links].map((link) => link.trim()).filter(Boolean)));
    const mergedNotes = [primary.notes.trim(), duplicate.notes.trim()].filter(Boolean).join("\n\n");
    const mergedContact = primary.contact.trim() || duplicate.contact.trim();
    const mergedType = primary.entityType !== "entity" ? primary.entityType : duplicate.entityType;
    const mergedColor = primary.color || duplicate.color || null;
    const mergedAnchorNodeId = chooseAnchorNodeId(mergedNodeIds, primary.anchorNodeId, duplicate.anchorNodeId);
    const mergedAnchorPosition = mergedAnchorNodeId ? resolveNodePosition(mergedAnchorNodeId) : null;
    const mergedPortalPosition =
      typeof primary.portalX === "number" && typeof primary.portalY === "number"
        ? resolvePortalFollowPosition(
            primary,
            primary.anchorNodeId ? resolveNodePosition(primary.anchorNodeId) : null,
            `${primary.id}:merged`
          )
        : typeof duplicate.portalX === "number" && typeof duplicate.portalY === "number"
          ? resolvePortalFollowPosition(
              duplicate,
              duplicate.anchorNodeId ? resolveNodePosition(duplicate.anchorNodeId) : null,
              `${duplicate.id}:merged`
            )
          : buildDefaultPortalPosition(mergedAnchorNodeId, primary.id);

    setBusyAction(true);
    setError(null);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, "users", userUid, "crossRefs", primary.id), {
        nodeIds: mergedNodeIds,
        anchorNodeId: mergedAnchorNodeId ?? deleteField(),
        ...(mergedPortalPosition ? { portalX: mergedPortalPosition.x, portalY: mergedPortalPosition.y } : {}),
        ...(mergedAnchorPosition ? { portalAnchorX: mergedAnchorPosition.x, portalAnchorY: mergedAnchorPosition.y } : {}),
        tags: mergedTags,
        links: mergedLinks,
        notes: mergedNotes,
        contact: mergedContact,
        ...(mergedColor ? { color: mergedColor } : { color: deleteField() }),
        entityType: mergedType,
        updatedAt: serverTimestamp(),
      });
      batch.delete(doc(firestore, "users", userUid, "crossRefs", duplicate.id));
      await batch.commit();

      setMergeFromRefId("");
      if (activePortalRefId === duplicate.id) {
        setActivePortalRefId(primary.id);
      }
      hydrateRefEditor({
        ...primary,
        nodeIds: mergedNodeIds,
        anchorNodeId: mergedAnchorNodeId,
        portalX: mergedPortalPosition?.x ?? primary.portalX,
        portalY: mergedPortalPosition?.y ?? primary.portalY,
        portalAnchorX: mergedAnchorPosition?.x ?? primary.portalAnchorX,
        portalAnchorY: mergedAnchorPosition?.y ?? primary.portalAnchorY,
        tags: mergedTags,
        links: mergedLinks,
        notes: mergedNotes,
        contact: mergedContact,
        color: mergedColor,
        entityType: mergedType,
      });
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not merge entities.");
    } finally {
      setBusyAction(false);
    }
  }, [
    activePortalRefId,
    buildDefaultPortalPosition,
    chooseAnchorNodeId,
    editRefId,
    firestore,
    hydrateRefEditor,
    mergeFromRefId,
    refs,
    resolveNodePosition,
    resolvePortalFollowPosition,
    setActivePortalRefId,
    setBusyAction,
    setError,
    setMergeFromRefId,
    userUid,
  ]);

  return {
    duplicateCrossRef,
    mergeCrossRefIntoEdited,
  };
}
