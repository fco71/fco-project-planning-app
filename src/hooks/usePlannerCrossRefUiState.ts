import { useState } from "react";
import type { EntityType } from "../types/planner";

export type RefCategoryFilter = "all" | "people" | "other";
export type RefScopeFilter = "view" | "all";

type PortalContextMenuState = { x: number; y: number; refId: string } | null;

type UsePlannerCrossRefUiStateParams = {
  defaultBubbleColor: string;
};

export function usePlannerCrossRefUiState({ defaultBubbleColor }: UsePlannerCrossRefUiStateParams) {
  const [mobileQuickBubbleEditName, setMobileQuickBubbleEditName] = useState("");
  const [newRefLabel, setNewRefLabel] = useState("");
  const [newRefCode, setNewRefCode] = useState("");
  const [newRefColor, setNewRefColor] = useState(defaultBubbleColor);
  const [newRefType, setNewRefType] = useState<EntityType>("entity");
  const [refSearchQuery, setRefSearchQuery] = useState("");
  const [refCategoryFilter, setRefCategoryFilter] = useState<RefCategoryFilter>("all");
  const [refScopeFilter, setRefScopeFilter] = useState<RefScopeFilter>("view");
  const [editRefId, setEditRefId] = useState("");
  const [editRefLabel, setEditRefLabel] = useState("");
  const [editRefCode, setEditRefCode] = useState("");
  const [editRefType, setEditRefType] = useState<EntityType>("entity");
  const [editRefTags, setEditRefTags] = useState("");
  const [editRefNotes, setEditRefNotes] = useState("");
  const [editRefContact, setEditRefContact] = useState("");
  const [editRefLinks, setEditRefLinks] = useState("");
  const [mergeFromRefId, setMergeFromRefId] = useState("");
  const [linkNodeQuery, setLinkNodeQuery] = useState("");
  const [linkTargetNodeId, setLinkTargetNodeId] = useState("");
  const [activePortalRefId, setActivePortalRefId] = useState<string | null>(null);
  const [portalContextMenu, setPortalContextMenu] = useState<PortalContextMenuState>(null);

  return {
    mobileQuickBubbleEditName,
    setMobileQuickBubbleEditName,
    newRefLabel,
    setNewRefLabel,
    newRefCode,
    setNewRefCode,
    newRefColor,
    setNewRefColor,
    newRefType,
    setNewRefType,
    refSearchQuery,
    setRefSearchQuery,
    refCategoryFilter,
    setRefCategoryFilter,
    refScopeFilter,
    setRefScopeFilter,
    editRefId,
    setEditRefId,
    editRefLabel,
    setEditRefLabel,
    editRefCode,
    setEditRefCode,
    editRefType,
    setEditRefType,
    editRefTags,
    setEditRefTags,
    editRefNotes,
    setEditRefNotes,
    editRefContact,
    setEditRefContact,
    editRefLinks,
    setEditRefLinks,
    mergeFromRefId,
    setMergeFromRefId,
    linkNodeQuery,
    setLinkNodeQuery,
    linkTargetNodeId,
    setLinkTargetNodeId,
    activePortalRefId,
    setActivePortalRefId,
    portalContextMenu,
    setPortalContextMenu,
  };
}
