import { useCallback, useEffect } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

type MobileSidebarSection = "project" | "node" | "bubbles";

type UsePlannerBubbleUiActionsParams = {
  isMobileLayout: boolean;
  selectedNodeId: string | null;
  mobileSidebarOpen: boolean;
  mobileSidebarSection: MobileSidebarSection;
  mobileQuickBubbleOpen: boolean;
  newRefLabelInputRef: RefObject<HTMLInputElement | null>;
  mobileQuickBubbleInputRef: RefObject<HTMLInputElement | null>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  setMobileSidebarSection: Dispatch<SetStateAction<MobileSidebarSection>>;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setMobileQuickEditorOpen: Dispatch<SetStateAction<boolean>>;
  setMobileQuickBubbleOpen: Dispatch<SetStateAction<boolean>>;
};

export function usePlannerBubbleUiActions({
  isMobileLayout,
  selectedNodeId,
  mobileSidebarOpen,
  mobileSidebarSection,
  mobileQuickBubbleOpen,
  newRefLabelInputRef,
  mobileQuickBubbleInputRef,
  setSelectedNodeId,
  setActivePortalRefId,
  setSidebarCollapsed,
  setMobileSidebarSection,
  setMobileSidebarOpen,
  setMobileQuickEditorOpen,
  setMobileQuickBubbleOpen,
}: UsePlannerBubbleUiActionsParams) {
  const focusBubbleLabelInput = useCallback((delayMs = 60) => {
    window.setTimeout(() => {
      const input = newRefLabelInputRef.current;
      if (!input) return;
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
      input.select();
    }, delayMs);
  }, [newRefLabelInputRef]);

  const openBubblesPanel = useCallback(
    (focusInput = true) => {
      setSidebarCollapsed(false);
      setMobileSidebarSection("bubbles");
      setMobileSidebarOpen(true);
      setMobileQuickEditorOpen(false);
      setMobileQuickBubbleOpen(false);
      if (focusInput) {
        focusBubbleLabelInput(isMobileLayout ? 90 : 20);
      }
    },
    [
      focusBubbleLabelInput,
      isMobileLayout,
      setMobileQuickBubbleOpen,
      setMobileQuickEditorOpen,
      setMobileSidebarOpen,
      setMobileSidebarSection,
      setSidebarCollapsed,
    ]
  );

  const focusMobileQuickBubbleInput = useCallback((delayMs = 90) => {
    window.setTimeout(() => {
      const input = mobileQuickBubbleInputRef.current;
      if (!input) return;
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
      input.select();
    }, delayMs);
  }, [mobileQuickBubbleInputRef]);

  const openMobileQuickBubble = useCallback(
    (nodeId?: string, focusInput = true) => {
      const targetId = nodeId || selectedNodeId;
      if (!targetId) return;
      setSelectedNodeId(targetId);
      setActivePortalRefId(null);
      setSidebarCollapsed(false);
      setMobileSidebarOpen(false);
      setMobileQuickEditorOpen(false);
      setMobileQuickBubbleOpen(true);
      if (focusInput) {
        focusMobileQuickBubbleInput(90);
      }
    },
    [
      focusMobileQuickBubbleInput,
      selectedNodeId,
      setActivePortalRefId,
      setMobileQuickBubbleOpen,
      setMobileQuickEditorOpen,
      setMobileSidebarOpen,
      setSelectedNodeId,
      setSidebarCollapsed,
    ]
  );

  const blurActiveInput = useCallback(() => {
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, []);

  useEffect(() => {
    if (!isMobileLayout) return;
    if (!mobileSidebarOpen || mobileSidebarSection !== "bubbles") return;
    focusBubbleLabelInput(90);
  }, [focusBubbleLabelInput, isMobileLayout, mobileSidebarOpen, mobileSidebarSection]);

  useEffect(() => {
    if (!isMobileLayout || !mobileQuickBubbleOpen) return;
    focusMobileQuickBubbleInput(90);
  }, [focusMobileQuickBubbleInput, isMobileLayout, mobileQuickBubbleOpen]);

  return {
    focusBubbleLabelInput,
    openBubblesPanel,
    focusMobileQuickBubbleInput,
    openMobileQuickBubble,
    blurActiveInput,
  };
}
