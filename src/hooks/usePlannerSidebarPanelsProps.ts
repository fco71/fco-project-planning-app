import type { ComponentProps, Dispatch, RefObject, SetStateAction } from "react";
import { PlannerSidebarPanels } from "../components/Planner/PlannerSidebarPanels";
import type { CrossRef, EntityType, NodeKind, TaskStatus, TreeNode } from "../types/planner";
import type { RefCategoryFilter, RefScopeFilter } from "./usePlannerCrossRefUiState";

type ProjectPage = {
  id: string;
  title: string;
};

type LinkedNodeOption = {
  id: string;
  path: string;
};

type UsePlannerSidebarPanelsPropsParams = {
  showProjectSection: boolean;
  showNodeSection: boolean;
  showSimpleBubblesSection: boolean;
  showBubblesSection: boolean;
  error: string | null;

  profileName: string;
  userEmail?: string | null;
  currentRootPath: string;
  currentRootId: string | null;
  rootNodeId: string | null;
  projectPages: ProjectPage[];
  activeProjectPageId: string;
  activeProjectPageIndex: number;
  selectedNodeId: string | null;
  selectedNodeKind?: NodeKind;
  currentRootHasParent: boolean;
  currentRootKind?: NodeKind | null;
  storyLaneMode: boolean;
  busyAction: boolean;
  visibleTreeCount: number;
  crossReferencesEnabled: boolean;
  bubblesSimplifiedMode: boolean;
  newChildTitle: string;
  setNewChildTitle: Dispatch<SetStateAction<string>>;
  goPrevProjectPage: () => void;
  goNextProjectPage: () => void;
  openProjectPage: (projectId: string) => void;
  goGrandmotherView: () => void;
  goUpOneView: () => void;
  openSelectedAsMaster: () => void;
  openSelectedAsStoryLane: () => void;
  setStoryLaneMode: Dispatch<SetStateAction<boolean>>;
  organizeVisibleTree: () => void;
  organizeSelectedBranch: () => void;
  cleanUpCrossRefs: () => void;
  createChild: () => Promise<void> | void;

  selectedNode: TreeNode | null | undefined;
  nodesById: Map<string, TreeNode>;
  renameInputRef: RefObject<HTMLInputElement | null>;
  renameTitle: string;
  setRenameTitle: Dispatch<SetStateAction<string>>;
  bodyDraft: string;
  setBodyDraft: Dispatch<SetStateAction<string>>;
  selectedNodeHasStoryChildren: boolean;
  selectedNodeChildren: TreeNode[];
  selectedNodeCollapsed: boolean;
  newStoryStepText: string;
  setNewStoryStepText: Dispatch<SetStateAction<string>>;
  handleContextChangeType: (nodeId: string) => Promise<void> | void;
  setNodeTaskStatus: (nodeId: string, status: TaskStatus) => Promise<void> | void;
  setNodeColor: (nodeId: string, color?: string) => Promise<void> | void;
  renameSelected: () => Promise<void> | void;
  deleteSelected: () => Promise<void> | void;
  saveSelectedBody: () => Promise<void> | void;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  toggleNodeCollapse: (nodeId: string) => void;
  handleContextAddCrossRef: (nodeId: string) => Promise<void> | void;
  handleContextAddChild: (nodeId: string) => Promise<void> | void;
  toggleStoryStepDone: (stepId: string) => Promise<void> | void;
  moveStoryStep: (stepId: string, direction: -1 | 1) => Promise<void> | void;
  deleteStoryStep: (stepId: string) => Promise<void> | void;
  addStoryStep: () => Promise<void> | void;

  bubbleTargetNode: TreeNode | null | undefined;
  isMobileLayout: boolean;
  selectedNodeRefs: CrossRef[];
  activePortalRef: CrossRef | null;
  effectiveBubbleTargetId: string | null;
  newRefLabelInputRef: RefObject<HTMLInputElement | null>;
  newRefLabel: string;
  setNewRefLabel: Dispatch<SetStateAction<string>>;
  newRefColor: string;
  setNewRefColor: Dispatch<SetStateAction<string>>;
  newRefCode: string;
  setNewRefCode: Dispatch<SetStateAction<string>>;
  nextAutoBubbleCode: string;
  effectiveNewBubbleCode: string;
  canCreateBubbleFromInput: boolean;
  bubblePrefixSuggestions: CrossRef[];
  defaultBubbleColor: string;
  createCrossRef: (targetNodeIdOverride?: unknown) => Promise<void> | void;
  openMobileQuickBubble: (targetNodeId?: string, focusInput?: boolean) => void;
  blurActiveInput: () => void;
  applyBubbleSuggestion: (ref: CrossRef) => void;
  deletePortalByRefId: (refId: string) => Promise<void> | void;
  updateCrossRefColor: (refId: string, color: string) => Promise<void> | void;

  refs: CrossRef[];
  activePortalTargets: TreeNode[];
  newRefType: EntityType;
  setNewRefType: Dispatch<SetStateAction<EntityType>>;
  newRefSuggestions: CrossRef[];
  describeRefTargets: (ref: CrossRef, limit?: number) => string;
  linkCrossRefToNode: (refId: string, nodeId: string) => Promise<void> | void;
  selectRefForEditing: (refId: string) => void;
  detachCrossRef: (refId: string, nodeId: string) => Promise<void> | void;
  jumpToReferencedNode: (nodeId: string) => void;

  refScopeFilter: RefScopeFilter;
  setRefScopeFilter: Dispatch<SetStateAction<RefScopeFilter>>;
  refCategoryFilter: RefCategoryFilter;
  setRefCategoryFilter: Dispatch<SetStateAction<RefCategoryFilter>>;
  refSearchQuery: string;
  setRefSearchQuery: Dispatch<SetStateAction<string>>;
  filteredRefs: CrossRef[];
  selectedNodeRefIds: Set<string>;
  describeRefLibraryPreview: (ref: CrossRef) => string;
  editRefId: string;
  editRefLabel: string;
  setEditRefLabel: Dispatch<SetStateAction<string>>;
  editRefCode: string;
  setEditRefCode: Dispatch<SetStateAction<string>>;
  editRefType: EntityType;
  setEditRefType: Dispatch<SetStateAction<EntityType>>;
  editRefTags: string;
  setEditRefTags: Dispatch<SetStateAction<string>>;
  editRefContact: string;
  setEditRefContact: Dispatch<SetStateAction<string>>;
  editRefNotes: string;
  setEditRefNotes: Dispatch<SetStateAction<string>>;
  editRefLinks: string;
  setEditRefLinks: Dispatch<SetStateAction<string>>;
  saveCrossRefEdits: () => Promise<void> | void;
  duplicateCrossRef: (refId: string) => Promise<void> | void;
  linkNodeQuery: string;
  setLinkNodeQuery: Dispatch<SetStateAction<string>>;
  linkTargetNodeId: string;
  setLinkTargetNodeId: Dispatch<SetStateAction<string>>;
  linkableNodeOptions: LinkedNodeOption[];
  editableRefTargets: LinkedNodeOption[];
  mergeCandidateRefs: CrossRef[];
  mergeFromRefId: string;
  setMergeFromRefId: Dispatch<SetStateAction<string>>;
  mergeCrossRefIntoEdited: () => Promise<void> | void;
  deleteCrossRefBubble: () => Promise<void> | void;
};

