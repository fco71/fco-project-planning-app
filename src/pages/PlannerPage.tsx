/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { useUndoRedo } from "../hooks/useUndoRedo";
import type { EdgeTypes, ReactFlowInstance } from "reactflow";
import type { User } from "firebase/auth";
import { db } from "../firebase";
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
  nextNodeKind,
  STORY_NODE_MAX_HEIGHT,
  STORY_NODE_MAX_WIDTH,
  STORY_NODE_MIN_HEIGHT,
  STORY_NODE_MIN_WIDTH,
} from "../utils/plannerConfig";
import type {
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
import { usePlannerDragActions } from "../hooks/usePlannerDragActions";
import { usePlannerContextNodeActions } from "../hooks/usePlannerContextNodeActions";
import { usePlannerContextUiActions } from "../hooks/usePlannerContextUiActions";
import { usePlannerCreateDeleteActions } from "../hooks/usePlannerCreateDeleteActions";
import { usePlannerCrossRefUiSync } from "../hooks/usePlannerCrossRefUiSync";
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
import { usePlannerMobileToolbarActions } from "../hooks/usePlannerMobileToolbarActions";
import { usePlannerCanvasSurfaceProps } from "../hooks/usePlannerCanvasSurfaceProps";
import { usePlannerMobilePanelsProps } from "../hooks/usePlannerMobilePanelsProps";
import { usePlannerSidebarPanelsProps } from "../hooks/usePlannerSidebarPanelsProps";
import { usePlannerCommandPalette } from "../hooks/usePlannerCommandPalette";
import { usePlannerCrossRefActions } from "../hooks/usePlannerCrossRefActions";
import { PlannerSidebarChrome } from "../components/Planner/PlannerSidebarChrome";
import { PlannerCanvasSurface } from "../components/Planner/PlannerCanvasSurface";
import { PlannerSidebarPanels } from "../components/Planner/PlannerSidebarPanels";
import { PlannerMobilePanels } from "../components/Planner/PlannerMobilePanels";
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

  const {
    cleanUpCrossRefs,
    linkCrossRefToNode,
    applyBubbleSuggestion,
    createCrossRef,
    duplicateCrossRef,
    mergeCrossRefIntoEdited,
    saveCrossRefEdits,
    saveMobileQuickBubbleName,
    updateCrossRefColor,
    deleteCrossRefBubble,
    deletePortalByRefId,
    detachCrossRef,
  } = usePlannerCrossRefActions({
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
    buildDefaultPortalPosition,
    setLinkNodeQuery,
    setLinkTargetNodeId,
    setNewRefLabel,
    setNewRefCode,
    setNewRefColor,
    setNewRefType,
    setRefs,
    mergeFromRefId,
    setMergeFromRefId,
    editRefLabel,
    editRefCode,
    editRefType,
    editRefTags,
    editRefNotes,
    editRefContact,
    editRefLinks,
    activePortalRef,
    mobileQuickBubbleEditName,
    setEditRefCode,
    setEditRefTags,
    setEditRefLinks,
    setEditRefLabel,
    crossRefToFirestoreSetData,
    closePortalContextMenu: () => setPortalContextMenu(null),
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
    runPaletteAction,
    paletteItems,
  } = usePlannerCommandPalette({
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
    paletteOpen,
    paletteQuery,
    paletteIndex,
    paletteInputRef,
    crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
    bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
    currentRootKind,
    storyLaneMode,
    selectedNodeId,
    nodes,
    refs,
    goGrandmotherView,
    goUpOneView,
    organizeVisibleTree,
    cleanUpCrossRefs,
    openSelectedAsMaster,
    organizeSelectedBranch,
    openSelectedAsStoryLane,
    handleContextAddStorySibling,
    handleContextAddChild,
    handleContextChangeType,
    handleContextToggleTaskStatus,
    openBubblesPanel,
    selectRefForEditing,
    linkCrossRefToNode,
    nextNodeKind,
    contextMenuOpen: !!contextMenu,
    activePortalRefId,
    deletePortalByRefId,
    handleContextDelete,
    handleContextDuplicate,
    mobileQuickEditorOpen,
    setMobileQuickEditorOpen,
    mobileSidebarOpen,
    searchQuery,
    setSearchQuery,
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

  const {
    onToolbarToggleOpen,
    onToolbarOpenMenu,
    onToolbarOpenEditor,
    onToolbarOpenBubble,
    onToolbarAddChild,
    onToolbarToggleTaskStatus,
    onToolbarGoHome,
    onToolbarGoUp,
  } = usePlannerMobileToolbarActions({
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
  });

  const plannerCanvasSurfaceProps = usePlannerCanvasSurfaceProps({
    isMobileLayout,
    mobileToolbarOpen,
    selectedNodeId,
    selectedNode,
    crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
    rootNodeId,
    currentRootHasParent: !!currentRootNode?.parentId,
    reactFlowNodes,
    flowEdges,
    nodeTypes: plannerNodeTypes,
    edgeTypes,
    onInit: setRfInstance,
    onNodesChange: handleNodesChange,
    activePortalRefId,
    onSetActivePortalRefId: setActivePortalRefId,
    onSelectRefForEditing: selectRefForEditing,
    onOpenBubblesPanel: openBubblesPanel,
    onSetSelectedNodeId: setSelectedNodeId,
    onSetMobileQuickEditorMode: setMobileQuickEditorMode,
    onNodeDoubleClick,
    scheduleHoverUpdate,
    hoveredEdgeId,
    hoveredNodeId,
    isDraggingRef,
    onNodeDrag,
    onNodeDragStop,
    onSelectionDragStop,
    onSetPortalContextMenu: setPortalContextMenu,
    portalContextMenu,
    onSetContextMenu: setContextMenu,
    contextMenu,
    nodesById,
    childrenByParent,
    onContextAddChild: handleContextAddChild,
    onContextAddStorySibling: handleContextAddStorySibling,
    onContextDelete: handleContextDelete,
    onContextDuplicate: handleContextDuplicate,
    onContextRename: handleContextRename,
    onContextAddCrossRef: CROSS_REFERENCES_ENABLED ? handleContextAddCrossRef : undefined,
    onContextChangeType: handleContextChangeType,
    onContextToggleTaskStatus: handleContextToggleTaskStatus,
    refs,
    busyAction,
    paletteOpen,
    paletteQuery,
    paletteIndex,
    paletteItems,
    paletteInputRef,
    onPaletteQueryChange: setPaletteQuery,
    onSetPaletteIndex: setPaletteIndex,
    onRunPaletteAction: runPaletteAction,
    showSaveErrorToast: saveStatus === "error",
    onToolbarToggleOpen,
    onToolbarOpenMenu,
    onToolbarOpenEditor,
    onToolbarOpenBubble,
    onToolbarAddChild,
    onToolbarToggleTaskStatus,
    onToolbarGoHome,
    onToolbarGoUp,
    setMobileSidebarOpen,
    setMobileToolbarOpen,
    setMobileQuickBubbleOpen,
    setMobileQuickEditorOpen,
    setPaletteOpen,
    setPaletteQuery,
    setPaletteIndex,
    onDeletePortalByRefIdAsync: deletePortalByRefId,
  });

  const plannerMobilePanelsProps = usePlannerMobilePanelsProps({
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
    crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
    newRefLabel,
    canCreateBubbleFromInput,
    bodyDraft,
    newRefCode,
    nextAutoBubbleCode,
    newRefColor,
    bubblePrefixSuggestions,
    selectedNodeChildrenCount: selectedNodeChildren.length,
    selectedNodeCollapsed,
    effectiveNewBubbleCode,
    mobileQuickBubbleInputRef,
    activePortalRef,
    mobileQuickBubbleEditName,
    defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
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
  });

  const plannerSidebarPanelsProps = usePlannerSidebarPanelsProps({
    showProjectSection,
    showNodeSection,
    showSimpleBubblesSection,
    showBubblesSection,
    error,
    profileName,
    userEmail: user.email,
    currentRootPath,
    currentRootId,
    rootNodeId,
    projectPages,
    activeProjectPageId,
    activeProjectPageIndex,
    selectedNodeId,
    selectedNodeKind: selectedNode?.kind,
    currentRootHasParent: !!currentRootNode?.parentId,
    currentRootKind,
    storyLaneMode,
    busyAction,
    visibleTreeCount: filteredTreeIds.length,
    crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
    bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
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
    defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
    createCrossRef,
    openMobileQuickBubble,
    setMobileQuickBubbleOpen,
    setMobileSidebarOpen,
    setMobileQuickEditorOpen,
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
        <PlannerSidebarChrome
          sidebarIsCollapsed={sidebarIsCollapsed}
          isMobileLayout={isMobileLayout}
          canUndo={canUndo}
          canRedo={canRedo}
          busyAction={busyAction}
          undoLabel={undoLabel}
          redoLabel={redoLabel}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          searchMatchCount={searchMatchingIds.size}
          selectedNodeId={selectedNodeId}
          crossReferencesEnabled={CROSS_REFERENCES_ENABLED}
          bubblesSimplifiedMode={BUBBLES_SIMPLIFIED_MODE}
          mobileSidebarSection={mobileSidebarSection}
          onUndo={() => undo(applyLocalOps)}
          onRedo={() => redo(applyLocalOps)}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
          onToggleSidebarCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onSearchQueryChange={setSearchQuery}
          onOpenPalette={() => {
            setPaletteOpen(true);
            setPaletteQuery("");
            setPaletteIndex(0);
          }}
          onOrganizeSelectedBranch={organizeSelectedBranch}
          onCleanUpCrossRefs={cleanUpCrossRefs}
          onSetMobileSidebarSection={setMobileSidebarSection}
          onOpenBubblesPanel={() => openBubblesPanel(true)}
        >

        <PlannerSidebarPanels {...plannerSidebarPanelsProps} />
        </PlannerSidebarChrome>
      </aside>

      <PlannerMobilePanels {...plannerMobilePanelsProps} />

      <PlannerCanvasSurface {...plannerCanvasSurfaceProps} />
    </div>
  );
}
