import { beforeEach, describe, expect, it, vi } from "vitest";
import type { usePlannerPageState } from "./usePlannerPageState";
import { usePlannerWorkspaceOrchestration } from "./usePlannerWorkspaceOrchestration";

type PlannerState = ReturnType<typeof usePlannerPageState>;

const {
  mockUseUndoRedo,
  mockUsePlannerRealtimeSync,
  mockUsePlannerResponsiveUi,
  mockUseStoryNodeContentActions,
  mockUsePlannerBubbleUiActions,
  mockUsePlannerFlowUiFeedback,
  mockUsePlannerRootSelectionSync,
  mockUsePlannerCanvasGraphState,
  mockUsePlannerApplyLocalOps,
  mockUsePlannerNodeIndex,
  mockUsePlannerStoryCardState,
  mockUsePlannerLocalNodePatch,
  mockUsePlannerNavigationCommandBundle,
  mockUsePlannerMutationContextBundle,
  mockUsePlannerDerivedCrossRefBundle,
  mockUsePlannerWorkspacePropsBundle,
  mockBuildPlannerBubbleUiActionsParams,
  mockBuildPlannerCanvasGraphStateParams,
  mockBuildPlannerDerivedCrossRefBundleParams,
  mockBuildPlannerMutationBundleParams,
  mockBuildPlannerNavigationBundleParams,
  mockBuildPlannerRealtimeSyncParams,
  mockBuildPlannerResponsiveUiParams,
  mockBuildPlannerRootSelectionSyncParams,
  mockBuildStoryNodeContentActionsParams,
  mockBuildPlannerWorkspaceBundleParamsFromBundles,
} = vi.hoisted(() => ({
  mockUseUndoRedo: vi.fn(),
  mockUsePlannerRealtimeSync: vi.fn(),
  mockUsePlannerResponsiveUi: vi.fn(),
  mockUseStoryNodeContentActions: vi.fn(),
  mockUsePlannerBubbleUiActions: vi.fn(),
  mockUsePlannerFlowUiFeedback: vi.fn(),
  mockUsePlannerRootSelectionSync: vi.fn(),
  mockUsePlannerCanvasGraphState: vi.fn(),
  mockUsePlannerApplyLocalOps: vi.fn(),
  mockUsePlannerNodeIndex: vi.fn(),
  mockUsePlannerStoryCardState: vi.fn(),
  mockUsePlannerLocalNodePatch: vi.fn(),
  mockUsePlannerNavigationCommandBundle: vi.fn(),
  mockUsePlannerMutationContextBundle: vi.fn(),
  mockUsePlannerDerivedCrossRefBundle: vi.fn(),
  mockUsePlannerWorkspacePropsBundle: vi.fn(),
  mockBuildPlannerBubbleUiActionsParams: vi.fn(),
  mockBuildPlannerCanvasGraphStateParams: vi.fn(),
  mockBuildPlannerDerivedCrossRefBundleParams: vi.fn(),
  mockBuildPlannerMutationBundleParams: vi.fn(),
  mockBuildPlannerNavigationBundleParams: vi.fn(),
  mockBuildPlannerRealtimeSyncParams: vi.fn(),
  mockBuildPlannerResponsiveUiParams: vi.fn(),
  mockBuildPlannerRootSelectionSyncParams: vi.fn(),
  mockBuildStoryNodeContentActionsParams: vi.fn(),
  mockBuildPlannerWorkspaceBundleParamsFromBundles: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => {
      effect();
    },
  };
});

vi.mock("./useUndoRedo", () => ({
  useUndoRedo: mockUseUndoRedo,
}));

vi.mock("./usePlannerRealtimeSync", () => ({
  usePlannerRealtimeSync: mockUsePlannerRealtimeSync,
}));

vi.mock("./usePlannerResponsiveUi", () => ({
  usePlannerResponsiveUi: mockUsePlannerResponsiveUi,
}));

vi.mock("./useStoryNodeContentActions", () => ({
  useStoryNodeContentActions: mockUseStoryNodeContentActions,
}));

vi.mock("./usePlannerBubbleUiActions", () => ({
  usePlannerBubbleUiActions: mockUsePlannerBubbleUiActions,
}));

vi.mock("./usePlannerFlowUiFeedback", () => ({
  usePlannerFlowUiFeedback: mockUsePlannerFlowUiFeedback,
}));

vi.mock("./usePlannerRootSelectionSync", () => ({
  usePlannerRootSelectionSync: mockUsePlannerRootSelectionSync,
}));

vi.mock("./usePlannerCanvasGraphState", () => ({
  usePlannerCanvasGraphState: mockUsePlannerCanvasGraphState,
}));

vi.mock("./usePlannerApplyLocalOps", () => ({
  usePlannerApplyLocalOps: mockUsePlannerApplyLocalOps,
}));