export function usePlannerSidebarPanelsProps({
  showProjectSection,
  showNodeSection,
  showSimpleBubblesSection,
  showBubblesSection,
  error,
  profileName,
  userEmail,
  currentRootPath,
  currentRootId,
  rootNodeId,
  projectPages,
  activeProjectPageId,
  activeProjectPageIndex,
  selectedNodeId,
  selectedNodeKind,
  currentRootHasParent,
  currentRootKind,
  storyLaneMode,
  busyAction,
  visibleTreeCount,
  crossReferencesEnabled,
  bubblesSimplifiedMode,
  newChildTitle,
  setNewChildTitle,
  goPrevProjectPage,
  goNextProjectPage,
  openProjectPage,
  goGrandmotherView,
  goUpOneView,
  openSelectedAsMaster,
  openSelectedAsStoryLane,
  setStoryLaneMode,
  organizeVisibleTree,
  organizeSelectedBranch,
  cleanUpCrossRefs,
  createChild,
  selectedNode,
  nodesById,
  renameInputRef,
  renameTitle,
  setRenameTitle,
  bodyDraft,
  setBodyDraft,
  selectedNodeHasStoryChildren,
  selectedNodeChildren,
  selectedNodeCollapsed,
  newStoryStepText,
  setNewStoryStepText,
  handleContextChangeType,
  setNodeTaskStatus,
  setNodeColor,
  renameSelected,
  deleteSelected,
  saveSelectedBody,
  setSelectedNodeId,
  setActivePortalRefId,
  toggleNodeCollapse,
  handleContextAddCrossRef,
  handleContextAddChild,
  toggleStoryStepDone,
  moveStoryStep,
  deleteStoryStep,
  addStoryStep,
  bubbleTargetNode,
  isMobileLayout,
  selectedNodeRefs,
  activePortalRef,
  effectiveBubbleTargetId,
  newRefLabelInputRef,
  newRefLabel,
  setNewRefLabel,
  newRefColor,
  setNewRefColor,
  newRefCode,
  setNewRefCode,
  nextAutoBubbleCode,
  effectiveNewBubbleCode,
  canCreateBubbleFromInput,
  bubblePrefixSuggestions,
  defaultBubbleColor,
  createCrossRef,
  openMobileQuickBubble,
  blurActiveInput,
  applyBubbleSuggestion,
  deletePortalByRefId,
  updateCrossRefColor,
  refs,
  activePortalTargets,
  newRefType,
  setNewRefType,
  newRefSuggestions,
  describeRefTargets,
  linkCrossRefToNode,
  selectRefForEditing,
  detachCrossRef,
  jumpToReferencedNode,
  refScopeFilter,
  setRefScopeFilter,
  refCategoryFilter,
  setRefCategoryFilter,
  refSearchQuery,
  setRefSearchQuery,
  filteredRefs,
  selectedNodeRefIds,
  describeRefLibraryPreview,
  editRefId,
  editRefLabel,
  setEditRefLabel,
  editRefCode,
  setEditRefCode,
  editRefType,
  setEditRefType,
  editRefTags,
  setEditRefTags,
  editRefContact,
  setEditRefContact,
  editRefNotes,
  setEditRefNotes,
  editRefLinks,
  setEditRefLinks,
  saveCrossRefEdits,
  duplicateCrossRef,
  linkNodeQuery,
  setLinkNodeQuery,
  linkTargetNodeId,
  setLinkTargetNodeId,
  linkableNodeOptions,
  editableRefTargets,
  mergeCandidateRefs,
  mergeFromRefId,
  setMergeFromRefId,
  mergeCrossRefIntoEdited,
  deleteCrossRefBubble,
}: UsePlannerSidebarPanelsPropsParams): ComponentProps<typeof PlannerSidebarPanels> {
  return {
    showProjectSection,
    showNodeSection,
    showSimpleBubblesSection,
    showBubblesSection,
    projectPanelProps: {
      profileName,
      userEmail,
      currentRootPath: currentRootPath || "No selection",
      currentRootId,
      rootNodeId,
      projectPages,
      activeProjectPageId,
      activeProjectPageIndex,
      selectedNodeId,
      selectedNodeKind,
      currentRootHasParent,
      currentRootKind,
      storyLaneMode,
      busyAction,
      visibleTreeCount,
      crossReferencesEnabled,
      bubblesSimplifiedMode,
      newChildTitle,
      canCreateChild: !!(selectedNodeId || currentRootId || rootNodeId),
      onNewChildTitleChange: setNewChildTitle,
      onGoPrevProjectPage: goPrevProjectPage,
      onGoNextProjectPage: goNextProjectPage,
      onOpenProjectPage: openProjectPage,
      onGoGrandmotherView: goGrandmotherView,
      onGoUpOneView: goUpOneView,
      onOpenSelectedAsMaster: openSelectedAsMaster,
      onOpenSelectedAsStoryLane: openSelectedAsStoryLane,
      onToggleStoryLaneMode: () => setStoryLaneMode((prev) => !prev),
      onOrganizeVisibleTree: organizeVisibleTree,
      onOrganizeSelectedBranch: organizeSelectedBranch,
      onCleanUpCrossRefs: cleanUpCrossRefs,
      onCreateChild: () => {
        void createChild();
      },
    },
    selectedNodePanelProps: {
      selectedNode,
      nodesById,
      busyAction,
      renameInputRef,
      renameTitle,
      onRenameTitleChange: setRenameTitle,
      bodyDraft,
      onBodyDraftChange: setBodyDraft,
      rootNodeId,
      selectedNodeHasStoryChildren,
      selectedNodeChildren,
      selectedNodeCollapsed,
      crossReferencesEnabled,
      newStoryStepText,
      onNewStoryStepTextChange: setNewStoryStepText,
      onOrganizeSelectedBranch: organizeSelectedBranch,
      onChangeNodeType: (nodeId) => {
        void handleContextChangeType(nodeId);
      },
      onSetNodeTaskStatus: (nodeId, status) => {
        void setNodeTaskStatus(nodeId, status);
      },
      onSetNodeColor: (nodeId, color) => {
        void setNodeColor(nodeId, color);
      },
      onRenameSelected: renameSelected,
      onDeleteSelected: deleteSelected,
      onSaveSelectedBody: saveSelectedBody,
      onSelectChildNode: (nodeId) => {
        setSelectedNodeId(nodeId);
        setActivePortalRefId(null);
      },
      onToggleNodeCollapse: toggleNodeCollapse,
      onAddBubbleToNode: (nodeId) => {
        void handleContextAddCrossRef(nodeId);
      },
      onOpenSelectedAsStoryLane: openSelectedAsStoryLane,
      onAddChildNode: (nodeId) => {
        void handleContextAddChild(nodeId);
      },
      onToggleStoryStepDone: (stepId) => {
        void toggleStoryStepDone(stepId);
      },
      onMoveStoryStep: (stepId, direction) => {
        void moveStoryStep(stepId, direction);
      },
      onDeleteStoryStep: (stepId) => {
        void deleteStoryStep(stepId);
      },
      onAddStoryStep: addStoryStep,
    },
    simpleBubblesPanelProps: {
      bubbleTargetNode,
      nodesById,
      isMobileLayout,
      busyAction,
      selectedNodeId,
      selectedNodeRefs,
      activePortalRef,
      effectiveBubbleTargetId,
      newRefLabelInputRef,
      newRefLabel,
      onNewRefLabelChange: setNewRefLabel,
      newRefColor,
      onNewRefColorChange: setNewRefColor,
      newRefCode,
      onNewRefCodeChange: setNewRefCode,
      nextAutoBubbleCode,
      effectiveNewBubbleCode,
      canCreateBubbleFromInput,
      bubblePrefixSuggestions,
      defaultBubbleColor,
      onSelectBubbleTarget: (nodeId) => {
        setSelectedNodeId(nodeId);
        setActivePortalRefId(null);
      },
      onCreateCrossRef: () => Promise.resolve(createCrossRef()),
      onOpenMobileQuickBubble: openMobileQuickBubble,
      onBlurActiveInput: blurActiveInput,
      onApplyBubbleSuggestion: applyBubbleSuggestion,
      onToggleActivePortalRef: (refId) => {
        setActivePortalRefId((prev) => (prev === refId ? null : refId));
      },
      onDeletePortalByRefId: (refId) => {
        void deletePortalByRefId(refId);
      },
      onUpdateCrossRefColor: async (refId, color) => {
        await updateCrossRefColor(refId, color);
      },
    },
    sharedBubblesTopPanelProps: {
      refs,
      selectedNode,
      selectedNodeId,
      selectedNodeRefs,
      nodesById,
      activePortalRef,
      activePortalTargets,
      busyAction,
      canCreateBubbleFromInput,
      newRefLabelInputRef,
      newRefLabel,
      onNewRefLabelChange: setNewRefLabel,
      newRefCode,
      onNewRefCodeChange: setNewRefCode,
      newRefType,
      onNewRefTypeChange: setNewRefType,
      newRefSuggestions,
      onCreateCrossRef: () => Promise.resolve(createCrossRef()),
      describeRefTargets,
      onLinkCrossRefToNode: linkCrossRefToNode,
      onSelectRefForEditing: selectRefForEditing,
      onDetachCrossRef: detachCrossRef,
      onJumpToReferencedNode: jumpToReferencedNode,
    },
    sharedBubblesManagerProps: {
      refs,
      refScopeFilter,
      onRefScopeFilterChange: setRefScopeFilter,
      refCategoryFilter,
      onRefCategoryFilterChange: setRefCategoryFilter,
      refSearchQuery,
      onRefSearchQueryChange: setRefSearchQuery,
      filteredRefs,
      selectedNodeId,
      selectedNodeRefIds,
      busyAction,
      onSelectRefForEditing: selectRefForEditing,
      describeRefLibraryPreview,
      onLinkCrossRefToNode: (refId, nodeId) => {
        void linkCrossRefToNode(refId, nodeId);
      },
      onDetachCrossRef: (refId, nodeId) => {
        void detachCrossRef(refId, nodeId);
      },
      editRefId,
      editRefLabel,
      onEditRefLabelChange: setEditRefLabel,
      editRefCode,
      onEditRefCodeChange: setEditRefCode,
      editRefType,
      onEditRefTypeChange: setEditRefType,
      editRefTags,
      onEditRefTagsChange: setEditRefTags,
      editRefContact,
      onEditRefContactChange: setEditRefContact,
      editRefNotes,
      onEditRefNotesChange: setEditRefNotes,
      editRefLinks,
      onEditRefLinksChange: setEditRefLinks,
      onSaveCrossRefEdits: () => {
        void saveCrossRefEdits();
      },
      onDuplicateCrossRef: (refId) => {
        void duplicateCrossRef(refId);
      },
      linkNodeQuery,
      onLinkNodeQueryChange: setLinkNodeQuery,
      linkTargetNodeId,
      onLinkTargetNodeIdChange: setLinkTargetNodeId,
      linkableNodeOptions,
      onLinkNodeFromEdit: (refId, nodeId) => {
        void linkCrossRefToNode(refId, nodeId);
      },
      editableRefTargets,
      onJumpToReferencedNode: jumpToReferencedNode,
      mergeCandidateRefs,
      mergeFromRefId,
      onMergeFromRefIdChange: setMergeFromRefId,
      onMergeCrossRefIntoEdited: () => {
        void mergeCrossRefIntoEdited();
      },
      onDeleteCrossRefBubble: () => {
        void deleteCrossRefBubble();
      },
    },
    error,
  };
}
