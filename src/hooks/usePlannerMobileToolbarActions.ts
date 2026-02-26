import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TaskStatus, TreeNode } from "../types/planner";

type MobileSidebarSection = "project" | "node" | "bubbles";
type MobileQuickEditorMode = "compact" | "full";

type UsePlannerMobileToolbarActionsParams = {
  selectedNodeId: string | null;
  selectedNode: TreeNode | null | undefined;
  setMobileToolbarOpen: Dispatch<SetStateAction<boolean>>;
  setMobileSidebarSection: Dispatch<SetStateAction<MobileSidebarSection>>;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setMobileQuickEditorMode: Dispatch<SetStateAction<MobileQuickEditorMode>>;
  setMobileQuickEditorOpen: Dispatch<SetStateAction<boolean>>;
  setMobileQuickBubbleOpen: Dispatch<SetStateAction<boolean>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  openMobileQuickBubble: (nodeId: string, focusInput?: boolean) => void;
  handleContextAddChild: (nodeId: string) => Promise<void> | void;
  setNodeTaskStatus: (nodeId: string, status: TaskStatus) => Promise<void> | void;
  goGrandmotherView: () => void;
  goUpOneView: () => void;
};

export function usePlannerMobileToolbarActions({
  selectedNodeId,
  selectedNode,
  setMobileToolbarOpen,
  setMobileSidebarSection,
  setMobileSidebarOpen,
  setMobileQuickEditorMode,
  setMobileQuickEditorOpen,
  setMobileQuickBubbleOpen,
  setActivePortalRefId,
  openMobileQuickBubble,
  handleContextAddChild,
  setNodeTaskStatus,
  goGrandmotherView,
  goUpOneView,
}: UsePlannerMobileToolbarActionsParams) {
  const onToolbarToggleOpen = useCallback(() => {
    setMobileToolbarOpen((previous) => !previous);
  }, [setMobileToolbarOpen]);

  const onToolbarOpenMenu = useCallback(() => {
    setMobileSidebarSection(selectedNodeId ? "node" : "project");
    setMobileSidebarOpen(true);
    setMobileQuickEditorOpen(false);
    setMobileQuickBubbleOpen(false);
    setMobileToolbarOpen(false);
  }, [
    selectedNodeId,
    setMobileSidebarSection,
    setMobileSidebarOpen,
    setMobileQuickEditorOpen,
    setMobileQuickBubbleOpen,
    setMobileToolbarOpen,
  ]);

  const onToolbarOpenEditor = useCallback(() => {
    setMobileSidebarOpen(false);
    setMobileQuickEditorMode("compact");
    setMobileQuickEditorOpen(true);
    setMobileQuickBubbleOpen(false);
    setMobileToolbarOpen(false);
  }, [
    setMobileSidebarOpen,
    setMobileQuickEditorMode,
    setMobileQuickEditorOpen,
    setMobileQuickBubbleOpen,
    setMobileToolbarOpen,
  ]);

  const onToolbarOpenBubble = useCallback(() => {
    if (!selectedNodeId) return;
    setActivePortalRefId(null);
    openMobileQuickBubble(selectedNodeId, true);
    setMobileToolbarOpen(false);
  }, [openMobileQuickBubble, selectedNodeId, setActivePortalRefId, setMobileToolbarOpen]);

  const onToolbarAddChild = useCallback(() => {
    if (!selectedNodeId) return;
    void handleContextAddChild(selectedNodeId);
    setMobileToolbarOpen(false);
  }, [handleContextAddChild, selectedNodeId, setMobileToolbarOpen]);

  const onToolbarToggleTaskStatus = useCallback(() => {
    if (!selectedNodeId || !selectedNode || selectedNode.kind === "root") return;
    const current = selectedNode.taskStatus || "none";
    const nextStatus: TaskStatus = current === "done" ? "todo" : "done";
    void setNodeTaskStatus(selectedNodeId, nextStatus);
    setMobileToolbarOpen(false);
  }, [selectedNode, selectedNodeId, setMobileToolbarOpen, setNodeTaskStatus]);

  const onToolbarGoHome = useCallback(() => {
    goGrandmotherView();
    setMobileToolbarOpen(false);
  }, [goGrandmotherView, setMobileToolbarOpen]);

  const onToolbarGoUp = useCallback(() => {
    goUpOneView();
    setMobileToolbarOpen(false);
  }, [goUpOneView, setMobileToolbarOpen]);

  return {
    onToolbarToggleOpen,
    onToolbarOpenMenu,
    onToolbarOpenEditor,
    onToolbarOpenBubble,
    onToolbarAddChild,
    onToolbarToggleTaskStatus,
    onToolbarGoHome,
    onToolbarGoUp,
  };
}
