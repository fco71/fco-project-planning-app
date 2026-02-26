import { describe, expect, it, vi } from "vitest";
import { buildPlannerMutationBundleParams } from "./buildPlannerMutationBundleParams";
import type { usePlannerPageState } from "./usePlannerPageState";

type PlannerState = ReturnType<typeof usePlannerPageState>;

describe("buildPlannerMutationBundleParams", () => {
  it("maps planner state and external inputs into mutation bundle params", () => {
    const setPortalContextMenu = vi.fn();
    const openBubblesPanel = vi.fn();
    const openMobileQuickBubble = vi.fn();
    const showSaveError = vi.fn();
    const nextNodeKind = vi.fn((kind: "root" | "item" | "project" | "story") => kind);
    const plannerState = {
      newChildTitle: "New Child",
      selectedNodeId: "node-1",
      currentRootId: "root-1",
      rootNodeId: "root-main",
      setBusyAction: vi.fn(),
      setError: vi.fn(),
      setNewChildTitle: vi.fn(),
      setPendingSelectedNodeId: vi.fn(),
      setPendingRenameNodeId: vi.fn(),
      setCurrentRootId: vi.fn(),
      setSelectedNodeId: vi.fn(),
      setActivePortalRefId: vi.fn(),
      renameTitle: "Rename me",
      setRenameTitle: vi.fn(),
      newStoryStepText: "story step",
      setNewStoryStepText: vi.fn(),
      activePortalRefId: "ref-1",
      editRefId: "ref-edit",
      newRefCode: "B001",
      newRefLabel: "Partner",
      newRefColor: "#123456",
      newRefType: "entity",
      newRefLabelInputRef: { current: null },
      setLinkNodeQuery: vi.fn(),
      setLinkTargetNodeId: vi.fn(),
      setNewRefLabel: vi.fn(),
      setNewRefCode: vi.fn(),
      setNewRefColor: vi.fn(),
      setNewRefType: vi.fn(),
      setRefs: vi.fn(),
      mergeFromRefId: "merge-1",
      setMergeFromRefId: vi.fn(),
      editRefLabel: "Edit Label",
      editRefCode: "EDIT",
      editRefType: "person",
      editRefTags: "tag-a",
      editRefNotes: "note",
      editRefContact: "contact",
      editRefLinks: "https://x.test",
      mobileQuickBubbleEditName: "Quick Bubble",
      setEditRefCode: vi.fn(),
      setEditRefTags: vi.fn(),
      setEditRefLinks: vi.fn(),
      setEditRefLabel: vi.fn(),
      setPortalContextMenu,
      rfInstance: null,
      collapsedNodeIds: new Set<string>(["node-1"]),
      setNodes: vi.fn(),
      setDropTargetNodeId: vi.fn(),
      isDraggingRef: { current: false },
      dropTargetIdRef: { current: null },
      isMobileLayout: true,
      renameInputRef: { current: null },
      setSidebarCollapsed: vi.fn(),
      setMobileSidebarSection: vi.fn(),
      setMobileSidebarOpen: vi.fn(),
    } as unknown as PlannerState;

    const params = buildPlannerMutationBundleParams({
      firestore: null,
      userUid: "user-1",
      plannerState,
      selectedNode: null,
      nodesById: new Map(),
      childrenByParent: new Map(),
      refs: [],
      newNodeDocId: vi.fn(() => "node-doc"),
      pushHistory: vi.fn(),
      resolveNodePosition: vi.fn(() => ({ x: 10, y: 20 })),
      chooseAnchorNodeId: vi.fn(() => "node-1"),
      resolvePortalFollowPosition: vi.fn(() => ({ x: 11, y: 22 })),
      crossRefToFirestoreSetData: vi.fn(() => ({})),
      applyLocalNodePatch: vi.fn(),
      hydrateRefEditor: vi.fn(),
      buildDefaultPortalPosition: vi.fn(() => ({ x: 100, y: 120 })),
      nextAutoBubbleCode: "B002",
      activePortalRef: null,
      showSaveError,
      draggedNodeIdRef: { current: "node-1" },
      crossReferencesEnabled: true,
      bubblesSimplifiedMode: true,
      defaultBubbleColor: "#40B6FF",
      nextNodeKind,
      openBubblesPanel,
      openMobileQuickBubble,
    });

    expect(params.createDelete.newChildTitle).toBe("New Child");
    expect(params.crossRef.effectiveBubbleTargetId).toBe("node-1");
    expect(params.context.openBubblesPanel).toBe(openBubblesPanel);
    expect(params.context.openMobileQuickBubble).toBe(openMobileQuickBubble);
    expect(params.drag.dropTargetIdRef).toBe(plannerState.dropTargetIdRef);
    params.crossRef.closePortalContextMenu();
    expect(setPortalContextMenu).toHaveBeenCalledWith(null);
  });
});
