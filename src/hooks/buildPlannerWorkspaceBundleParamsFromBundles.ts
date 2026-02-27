import type { EdgeTypes } from "reactflow";
import type { TreeNode } from "../types/planner";
import type { usePlannerPageState } from "./usePlannerPageState";
import type { usePlannerCanvasGraphState } from "./usePlannerCanvasGraphState";
import type { usePlannerDerivedCrossRefBundle } from "./usePlannerDerivedCrossRefBundle";
import type { usePlannerMutationContextBundle } from "./usePlannerMutationContextBundle";
import type { usePlannerNavigationCommandBundle } from "./usePlannerNavigationCommandBundle";
import type { usePlannerWorkspacePropsBundle } from "./usePlannerWorkspacePropsBundle";
import type { LocalOp } from "./useUndoRedo";
import type { NodeKind } from "../types/planner";
import { buildPlannerWorkspaceBundleParams } from "./buildPlannerWorkspaceBundleParams";

type PlannerState = ReturnType<typeof usePlannerPageState>;
type CanvasGraphState = ReturnType<typeof usePlannerCanvasGraphState>;
type DerivedBundle = ReturnType<typeof usePlannerDerivedCrossRefBundle>;
type MutationBundle = ReturnType<typeof usePlannerMutationContextBundle>;
type NavigationBundle = ReturnType<typeof usePlannerNavigationCommandBundle>;
type WorkspaceBundleParams = Parameters<typeof usePlannerWorkspacePropsBundle>[0];

type BuildPlannerWorkspaceBundleParamsFromBundlesInput = {
  plannerState: PlannerState;
  selectedNode: TreeNode | null;
  currentRootHasParent: boolean;
  canvasGraph: Pick<
    CanvasGraphState,
    "reactFlowNodes" | "flowEdges" | "handleNodesChange" | "toggleNodeCollapse" | "filteredTreeIds" | "searchMatchingIds"
  >;
  nodeTypes: WorkspaceBundleParams["canvasSurface"]["nodeTypes"];
  edgeTypes: EdgeTypes;
  nodesById: WorkspaceBundleParams["canvasSurface"]["nodesById"];
  childrenByParent: WorkspaceBundleParams["canvasSurface"]["childrenByParent"];
  refs: WorkspaceBundleParams["canvasSurface"]["refs"];
  derived: DerivedBundle;
  mutation: MutationBundle;
  navigation: NavigationBundle;
  showSaveErrorToast: boolean;
  userEmail: string | null | undefined;
  sidebarIsCollapsed: boolean;
  currentRootKind: NodeKind | null;
  crossReferencesEnabled: boolean;
  bubblesSimplifiedMode: boolean;
  defaultBubbleColor: string;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  undo: (applyLocalOps: (ops: LocalOp[]) => void) => void;
  redo: (applyLocalOps: (ops: LocalOp[]) => void) => void;
  applyLocalOps: (ops: LocalOp[]) => void;
  onNodeDoubleClick: WorkspaceBundleParams["canvasSurface"]["onNodeDoubleClick"];
  openBubblesPanel: (focusInput?: boolean) => void;
  openMobileQuickBubble: (nodeId?: string, focusInput?: boolean) => void;
  focusMobileQuickBubbleInput: (delayMs?: number) => void;
  blurActiveInput: () => void;
};

