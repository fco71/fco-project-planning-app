import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { doc, serverTimestamp, updateDoc, type Firestore } from "firebase/firestore";
import type { CrossRef, EntityType } from "../types/planner";
import { normalizeHexColor } from "../utils/normalize";
import { initialsFromLabel, normalizeCode } from "../utils/treeUtils";

function parseCsvLike(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
}

function parseLineList(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/\r?\n/)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
}

type UseCrossRefEditActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  editRefId: string;
  editRefLabel: string;
  editRefCode: string;
  editRefType: EntityType;
  editRefTags: string;
  editRefNotes: string;
  editRefContact: string;
  editRefLinks: string;
  activePortalRef: CrossRef | null;
  mobileQuickBubbleEditName: string;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  setEditRefCode: Dispatch<SetStateAction<string>>;
  setEditRefTags: Dispatch<SetStateAction<string>>;
  setEditRefLinks: Dispatch<SetStateAction<string>>;
  setEditRefLabel: Dispatch<SetStateAction<string>>;
  setRefs: Dispatch<SetStateAction<CrossRef[]>>;
};

export function useCrossRefEditActions({
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
}: UseCrossRefEditActionsParams) {
  const saveCrossRefEdits = useCallback(async () => {
    if (!firestore || !editRefId) return;
    const label = editRefLabel.trim();
    if (!label) {
      setError("Bubble name is required.");
      return;
    }
    const code = editRefCode.trim() ? normalizeCode(editRefCode) : initialsFromLabel(label);
    const tags = parseCsvLike(editRefTags);
    const links = parseLineList(editRefLinks);
    const notes = editRefNotes.trim();
    const contact = editRefContact.trim();
    setBusyAction(true);
    setError(null);
    try {
      await updateDoc(doc(firestore, "users", userUid, "crossRefs", editRefId), {
        label,
        code,
        entityType: editRefType,
        tags,
        notes,
        contact,
        links,
        updatedAt: serverTimestamp(),
      });
      setEditRefCode(code);
      setEditRefTags(tags.join(", "));
      setEditRefLinks(links.join("\n"));
      setActivePortalRefId(editRefId);
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not update bubble.");
    } finally {
      setBusyAction(false);
    }
  }, [
    editRefCode,
    editRefContact,
    editRefId,
    editRefLabel,
    editRefLinks,
    editRefNotes,
    editRefTags,
    editRefType,
    firestore,
    setActivePortalRefId,
    setBusyAction,
    setEditRefCode,
    setEditRefLinks,
    setEditRefTags,
    setError,
    userUid,
  ]);

  const saveMobileQuickBubbleName = useCallback(async () => {
    if (!firestore || !activePortalRef) return;
    const nextName = mobileQuickBubbleEditName.trim();
    if (!nextName) {
      setError("Bubble name is required.");
      return;
    }
    if (nextName === activePortalRef.label.trim()) return;
    setBusyAction(true);
    setError(null);
    setRefs((previous) =>
      previous.map((entry) => (entry.id === activePortalRef.id ? { ...entry, label: nextName } : entry))
    );
    try {
      await updateDoc(doc(firestore, "users", userUid, "crossRefs", activePortalRef.id), {
        label: nextName,
        updatedAt: serverTimestamp(),
      });
      if (editRefId === activePortalRef.id) {
        setEditRefLabel(nextName);
      }
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not rename bubble.");
    } finally {
      setBusyAction(false);
    }
  }, [
    activePortalRef,
    editRefId,
    firestore,
    mobileQuickBubbleEditName,
    setBusyAction,
    setEditRefLabel,
    setError,
    setRefs,
    userUid,
  ]);

  const updateCrossRefColor = useCallback(
    async (refId: string, rawColor: string) => {
      if (!firestore) return;
      const normalized = normalizeHexColor(rawColor);
      if (!normalized) return;
      setRefs((previous) => previous.map((entry) => (entry.id === refId ? { ...entry, color: normalized } : entry)));
      try {
        await updateDoc(doc(firestore, "users", userUid, "crossRefs", refId), {
          color: normalized,
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not update bubble color.");
      }
    },
    [firestore, setError, setRefs, userUid]
  );

  return {
    saveCrossRefEdits,
    saveMobileQuickBubbleName,
    updateCrossRefColor,
  };
}