vi.mock("./usePlannerNodeIndex", () => ({
  usePlannerNodeIndex: mockUsePlannerNodeIndex,
}));

vi.mock("./usePlannerStoryCardState", () => ({
  usePlannerStoryCardState: mockUsePlannerStoryCardState,
}));

vi.mock("./usePlannerLocalNodePatch", () => ({
  usePlannerLocalNodePatch: mockUsePlannerLocalNodePatch,
}));

vi.mock("./usePlannerNavigationCommandBundle", () => ({
  usePlannerNavigationCommandBundle: mockUsePlannerNavigationCommandBundle,
}));

vi.mock("./usePlannerMutationContextBundle", () => ({
  usePlannerMutationContextBundle: mockUsePlannerMutationContextBundle,
}));

vi.mock("./usePlannerDerivedCrossRefBundle", () => ({
  usePlannerDerivedCrossRefBundle: mockUsePlannerDerivedCrossRefBundle,
}));

vi.mock("./usePlannerWorkspacePropsBundle", () => ({
  usePlannerWorkspacePropsBundle: mockUsePlannerWorkspacePropsBundle,
}));

vi.mock("./buildPlannerBubbleUiActionsParams", () => ({
  buildPlannerBubbleUiActionsParams: mockBuildPlannerBubbleUiActionsParams,
}));

vi.mock("./buildPlannerCanvasGraphStateParams", () => ({
  buildPlannerCanvasGraphStateParams: mockBuildPlannerCanvasGraphStateParams,
}));

vi.mock("./buildPlannerDerivedCrossRefBundleParams", () => ({
  buildPlannerDerivedCrossRefBundleParams: mockBuildPlannerDerivedCrossRefBundleParams,
}));

vi.mock("./buildPlannerMutationBundleParams", () => ({
  buildPlannerMutationBundleParams: mockBuildPlannerMutationBundleParams,
}));

vi.mock("./buildPlannerNavigationBundleParams", () => ({
  buildPlannerNavigationBundleParams: mockBuildPlannerNavigationBundleParams,
}));

vi.mock("./buildPlannerRealtimeSyncParams", () => ({
  buildPlannerRealtimeSyncParams: mockBuildPlannerRealtimeSyncParams,
}));

vi.mock("./buildPlannerResponsiveUiParams", () => ({
  buildPlannerResponsiveUiParams: mockBuildPlannerResponsiveUiParams,
}));

vi.mock("./buildPlannerRootSelectionSyncParams", () => ({
  buildPlannerRootSelectionSyncParams: mockBuildPlannerRootSelectionSyncParams,
}));

vi.mock("./buildStoryNodeContentActionsParams", () => ({
  buildStoryNodeContentActionsParams: mockBuildStoryNodeContentActionsParams,
}));

vi.mock("./buildPlannerWorkspaceBundleParamsFromBundles", () => ({
  buildPlannerWorkspaceBundleParamsFromBundles: mockBuildPlannerWorkspaceBundleParamsFromBundles,
}));

describe("usePlannerWorkspaceOrchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires builders and hook bundles to produce workspace layout props", () => {
    const responsiveParams = { kind: "responsive" };
    const realtimeParams = { kind: "realtime" };
    const rootSelectionParams = { kind: "root-selection" };
    const bubbleUiParams = { kind: "bubble-ui" };
    const storyContentParams = { kind: "story-content" };
    const canvasParams = { kind: "canvas" };
    const derivedParams = { kind: "derived" };
    const mutationParams = { kind: "mutation" };
    const navigationParams = { kind: "navigation" };
    const workspaceBundleParams = { kind: "workspace-bundle" };

    mockBuildPlannerResponsiveUiParams.mockReturnValue(responsiveParams);
    mockBuildPlannerRealtimeSyncParams.mockReturnValue(realtimeParams);
    mockBuildPlannerRootSelectionSyncParams.mockReturnValue(rootSelectionParams);
    mockBuildPlannerBubbleUiActionsParams.mockReturnValue(bubbleUiParams);
    mockBuildStoryNodeContentActionsParams.mockReturnValue(storyContentParams);
    mockBuildPlannerCanvasGraphStateParams.mockReturnValue(canvasParams);
    mockBuildPlannerDerivedCrossRefBundleParams.mockReturnValue(derivedParams);
    mockBuildPlannerMutationBundleParams.mockReturnValue(mutationParams);
    mockBuildPlannerNavigationBundleParams.mockReturnValue(navigationParams);
    mockBuildPlannerWorkspaceBundleParamsFromBundles.mockReturnValue(workspaceBundleParams);

    const applyLocalOps = vi.fn();
    mockUsePlannerApplyLocalOps.mockReturnValue(applyLocalOps);
    mockUsePlannerNodeIndex.mockReturnValue({ nodesById: new Map(), childrenByParent: new Map() });
    mockUsePlannerStoryCardState.mockReturnValue({ expandedStoryNodeIds: new Set<string>(), toggleStoryCardExpand: vi.fn() });
    mockUsePlannerLocalNodePatch.mockReturnValue(vi.fn());
    mockUseUndoRedo.mockReturnValue({
      canUndo: true,
      canRedo: false,
      push: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      suppressSnapshotRef: { current: 0 },
      newNodeDocId: vi.fn(() => "node-1"),
      undoLabel: "Undo",
      redoLabel: null,
    });
    mockUsePlannerRootSelectionSync.mockReturnValue({ selectedNode: null });
    const openBubblesPanel = vi.fn();
    const openMobileQuickBubble = vi.fn();
    const focusMobileQuickBubbleInput = vi.fn();
    const blurActiveInput = vi.fn();
    mockUsePlannerBubbleUiActions.mockReturnValue({
      openBubblesPanel,
      focusMobileQuickBubbleInput,
      openMobileQuickBubble,
      blurActiveInput,
    });
    mockUseStoryNodeContentActions.mockReturnValue({
      persistNodeBody: vi.fn(),
      resetStoryNodeSize: vi.fn(),
      startStoryNodeResize: vi.fn(),
    });
    mockUsePlannerCanvasGraphState.mockReturnValue({
      visibleTreeIdSet: new Set<string>(),
      toggleNodeCollapse: vi.fn(),
      filteredTreeIds: ["root-1"],
      searchMatchingIds: new Set<string>(),
      currentRootKind: "root",
      treeLayout: [],
      resolveNodePosition: vi.fn(() => ({ x: 0, y: 0 })),
      filteredTreeIdSet: new Set<string>(),
      handleNodesChange: vi.fn(),
      draggedNodeIdRef: { current: null },
      flowEdges: [],
      reactFlowNodes: [],
    });
    mockUsePlannerFlowUiFeedback.mockReturnValue({
      saveStatus: "idle",
      showSaveError: vi.fn(),
      onNodeDoubleClick: vi.fn(),
    });
    mockUsePlannerDerivedCrossRefBundle.mockReturnValue({
      currentRootNode: null,
      projectPages: [],
      activeProjectPageIndex: 0,
      nextAutoBubbleCode: "B001",
      activePortalRef: null,
      hydrateRefEditor: vi.fn(),
      buildDefaultPortalPosition: vi.fn(),
    });
    mockUsePlannerMutationContextBundle.mockReturnValue({
      handleContextAddChild: vi.fn(),
      setNodeTaskStatus: vi.fn(),
      cleanUpCrossRefs: vi.fn(),
      handleContextAddStorySibling: vi.fn(),
      handleContextChangeType: vi.fn(),
      handleContextToggleTaskStatus: vi.fn(),
      selectRefForEditing: vi.fn(),
      linkCrossRefToNode: vi.fn(),
      deletePortalByRefId: vi.fn(),
      handleContextDelete: vi.fn(),
      handleContextDuplicate: vi.fn(),
    });
    mockUsePlannerNavigationCommandBundle.mockReturnValue({});
    mockUsePlannerWorkspacePropsBundle.mockReturnValue({
      plannerCanvasSurfaceProps: { surface: true },
      plannerMobilePanelsProps: { mobile: true },
      plannerSidebarPanelsProps: { sidebar: true },
      plannerSidebarChromeProps: { chrome: true },
    });

    const setNewStoryStepText = vi.fn();
    const plannerState = {
      nodes: [],
      setNodes: vi.fn(),
      refs: [],
      setRefs: vi.fn(),
      selectedNodeId: "node-1",
      sidebarCollapsed: false,
      isMobileLayout: true,
      mobileSidebarOpen: true,
      setNewStoryStepText,
      activePortalRefId: null,
      contextMenu: null,
      loading: false,
      rfInstance: null,
    } as unknown as PlannerState;
    const user = {
      uid: "user-1",
      email: "user@example.com",
    };

    const result = usePlannerWorkspaceOrchestration({
      user: user as never,
      plannerState,
    });

    expect(mockUsePlannerResponsiveUi).toHaveBeenCalledWith(responsiveParams);
    expect(mockUsePlannerRealtimeSync).toHaveBeenCalledWith(realtimeParams);
    expect(mockUsePlannerWorkspacePropsBundle).toHaveBeenCalledWith(workspaceBundleParams);
    expect(mockBuildPlannerWorkspaceBundleParamsFromBundles).toHaveBeenCalledTimes(1);
    expect(setNewStoryStepText).toHaveBeenCalledWith("");
    expect(result).toEqual({
      loading: false,
      isMobileLayout: true,
      mobileSidebarOpen: true,
      sidebarIsCollapsed: false,
      plannerCanvasSurfaceProps: { surface: true },
      plannerMobilePanelsProps: { mobile: true },
      plannerSidebarPanelsProps: { sidebar: true },
      plannerSidebarChromeProps: { chrome: true },
    });
  });
});
