import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ComponentProps } from "react";
import { PlannerMobilePanels } from "../components/Planner/PlannerMobilePanels";
import type { CrossRef, TaskStatus, TreeNode } from "../types/planner";

type MobileSidebarSection = "project" | "node" | "bubbles";
type MobileQuickEditorMode = "compact" | "full";

type UsePlannerMobilePanelsPropsParams = {
  isMobileLayout: boolean;
  mobileSidebarOpen: boolean;
  mobileQuickEditorOpen: boolean;
  mobileQuickBubbleOpen: boolean;
  mobileQuickEditorMode: MobileQuickEditorMode;
  selectedNode: TreeNode | null | undefined;
  selectedNodeId: string | null;
  nodesById: Map<string, TreeNode>;
  renameTitle: string;
  busyAction: boolean;
  selectedNodeRefs: CrossRef[];
  crossReferencesEnabled: boolean;
  newRefLabel: string;
  canCreateBubbleFromInput: boolean;
  bodyDraft: string;
  newRefCode: string;
  nextAutoBubbleCode: string;
  newRefColor: string;
  bubblePrefixSuggestions: CrossRef[];
  selectedNodeChildrenCount: number;
  selectedNodeCollapsed: boolean;
  effectiveNewBubbleCode: string;
  mobileQuickBubbleInputRef: RefObject<HTMLInputElement | null>;
  activePortalRef: CrossRef | null;
  mobileQuickBubbleEditName: string;
  defaultBubbleColor: string;
  renameSelected: () => void | Promise<void>;
  createCrossRef: () => void | Promise<void>;
  openMobileQuickBubble: (nodeId: string, focusInput?: boolean) => void;
  saveSelectedBody: () => void | Promise<void>;
  applyBubbleSuggestion: (ref: CrossRef) => void;
  openBubblesPanel: (focusInput?: boolean) => void;
  setNodeTaskStatus: (nodeId: string, status: TaskStatus) => void | Promise<void>;
  handleContextChangeType: (nodeId: string) => void | Promise<void>;
  toggleNodeCollapse: (nodeId: string) => void;
  setCurrentRootId: (nodeId: string | null) => void;
  handleContextAddChild: (nodeId: string) => void | Promise<void>;
  handleContextAddStorySibling: (nodeId: string) => void | Promise<void>;
  openSelectedAsStoryLane: () => void;
  focusMobileQuickBubbleInput: (delayMs?: number) => void;
  blurActiveInput: () => void;
  selectRefForEditing: (refId: string) => void;
  saveMobileQuickBubbleName: () => void | Promise<void>;
  updateCrossRefColor: (refId: string, color: string) => void | Promise<void>;
  deletePortalByRefId: (refId: string) => void | Promise<void>;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setMobileQuickEditorMode: Dispatch<SetStateAction<MobileQuickEditorMode>>;
  setRenameTitle: Dispatch<SetStateAction<string>>;
  setNewRefLabel: Dispatch<SetStateAction<string>>;
  setBodyDraft: Dispatch<SetStateAction<string>>;
  setNewRefCode: Dispatch<SetStateAction<string>>;
  setNewRefColor: Dispatch<SetStateAction<string>>;
  setMobileSidebarSection: Dispatch<SetStateAction<MobileSidebarSection>>;
  setMobileQuickEditorOpen: Dispatch<SetStateAction<boolean>>;
  setMobileQuickBubbleOpen: Dispatch<SetStateAction<boolean>>;
  setMobileQuickBubbleEditName: Dispatch<SetStateAction<string>>;
};

