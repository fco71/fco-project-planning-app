/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { useUndoRedo } from "../hooks/useUndoRedo";
import ReactFlow, {
  Background,
  SelectionMode,
  type EdgeTypes,
  type ReactFlowInstance,
} from "reactflow";
import type { User } from "firebase/auth";
import { db } from "../firebase";
import {
  normalizeCode,
  initialsFromLabel,
  buildNodePath,
  buildNodePathTail,
} from "../utils/treeUtils";
import {
  bubbleDisplayToken,
  chooseAnchorNodeId,
  crossRefToFirestoreSetData,
  defaultPortalPositionForAnchor,
  resolvePortalFollowPosition,
} from "../utils/crossRefUtils";
import {
  rgbaFromHex,
} from "../utils/normalize";
import {
  BUBBLES_SIMPLIFIED_MODE,
  CROSS_REFERENCES_ENABLED,
  DEFAULT_BUBBLE_COLOR,
  defaultNodeColor,
  ENTITY_TYPE_GROUPS,
  nextNodeKind,
  STORY_NODE_MAX_HEIGHT,
  STORY_NODE_MAX_WIDTH,
  STORY_NODE_MIN_HEIGHT,
  STORY_NODE_MIN_WIDTH,
  storyContainerColor,
} from "../utils/plannerConfig";
import type {
  TaskStatus,
  EntityType,
  TreeNode,
  CrossRef,
} from "../types/planner";
import { usePlannerRealtimeSync } from "../hooks/usePlannerRealtimeSync";
import { usePlannerResponsiveUi } from "../hooks/usePlannerResponsiveUi";
import { usePlannerNavigationActions } from "../hooks/usePlannerNavigationActions";
import { usePlannerCrossRefDerivedState } from "../hooks/usePlannerCrossRefDerivedState";
import { usePlannerViewDerivedState } from "../hooks/usePlannerViewDerivedState";
import { useStoryNodeContentActions } from "../hooks/useStoryNodeContentActions";
import { usePlannerNodeMutationActions } from "../hooks/usePlannerNodeMutationActions";
import { usePlannerLayoutActions } from "../hooks/usePlannerLayoutActions";
import { useCrossRefMaintenanceActions } from "../hooks/useCrossRefMaintenanceActions";
import { useCrossRefCreationActions } from "../hooks/useCrossRefCreationActions";
import { useCrossRefEditActions } from "../hooks/useCrossRefEditActions";
import { useCrossRefDeleteDetachActions } from "../hooks/useCrossRefDeleteDetachActions";
import { useCrossRefMergeActions } from "../hooks/useCrossRefMergeActions";
import { usePlannerDragActions } from "../hooks/usePlannerDragActions";
import { usePlannerContextNodeActions } from "../hooks/usePlannerContextNodeActions";
import { usePlannerContextUiActions } from "../hooks/usePlannerContextUiActions";
import { usePlannerKeyboardShortcuts } from "../hooks/usePlannerKeyboardShortcuts";
import { usePlannerPaletteItems } from "../hooks/usePlannerPaletteItems";
import { usePlannerCreateDeleteActions } from "../hooks/usePlannerCreateDeleteActions";
import { usePlannerCrossRefUiSync } from "../hooks/usePlannerCrossRefUiSync";
import { usePlannerCommandActions } from "../hooks/usePlannerCommandActions";
import { usePlannerBubbleUiActions } from "../hooks/usePlannerBubbleUiActions";
import { usePlannerFlowUiFeedback } from "../hooks/usePlannerFlowUiFeedback";
import { usePlannerTreeViewState } from "../hooks/usePlannerTreeViewState";
import { usePlannerRootSelectionSync } from "../hooks/usePlannerRootSelectionSync";
import { usePlannerEdgeHoverState } from "../hooks/usePlannerEdgeHoverState";
import { usePlannerBaseGraphData } from "../hooks/usePlannerBaseGraphData";
import { usePlannerBaseNodeState } from "../hooks/usePlannerBaseNodeState";
import { usePlannerVisiblePortals } from "../hooks/usePlannerVisiblePortals";
import { usePlannerFlowNodes } from "../hooks/usePlannerFlowNodes";
import { usePlannerFlowGraph } from "../hooks/usePlannerFlowGraph";
import { usePlannerApplyLocalOps } from "../hooks/usePlannerApplyLocalOps";
import { usePlannerNodeIndex } from "../hooks/usePlannerNodeIndex";
import { usePlannerStoryCardState } from "../hooks/usePlannerStoryCardState";
import { usePlannerBodySaveActions } from "../hooks/usePlannerBodySaveActions";
import { usePlannerLocalNodePatch } from "../hooks/usePlannerLocalNodePatch";
import { usePlannerFilteredTreeIdSet } from "../hooks/usePlannerFilteredTreeIdSet";
import { usePlannerHoverState } from "../hooks/usePlannerHoverState";
import { usePlannerDefaultPortalPosition } from "../hooks/usePlannerDefaultPortalPosition";
import { usePlannerSidebarSectionVisibility } from "../hooks/usePlannerSidebarSectionVisibility";
import { usePlannerCrossRefUiState } from "../hooks/usePlannerCrossRefUiState";
import { NodeContextMenu } from "../components/Planner/NodeContextMenu";
import { plannerNodeTypes } from "../components/Planner/PortalNode";
import "reactflow/dist/style.css";

type PlannerPageProps = {
  user: User;
};

const edgeTypes: EdgeTypes = Object.freeze({});

