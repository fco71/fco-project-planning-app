import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { CrossRef, TreeNode } from "../types/planner";
import { normalizeHexColor } from "../utils/normalize";

type MobileSidebarSection = "project" | "node" | "bubbles";

type UsePlannerContextUiActionsParams = {
  crossReferencesEnabled: boolean;
  isMobileLayout: boolean;
  newRefCode: string;
  newRefColor: string;
  nextAutoBubbleCode: string;
  defaultBubbleColor: string;
  nodesById: Map<string, TreeNode>;
  refs: CrossRef[];
  renameInputRef: MutableRefObject<HTMLInputElement | null>;
  openBubblesPanel: (focusInput?: boolean) => void;
  openMobileQuickBubble: (nodeId?: string, focusInput?: boolean) => void;
  hydrateRefEditor: (ref: CrossRef | null) => void;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  setNewRefLabel: Dispatch<SetStateAction<string>>;
  setNewRefCode: Dispatch<SetStateAction<string>>;
  setNewRefColor: Dispatch<SetStateAction<string>>;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  setMobileSidebarSection: Dispatch<SetStateAction<MobileSidebarSection>>;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setLinkNodeQuery: Dispatch<SetStateAction<string>>;
  setLinkTargetNodeId: Dispatch<SetStateAction<string>>;
};

export function usePlannerContextUiActions({
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
}: UsePlannerContextUiActionsParams) {
  const handleContextAddCrossRef = useCallback(
    async (nodeId: string) => {
      if (!crossReferencesEnabled) return;
      const anchor = nodesById.get(nodeId);
      setSelectedNodeId(nodeId);
      setActivePortalRefId(null);
      if (anchor) {
        setNewRefLabel((previous) => (previous.trim().length > 0 ? previous : `${anchor.title} Bubble`));
      }
      if (!newRefCode.trim()) setNewRefCode(nextAutoBubbleCode);
      if (!normalizeHexColor(newRefColor)) setNewRefColor(defaultBubbleColor);
      if (isMobileLayout) {
        openMobileQuickBubble(nodeId, true);
        return;
      }
      openBubblesPanel(true);
      window.setTimeout(() => {
        const section = document.getElementById("cross-ref-bubbles-panel");
        section?.scrollIntoView({ block: "start", behavior: "smooth" });
      }, 40);
    },
    [
      crossReferencesEnabled,
      defaultBubbleColor,
      isMobileLayout,
      newRefCode,
      newRefColor,
      nextAutoBubbleCode,
      nodesById,
      openBubblesPanel,
      openMobileQuickBubble,
      setActivePortalRefId,
      setNewRefCode,
      setNewRefColor,
      setNewRefLabel,
      setSelectedNodeId,
    ]
  );

  const handleContextRename = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setActivePortalRefId(null);
      setSidebarCollapsed(false);
      setMobileSidebarSection("node");
      setMobileSidebarOpen(true);
      window.setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 20);
    },
    [
      renameInputRef,
      setActivePortalRefId,
      setMobileSidebarOpen,
      setMobileSidebarSection,
      setSelectedNodeId,
      setSidebarCollapsed,
    ]
  );

  const selectRefForEditing = useCallback(
    (refId: string) => {
      setActivePortalRefId(refId);
      const ref = refs.find((entry) => entry.id === refId);
      hydrateRefEditor(ref || null);
      setLinkNodeQuery("");
      setLinkTargetNodeId("");
    },
    [hydrateRefEditor, refs, setActivePortalRefId, setLinkNodeQuery, setLinkTargetNodeId]
  );

  return {
    handleContextAddCrossRef,
    handleContextRename,
    selectRefForEditing,
  };
}