export function usePlannerMobilePanelsProps({
  isMobileLayout,
  mobileSidebarOpen,
  mobileQuickEditorOpen,
  mobileQuickBubbleOpen,
  mobileQuickEditorMode,
  selectedNode,
  selectedNodeId,
  nodesById,
  renameTitle,
  busyAction,
  selectedNodeRefs,
  crossReferencesEnabled,
  newRefLabel,
  canCreateBubbleFromInput,
  bodyDraft,
  newRefCode,
  nextAutoBubbleCode,
  newRefColor,
  bubblePrefixSuggestions,
  selectedNodeChildrenCount,
  selectedNodeCollapsed,
  effectiveNewBubbleCode,
  mobileQuickBubbleInputRef,
  activePortalRef,
  mobileQuickBubbleEditName,
  defaultBubbleColor,
  renameSelected,
  createCrossRef,
  openMobileQuickBubble,
  saveSelectedBody,
  applyBubbleSuggestion,
  openBubblesPanel,
  setNodeTaskStatus,
  handleContextChangeType,
  toggleNodeCollapse,
  setCurrentRootId,
  handleContextAddChild,
  handleContextAddStorySibling,
  openSelectedAsStoryLane,
  focusMobileQuickBubbleInput,
  blurActiveInput,
  selectRefForEditing,
  saveMobileQuickBubbleName,
  updateCrossRefColor,
  deletePortalByRefId,
  setMobileSidebarOpen,
  setMobileQuickEditorMode,
  setRenameTitle,
  setNewRefLabel,
  setBodyDraft,
  setNewRefCode,
  setNewRefColor,
  setMobileSidebarSection,
  setMobileQuickEditorOpen,
  setMobileQuickBubbleOpen,
  setMobileQuickBubbleEditName,
}: UsePlannerMobilePanelsPropsParams): ComponentProps<typeof PlannerMobilePanels> {
  return {
    overlaysProps: {
      isMobileLayout,
      mobileSidebarOpen,
      mobileQuickEditorOpen,
      mobileQuickBubbleOpen,
      onCloseSidebar: () => setMobileSidebarOpen(false),
      onCloseQuickEditor: () => setMobileQuickEditorOpen(false),
      onCloseQuickBubble: () => setMobileQuickBubbleOpen(false),
    },
    quickEditorProps: {
      open: isMobileLayout && mobileQuickEditorOpen,
      mode: mobileQuickEditorMode,
      onModeChange: setMobileQuickEditorMode,
      selectedNode: selectedNode || null,
      selectedNodeId,
      nodesById,
      renameTitle,
      onRenameTitleChange: setRenameTitle,
      onRenameSelected: renameSelected,
      busyAction,
      crossReferencesEnabled,
      selectedNodeRefs,
      newRefLabel,
      onNewRefLabelChange: setNewRefLabel,
      canCreateBubbleFromInput,
      onCreateCrossRef: () => createCrossRef(),
      onOpenMobileQuickBubble: openMobileQuickBubble,
      bodyDraft,
      onBodyDraftChange: setBodyDraft,
      onSaveSelectedBody: saveSelectedBody,
      selectedNodeBody: selectedNode?.body || "",
      newRefCode,
      onNewRefCodeChange: setNewRefCode,
      nextAutoBubbleCode,
      newRefColor,
      onNewRefColorChange: setNewRefColor,
      bubblePrefixSuggestions,
      onApplyBubbleSuggestion: applyBubbleSuggestion,
      onOpenBubblesPanel: openBubblesPanel,
      selectedNodeChildrenCount,
      selectedNodeCollapsed,
      onSetNodeTaskStatus: setNodeTaskStatus,
      onChangeType: (nodeId) => handleContextChangeType(nodeId),
      onToggleNodeCollapse: toggleNodeCollapse,
      onFocusHere: setCurrentRootId,
      onAddChild: (nodeId) => {
        const node = nodesById.get(nodeId);
        if (node?.kind === "story") {
          return handleContextAddStorySibling(nodeId);
        }
        return handleContextAddChild(nodeId);
      },
      onOpenSelectedAsStoryLane: openSelectedAsStoryLane,
      onOpenFullNodePanel: () => {
        setMobileSidebarSection("node");
        setMobileSidebarOpen(true);
        setMobileQuickEditorOpen(false);
      },
      onClose: () => setMobileQuickEditorOpen(false),
    },
    quickBubbleProps: {
      open: isMobileLayout && mobileQuickBubbleOpen,
      selectedNode: selectedNode || null,
      nodesById,
      mobileQuickBubbleInputRef,
      newRefLabel,
      onNewRefLabelChange: setNewRefLabel,
      busyAction,
      canCreateBubbleFromInput,
      onCreateBubble: () => createCrossRef(),
      focusMobileQuickBubbleInput,
      blurActiveInput,
      openBubblesPanel,
      newRefColor,
      onNewRefColorChange: setNewRefColor,
      newRefCode,
      onNewRefCodeChange: setNewRefCode,
      nextAutoBubbleCode,
      effectiveNewBubbleCode,
      bubblePrefixSuggestions,
      applyBubbleSuggestion,
      selectedNodeRefs,
      onSelectRefForEditing: selectRefForEditing,
      activePortalRef,
      mobileQuickBubbleEditName,
      onMobileQuickBubbleEditNameChange: setMobileQuickBubbleEditName,
      onSaveMobileQuickBubbleName: saveMobileQuickBubbleName,
      onUpdateCrossRefColor: updateCrossRefColor,
      defaultBubbleColor,
      onDeletePortalByRefId: deletePortalByRefId,
      onClose: () => setMobileQuickBubbleOpen(false),
    },
  };
}