export default function PlannerPage({ user }: PlannerPageProps) {
  const [profileName, setProfileName] = useState("");
  const [rootNodeId, setRootNodeId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [refs, setRefs] = useState<CrossRef[]>([]);
  const [currentRootId, setCurrentRootId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingSelectedNodeId, setPendingSelectedNodeId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 980px)").matches : false
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSidebarSection, setMobileSidebarSection] = useState<"project" | "node" | "bubbles">("project");
  const [mobileQuickEditorOpen, setMobileQuickEditorOpen] = useState(false);
  const [mobileQuickBubbleOpen, setMobileQuickBubbleOpen] = useState(false);
  const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false);
  const [mobileQuickEditorMode, setMobileQuickEditorMode] = useState<"compact" | "full">("compact");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newRefLabelInputRef = useRef<HTMLInputElement>(null);
  const mobileQuickBubbleInputRef = useRef<HTMLInputElement>(null);
  const [newChildTitle, setNewChildTitle] = useState("");
  const [newStoryStepText, setNewStoryStepText] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [pendingRenameNodeId, setPendingRenameNodeId] = useState<string | null>(null);
  const [storyLaneMode, setStoryLaneMode] = useState(false);
  const {
    mobileQuickBubbleEditName, setMobileQuickBubbleEditName,
    newRefLabel, setNewRefLabel, newRefCode, setNewRefCode, newRefColor, setNewRefColor, newRefType, setNewRefType,
    refSearchQuery, setRefSearchQuery, refCategoryFilter, setRefCategoryFilter, refScopeFilter, setRefScopeFilter,
    editRefId, setEditRefId, editRefLabel, setEditRefLabel, editRefCode, setEditRefCode, editRefType, setEditRefType,
    editRefTags, setEditRefTags, editRefNotes, setEditRefNotes, editRefContact, setEditRefContact,
    editRefLinks, setEditRefLinks, mergeFromRefId, setMergeFromRefId,
    linkNodeQuery, setLinkNodeQuery, linkTargetNodeId, setLinkTargetNodeId,
    activePortalRefId, setActivePortalRefId, portalContextMenu, setPortalContextMenu,
  } = usePlannerCrossRefUiState({
    defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  // Swipe-to-dismiss tracking for the mobile quick-editor sheet.
  const sheetTouchStartY = useRef<number | null>(null);
  const bubbleSheetTouchStartY = useRef<number | null>(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const { hoveredNodeId, hoveredEdgeId, isDraggingRef, scheduleHoverUpdate } = usePlannerHoverState();
  const [dropTargetNodeId, setDropTargetNodeId] = useState<string | null>(null);
  // Track drop target via ref during drag — avoids calling setDropTargetNodeId
  // on every mousemove frame which would recompute flowNodes each frame.
  const dropTargetIdRef = useRef<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [collapsedHydrated, setCollapsedHydrated] = useState(false);
  const syncedCollapsedKeyRef = useRef("");

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  const {
    canUndo,
    canRedo,
    push: pushHistory,
    undo,
    redo,
    suppressSnapshotRef,
    newNodeDocId,
    undoLabel,
    redoLabel,
  } = useUndoRedo(user.uid);

  const applyLocalOps = usePlannerApplyLocalOps({
    setNodes,
    setRefs,
  });

  const { nodesById, childrenByParent } = usePlannerNodeIndex(nodes);
  const { expandedStoryNodeIds, toggleStoryCardExpand } = usePlannerStoryCardState();
  const applyLocalNodePatch = usePlannerLocalNodePatch({ setNodes });

  usePlannerResponsiveUi({
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
  });

  usePlannerRealtimeSync({
    user,
    firestore: db,
    suppressSnapshotRef,
    setLoading,
    setError,
    setCollapsedHydrated,
    syncedCollapsedKeyRef,
    setCollapsedNodeIds,
    setProfileName,
    setRootNodeId,
    setNodes,
    setRefs,
    crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
    bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
  });

  const { selectedNode } = usePlannerRootSelectionSync({
    rootNodeId,
    loading,
    nodesById,
    currentRootId,
    setCurrentRootId,
    selectedNodeId,
    setSelectedNodeId,
    pendingSelectedNodeId,
    setPendingSelectedNodeId,
    isMobileLayout,
    setRenameTitle,
    setBodyDraft,
    storyLaneMode,
    setStoryLaneMode,
    pendingRenameNodeId,
    setPendingRenameNodeId,
    setSidebarCollapsed,
    setMobileSidebarSection,
    setMobileSidebarOpen,
    renameInputRef,
  });

  const effectiveBubbleTargetId = selectedNodeId || null;
  const bubbleTargetNode = selectedNode;

  const {
    openBubblesPanel,
    focusMobileQuickBubbleInput,
    openMobileQuickBubble,
    blurActiveInput,
  } = usePlannerBubbleUiActions({
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
  });

  useEffect(() => {
    setNewStoryStepText("");
  }, [selectedNode?.id]);

  const {
    visibleTreeIdSet,
    toggleNodeCollapse,
    filteredTreeIds,
    searchMatchingIds,
    currentRootKind,
    treeLayout,
    resolveNodePosition,
  } = usePlannerTreeViewState({
    firestore: db,
    userUid: user.uid,
    currentRootId,
    nodesById,
    childrenByParent,
    collapsedNodeIds,
    setCollapsedNodeIds,
    collapsedHydrated,
    syncedCollapsedKeyRef,
    searchQuery,
    storyLaneMode,
  });

  const {
    persistNodeBody,
    resetStoryNodeSize,
    startStoryNodeResize,
  } = useStoryNodeContentActions({
    firestore: db,
    userUid: user.uid,
    nodesById,
    pushHistory,
    applyLocalNodePatch,
    setBusyAction,
    setError,
    setNodes,
    storyNodeMinWidth: STORY_NODE_MIN_WIDTH,
    storyNodeMaxWidth: STORY_NODE_MAX_WIDTH,
    storyNodeMinHeight: STORY_NODE_MIN_HEIGHT,
    storyNodeMaxHeight: STORY_NODE_MAX_HEIGHT,
  });

  const filteredTreeIdSet = usePlannerFilteredTreeIdSet(filteredTreeIds);

  // visiblePortals is computed after baseNodes so it reads live drag positions.
  const { baseTreeNodes, baseEdges } = usePlannerBaseGraphData({
    filteredTreeIds,
    nodesById,
    childrenByParent,
    collapsedNodeIds,
    treeLayout,
    rootNodeId,
    searchMatchingIds,
    storyLaneMode,
    currentRootKind,
    currentRootId,
    expandedStoryNodeIds,
    isMobileLayout,
    refs,
    filteredTreeIdSet,
    crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
    storyNodeMinWidth: STORY_NODE_MIN_WIDTH,
    storyNodeMaxWidth: STORY_NODE_MAX_WIDTH,
    storyNodeMinHeight: STORY_NODE_MIN_HEIGHT,
    storyNodeMaxHeight: STORY_NODE_MAX_HEIGHT,
  });

  const { hoverNodeIds, hoverEdgeIds, activeLinkedNodeIds } = usePlannerEdgeHoverState({
    baseEdges,
    hoveredNodeId,
    hoveredEdgeId,
    activePortalRefId,
    refs,
  });

  const { baseNodes, handleNodesChange, draggedNodeIdRef } = usePlannerBaseNodeState({
    baseTreeNodes,
  });

  const flowNodes = usePlannerFlowNodes({
    baseNodes,
    selectedNodeId,
    activeLinkedNodeIds,
    hoverNodeIds,
    dropTargetNodeId,
    hoveredNodeId,
    hoveredEdgeId,
    isMobileLayout,
    toggleNodeCollapse,
    setSelectedNodeId,
    persistNodeBody,
    toggleStoryCardExpand,
    startStoryNodeResize,
    resetStoryNodeSize,
  });

  const visiblePortals = usePlannerVisiblePortals({
    crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
    refs,
    filteredTreeIdSet,
    baseNodes,
    isMobileLayout,
    activePortalRefId,
    defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
    chooseAnchorNodeId,
    bubbleDisplayToken,
    rgbaFromHex,
  });

  const { flowEdges, reactFlowNodes } = usePlannerFlowGraph({
    baseEdges,
    hoverEdgeIds,
    hoveredEdgeId,
    hoveredNodeId,
    flowNodes,
    visiblePortals,
  });

  const { saveStatus, showSaveError, onNodeDoubleClick } = usePlannerFlowUiFeedback(rfInstance);

  const {
    currentRootNode,
    currentRootPath,
    projectPages,
    activeProjectPageIndex,
    activeProjectPageId,
    selectedNodeChildren,
    selectedNodeCollapsed,
    selectedNodeHasStoryChildren,
  } = usePlannerViewDerivedState({
    currentRootId,
    rootNodeId,
    selectedNodeId,
    nodesById,
    childrenByParent,
    collapsedNodeIds,
  });

  const {
    selectedNodeRefs,
    selectedNodeRefIds,
    describeRefTargets,
    describeRefLibraryPreview,
    filteredRefs,
    newRefSuggestions,
    nextAutoBubbleCode,
    effectiveNewBubbleCode,
    canCreateBubbleFromInput,
    bubblePrefixSuggestions,
    editableRefTargets,
    linkableNodeOptions,
    activePortalRef,
    activePortalTargets,
    mergeCandidateRefs,
  } = usePlannerCrossRefDerivedState({
    refs,
    nodes,
    nodesById,
    visibleTreeIdSet,
    selectedNodeId,
    activePortalRefId,
    effectiveBubbleTargetId,
    editRefId,
    refSearchQuery,
    refCategoryFilter,
    refScopeFilter,
    newRefLabel,
    newRefCode,
    linkNodeQuery,
  });

  const { hydrateRefEditor } = usePlannerCrossRefUiSync({
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
  });

  const buildDefaultPortalPosition = usePlannerDefaultPortalPosition({
    resolveNodePosition,
    defaultPortalPositionForAnchor,
  });

  const {
    openProjectPage,
    goPrevProjectPage,
    goNextProjectPage,
    goGrandmotherView,
    goUpOneView,
    openSelectedAsMaster,
    openSelectedAsStoryLane,
  } = usePlannerNavigationActions({
    nodesById,
    rootNodeId,
    currentRootParentId: currentRootNode?.parentId || null,
    selectedNodeId,
    projectPages,
    activeProjectPageIndex,
    setCurrentRootId,
    setSelectedNodeId,
    setStoryLaneMode,
    setActivePortalRefId,
  });

  const { saveSelectedBody } = usePlannerBodySaveActions({
    persistNodeBody,
    selectedNodeId,
    bodyDraft,
  });

  const { createChild, deleteSelected } = usePlannerCreateDeleteActions({
    firestore: db,
    userUid: user.uid,
    newChildTitle,
    selectedNodeId,
    currentRootId,
    rootNodeId,
    childrenByParent,
    nodesById,
    refs,
    newNodeDocId,
    resolveNodePosition,
    chooseAnchorNodeId,
    resolvePortalFollowPosition,
    crossRefToFirestoreSetData,
    pushHistory,
    setBusyAction,
    setError,
    setNewChildTitle,
    setPendingSelectedNodeId,
    setPendingRenameNodeId,
    setCurrentRootId,
    setSelectedNodeId,
    setActivePortalRefId,
  });

  const {
    renameSelected,
    setNodeTaskStatus,
    addStoryStep,
    toggleStoryStepDone,
    deleteStoryStep,
    moveStoryStep,
    setNodeColor,
  } = usePlannerNodeMutationActions({
    firestore: db,
    userUid: user.uid,
    selectedNodeId,
    selectedNode,
    renameTitle,
    setRenameTitle,
    newStoryStepText,
    setNewStoryStepText,
    nodesById,
    pushHistory,
    applyLocalNodePatch,
    setBusyAction,
    setError,
  });

  const {
    organizeVisibleTree,
    organizeSelectedBranch,
  } = usePlannerLayoutActions({
    firestore: db,
    userUid: user.uid,
    treeLayout,
    filteredTreeIds,
    filteredTreeIdSet,
    selectedNodeId,
    nodesById,
    childrenByParent,
    pushHistory,
    setBusyAction,
    setError,
    setNodes,
  });

  const { cleanUpCrossRefs } = useCrossRefMaintenanceActions({
    firestore: db,
    userUid: user.uid,
    refs,
    nodesById,
    activePortalRefId,
    editRefId,
    resolveNodePosition,
    chooseAnchorNodeId,
    resolvePortalFollowPosition,
    hydrateRefEditor,
    setActivePortalRefId,
    setBusyAction,
    setError,
  });

  const {
    linkCrossRefToNode,
    applyBubbleSuggestion,
    createCrossRef,
  } = useCrossRefCreationActions({
    firestore: db,
    userUid: user.uid,
    refs,
    effectiveBubbleTargetId,
    newRefCode,
    newRefLabel,
    newRefColor,
    newRefType,
    nextAutoBubbleCode,
    bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
    defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
    newRefLabelInputRef,
    pushHistory,
    chooseAnchorNodeId,
    resolveNodePosition,
    resolvePortalFollowPosition,
    buildDefaultPortalPosition,
    hydrateRefEditor,
    setBusyAction,
    setError,
    setActivePortalRefId,
    setLinkNodeQuery,
    setLinkTargetNodeId,
    setNewRefLabel,
    setNewRefCode,
    setNewRefColor,
    setNewRefType,
    setRefs,
  });

  const {
    duplicateCrossRef,
    mergeCrossRefIntoEdited,
  } = useCrossRefMergeActions({
    firestore: db,
    userUid: user.uid,
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
  });

  const {
    saveCrossRefEdits,
    saveMobileQuickBubbleName,
    updateCrossRefColor,
  } = useCrossRefEditActions({
    firestore: db,
    userUid: user.uid,
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
  });

  const {
    deleteCrossRefBubble,
    deletePortalByRefId,
    detachCrossRef,
  } = useCrossRefDeleteDetachActions({
    firestore: db,
    userUid: user.uid,
    refs,
    editRefId,
    activePortalRefId,
    pushHistory,
    crossRefToFirestoreSetData,
    hydrateRefEditor,
    chooseAnchorNodeId,
    resolveNodePosition,
    resolvePortalFollowPosition,
    closePortalContextMenu: () => setPortalContextMenu(null),
    setBusyAction,
    setError,
    setRefs,
    setActivePortalRefId,
    setLinkNodeQuery,
    setLinkTargetNodeId,
  });

  const {
    onNodeDrag,
    onNodeDragStop,
    onSelectionDragStop,
  } = usePlannerDragActions({
    firestore: db,
    userUid: user.uid,
    rfInstance,
    childrenByParent,
    nodesById,
    collapsedNodeIds,
    rootNodeId,
    pushHistory,
    setNodes,
    setDropTargetNodeId,
    setError,
    showSaveError,
    isDraggingRef,
    draggedNodeIdRef,
    dropTargetIdRef,
  });

  // Context menu handlers
  const {
    handleContextAddChild,
    handleContextAddStorySibling,
    handleContextDelete,
    handleContextDuplicate,
    handleContextChangeType,
    handleContextToggleTaskStatus,
  } = usePlannerContextNodeActions({
    firestore: db,
    userUid: user.uid,
    rootNodeId,
    currentRootId,
    selectedNodeId,
    childrenByParent,
    nodesById,
    refs,
    newNodeDocId,
    pushHistory,
    resolveNodePosition,
    chooseAnchorNodeId,
    resolvePortalFollowPosition,
    crossRefToFirestoreSetData,
    nextNodeKind,
    applyLocalNodePatch,
    setNodeTaskStatus,
    setBusyAction,
    setError,
    setCurrentRootId,
    setSelectedNodeId,
    setActivePortalRefId,
    setPendingSelectedNodeId,
    setPendingRenameNodeId,
  });

  const {
    handleContextAddCrossRef,
    handleContextRename,
    selectRefForEditing,
  } = usePlannerContextUiActions({
    crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
    isMobileLayout,
    newRefCode,
    newRefColor,
    nextAutoBubbleCode,
    defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
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
  });

  const {
    jumpToReferencedNode,
    toggleStoryLane,
    focusNodeSearch,
    runPaletteAction,
  } = usePlannerCommandActions({
    rootNodeId,
    nodesById,
    setCurrentRootId,
    setSelectedNodeId,
    setActivePortalRefId,
    setStoryLaneMode,
    setSidebarCollapsed,
    setMobileSidebarSection,
    setMobileSidebarOpen,
    searchInputRef,
    setPaletteOpen,
    setPaletteQuery,
    setPaletteIndex,
  });

  const paletteItems = usePlannerPaletteItems({
    paletteQuery,
    crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
    bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
    currentRootKind,
    storyLaneMode,
    selectedNodeId,
    nodesById,
    nodes,
    refs,
    goGrandmotherView,
    goUpOneView,
    organizeVisibleTree,
    cleanUpCrossRefs,
    toggleStoryLane,
    openSelectedAsMaster,
    organizeSelectedBranch,
    openSelectedAsStoryLane,
    handleContextAddStorySibling,
    handleContextAddChild,
    handleContextChangeType,
    handleContextToggleTaskStatus,
    focusNodeSearch,
    jumpToReferencedNode,
    openBubblesPanel,
    selectRefForEditing,
    linkCrossRefToNode,
    nextNodeKind,
  });

  usePlannerKeyboardShortcuts({
    paletteOpen,
    setPaletteOpen,
    paletteIndex,
    setPaletteIndex,
    setPaletteQuery,
    paletteItems,
    paletteInputRef,
    runPaletteAction,
    contextMenuOpen: !!contextMenu,
    activePortalRefId,
    deletePortalByRefId,
    handleContextAddChild,
    handleContextDelete,
    handleContextDuplicate,
    selectedNodeId,
    mobileQuickEditorOpen,
    setMobileQuickEditorOpen,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    searchQuery,
    setSearchQuery,
    setSelectedNodeId,
    setActivePortalRefId,
    searchInputRef,
    canUndo,
    canRedo,
    undo,
    redo,
    applyLocalOps,
    busyAction,
  });

  const sidebarIsCollapsed = !isMobileLayout && sidebarCollapsed;
  const {
    showProjectSection,
    showNodeSection,
    showBubblesSection,
    showSimpleBubblesSection,
  } = usePlannerSidebarSectionVisibility({
    isMobileLayout,
    mobileSidebarSection,
    crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
    bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
  });

  if (!db) {
    return (
      <div className="planner-empty-state">
        Firestore is not available. Configure Firebase credentials to use the planning graph editor.
      </div>
    );
  }

  if (loading) {
    return <div className="planner-empty-state">Loading your planning graph...</div>;
  }

  return (
    <div className={`planner-shell ${sidebarIsCollapsed ? "sidebar-collapsed" : ""} ${isMobileLayout ? "mobile" : ""}`}>
      <aside
        className={`planner-sidebar ${sidebarIsCollapsed ? "collapsed" : ""} ${isMobileLayout ? (mobileSidebarOpen ? "mobile-open" : "mobile-hidden") : ""}`}
      >
        <div className="planner-sidebar-header">
          {!sidebarIsCollapsed && (
            <div className="planner-undo-redo-btns">
              <button
                className="planner-undo-redo-btn"
                onClick={() => undo(applyLocalOps)}
                disabled={!canUndo || busyAction}
                title={undoLabel ? `Undo: ${undoLabel}` : "Undo (⌘Z)"}
                aria-label="Undo"
              >
                ↩
              </button>
              <button
                className="planner-undo-redo-btn"
                onClick={() => redo(applyLocalOps)}
                disabled={!canRedo || busyAction}
                title={redoLabel ? `Redo: ${redoLabel}` : "Redo (⌘⇧Z)"}
                aria-label="Redo"
              >
                ↪
              </button>
            </div>
          )}
          <button
            onClick={() => {
              if (isMobileLayout) {
                setMobileSidebarOpen(false);
                return;
              }
              setSidebarCollapsed(!sidebarCollapsed);
            }}
            className="planner-sidebar-toggle"
            aria-label={isMobileLayout ? "Close controls" : sidebarIsCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isMobileLayout ? "✕" : sidebarIsCollapsed ? "→" : "←"}
          </button>
        </div>

        {sidebarIsCollapsed ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            paddingTop: "12px",
          }}>
            <div style={{
              fontSize: "10px",
              color: "rgba(245, 248, 255, 0.6)",
              textAlign: "center",
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              letterSpacing: "1px",
              fontWeight: 700,
            }}>
              Controls
            </div>
          </div>
        ) : (
          <>
        {/* Search Input */}
        <div style={{
          padding: "12px 12px 0",
          marginBottom: "12px",
        }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={isMobileLayout ? "Search nodes..." : "Search nodes... (Ctrl+F)"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.05)",
              color: "rgba(245, 248, 255, 0.94)",
              fontSize: isMobileLayout ? "16px" : "13px",
              outline: "none",
              transition: "all 150ms ease",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(34, 197, 94, 0.5)";
              e.target.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(255, 255, 255, 0.15)";
              e.target.style.background = "rgba(255, 255, 255, 0.05)";
            }}
          />
          {searchMatchingIds.size > 0 && (
            <div style={{
              marginTop: "6px",
              fontSize: "11px",
              color: "rgba(34, 197, 94, 0.9)",
              fontWeight: 600,
            }}>
              {searchMatchingIds.size} match{searchMatchingIds.size !== 1 ? "es" : ""} found
            </div>
          )}
          <button
            className="planner-palette-launcher"
            onClick={() => {
              setPaletteOpen(true);
              setPaletteQuery("");
              setPaletteIndex(0);
            }}
          >
            Command palette (Cmd/Ctrl+K)
          </button>
          {!isMobileLayout ? (
            <div className="planner-top-actions">
              <button onClick={organizeSelectedBranch} disabled={busyAction || !selectedNodeId}>
                Clean up selected branch
              </button>
              {CROSS_REFERENCES_ENABLED && !BUBBLES_SIMPLIFIED_MODE ? (
                <button onClick={cleanUpCrossRefs} disabled={busyAction}>
                  Clean stale bubbles
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {isMobileLayout ? (
          <div className="planner-mobile-section-tabs">
            <button
              className={mobileSidebarSection === "project" ? "active" : ""}
              onClick={() => setMobileSidebarSection("project")}
            >
              Project
            </button>
            <button
              className={mobileSidebarSection === "node" ? "active" : ""}
              onClick={() => setMobileSidebarSection("node")}
            >
              Node
            </button>
            {CROSS_REFERENCES_ENABLED ? (
              <button
                className={mobileSidebarSection === "bubbles" ? "active" : ""}
                onClick={() => openBubblesPanel(true)}
              >
                Bubbles
              </button>
            ) : null}
          </div>
        ) : null}

        {showProjectSection ? (
          <>
        <div id="project-overview-panel" className="planner-panel-block">
          <h2>{profileName || "Main Node"}</h2>
          <p className="planner-subtle">{user.email}</p>
          <p className="planner-subtle">
            Current view: <strong>{currentRootPath || "No selection"}</strong>
          </p>
          {currentRootId && rootNodeId && currentRootId !== rootNodeId ? (
            <p className="planner-subtle">Isolated view active. Use “Back to main workspace” to return.</p>
          ) : null}
          <div className="planner-row-label">Project pages</div>
          {projectPages.length === 0 ? (
            <p className="planner-subtle">No top-level project pages yet.</p>
          ) : (
            <>
              <div className="planner-inline-buttons">
                <button onClick={goPrevProjectPage} disabled={projectPages.length < 2}>
                  Previous project
                </button>
                <button onClick={goNextProjectPage} disabled={projectPages.length < 2}>
                  Next project
                </button>
              </div>
              <select
                value={activeProjectPageId}
                onChange={(event) => {
                  if (!event.target.value) return;
                  openProjectPage(event.target.value);
                }}
              >
                {activeProjectPageId === "" ? <option value="">Select a project page</option> : null}
                {projectPages.map((project, index) => (
                  <option key={project.id} value={project.id}>
                    {`${index + 1}. ${project.title}`}
                  </option>
                ))}
              </select>
              <p className="planner-subtle">
                {activeProjectPageIndex >= 0
                  ? `Page ${activeProjectPageIndex + 1} of ${projectPages.length} — URL keeps this page.`
                  : "You are outside top-level project pages. Pick one above to normalize."}
              </p>
            </>
          )}
          <div className="planner-inline-buttons">
            <button onClick={goGrandmotherView} disabled={!rootNodeId} title="Return to your full workspace root">
              Back to main workspace
            </button>
            <button onClick={goUpOneView} disabled={!currentRootNode?.parentId} title="Move one level up from the current view">
              Parent view
            </button>
          </div>
          <p className="planner-subtle">Back to main workspace returns to the root. Parent view moves one level up.</p>
          <button onClick={openSelectedAsMaster} disabled={!selectedNodeId}>
            Open selected as master
          </button>
          <div className="planner-inline-buttons">
            <button onClick={openSelectedAsStoryLane} disabled={!selectedNodeId || selectedNode?.kind !== "story"}>
              Open selected in story lane
            </button>
            <button onClick={() => setStoryLaneMode((prev) => !prev)} disabled={currentRootKind !== "story"}>
              {storyLaneMode ? "Story lane: on" : "Story lane: off"}
            </button>
          </div>
          <div className="planner-row-label">Quick maintenance</div>
          <div className="planner-inline-buttons">
            <button onClick={organizeVisibleTree} disabled={busyAction || filteredTreeIds.length === 0}>
              Clean up visible tree
            </button>
            <button onClick={organizeSelectedBranch} disabled={busyAction || !selectedNodeId}>
              Clean up selected branch
            </button>
            {CROSS_REFERENCES_ENABLED && !BUBBLES_SIMPLIFIED_MODE ? (
              <button onClick={cleanUpCrossRefs} disabled={busyAction}>
                Clean stale bubbles
              </button>
            ) : null}
          </div>
        </div>

        <div className="planner-panel-block">
          <h3>Add Child Node</h3>
          <p className="planner-subtle">Leave blank to create a default node name and rename immediately.</p>
          <input
            value={newChildTitle}
            onChange={(event) => setNewChildTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (busyAction) return;
              void createChild();
            }}
            placeholder="Film Production, Education, Finance..."
          />
          <button
            onClick={createChild}
            disabled={busyAction || (!selectedNodeId && !currentRootId && !rootNodeId)}
          >
            Add child
          </button>
        </div>
          </>
        ) : null}

        {showNodeSection ? (
        <div className="planner-panel-block">
          <h3>Selected Node</h3>
          {selectedNode ? (
            <>
              <div className="planner-row-label">Path</div>
              <div className="planner-path">{buildNodePath(selectedNode.id, nodesById)}</div>
              <div className="planner-inline-buttons">
                <button onClick={organizeSelectedBranch} disabled={busyAction}>
                  Clean up this branch
                </button>
              </div>
              <div className="planner-row-label">Type</div>
              <div className="planner-inline-buttons">
                <button
                  onClick={() => handleContextChangeType(selectedNode.id)}
                  disabled={busyAction || selectedNode.kind === "root"}
                >
                  {selectedNode.kind === "root" ? "Root" : `Set as ${nextNodeKind(selectedNode.kind)}`}
                </button>
                <button disabled>{selectedNode.kind}</button>
              </div>
              <div className="planner-row-label">Task status</div>
              <div className="planner-inline-buttons">
                <select
                  value={selectedNode.taskStatus || "none"}
                  onChange={(event) => {
                    void setNodeTaskStatus(selectedNode.id, event.target.value as TaskStatus);
                  }}
                  disabled={busyAction || selectedNode.kind === "root"}
                >
                  <option value="none">No task</option>
                  <option value="todo">Todo</option>
                  <option value="done">Done</option>
                </select>
                <button
                  onClick={() => {
                    const current = selectedNode.taskStatus || "none";
                    const nextStatus: TaskStatus = current === "done" ? "todo" : "done";
                    void setNodeTaskStatus(selectedNode.id, nextStatus);
                  }}
                  disabled={busyAction || selectedNode.kind === "root"}
                >
                  {selectedNode.taskStatus === "done" ? "Mark todo" : "Mark done"}
                </button>
              </div>
              <div className="planner-row-label">Color</div>
              <div className="planner-inline-buttons">
                <input
                  type="color"
                  value={selectedNode.color || (selectedNodeHasStoryChildren ? storyContainerColor() : defaultNodeColor(selectedNode.kind))}
                  onChange={(event) => {
                    void setNodeColor(selectedNode.id, event.target.value);
                  }}
                  disabled={busyAction}
                  style={{ width: "72px", height: "34px", padding: "4px 6px" }}
                />
                <button
                  onClick={() => {
                    void setNodeColor(selectedNode.id, undefined);
                  }}
                  disabled={busyAction || !selectedNode.color}
                >
                  Reset color
                </button>
              </div>
              <input
                ref={renameInputRef}
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (busyAction) return;
                  void renameSelected();
                }}
              />
              <div className="planner-inline-buttons">
                <button onClick={renameSelected} disabled={busyAction || renameTitle.trim().length === 0}>
                  Rename
                </button>
                <button
                  className="danger"
                  onClick={deleteSelected}
                  disabled={busyAction || selectedNode.id === rootNodeId}
                >
                  Delete subtree
                </button>
              </div>
              <div className="planner-row-label">Body text</div>
              <textarea
                value={bodyDraft}
                onChange={(event) => setBodyDraft(event.target.value)}
                placeholder={
                  selectedNode.kind === "story"
                    ? "Write scene/story details for this node..."
                    : "Write extended notes for this node..."
                }
                rows={selectedNode.kind === "story" ? 7 : 5}
                disabled={busyAction}
              />
              <button onClick={saveSelectedBody} disabled={busyAction || bodyDraft.trim() === (selectedNode.body || "").trim()}>
                Save body text
              </button>

              <div className="planner-row-label">Children</div>
              <div className="planner-chip-list">
                {selectedNodeChildren.length === 0 ? (
                  <span className="planner-subtle">No child nodes yet.</span>
                ) : (
                  selectedNodeChildren.map((child) => (
                    <button
                      key={child.id}
                      className="chip"
                      onClick={() => {
                        setSelectedNodeId(child.id);
                        setActivePortalRefId(null);
                      }}
                    >
                      <span className={child.taskStatus === "done" ? "planner-node-title done" : ""}>{child.title}</span>
                    </button>
                  ))
                )}
              </div>
              {selectedNodeChildren.length > 0 ? (
                <button
                  onClick={() => toggleNodeCollapse(selectedNode.id)}
                  type="button"
                >
                  {selectedNodeCollapsed ? "Expand children" : "Collapse children"}
                </button>
              ) : null}
              {CROSS_REFERENCES_ENABLED ? (
                <>
                  <div className="planner-row-label">Bubbles</div>
                  <div className="planner-inline-buttons">
                    <button
                      onClick={() => {
                        void handleContextAddCrossRef(selectedNode.id);
                      }}
                    >
                      Add bubble to this node
                    </button>
                  </div>
                </>
              ) : null}

              {selectedNode.kind === "story" ? (
                <>
                  <div className="planner-row-label">Story lane</div>
                  <div className="planner-inline-buttons">
                    <button onClick={openSelectedAsStoryLane}>Open this story in lane view</button>
                    <button
                      onClick={() => {
                        void handleContextAddChild(selectedNode.id);
                      }}
                      disabled={busyAction}
                    >
                      Add beat node
                    </button>
                  </div>
                  <p className="planner-subtle">
                    Lane view arranges child nodes left-to-right as beats. Use each beat node's body text for long scene notes.
                  </p>
                  <details className="planner-advanced-tools">
                    <summary>Legacy checklist beats (optional)</summary>
                    <div className="planner-advanced-tools-content">
                      <div className="planner-reference-list">
                        {(selectedNode.storySteps || []).length === 0 ? (
                          <span className="planner-subtle">No checklist beats yet.</span>
                        ) : (
                          (selectedNode.storySteps || []).map((step, index) => (
                            <div key={step.id} className="planner-story-step-item">
                              <button
                                className="planner-story-step-toggle"
                                onClick={() => {
                                  void toggleStoryStepDone(step.id);
                                }}
                                disabled={busyAction}
                                title={step.done ? "Mark as not done" : "Mark as done"}
                              >
                                {step.done ? "☑" : "☐"}
                              </button>
                              <span className={step.done ? "planner-story-step-text done" : "planner-story-step-text"}>
                                {`${index + 1}. ${step.text}`}
                              </span>
                              <div className="planner-story-step-actions">
                                <button
                                  onClick={() => {
                                    void moveStoryStep(step.id, -1);
                                  }}
                                  disabled={busyAction || index === 0}
                                  title="Move up"
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => {
                                    void moveStoryStep(step.id, 1);
                                  }}
                                  disabled={busyAction || index === (selectedNode.storySteps || []).length - 1}
                                  title="Move down"
                                >
                                  ↓
                                </button>
                                <button
                                  className="danger"
                                  onClick={() => {
                                    void deleteStoryStep(step.id);
                                  }}
                                  disabled={busyAction}
                                  title="Delete step"
                                >
                                  x
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="planner-story-step-add">
                        <input
                          value={newStoryStepText}
                          onChange={(event) => setNewStoryStepText(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            if (busyAction || newStoryStepText.trim().length === 0) return;
                            void addStoryStep();
                          }}
                          placeholder="Add checklist beat..."
                          disabled={busyAction}
                        />
                        <button onClick={addStoryStep} disabled={busyAction || newStoryStepText.trim().length === 0}>
                          Add step
                        </button>
                      </div>
                    </div>
                  </details>
                </>
              ) : null}
            </>
          ) : (
            <p className="planner-subtle">No node selected.</p>
          )}
        </div>
        ) : null}

        {showSimpleBubblesSection ? (
        <div id="cross-ref-bubbles-panel" className="planner-panel-block">
          <h3>Bubbles</h3>
          <p className="planner-subtle">
            Local visual bubbles for each node. No cross-linking between nodes.
          </p>
          <div className="planner-row-label">Selected node target</div>
          <div className="planner-chip-list">
            {bubbleTargetNode ? (
              <button
                className="chip"
                onClick={() => {
                  setSelectedNodeId(bubbleTargetNode.id);
                  setActivePortalRefId(null);
                }}
                title={buildNodePath(bubbleTargetNode.id, nodesById)}
              >
                {bubbleTargetNode.title}
              </button>
            ) : (
              <span className="planner-subtle">Tap a node, then add a bubble.</span>
            )}
          </div>
          {bubbleTargetNode ? (
            <div className={`planner-path planner-bubble-target-path${isMobileLayout ? " planner-path-tail" : ""}`}>
              {isMobileLayout
                ? buildNodePathTail(bubbleTargetNode.id, nodesById, 3)
                : buildNodePath(bubbleTargetNode.id, nodesById)}
            </div>
          ) : (
            <p className="planner-subtle">
              Tap any node on the canvas. This panel always targets your current selection.
            </p>
          )}
          {isMobileLayout ? (
            <>
              <div className="planner-row-label">
                {bubbleTargetNode ? `Quick add to: ${bubbleTargetNode.title}` : "Tap a node first"}
              </div>
              <div className="planner-inline-buttons planner-mobile-bubble-aux-row">
                <button
                  type="button"
                  onClick={() => openMobileQuickBubble(effectiveBubbleTargetId || undefined, true)}
                  disabled={!effectiveBubbleTargetId}
                >
                  Quick Add Bubble
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileQuickBubbleOpen(false);
                    setMobileSidebarOpen(false);
                    setMobileQuickEditorOpen(false);
                  }}
                >
                  Pick Node
                </button>
              </div>
              <p className="planner-subtle">
                Quick Add opens a short sheet with one input and one Add button.
              </p>
              <details className="planner-advanced-tools">
                <summary>Advanced bubble options</summary>
                <div className="planner-advanced-tools-content">
                  <div className="planner-inline-buttons planner-mobile-bubble-input-row">
                    <input
                      ref={newRefLabelInputRef}
                      value={newRefLabel}
                      onChange={(event) => setNewRefLabel(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        if (busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput) return;
                        void createCrossRef();
                      }}
                      placeholder="Bubble name"
                    />
                    <button
                      onClick={() => {
                        void createCrossRef();
                      }}
                      disabled={busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput}
                    >
                      Add
                    </button>
                  </div>
                  <div className="planner-inline-buttons planner-mobile-bubble-aux-row">
                    <button type="button" onClick={blurActiveInput}>
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => openMobileQuickBubble(effectiveBubbleTargetId || undefined, true)}
                      disabled={!effectiveBubbleTargetId}
                    >
                      Open Quick Add
                    </button>
                  </div>
                  <div className="planner-inline-buttons">
                    <label style={{ display: "grid", gap: 4, alignItems: "center" }}>
                      <span className="planner-subtle" style={{ fontSize: 11 }}>Color</span>
                      <input
                        type="color"
                        value={newRefColor}
                        onChange={(event) => setNewRefColor(event.target.value)}
                        style={{ width: 54, height: 34, padding: "4px 6px" }}
                      />
                    </label>
                    <div style={{ display: "grid", gap: 4, flex: 1 }}>
                      <input
                        value={newRefCode}
                        onChange={(event) => setNewRefCode(event.target.value)}
                        placeholder={`Code (auto ${nextAutoBubbleCode})`}
                        style={{ flex: 1 }}
                      />
                      <span className="planner-subtle" style={{ fontSize: 11 }}>
                        New bubble code: <strong>{effectiveNewBubbleCode}</strong>
                      </span>
                    </div>
                  </div>
                  {bubblePrefixSuggestions.length > 0 ? (
                    <>
                      <div className="planner-row-label">Similar bubble styles</div>
                      <div className="planner-chip-list">
                        {bubblePrefixSuggestions.map((ref) => (
                          <button
                            key={`template:${ref.id}`}
                            className="chip"
                            onClick={() => applyBubbleSuggestion(ref)}
                            title={`Use style from ${ref.label} (${ref.code})`}
                            style={{
                              borderColor: rgbaFromHex(ref.color, 0.9, "rgba(64,182,255,0.88)"),
                              boxShadow: `0 0 0 1px ${rgbaFromHex(ref.color, 0.25, "rgba(64,182,255,0.2)")}`,
                            }}
                          >
                            {ref.label}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              </details>
            </>
          ) : (
            <>
              <div className="planner-row-label">
                {bubbleTargetNode ? `Add bubble to: ${bubbleTargetNode.title}` : "Tap a node first"}
              </div>
              <input
                ref={newRefLabelInputRef}
                value={newRefLabel}
                onChange={(event) => setNewRefLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput) return;
                  void createCrossRef();
                }}
                placeholder="Bubble name"
              />
              <button
                onClick={() => {
                  void createCrossRef();
                }}
                disabled={busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput}
              >
                {effectiveBubbleTargetId ? "Add Bubble to Selected Node" : "Select Node to Add Bubble"}
              </button>
              <div className="planner-inline-buttons">
                <label style={{ display: "grid", gap: 4, alignItems: "center" }}>
                  <span className="planner-subtle" style={{ fontSize: 11 }}>Color</span>
                  <input
                    type="color"
                    value={newRefColor}
                    onChange={(event) => setNewRefColor(event.target.value)}
                    style={{ width: 54, height: 34, padding: "4px 6px" }}
                  />
                </label>
                <div style={{ display: "grid", gap: 4, flex: 1 }}>
                  <input
                    value={newRefCode}
                    onChange={(event) => setNewRefCode(event.target.value)}
                    placeholder={`Code (auto ${nextAutoBubbleCode})`}
                    style={{ flex: 1 }}
                  />
                  <span className="planner-subtle" style={{ fontSize: 11 }}>
                    New bubble code: <strong>{effectiveNewBubbleCode}</strong>
                  </span>
                </div>
              </div>
              {bubblePrefixSuggestions.length > 0 ? (
                <>
                  <div className="planner-row-label">Similar bubble styles</div>
                  <div className="planner-chip-list">
                    {bubblePrefixSuggestions.map((ref) => (
                      <button
                        key={`template:${ref.id}`}
                        className="chip"
                        onClick={() => applyBubbleSuggestion(ref)}
                        title={`Use style from ${ref.label} (${ref.code})`}
                        style={{
                          borderColor: rgbaFromHex(ref.color, 0.9, "rgba(64,182,255,0.88)"),
                          boxShadow: `0 0 0 1px ${rgbaFromHex(ref.color, 0.25, "rgba(64,182,255,0.2)")}`,
                        }}
                      >
                        {ref.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
          <div className="planner-row-label">
            {bubbleTargetNode ? `Bubbles on ${bubbleTargetNode.title}` : "Bubbles on selected node"}
          </div>
          <div className="planner-chip-list">
            {selectedNodeRefs.length === 0 || !selectedNodeId ? (
              <span className="planner-subtle">No bubbles yet.</span>
            ) : (
              selectedNodeRefs.map((ref) => (
                <div key={ref.id} className="chip with-action">
                  <button
                    onClick={() => setActivePortalRefId((prev) => (prev === ref.id ? null : ref.id))}
                    title={ref.label}
                    style={{
                      borderColor: rgbaFromHex(ref.color, 0.9, "rgba(64,182,255,0.88)"),
                      boxShadow: `0 0 0 1px ${rgbaFromHex(ref.color, 0.25, "rgba(64,182,255,0.2)")}`,
                    }}
                  >
                    {ref.label}
                  </button>
                  <button
                    className="chip-action"
                    onClick={() => void deletePortalByRefId(ref.id)}
                    title="Delete bubble"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
          {activePortalRef ? (
            <div className="planner-panel-block" style={{ marginTop: 8, padding: "10px 12px" }}>
              <div className="planner-row-label">Selected bubble</div>
              <div className="planner-inline-buttons">
                <span className="planner-subtle" style={{ alignSelf: "center" }}>{`${activePortalRef.label} (${activePortalRef.code})`}</span>
                <input
                  type="color"
                  value={activePortalRef.color || DEFAULT_BUBBLE_COLOR}
                  onChange={(event) => {
                    void updateCrossRefColor(activePortalRef.id, event.target.value);
                  }}
                  style={{ width: 56, height: 34, padding: "4px 6px" }}
                />
              </div>
            </div>
          ) : null}
        </div>
        ) : null}

        {showBubblesSection ? (
        <div className="planner-panel-block">
          <h3>Bubbles</h3>
          <p className="planner-subtle">
            Shared entities across branches — vendor, partner, person, etc.
          </p>

          {/* ── CREATE / ATTACH ── */}
          <div className="planner-row-label">
            {selectedNode ? `Attach to: ${selectedNode.title}` : "Select a node to attach"}
          </div>
          <input
            ref={newRefLabelInputRef}
            value={newRefLabel}
            onChange={(event) => setNewRefLabel(event.target.value)}
            placeholder="Name (e.g., Mario Pinto, ACME Corp)"
          />
          <div className="planner-inline-buttons">
            <input
              value={newRefCode}
              onChange={(event) => setNewRefCode(event.target.value)}
              placeholder="Code (e.g., MP)"
              style={{ flex: 1 }}
            />
            <select value={newRefType} onChange={(event) => setNewRefType(event.target.value as EntityType)} style={{ flex: 1 }}>
              {ENTITY_TYPE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((entityType) => (
                    <option key={entityType} value={entityType}>
                      {entityType}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {(() => {
            const typedCode = newRefCode.trim() ? normalizeCode(newRefCode) : (newRefLabel.trim() ? initialsFromLabel(newRefLabel) : "");
            if (!typedCode) return null;
            const collisions = refs.filter((r) => r.code === typedCode);
            if (collisions.length === 0) return null;
            return (
              <p className="planner-code-collision-warn">
                ⚠ Code <strong>{typedCode}</strong> already used by:{" "}
                {collisions.map((r) => r.label).join(", ")}. Consider a longer code (e.g. <em>MPinto</em> vs <em>MPérez</em>).
              </p>
            );
          })()}
          <button
            onClick={() => {
              void createCrossRef();
            }}
            disabled={busyAction || !selectedNodeId || !canCreateBubbleFromInput}
          >
            Create and attach to selected
          </button>

          {newRefSuggestions.length > 0 ? (
            <>
              <div className="planner-row-label">Or attach existing</div>
              <div className="planner-chip-list">
                {newRefSuggestions.map((ref) => (
                  <button
                    key={ref.id}
                    className="chip"
                    onClick={() => {
                      if (!selectedNodeId) return;
                      linkCrossRefToNode(ref.id, selectedNodeId);
                    }}
                    title={describeRefTargets(ref, 4)}
                  >
                    {`${ref.code} — ${ref.label}`}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {/* ── ON SELECTED NODE ── */}
          <div className="planner-row-label">On selected node</div>
          <div className="planner-chip-list">
            {selectedNodeRefs.length === 0 || !selectedNodeId ? (
              <span className="planner-subtle">None attached.</span>
            ) : (
              selectedNodeRefs.map((ref) => (
                <div key={ref.id} className="chip with-action">
                  <button
                    onClick={() => selectRefForEditing(ref.id)}
                    title={describeRefTargets(ref, 4)}
                  >{`${ref.code} — ${ref.label}`}</button>
                  <button
                    className="chip-action"
                    onClick={() => detachCrossRef(ref.id, selectedNodeId)}
                    title="Detach from selected node"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* ── ACTIVE BUBBLE (set by clicking on canvas or selecting here) ── */}
          {activePortalRef ? (
            <div className="planner-panel-block" style={{ marginTop: 8, padding: "10px 12px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                {`${activePortalRef.code} — ${activePortalRef.label}`}
                <span className="planner-kind-badge" style={{ marginLeft: 6 }}>{activePortalRef.entityType}</span>
              </div>
              {activePortalRef.contact ? <p className="planner-subtle" style={{ margin: "2px 0" }}>{activePortalRef.contact}</p> : null}
              {activePortalRef.notes ? <p className="planner-subtle" style={{ margin: "2px 0" }}>{activePortalRef.notes}</p> : null}
              {activePortalRef.links.length > 0 ? (
                <div style={{ margin: "4px 0" }}>
                  {activePortalRef.links.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 11, wordBreak: "break-all" }}>
                      {url}
                    </a>
                  ))}
                </div>
              ) : null}
              <div className="planner-row-label" style={{ marginTop: 6 }}>Linked nodes</div>
              <div className="planner-reference-list">
                {activePortalTargets.map((target) => (
                  <button key={target.id} onClick={() => jumpToReferencedNode(target.id)}>
                    {buildNodePath(target.id, nodesById)}
                  </button>
                ))}
              </div>
              <div className="planner-inline-buttons" style={{ marginTop: 6 }}>
                <button
                  onClick={() => {
                    if (!selectedNodeId) return;
                    if (activePortalRef.nodeIds.includes(selectedNodeId)) {
                      void detachCrossRef(activePortalRef.id, selectedNodeId);
                    } else {
                      void linkCrossRefToNode(activePortalRef.id, selectedNodeId);
                    }
                  }}
                  disabled={busyAction || !selectedNodeId}
                >
                  {!selectedNodeId ? "Select node" : activePortalRef.nodeIds.includes(selectedNodeId) ? "Unlink selected" : "Link to selected"}
                </button>
                <button
                  onClick={() => {
                    selectRefForEditing(activePortalRef.id);
                  }}
                  disabled={busyAction}
                >
                  Edit bubble
                </button>
              </div>
            </div>
          ) : null}

          {/* ── BUBBLE MANAGER (full list + edit) ── */}
          <details className="planner-advanced-tools">
            <summary>Manage all bubbles ({refs.length})</summary>
            <div className="planner-advanced-tools-content">
              <div className="planner-filter-toggle">
                <button type="button" className={refScopeFilter === "view" ? "active" : ""} onClick={() => setRefScopeFilter("view")}>
                  This view
                </button>
                <button type="button" className={refScopeFilter === "all" ? "active" : ""} onClick={() => setRefScopeFilter("all")}>
                  All
                </button>
                <button
                  type="button"
                  className={refCategoryFilter === "people" ? "active" : ""}
                  onClick={() => setRefCategoryFilter(refCategoryFilter === "people" ? "all" : "people")}
                >
                  People
                </button>
              </div>
              <input
                value={refSearchQuery}
                onChange={(event) => setRefSearchQuery(event.target.value)}
                placeholder="Search bubbles..."
              />
              <div className="planner-reference-list">
                {filteredRefs.length === 0 ? (
                  <span className="planner-subtle">
                    {refs.length === 0 ? "No bubbles yet." : "No matches."}
                  </span>
                ) : (
                  filteredRefs.map((ref) => {
                    const linkedOnSelected = selectedNodeId ? selectedNodeRefIds.has(ref.id) : false;
                    return (
                      <div key={ref.id} className="planner-reference-item">
                        <button onClick={() => selectRefForEditing(ref.id)}>{`${ref.code} — ${ref.label}`}</button>
                        <div className="planner-reference-preview">{describeRefLibraryPreview(ref)}</div>
                        <div className="planner-reference-actions">
                          <button
                            onClick={() => {
                              if (!selectedNodeId) return;
                              if (linkedOnSelected) {
                                detachCrossRef(ref.id, selectedNodeId);
                              } else {
                                linkCrossRefToNode(ref.id, selectedNodeId);
                              }
                            }}
                            disabled={busyAction || !selectedNodeId}
                          >
                            {!selectedNodeId ? "Select node" : linkedOnSelected ? "Unlink" : "Link to selected"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Edit active bubble */}
              {editRefId ? (
                <>
                  <div className="planner-row-label">
                    Editing: {editRefLabel || "—"}
                  </div>
                  <input
                    value={editRefLabel}
                    onChange={(event) => setEditRefLabel(event.target.value)}
                    placeholder="Bubble name"
                  />
                  <div className="planner-inline-buttons">
                    <input
                      value={editRefCode}
                      onChange={(event) => setEditRefCode(event.target.value)}
                      placeholder="Code"
                      style={{ flex: 1 }}
                    />
                    <select
                      value={editRefType}
                      onChange={(event) => setEditRefType(event.target.value as EntityType)}
                      style={{ flex: 1 }}
                    >
                      {ENTITY_TYPE_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map((entityType) => (
                            <option key={entityType} value={entityType}>{entityType}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <input
                    value={editRefTags}
                    onChange={(event) => setEditRefTags(event.target.value)}
                    placeholder="Tags (comma-separated)"
                  />
                  <input
                    value={editRefContact}
                    onChange={(event) => setEditRefContact(event.target.value)}
                    placeholder="Contact info"
                  />
                  <textarea
                    value={editRefNotes}
                    onChange={(event) => setEditRefNotes(event.target.value)}
                    placeholder="Notes"
                    rows={3}
                  />
                  <textarea
                    value={editRefLinks}
                    onChange={(event) => setEditRefLinks(event.target.value)}
                    placeholder="One URL per line"
                    rows={2}
                  />
                  <div className="planner-inline-buttons">
                    <button onClick={saveCrossRefEdits} disabled={busyAction || editRefLabel.trim().length === 0}>
                      Save
                    </button>
                    <button onClick={() => void duplicateCrossRef(editRefId)} disabled={busyAction}>
                      Duplicate
                    </button>
                  </div>

                  {/* Link to another node */}
                  <div className="planner-row-label">Link to node</div>
                  <input
                    value={linkNodeQuery}
                    onChange={(event) => setLinkNodeQuery(event.target.value)}
                    placeholder="Search node..."
                  />
                  <select value={linkTargetNodeId} onChange={(event) => setLinkTargetNodeId(event.target.value)}>
                    <option value="">Choose node...</option>
                    {linkableNodeOptions.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.path}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => { if (editRefId && linkTargetNodeId) linkCrossRefToNode(editRefId, linkTargetNodeId); }}
                    disabled={busyAction || !linkTargetNodeId}
                  >
                    Link node
                  </button>

                  {/* Linked nodes */}
                  <div className="planner-row-label">All linked nodes</div>
                  <div className="planner-reference-list">
                    {editableRefTargets.length === 0 ? (
                      <span className="planner-subtle">Not linked to any node yet.</span>
                    ) : (
                      editableRefTargets.map((entry) => (
                        <div key={entry.id} className="planner-reference-target-item">
                          <button onClick={() => jumpToReferencedNode(entry.id)}>{entry.path}</button>
                          <button className="danger" onClick={() => detachCrossRef(editRefId, entry.id)} disabled={busyAction}>
                            Unlink
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Merge */}
                  {mergeCandidateRefs.length > 0 ? (
                    <>
                      <div className="planner-row-label">Merge duplicate</div>
                      <select value={mergeFromRefId} onChange={(event) => setMergeFromRefId(event.target.value)}>
                        <option value="">Select duplicate...</option>
                        {mergeCandidateRefs.map((ref) => (
                          <option key={ref.id} value={ref.id}>{`${ref.code} — ${ref.label}`}</option>
                        ))}
                      </select>
                      <button onClick={mergeCrossRefIntoEdited} disabled={busyAction || !mergeFromRefId}>
                        Merge into current
                      </button>
                    </>
                  ) : null}

                  <button className="danger" onClick={deleteCrossRefBubble} disabled={busyAction} style={{ marginTop: 8 }}>
                    Delete bubble
                  </button>
                </>
              ) : (
                <p className="planner-subtle">Click a bubble above to edit it.</p>
              )}
            </div>
          </details>

        </div>
        ) : null}


        {error ? <div className="planner-error">{error}</div> : null}
          </>
        )}
      </aside>

      {isMobileLayout && mobileSidebarOpen ? (
        <button
          type="button"
          className="planner-mobile-backdrop"
          aria-label="Close controls panel"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      {isMobileLayout && mobileQuickEditorOpen ? (
        <button
          type="button"
          className="planner-mobile-backdrop planner-mobile-sheet-backdrop"
          aria-label="Close quick editor"
          onClick={() => setMobileQuickEditorOpen(false)}
        />
      ) : null}

      {isMobileLayout && mobileQuickBubbleOpen ? (
        <button
          type="button"
          className="planner-mobile-backdrop planner-mobile-sheet-backdrop"
          aria-label="Close quick bubble add"
          onClick={() => setMobileQuickBubbleOpen(false)}
        />
      ) : null}

      {isMobileLayout && mobileQuickEditorOpen ? (
        <section
          className={`planner-mobile-sheet ${mobileQuickEditorMode === "compact" ? "compact" : "full"}`}
          role="dialog"
          aria-label="Quick node editor"
        >
          <div
            className="planner-mobile-sheet-handle"
            onClick={() => setMobileQuickEditorOpen(false)}
            role="button"
            aria-label="Close"
            onTouchStart={(e) => { sheetTouchStartY.current = e.touches[0]?.clientY ?? null; }}
            onTouchEnd={(e) => {
              const startY = sheetTouchStartY.current;
              if (startY === null) return;
              const endY = e.changedTouches[0]?.clientY ?? startY;
              sheetTouchStartY.current = null;
              // Swipe down on handle ≥ 60px → dismiss.
              if (endY - startY > 60) setMobileQuickEditorOpen(false);
            }}
          />
          {selectedNode ? (
            <>
              <div className="planner-mobile-sheet-header">
                <strong>{selectedNode.title}</strong>
                <span>{selectedNode.kind}</span>
              </div>
              <div className="planner-mobile-sheet-path">{buildNodePath(selectedNode.id, nodesById)}</div>
              <div className="planner-mobile-sheet-mode-toggle" role="tablist" aria-label="Editor detail level">
                <button
                  type="button"
                  className={mobileQuickEditorMode === "compact" ? "active" : ""}
                  onClick={() => setMobileQuickEditorMode("compact")}
                  aria-selected={mobileQuickEditorMode === "compact"}
                >
                  Compact
                </button>
                <button
                  type="button"
                  className={mobileQuickEditorMode === "full" ? "active" : ""}
                  onClick={() => setMobileQuickEditorMode("full")}
                  aria-selected={mobileQuickEditorMode === "full"}
                >
                  Full
                </button>
              </div>
              <input
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (busyAction) return;
                  void renameSelected();
                }}
                placeholder="Rename node..."
              />
              <button onClick={renameSelected} disabled={busyAction || renameTitle.trim().length === 0}>
                Save Name
              </button>
              {mobileQuickEditorMode === "compact" ? (
                <>
                  <div className="planner-mobile-sheet-compact-summary">
                    <div className="planner-row-label">Body preview</div>
                    <div className="planner-subtle">
                      {(selectedNode.body || "").trim().length > 0
                        ? ((selectedNode.body || "").trim().length > 120
                          ? `${(selectedNode.body || "").trim().slice(0, 120)}...`
                          : (selectedNode.body || "").trim())
                        : "No body text yet."}
                    </div>
                    {CROSS_REFERENCES_ENABLED ? (
                      <div className="planner-subtle">
                        {selectedNodeRefs.length} bubble{selectedNodeRefs.length === 1 ? "" : "s"} on this node
                      </div>
                    ) : null}
                  </div>
                  {CROSS_REFERENCES_ENABLED ? (
                    <>
                      <div className="planner-row-label">Quick bubble on this node</div>
                      <div className="planner-inline-buttons planner-mobile-quick-bubble-row">
                        <input
                          value={newRefLabel}
                          onChange={(event) => setNewRefLabel(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            if (busyAction || !canCreateBubbleFromInput) return;
                            void createCrossRef(selectedNode.id);
                          }}
                          placeholder="Bubble name"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void createCrossRef(selectedNode.id);
                          }}
                          disabled={busyAction || !canCreateBubbleFromInput}
                        >
                          Add bubble
                        </button>
                      </div>
                    </>
                  ) : null}
                  <div className="planner-mobile-sheet-grid planner-mobile-sheet-compact-grid">
                    <button
                      type="button"
                      onClick={() => setMobileQuickEditorMode("full")}
                    >
                      Expand Editor
                    </button>
                    {CROSS_REFERENCES_ENABLED ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileQuickEditorOpen(false);
                          openMobileQuickBubble(selectedNode.id, true);
                        }}
                      >
                        Add Bubble
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <textarea
                    value={bodyDraft}
                    onChange={(event) => setBodyDraft(event.target.value)}
                    placeholder={selectedNode.kind === "story" ? "Scene/story body..." : "Node notes..."}
                    rows={selectedNode.kind === "story" ? 6 : 4}
                  />
                  <button onClick={saveSelectedBody} disabled={busyAction || bodyDraft.trim() === (selectedNode.body || "").trim()}>
                    Save Body
                  </button>
                  {CROSS_REFERENCES_ENABLED ? (
                    <>
                      <div className="planner-row-label">Quick bubble on this node</div>
                      <input
                        value={newRefLabel}
                        onChange={(event) => setNewRefLabel(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          if (busyAction || !selectedNodeId || !canCreateBubbleFromInput) return;
                          void createCrossRef(selectedNode.id);
                        }}
                        placeholder="Bubble name"
                      />
                      <div className="planner-inline-buttons">
                        <input
                          value={newRefCode}
                          onChange={(event) => setNewRefCode(event.target.value)}
                          placeholder={`Code (auto ${nextAutoBubbleCode})`}
                          style={{ flex: 1 }}
                        />
                        <input
                          type="color"
                          value={newRefColor}
                          onChange={(event) => setNewRefColor(event.target.value)}
                          style={{ width: 54, height: 34, padding: "4px 6px" }}
                        />
                        <button
                          onClick={() => {
                            void createCrossRef(selectedNode.id);
                          }}
                          disabled={busyAction || !selectedNodeId || !canCreateBubbleFromInput}
                        >
                          Add Bubble
                        </button>
                      </div>
                      {bubblePrefixSuggestions.length > 0 ? (
                        <div className="planner-chip-list">
                          {bubblePrefixSuggestions.slice(0, 3).map((ref) => (
                            <button
                              key={`mobile-template:${ref.id}`}
                              className="chip"
                              onClick={() => applyBubbleSuggestion(ref)}
                              title={`Use style from ${ref.label} (${ref.code})`}
                              style={{
                                borderColor: rgbaFromHex(ref.color, 0.9, "rgba(64,182,255,0.88)"),
                                boxShadow: `0 0 0 1px ${rgbaFromHex(ref.color, 0.25, "rgba(64,182,255,0.2)")}`,
                              }}
                            >
                              {ref.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <button
                        onClick={() => {
                          setMobileQuickEditorOpen(false);
                          openBubblesPanel(false);
                        }}
                      >
                        Open Bubble Manager
                      </button>
                    </>
                  ) : null}
                </>
              )}
              <div className="planner-mobile-sheet-grid">
                <button
                  onClick={() => {
                    if (selectedNode.kind === "root") return;
                    const current = selectedNode.taskStatus || "none";
                    const nextStatus: TaskStatus = current === "done" ? "todo" : "done";
                    void setNodeTaskStatus(selectedNode.id, nextStatus);
                  }}
                  disabled={busyAction || selectedNode.kind === "root"}
                >
                  {selectedNode.taskStatus === "done" ? "Mark Todo" : "Mark Done"}
                </button>
                <button
                  onClick={() => {
                    void handleContextChangeType(selectedNode.id);
                  }}
                  disabled={busyAction || selectedNode.kind === "root"}
                >
                  {selectedNode.kind === "root" ? "Root" : `Set ${nextNodeKind(selectedNode.kind)}`}
                </button>
                <button
                  onClick={() => toggleNodeCollapse(selectedNode.id)}
                  disabled={selectedNodeChildren.length === 0}
                >
                  {selectedNodeCollapsed ? "Expand kids" : "Collapse kids"}
                </button>
                <button
                  onClick={() => {
                    setCurrentRootId(selectedNode.id);
                    setMobileQuickEditorOpen(false);
                  }}
                >
                  Focus Here
                </button>
                <button
                  onClick={() => {
                    void handleContextAddChild(selectedNode.id);
                  }}
                  disabled={busyAction}
                >
                  Add Child
                </button>
              </div>
              {selectedNode.kind === "story" ? (
                <div className="planner-mobile-sheet-story">
                  <button onClick={openSelectedAsStoryLane}>Open Story Lane</button>
                  <button
                    onClick={() => {
                      void handleContextAddChild(selectedNode.id);
                    }}
                    disabled={busyAction}
                  >
                    Add Beat Node
                  </button>
                </div>
              ) : null}
              <div className="planner-mobile-sheet-actions">
                <button
                  onClick={() => {
                    setMobileSidebarSection("node");
                    setMobileSidebarOpen(true);
                    setMobileQuickEditorOpen(false);
                  }}
                >
                  Open Full Node Panel
                </button>
                <button onClick={() => setMobileQuickEditorOpen(false)}>Close</button>
              </div>
            </>
          ) : (
            <div className="planner-subtle">Select a node to edit.</div>
          )}
        </section>
      ) : null}

      {isMobileLayout && mobileQuickBubbleOpen ? (
        <section
          className="planner-mobile-sheet compact planner-mobile-bubble-sheet"
          role="dialog"
          aria-label="Quick bubble add"
        >
          <div
            className="planner-mobile-sheet-handle"
            onClick={() => setMobileQuickBubbleOpen(false)}
            role="button"
            aria-label="Close"
            onTouchStart={(event) => { bubbleSheetTouchStartY.current = event.touches[0]?.clientY ?? null; }}
            onTouchEnd={(event) => {
              const startY = bubbleSheetTouchStartY.current;
              if (startY === null) return;
              const endY = event.changedTouches[0]?.clientY ?? startY;
              bubbleSheetTouchStartY.current = null;
              if (endY - startY > 60) setMobileQuickBubbleOpen(false);
            }}
          />
          {selectedNode ? (
            <>
              <div className="planner-mobile-sheet-header">
                <strong>{selectedNode.title}</strong>
                <span>bubble</span>
              </div>
              <div className="planner-mobile-sheet-path planner-mobile-sheet-path-tail">
                {buildNodePathTail(selectedNode.id, nodesById, 3)}
              </div>
              <div className="planner-row-label">Bubble name</div>
              <div className="planner-inline-buttons planner-mobile-bubble-input-row">
                <input
                  ref={mobileQuickBubbleInputRef}
                  value={newRefLabel}
                  onChange={(event) => setNewRefLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    if (busyAction || !canCreateBubbleFromInput) return;
                    void createCrossRef(selectedNode.id).then(() => {
                      focusMobileQuickBubbleInput(30);
                    });
                  }}
                  placeholder="Bubble name"
                />
                <button
                  type="button"
                  onClick={() => {
                    void createCrossRef(selectedNode.id).then(() => {
                      focusMobileQuickBubbleInput(30);
                    });
                  }}
                  disabled={busyAction || !canCreateBubbleFromInput}
                >
                  Add
                </button>
              </div>
              <div className="planner-inline-buttons planner-mobile-bubble-aux-row">
                <button type="button" onClick={blurActiveInput}>
                  Done
                </button>
                <button type="button" onClick={() => openBubblesPanel(false)}>
                  Manage
                </button>
              </div>
              <div className="planner-inline-buttons planner-mobile-bubble-meta-row">
                <details className="planner-advanced-tools" style={{ width: "100%" }}>
                  <summary>Advanced style and code (optional)</summary>
                  <div className="planner-advanced-tools-content">
                    <label style={{ display: "grid", gap: 4, alignItems: "center" }}>
                      <span className="planner-subtle" style={{ fontSize: 11 }}>Color</span>
                      <input
                        type="color"
                        value={newRefColor}
                        onChange={(event) => setNewRefColor(event.target.value)}
                        style={{ width: 58, height: 34, padding: "4px 6px" }}
                      />
                    </label>
                    <div style={{ display: "grid", gap: 4, flex: 1 }}>
                      <input
                        value={newRefCode}
                        onChange={(event) => setNewRefCode(event.target.value)}
                        placeholder={`Internal code (auto ${nextAutoBubbleCode})`}
                        style={{ flex: 1 }}
                      />
                      <span className="planner-subtle" style={{ fontSize: 11 }}>
                        Internal code: <strong>{effectiveNewBubbleCode}</strong>
                      </span>
                    </div>
                  </div>
                </details>
              </div>
              {bubblePrefixSuggestions.length > 0 ? (
                <div className="planner-chip-list">
                  {bubblePrefixSuggestions.slice(0, 4).map((ref) => (
                    <button
                      key={`mobile-quick-template:${ref.id}`}
                      className="chip"
                      onClick={() => applyBubbleSuggestion(ref)}
                      title={`Use style from ${ref.label} (${ref.code})`}
                      style={{
                        borderColor: rgbaFromHex(ref.color, 0.9, "rgba(64,182,255,0.88)"),
                        boxShadow: `0 0 0 1px ${rgbaFromHex(ref.color, 0.25, "rgba(64,182,255,0.2)")}`,
                      }}
                    >
                      {ref.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="planner-subtle">
                {selectedNodeRefs.length} bubble{selectedNodeRefs.length === 1 ? "" : "s"} currently on this node.
              </div>
              <div className="planner-row-label">Bubbles on this node</div>
              <div className="planner-chip-list">
                {selectedNodeRefs.length === 0 ? (
                  <span className="planner-subtle">No bubbles yet.</span>
                ) : (
                  selectedNodeRefs.map((ref) => (
                    <button
                      key={`mobile-quick-node-ref:${ref.id}`}
                      className="chip"
                      onClick={() => selectRefForEditing(ref.id)}
                      style={{
                        borderColor: rgbaFromHex(ref.color, 0.9, "rgba(64,182,255,0.88)"),
                        boxShadow: `0 0 0 1px ${rgbaFromHex(ref.color, 0.25, "rgba(64,182,255,0.2)")}`,
                        background:
                          activePortalRef?.id === ref.id
                            ? rgbaFromHex(ref.color, 0.22, "rgba(64,182,255,0.2)")
                            : undefined,
                      }}
                    >
                      {ref.label}
                    </button>
                  ))
                )}
              </div>
              {activePortalRef && activePortalRef.nodeIds.includes(selectedNode.id) ? (
                <>
                  <div className="planner-row-label">Edit selected bubble</div>
                  <input
                    value={mobileQuickBubbleEditName}
                    onChange={(event) => setMobileQuickBubbleEditName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      if (busyAction || mobileQuickBubbleEditName.trim().length === 0) return;
                      void saveMobileQuickBubbleName();
                    }}
                    placeholder="Bubble name"
                  />
                  <div className="planner-inline-buttons planner-mobile-bubble-edit-row">
                    <input
                      type="color"
                      value={activePortalRef.color || DEFAULT_BUBBLE_COLOR}
                      onChange={(event) => {
                        void updateCrossRefColor(activePortalRef.id, event.target.value);
                      }}
                      style={{ width: 58, height: 34, padding: "4px 6px" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void saveMobileQuickBubbleName();
                      }}
                      disabled={busyAction || mobileQuickBubbleEditName.trim().length === 0}
                    >
                      Save Name
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void deletePortalByRefId(activePortalRef.id);
                      }}
                      disabled={busyAction}
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : null}
              <div className="planner-mobile-sheet-actions">
                <button onClick={() => setMobileQuickBubbleOpen(false)}>Close</button>
              </div>
            </>
          ) : (
            <>
              <div className="planner-subtle">Select a node first, then use Bubble.</div>
              <div className="planner-mobile-sheet-actions">
                <button onClick={() => setMobileQuickBubbleOpen(false)}>Close</button>
              </div>
            </>
          )}
        </section>
      ) : null}

      <main className="planner-canvas">
        {isMobileLayout ? (
          <>
            <button
              type="button"
              className="planner-mobile-toolbar-launcher"
              aria-label={mobileToolbarOpen ? "Hide controls" : "Show controls"}
              onClick={() => setMobileToolbarOpen((previous) => !previous)}
            >
              {mobileToolbarOpen ? "×" : "☰"}
            </button>
            {mobileToolbarOpen ? (
              <div className="planner-mobile-toolbar">
                <button
                  onClick={() => {
                    setMobileSidebarSection(selectedNodeId ? "node" : "project");
                    setMobileSidebarOpen(true);
                    setMobileQuickEditorOpen(false);
                    setMobileQuickBubbleOpen(false);
                    setMobileToolbarOpen(false);
                  }}
                >
                  ☰ Menu
                </button>
                <button
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    setMobileQuickEditorMode("compact");
                    setMobileQuickEditorOpen(true);
                    setMobileQuickBubbleOpen(false);
                    setMobileToolbarOpen(false);
                  }}
                  disabled={!selectedNode}
                >
                  Edit
                </button>
                {CROSS_REFERENCES_ENABLED ? (
                  <button
                    onClick={() => {
                      if (!selectedNodeId) return;
                      setActivePortalRefId(null);
                      openMobileQuickBubble(selectedNodeId, true);
                      setMobileToolbarOpen(false);
                    }}
                    disabled={!selectedNodeId}
                  >
                    ◯ Bubble
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    if (!selectedNodeId) return;
                    void handleContextAddChild(selectedNodeId);
                    setMobileToolbarOpen(false);
                  }}
                  disabled={!selectedNodeId}
                >
                  ＋ Child
                </button>
                <button
                  onClick={() => {
                    if (!selectedNodeId || !selectedNode || selectedNode.kind === "root") return;
                    const current = selectedNode.taskStatus || "none";
                    const nextStatus: TaskStatus = current === "done" ? "todo" : "done";
                    void setNodeTaskStatus(selectedNodeId, nextStatus);
                    setMobileToolbarOpen(false);
                  }}
                  disabled={!selectedNode || selectedNode.kind === "root"}
                >
                  {selectedNode?.taskStatus === "done" ? "↩ Todo" : "✓ Done"}
                </button>
                <button
                  onClick={() => {
                    goGrandmotherView();
                    setMobileToolbarOpen(false);
                  }}
                  disabled={!rootNodeId}
                >
                  ⌂ Home
                </button>
                <button
                  onClick={() => {
                    goUpOneView();
                    setMobileToolbarOpen(false);
                  }}
                  disabled={!currentRootNode?.parentId}
                >
                  ↑ Up
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        <ReactFlow
          nodes={reactFlowNodes}
          edges={flowEdges}
          nodeTypes={plannerNodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: isMobileLayout ? 0.12 : 0.3, maxZoom: isMobileLayout ? 0.85 : 1 }}
          onlyRenderVisibleElements={false}
          nodesConnectable={false}
          selectionOnDrag={!isMobileLayout}
          selectionMode={isMobileLayout ? SelectionMode.Full : SelectionMode.Partial}
          // On mobile, single-finger drag pans the canvas (no box-selection).
          // On desktop, panning requires middle-mouse or space+drag.
          panOnDrag={isMobileLayout ? [0, 1, 2] : [1, 2]}
          panOnScroll={!isMobileLayout}
          multiSelectionKeyCode={["Shift", "Meta", "Control"]}
          onInit={setRfInstance}
          onNodesChange={handleNodesChange}
          onNodeClick={(_, node) => {
            setContextMenu(null);
            setPortalContextMenu(null);
            // Portal orb tap: toggle active state and (on mobile) open Bubbles panel.
            if (node.id.startsWith("portal:")) {
              const refId = node.id.split(":")[1];
              const nextSelected = activePortalRefId === refId ? null : refId;
              setActivePortalRefId(nextSelected);
              if (nextSelected) {
                selectRefForEditing(refId);
                openBubblesPanel(false);
                window.setTimeout(() => {
                  const section = document.getElementById("cross-ref-bubbles-panel");
                  section?.scrollIntoView({ block: "start", behavior: "smooth" });
                }, 20);
              }
              if (isMobileLayout) setMobileToolbarOpen(false);
              return;
            }
            setSelectedNodeId(node.id);
            setActivePortalRefId(null);
            if (isMobileLayout) {
              setMobileSidebarOpen(false);
              setMobileToolbarOpen(false);
            }
          }}
          onNodeDoubleClick={(_, node) => {
            if (isMobileLayout) return;
            // Zoom only; changing view root is an explicit action.
            onNodeDoubleClick(_, node);
          }}
          onNodeMouseEnter={(_, node) => {
            if (node.id.startsWith("portal:")) return;
            scheduleHoverUpdate(node.id, hoveredEdgeId);
          }}
          onNodeMouseLeave={(_, node) => {
            if (node.id.startsWith("portal:")) return;
            scheduleHoverUpdate(null, hoveredEdgeId);
          }}
          onEdgeMouseEnter={(_, edge) => scheduleHoverUpdate(hoveredNodeId, edge.id)}
          onEdgeMouseLeave={() => scheduleHoverUpdate(hoveredNodeId, null)}
          onNodeDragStart={(_, node) => {
            if (!node.id.startsWith("portal:")) isDraggingRef.current = true;
          }}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onSelectionDragStop={onSelectionDragStop}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            // Portal orb right-click → show portal delete menu
            if (node.id.startsWith("portal:")) {
              const refId = node.id.split(":")[1];
              setPortalContextMenu({ x: event.clientX, y: event.clientY, refId });
              return;
            }
            setPortalContextMenu(null);
            if (isMobileLayout) {
              setSelectedNodeId(node.id);
              setActivePortalRefId(null);
              setMobileSidebarOpen(false);
              setMobileQuickBubbleOpen(false);
              setMobileQuickEditorMode("compact");
              setMobileQuickEditorOpen(true);
              setMobileToolbarOpen(false);
              return;
            }
            setSelectedNodeId(node.id);
            setActivePortalRefId(null);
            setContextMenu({
              x: event.clientX,
              y: event.clientY,
              nodeId: node.id,
            });
          }}
          onPaneClick={() => {
            setContextMenu(null);
            setPortalContextMenu(null);
            setActivePortalRefId(null);
            // On mobile, tapping the canvas background deselects and closes the sheet.
            if (isMobileLayout) {
              setSelectedNodeId(null);
              setMobileQuickEditorOpen(false);
              setMobileQuickBubbleOpen(false);
              setMobileToolbarOpen(false);
            }
          }}
          minZoom={0.3}
        >
          <Background gap={22} size={1} />
        </ReactFlow>

        {/* Context Menu */}
        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeId={contextMenu.nodeId}
            nodeTitle={nodesById.get(contextMenu.nodeId)?.title || "Node"}
            nodeKind={nodesById.get(contextMenu.nodeId)?.kind || "item"}
            taskStatus={nodesById.get(contextMenu.nodeId)?.taskStatus || "none"}
            hasChildren={(childrenByParent.get(contextMenu.nodeId) || []).length > 0}
            onClose={() => setContextMenu(null)}
            onAddChild={handleContextAddChild}
            onAddStorySibling={handleContextAddStorySibling}
            onDelete={handleContextDelete}
            onDuplicate={handleContextDuplicate}
            onRename={handleContextRename}
            onAddCrossRef={CROSS_REFERENCES_ENABLED ? handleContextAddCrossRef : undefined}
            onChangeType={handleContextChangeType}
            onToggleTaskStatus={handleContextToggleTaskStatus}
          />
        )}

        {/* Portal orb right-click context menu */}
        {portalContextMenu && (() => {
          const menuRef = refs.find((r) => r.id === portalContextMenu.refId);
          return (
            <div
              data-portal-context-menu
              style={{
                position: "fixed",
                left: portalContextMenu.x,
                top: portalContextMenu.y,
                zIndex: 9999,
                minWidth: 180,
                background: "rgba(18, 20, 28, 0.97)",
                border: "1px solid rgba(255, 160, 71, 0.35)",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                padding: "6px 0",
                userSelect: "none",
              }}
            >
              {menuRef && (
                <div
                  style={{
                    padding: "6px 14px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    textTransform: "none",
                    color: "rgba(255,160,71,0.75)",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    marginBottom: 4,
                  }}
                >
                  {menuRef.label} ({menuRef.code})
                </div>
              )}
              <button
                type="button"
                onClick={() => void deletePortalByRefId(portalContextMenu.refId)}
                disabled={busyAction}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 14px",
                  background: "none",
                  border: "none",
                  cursor: busyAction ? "not-allowed" : "pointer",
                  fontSize: 13,
                  color: busyAction ? "rgba(239,68,68,0.4)" : "rgba(239,68,68,0.9)",
                  textAlign: "left",
                  transition: "background 100ms",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
              >
                <span style={{ fontSize: 15 }}>🗑</span>
                {busyAction ? "Deleting…" : "Delete bubble"}
              </button>
              <button
                type="button"
                onClick={() => setPortalContextMenu(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.45)",
                  textAlign: "left",
                  transition: "background 100ms",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
              >
                Cancel
              </button>
            </div>
          );
        })()}

        {paletteOpen && (
          <div
            className="planner-palette-backdrop"
            onClick={() => {
              setPaletteOpen(false);
              setPaletteQuery("");
              setPaletteIndex(0);
            }}
          >
            <div className="planner-palette" onClick={(event) => event.stopPropagation()}>
              <input
                ref={paletteInputRef}
                value={paletteQuery}
                onChange={(event) => {
                  setPaletteQuery(event.target.value);
                  setPaletteIndex(0);
                }}
                placeholder="Type a command, node, or entity..."
              />
              <div className="planner-palette-list">
                {paletteItems.length === 0 ? (
                  <div className="planner-palette-empty">No matches</div>
                ) : (
                  paletteItems.map((item, index) => (
                    <button
                      key={item.id}
                      className={`planner-palette-item ${index === paletteIndex ? "active" : ""}`}
                      onMouseEnter={() => setPaletteIndex(index)}
                      onClick={() => runPaletteAction(item)}
                    >
                      <span>{item.label}</span>
                      {item.hint ? <span>{item.hint}</span> : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Save error indicator (successful autosaves are silent). */}
        {saveStatus === "error" && (
          <div
            style={{
              position: "fixed",
              top: "16px",
              right: "16px",
              zIndex: 9998,
              padding: "10px 16px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
              transition: "all 200ms ease",
              background: "rgba(239, 68, 68, 0.95)",
              color: "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span style={{ fontSize: "16px" }}>⚠</span>
            <span>Could not save node position</span>
          </div>
        )}
      </main>
    </div>
  );
}
