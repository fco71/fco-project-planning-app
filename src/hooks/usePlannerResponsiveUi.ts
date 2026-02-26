import { useEffect } from "react";

type UsePlannerResponsiveUiParams = {
  isMobileLayout: boolean;
  mobileSidebarOpen: boolean;
  mobileQuickEditorOpen: boolean;
  mobileQuickBubbleOpen: boolean;
  selectedNodeId: string | null;
  setIsMobileLayout: React.Dispatch<React.SetStateAction<boolean>>;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMobileQuickEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMobileQuickBubbleOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMobileToolbarOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function usePlannerResponsiveUi({
  isMobileLayout,
  mobileSidebarOpen,
  mobileQuickEditorOpen,
  mobileQuickBubbleOpen,
  selectedNodeId,
  setIsMobileLayout,
  setSidebarCollapsed,
  setMobileSidebarOpen,
  setMobileQuickEditorOpen,
  setMobileQuickBubbleOpen,
  setMobileToolbarOpen,
}: UsePlannerResponsiveUiParams): void {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 980px)");
    const applyState = () => setIsMobileLayout(media.matches);
    applyState();

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches);
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, [setIsMobileLayout]);

  useEffect(() => {
    if (isMobileLayout) {
      setSidebarCollapsed(false);
      return;
    }
    setMobileSidebarOpen(false);
    setMobileQuickEditorOpen(false);
    setMobileQuickBubbleOpen(false);
    setMobileToolbarOpen(false);
  }, [
    isMobileLayout,
    setMobileQuickBubbleOpen,
    setMobileQuickEditorOpen,
    setMobileSidebarOpen,
    setMobileToolbarOpen,
    setSidebarCollapsed,
  ]);

  useEffect(() => {
    if (
      !isMobileLayout ||
      (!mobileSidebarOpen && !mobileQuickEditorOpen && !mobileQuickBubbleOpen) ||
      typeof document === "undefined"
    ) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileLayout, mobileQuickBubbleOpen, mobileQuickEditorOpen, mobileSidebarOpen]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    setMobileQuickEditorOpen(false);
    setMobileQuickBubbleOpen(false);
    setMobileToolbarOpen(false);
  }, [mobileSidebarOpen, setMobileQuickBubbleOpen, setMobileQuickEditorOpen, setMobileToolbarOpen]);

  useEffect(() => {
    if (selectedNodeId) return;
    setMobileQuickEditorOpen(false);
    setMobileQuickBubbleOpen(false);
  }, [selectedNodeId, setMobileQuickBubbleOpen, setMobileQuickEditorOpen]);

  useEffect(() => {
    if (!isMobileLayout) return;
    if (!mobileSidebarOpen && !mobileQuickEditorOpen && !mobileQuickBubbleOpen) return;
    setMobileToolbarOpen(false);
  }, [
    isMobileLayout,
    mobileQuickBubbleOpen,
    mobileQuickEditorOpen,
    mobileSidebarOpen,
    setMobileToolbarOpen,
  ]);
}

