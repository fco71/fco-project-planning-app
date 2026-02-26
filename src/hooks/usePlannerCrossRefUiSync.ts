import { useCallback, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CrossRef } from "../types/planner";

type LinkableNodeOption = {
  id: string;
  path: string;
};

type PortalContextMenuState = {
  refId: string;
  x: number;
  y: number;
} | null;

type UsePlannerCrossRefUiSyncParams = {
  activePortalRef: CrossRef | null;
  isMobileLayout: boolean;
  mobileQuickBubbleOpen: boolean;
  selectedNodeId: string | null;
  selectedNodeRefs: CrossRef[];
  editRefId: string;
  refs: CrossRef[];
  linkTargetNodeId: string;
  linkableNodeOptions: LinkableNodeOption[];
  portalContextMenu: PortalContextMenuState;
  setPortalContextMenu: Dispatch<SetStateAction<PortalContextMenuState>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  setMobileQuickBubbleEditName: Dispatch<SetStateAction<string>>;
  setEditRefId: Dispatch<SetStateAction<string>>;
  setEditRefLabel: Dispatch<SetStateAction<string>>;
  setEditRefCode: Dispatch<SetStateAction<string>>;
  setEditRefType: Dispatch<SetStateAction<CrossRef["entityType"]>>;
  setEditRefTags: Dispatch<SetStateAction<string>>;
  setEditRefNotes: Dispatch<SetStateAction<string>>;
  setEditRefContact: Dispatch<SetStateAction<string>>;
  setEditRefLinks: Dispatch<SetStateAction<string>>;
  setMergeFromRefId: Dispatch<SetStateAction<string>>;
  setLinkNodeQuery: Dispatch<SetStateAction<string>>;
  setLinkTargetNodeId: Dispatch<SetStateAction<string>>;
};

export function usePlannerCrossRefUiSync({
  activePortalRef,
  isMobileLayout,
  mobileQuickBubbleOpen,
  selectedNodeId,
  selectedNodeRefs,
  editRefId,
  refs,
  linkTargetNodeId,
  linkableNodeOptions,
  portalContextMenu,
  setPortalContextMenu,
  setActivePortalRefId,
  setMobileQuickBubbleEditName,
  setEditRefId,
  setEditRefLabel,
  setEditRefCode,
  setEditRefType,
  setEditRefTags,
  setEditRefNotes,
  setEditRefContact,
  setEditRefLinks,
  setMergeFromRefId,
  setLinkNodeQuery,
  setLinkTargetNodeId,
} : UsePlannerCrossRefUiSyncParams) {
  const hydrateRefEditor = useCallback((ref: CrossRef | null) => {
    if (!ref) {
      setEditRefId("");
      setEditRefLabel("");
      setEditRefCode("");
      setEditRefType("entity");
      setEditRefTags("");
      setEditRefNotes("");
      setEditRefContact("");
      setEditRefLinks("");
      setMergeFromRefId("");
      return;
    }
    setEditRefId(ref.id);
    setEditRefLabel(ref.label);
    setEditRefCode(ref.code);
    setEditRefType(ref.entityType);
    setEditRefTags(ref.tags.join(", "));
    setEditRefNotes(ref.notes);
    setEditRefContact(ref.contact);
    setEditRefLinks(ref.links.join("\n"));
    setMergeFromRefId("");
  }, [
    setEditRefCode,
    setEditRefContact,
    setEditRefId,
    setEditRefLabel,
    setEditRefLinks,
    setEditRefNotes,
    setEditRefTags,
    setEditRefType,
    setMergeFromRefId,
  ]);

  useEffect(() => {
    if (!activePortalRef) {
      setMobileQuickBubbleEditName("");
      return;
    }
    setMobileQuickBubbleEditName(activePortalRef.label);
  }, [activePortalRef, setMobileQuickBubbleEditName]);

  useEffect(() => {
    if (!isMobileLayout || !mobileQuickBubbleOpen || !selectedNodeId) return;
    if (selectedNodeRefs.length === 0) {
      setActivePortalRefId(null);
      return;
    }
    if (activePortalRef && activePortalRef.nodeIds.includes(selectedNodeId)) return;
    setActivePortalRefId(selectedNodeRefs[0].id);
  }, [
    activePortalRef,
    isMobileLayout,
    mobileQuickBubbleOpen,
    selectedNodeId,
    selectedNodeRefs,
    setActivePortalRefId,
  ]);

  useEffect(() => {
    if (!portalContextMenu) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-portal-context-menu]")) return;
      setPortalContextMenu(null);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [portalContextMenu, setPortalContextMenu]);

  useEffect(() => {
    if (!editRefId) return;
    if (refs.some((ref) => ref.id === editRefId)) return;
    hydrateRefEditor(null);
    setLinkNodeQuery("");
    setLinkTargetNodeId("");
  }, [editRefId, hydrateRefEditor, refs, setLinkNodeQuery, setLinkTargetNodeId]);

  useEffect(() => {
    if (!linkTargetNodeId) return;
    if (linkableNodeOptions.some((entry) => entry.id === linkTargetNodeId)) return;
    setLinkTargetNodeId("");
  }, [linkTargetNodeId, linkableNodeOptions, setLinkTargetNodeId]);

  return {
    hydrateRefEditor,
  };
}