export function buildPlannerWorkspaceBundleParamsFromBundles({
  plannerState,
  selectedNode,
  currentRootHasParent,
  canvasGraph,
  nodeTypes,
  edgeTypes,
  nodesById,
  childrenByParent,
  refs,
  derived,
  mutation,
  navigation,
  showSaveErrorToast,
  userEmail,
  sidebarIsCollapsed,
  currentRootKind,
  crossReferencesEnabled,
  bubblesSimplifiedMode,
  defaultBubbleColor,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  undo,
  redo,
  applyLocalOps,
  onNodeDoubleClick,
  openBubblesPanel,
  openMobileQuickBubble,
  focusMobileQuickBubbleInput,
  blurActiveInput,
}: BuildPlannerWorkspaceBundleParamsFromBundlesInput): WorkspaceBundleParams {
  return buildPlannerWorkspaceBundleParams({
    plannerState,
    crossReferencesEnabled,
    bubblesSimplifiedMode,
    selectedNode,
    currentRootHasParent,
    reactFlowNodes: canvasGraph.reactFlowNodes,
    flowEdges: canvasGraph.flowEdges,
    nodeTypes,
    edgeTypes,
    handleNodesChange: canvasGraph.handleNodesChange,
    onSelectRefForEditing: mutation.selectRefForEditing,
    onOpenBubblesPanel: openBubblesPanel,
    onNodeDoubleClick,
    onNodeDrag: mutation.onNodeDrag,
    onNodeDragStop: mutation.onNodeDragStop,
    onSelectionDragStop: mutation.onSelectionDragStop,
    nodesById,
    childrenByParent,
    onContextAddChild: mutation.handleContextAddChild,
    onContextAddStorySibling: mutation.handleContextAddStorySibling,
    onContextDelete: mutation.handleContextDelete,
    onContextDuplicate: mutation.handleContextDuplicate,
    onContextRename: mutation.handleContextRename,
    onContextAddCrossRef: crossReferencesEnabled ? mutation.handleContextAddCrossRef : undefined,
    onContextChangeType: mutation.handleContextChangeType,
    onContextToggleTaskStatus: mutation.handleContextToggleTaskStatus,
    refs,
    paletteItems: navigation.paletteItems,
    onRunPaletteAction: navigation.runPaletteAction,
    showSaveErrorToast,
    onToolbarToggleOpen: navigation.onToolbarToggleOpen,
    onToolbarOpenMenu: navigation.onToolbarOpenMenu,
    onToolbarOpenEditor: navigation.onToolbarOpenEditor,
    onToolbarOpenBubble: navigation.onToolbarOpenBubble,
    onToolbarAddChild: navigation.onToolbarAddChild,
    onToolbarToggleTaskStatus: navigation.onToolbarToggleTaskStatus,
    onToolbarGoHome: navigation.onToolbarGoHome,
    onToolbarGoUp: navigation.onToolbarGoUp,
    onDeletePortalByRefIdAsync: mutation.deletePortalByRefId,
    selectedNodeRefs: derived.selectedNodeRefs,
    canCreateBubbleFromInput: derived.canCreateBubbleFromInput,
    nextAutoBubbleCode: derived.nextAutoBubbleCode,
    bubblePrefixSuggestions: derived.bubblePrefixSuggestions,
    selectedNodeChildrenCount: derived.selectedNodeChildren.length,
    selectedNodeCollapsed: derived.selectedNodeCollapsed,
    effectiveNewBubbleCode: derived.effectiveNewBubbleCode,
    activePortalRef: derived.activePortalRef,
    defaultBubbleColor,
    renameSelected: mutation.renameSelected,
    createCrossRef: mutation.createCrossRef,
    openMobileQuickBubble,
    saveSelectedBody: derived.saveSelectedBody,
    applyBubbleSuggestion: mutation.applyBubbleSuggestion,
    setNodeTaskStatus: mutation.setNodeTaskStatus,
    toggleNodeCollapse: canvasGraph.toggleNodeCollapse,
    createChild: mutation.createChild,
    handleContextAddStorySibling: mutation.handleContextAddStorySibling,
    openSelectedAsStoryLane: navigation.openSelectedAsStoryLane,
    focusMobileQuickBubbleInput,
    blurActiveInput,
    saveMobileQuickBubbleName: mutation.saveMobileQuickBubbleName,
    updateCrossRefColor: mutation.updateCrossRefColor,
    deletePortalByRefId: mutation.deletePortalByRefId,
    showProjectSection: navigation.showProjectSection,
    showNodeSection: navigation.showNodeSection,
    showSimpleBubblesSection: navigation.showSimpleBubblesSection,
    showBubblesSection: navigation.showBubblesSection,
    profileName: plannerState.profileName,
    userEmail,
    currentRootPath: derived.currentRootPath,
    projectPages: derived.projectPages,
    activeProjectPageId: derived.activeProjectPageId,
    activeProjectPageIndex: derived.activeProjectPageIndex,
    currentRootKind,
    visibleTreeCount: canvasGraph.filteredTreeIds.length,
    goPrevProjectPage: navigation.goPrevProjectPage,
    goNextProjectPage: navigation.goNextProjectPage,
    openProjectPage: navigation.openProjectPage,
    goGrandmotherView: navigation.goGrandmotherView,
    goUpOneView: navigation.goUpOneView,
    openSelectedAsMaster: navigation.openSelectedAsMaster,
    organizeVisibleTree: navigation.organizeVisibleTree,
    organizeSelectedBranch: navigation.organizeSelectedBranch,
    cleanUpCrossRefs: mutation.cleanUpCrossRefs,
    selectedNodeHasStoryChildren: derived.selectedNodeHasStoryChildren,
    selectedNodeChildren: derived.selectedNodeChildren,
    setNodeColor: mutation.setNodeColor,
    deleteSelected: mutation.deleteSelected,
    handleContextAddCrossRef: mutation.handleContextAddCrossRef,
    toggleStoryStepDone: mutation.toggleStoryStepDone,
    moveStoryStep: mutation.moveStoryStep,
    deleteStoryStep: mutation.deleteStoryStep,
    addStoryStep: mutation.addStoryStep,
    bubbleTargetNode: selectedNode,
    effectiveBubbleTargetId: plannerState.selectedNodeId || null,
    activePortalTargets: derived.activePortalTargets,
    newRefSuggestions: derived.newRefSuggestions,
    describeRefTargets: derived.describeRefTargets,
    linkCrossRefToNode: mutation.linkCrossRefToNode,
    detachCrossRef: mutation.detachCrossRef,
    jumpToReferencedNode: navigation.jumpToReferencedNode,
    filteredRefs: derived.filteredRefs,
    selectedNodeRefIds: derived.selectedNodeRefIds,
    describeRefLibraryPreview: derived.describeRefLibraryPreview,
    saveCrossRefEdits: mutation.saveCrossRefEdits,
    duplicateCrossRef: mutation.duplicateCrossRef,
    linkableNodeOptions: derived.linkableNodeOptions,
    editableRefTargets: derived.editableRefTargets,
    mergeCandidateRefs: derived.mergeCandidateRefs,
    mergeCrossRefIntoEdited: mutation.mergeCrossRefIntoEdited,
    deleteCrossRefBubble: mutation.deleteCrossRefBubble,
    sidebarIsCollapsed,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    searchMatchCount: canvasGraph.searchMatchingIds.size,
    undo,
    redo,
    applyLocalOps,
  });
}
