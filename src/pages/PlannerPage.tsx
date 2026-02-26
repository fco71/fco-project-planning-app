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
  buildNodePath,
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
  nextNodeKind,
  STORY_NODE_MAX_HEIGHT,
  STORY_NODE_MAX_WIDTH,
  STORY_NODE_MIN_HEIGHT,
  STORY_NODE_MIN_WIDTH,
  storyContainerColor,
} from "../utils/plannerConfig";
import type {
  TaskStatus,
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
import { PortalContextMenu } from "../components/Planner/PortalContextMenu";
import { SaveErrorToast } from "../components/Planner/SaveErrorToast";
import { CommandPalette } from "../components/Planner/CommandPalette";
import { MobileQuickBubbleSheet } from "../components/Planner/MobileQuickBubbleSheet";
import { MobileQuickEditorSheet } from "../components/Planner/MobileQuickEditorSheet";
import { MobileOverlayBackdrops } from "../components/Planner/MobileOverlayBackdrops";
import { MobileCanvasToolbar } from "../components/Planner/MobileCanvasToolbar";
import { SimpleBubblesPanel } from "../components/Planner/SimpleBubblesPanel";
import { SharedBubblesManager } from "../components/Planner/SharedBubblesManager";
import { SharedBubblesTopPanel } from "../components/Planner/SharedBubblesTopPanel";
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
          <div className="planner-collapsed-controls">
            <div className="planner-collapsed-controls-label">
              Controls
            </div>
          </div>
        ) : (
          <>
        {/* Search Input */}
        <div className="planner-search-wrap">
          <input
            className="planner-search-input"
            ref={searchInputRef}
            type="text"
            placeholder={isMobileLayout ? "Search nodes..." : "Search nodes... (Ctrl+F)"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchMatchingIds.size > 0 && (
            <div className="planner-search-match">
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
                  className="planner-color-input-lg"
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
          <SimpleBubblesPanel
            bubbleTargetNode={bubbleTargetNode}
            nodesById={nodesById}
            isMobileLayout={isMobileLayout}
            busyAction={busyAction}
            selectedNodeId={selectedNodeId}
            selectedNodeRefs={selectedNodeRefs}
            activePortalRef={activePortalRef}
            effectiveBubbleTargetId={effectiveBubbleTargetId}
            newRefLabelInputRef={newRefLabelInputRef}
            newRefLabel={newRefLabel}
            onNewRefLabelChange={setNewRefLabel}
            newRefColor={newRefColor}
            onNewRefColorChange={setNewRefColor}
            newRefCode={newRefCode}
            onNewRefCodeChange={setNewRefCode}
            nextAutoBubbleCode={nextAutoBubbleCode}
            effectiveNewBubbleCode={effectiveNewBubbleCode}
            canCreateBubbleFromInput={canCreateBubbleFromInput}
            bubblePrefixSuggestions={bubblePrefixSuggestions}
            defaultBubbleColor={DEFAULT_BUBBLE_COLOR}
            onSelectBubbleTarget={(nodeId) => {
              setSelectedNodeId(nodeId);
              setActivePortalRefId(null);
            }}
            onCreateCrossRef={createCrossRef}
            onOpenMobileQuickBubble={openMobileQuickBubble}
            onCloseMobilePanels={() => {
              setMobileQuickBubbleOpen(false);
              setMobileSidebarOpen(false);
              setMobileQuickEditorOpen(false);
            }}
            onBlurActiveInput={blurActiveInput}
            onApplyBubbleSuggestion={applyBubbleSuggestion}
            onToggleActivePortalRef={(refId) => {
              setActivePortalRefId((prev) => (prev === refId ? null : refId));
            }}
            onDeletePortalByRefId={(refId) => {
              void deletePortalByRefId(refId);
            }}
            onUpdateCrossRefColor={updateCrossRefColor}
          />
        ) : null}

        {showBubblesSection ? (
        <div className="planner-panel-block">
          <SharedBubblesTopPanel
            refs={refs}
            selectedNode={selectedNode}
            selectedNodeId={selectedNodeId}
            selectedNodeRefs={selectedNodeRefs}
            nodesById={nodesById}
            activePortalRef={activePortalRef}
            activePortalTargets={activePortalTargets}
            busyAction={busyAction}
            canCreateBubbleFromInput={canCreateBubbleFromInput}
            newRefLabelInputRef={newRefLabelInputRef}
            newRefLabel={newRefLabel}
            onNewRefLabelChange={setNewRefLabel}
            newRefCode={newRefCode}
            onNewRefCodeChange={setNewRefCode}
            newRefType={newRefType}
            onNewRefTypeChange={setNewRefType}
            newRefSuggestions={newRefSuggestions}
            onCreateCrossRef={createCrossRef}
            describeRefTargets={describeRefTargets}
            onLinkCrossRefToNode={linkCrossRefToNode}
            onSelectRefForEditing={selectRefForEditing}
            onDetachCrossRef={detachCrossRef}
            onJumpToReferencedNode={jumpToReferencedNode}
          />

          <SharedBubblesManager
            refs={refs}
            refScopeFilter={refScopeFilter}
            onRefScopeFilterChange={setRefScopeFilter}
            refCategoryFilter={refCategoryFilter}
            onRefCategoryFilterChange={setRefCategoryFilter}
            refSearchQuery={refSearchQuery}
            onRefSearchQueryChange={setRefSearchQuery}
            filteredRefs={filteredRefs}
            selectedNodeId={selectedNodeId}
            selectedNodeRefIds={selectedNodeRefIds}
            busyAction={busyAction}
            onSelectRefForEditing={selectRefForEditing}
            describeRefLibraryPreview={describeRefLibraryPreview}
            onLinkCrossRefToNode={linkCrossRefToNode}
            onDetachCrossRef={detachCrossRef}
            editRefId={editRefId}
            editRefLabel={editRefLabel}
            onEditRefLabelChange={setEditRefLabel}
            editRefCode={editRefCode}
            onEditRefCodeChange={setEditRefCode}
            editRefType={editRefType}
            onEditRefTypeChange={setEditRefType}
            editRefTags={editRefTags}
            onEditRefTagsChange={setEditRefTags}
            editRefContact={editRefContact}
            onEditRefContactChange={setEditRefContact}
            editRefNotes={editRefNotes}
            onEditRefNotesChange={setEditRefNotes}
            editRefLinks={editRefLinks}
            onEditRefLinksChange={setEditRefLinks}
            onSaveCrossRefEdits={saveCrossRefEdits}
            onDuplicateCrossRef={(refId) => {
              void duplicateCrossRef(refId);
            }}
            linkNodeQuery={linkNodeQuery}
            onLinkNodeQueryChange={setLinkNodeQuery}
            linkTargetNodeId={linkTargetNodeId}
            onLinkTargetNodeIdChange={setLinkTargetNodeId}
            linkableNodeOptions={linkableNodeOptions}
            onLinkNodeFromEdit={linkCrossRefToNode}
            editableRefTargets={editableRefTargets}
            onJumpToReferencedNode={jumpToReferencedNode}
            mergeCandidateRefs={mergeCandidateRefs}
            mergeFromRefId={mergeFromRefId}
            onMergeFromRefIdChange={setMergeFromRefId}
            onMergeCrossRefIntoEdited={mergeCrossRefIntoEdited}
            onDeleteCrossRefBubble={deleteCrossRefBubble}
          />

        </div>
        ) : null}


        {error ? <div className="planner-error">{error}</div> : null}
          </>
        )}
      </aside>

      <MobileOverlayBackdrops
        isMobileLayout={isMobileLayout}
        mobileSidebarOpen={mobileSidebarOpen}
        mobileQuickEditorOpen={mobileQuickEditorOpen}
        mobileQuickBubbleOpen={mobileQuickBubbleOpen}
        onCloseSidebar={() => setMobileSidebarOpen(false)}
        onCloseQuickEditor={() => setMobileQuickEditorOpen(false)}
        onCloseQuickBubble={() => setMobileQuickBubbleOpen(false)}
      />

      <MobileQuickEditorSheet
        open={isMobileLayout && mobileQuickEditorOpen}
        mode={mobileQuickEditorMode}
        onModeChange={setMobileQuickEditorMode}
        selectedNode={selectedNode}
        selectedNodeId={selectedNodeId}
        nodesById={nodesById}
        renameTitle={renameTitle}
        onRenameTitleChange={setRenameTitle}
        onRenameSelected={renameSelected}
        busyAction={busyAction}
        crossReferencesEnabled={CROSS_REFERENCES_ENABLED}
        selectedNodeRefs={selectedNodeRefs}
        newRefLabel={newRefLabel}
        onNewRefLabelChange={setNewRefLabel}
        canCreateBubbleFromInput={canCreateBubbleFromInput}
        onCreateCrossRef={createCrossRef}
        onOpenMobileQuickBubble={openMobileQuickBubble}
        bodyDraft={bodyDraft}
        onBodyDraftChange={setBodyDraft}
        onSaveSelectedBody={saveSelectedBody}
        selectedNodeBody={selectedNode?.body || ""}
        newRefCode={newRefCode}
        onNewRefCodeChange={setNewRefCode}
        nextAutoBubbleCode={nextAutoBubbleCode}
        newRefColor={newRefColor}
        onNewRefColorChange={setNewRefColor}
        bubblePrefixSuggestions={bubblePrefixSuggestions}
        onApplyBubbleSuggestion={applyBubbleSuggestion}
        onOpenBubblesPanel={openBubblesPanel}
        selectedNodeChildrenCount={selectedNodeChildren.length}
        selectedNodeCollapsed={selectedNodeCollapsed}
        onSetNodeTaskStatus={setNodeTaskStatus}
        onChangeType={(nodeId) => handleContextChangeType(nodeId)}
        onToggleNodeCollapse={toggleNodeCollapse}
        onFocusHere={setCurrentRootId}
        onAddChild={handleContextAddChild}
        onOpenSelectedAsStoryLane={openSelectedAsStoryLane}
        onOpenFullNodePanel={() => {
          setMobileSidebarSection("node");
          setMobileSidebarOpen(true);
          setMobileQuickEditorOpen(false);
        }}
        onClose={() => setMobileQuickEditorOpen(false)}
      />

      <MobileQuickBubbleSheet
        open={isMobileLayout && mobileQuickBubbleOpen}
        selectedNode={selectedNode}
        nodesById={nodesById}
        mobileQuickBubbleInputRef={mobileQuickBubbleInputRef}
        newRefLabel={newRefLabel}
        onNewRefLabelChange={setNewRefLabel}
        busyAction={busyAction}
        canCreateBubbleFromInput={canCreateBubbleFromInput}
        onCreateBubble={createCrossRef}
        focusMobileQuickBubbleInput={focusMobileQuickBubbleInput}
        blurActiveInput={blurActiveInput}
        openBubblesPanel={openBubblesPanel}
        newRefColor={newRefColor}
        onNewRefColorChange={setNewRefColor}
        newRefCode={newRefCode}
        onNewRefCodeChange={setNewRefCode}
        nextAutoBubbleCode={nextAutoBubbleCode}
        effectiveNewBubbleCode={effectiveNewBubbleCode}
        bubblePrefixSuggestions={bubblePrefixSuggestions}
        applyBubbleSuggestion={applyBubbleSuggestion}
        selectedNodeRefs={selectedNodeRefs}
        onSelectRefForEditing={selectRefForEditing}
        activePortalRef={activePortalRef}
        mobileQuickBubbleEditName={mobileQuickBubbleEditName}
        onMobileQuickBubbleEditNameChange={setMobileQuickBubbleEditName}
        onSaveMobileQuickBubbleName={saveMobileQuickBubbleName}
        onUpdateCrossRefColor={updateCrossRefColor}
        defaultBubbleColor={DEFAULT_BUBBLE_COLOR}
        onDeletePortalByRefId={deletePortalByRefId}
        onClose={() => setMobileQuickBubbleOpen(false)}
      />

      <main className="planner-canvas">
        <MobileCanvasToolbar
          isMobileLayout={isMobileLayout}
          mobileToolbarOpen={mobileToolbarOpen}
          selectedNodeId={selectedNodeId}
          selectedNode={selectedNode}
          crossReferencesEnabled={CROSS_REFERENCES_ENABLED}
          rootNodeId={rootNodeId}
          currentRootHasParent={!!currentRootNode?.parentId}
          onToggleOpen={() => setMobileToolbarOpen((previous) => !previous)}
          onOpenMenu={() => {
            setMobileSidebarSection(selectedNodeId ? "node" : "project");
            setMobileSidebarOpen(true);
            setMobileQuickEditorOpen(false);
            setMobileQuickBubbleOpen(false);
            setMobileToolbarOpen(false);
          }}
          onOpenEditor={() => {
            setMobileSidebarOpen(false);
            setMobileQuickEditorMode("compact");
            setMobileQuickEditorOpen(true);
            setMobileQuickBubbleOpen(false);
            setMobileToolbarOpen(false);
          }}
          onOpenBubble={() => {
            if (!selectedNodeId) return;
            setActivePortalRefId(null);
            openMobileQuickBubble(selectedNodeId, true);
            setMobileToolbarOpen(false);
          }}
          onAddChild={() => {
            if (!selectedNodeId) return;
            void handleContextAddChild(selectedNodeId);
            setMobileToolbarOpen(false);
          }}
          onToggleTaskStatus={() => {
            if (!selectedNodeId || !selectedNode || selectedNode.kind === "root") return;
            const current = selectedNode.taskStatus || "none";
            const nextStatus: TaskStatus = current === "done" ? "todo" : "done";
            void setNodeTaskStatus(selectedNodeId, nextStatus);
            setMobileToolbarOpen(false);
          }}
          onGoHome={() => {
            goGrandmotherView();
            setMobileToolbarOpen(false);
          }}
          onGoUp={() => {
            goUpOneView();
            setMobileToolbarOpen(false);
          }}
        />

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

        <PortalContextMenu
          contextMenu={portalContextMenu}
          refs={refs}
          busy={busyAction}
          onDelete={(refId) => {
            void deletePortalByRefId(refId);
          }}
          onClose={() => setPortalContextMenu(null)}
        />

        <CommandPalette
          open={paletteOpen}
          query={paletteQuery}
          paletteIndex={paletteIndex}
          items={paletteItems}
          inputRef={paletteInputRef}
          onClose={() => {
            setPaletteOpen(false);
            setPaletteQuery("");
            setPaletteIndex(0);
          }}
          onQueryChange={setPaletteQuery}
          onSetIndex={setPaletteIndex}
          onRunItem={runPaletteAction}
        />

        <SaveErrorToast open={saveStatus === "error"} message="Could not save node position" />
      </main>
    </div>
  );
}
