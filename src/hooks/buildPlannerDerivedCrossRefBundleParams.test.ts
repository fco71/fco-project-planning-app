import { describe, expect, it, vi } from "vitest";
import { buildPlannerDerivedCrossRefBundleParams } from "./buildPlannerDerivedCrossRefBundleParams";
import type { usePlannerPageState } from "./usePlannerPageState";

type PlannerState = ReturnType<typeof usePlannerPageState>;

describe("buildPlannerDerivedCrossRefBundleParams", () => {
  it("maps planner state and external inputs into derived cross-ref bundle params", () => {
    const plannerState = {
      currentRootId: "root-1",
      rootNodeId: "root-main",
      selectedNodeId: "node-1",
      collapsedNodeIds: new Set<string>(["collapsed-1"]),
      refs: [{ id: "ref-1", nodeIds: ["node-1"] }],
      activePortalRefId: "ref-1",
      editRefId: "ref-edit",
      refSearchQuery: "et",
      refCategoryFilter: "person",
      refScopeFilter: "all",
      newRefLabel: "Ettore",
      newRefCode: "B001",
      linkNodeQuery: "project",
      isMobileLayout: true,
      mobileQuickBubbleOpen: false,
      linkTargetNodeId: "node-2",
      portalContextMenu: null,
      setPortalContextMenu: vi.fn(),
      setActivePortalRefId: vi.fn(),
      setMobileQuickBubbleEditName: vi.fn(),
      setEditRefId: vi.fn(),
      setEditRefLabel: vi.fn(),
      setEditRefCode: vi.fn(),
      setEditRefType: vi.fn(),
      setEditRefTags: vi.fn(),
      setEditRefNotes: vi.fn(),
      setEditRefContact: vi.fn(),
      setEditRefLinks: vi.fn(),
      setMergeFromRefId: vi.fn(),
      setLinkNodeQuery: vi.fn(),
      setLinkTargetNodeId: vi.fn(),
      bodyDraft: "Body draft",
    } as unknown as PlannerState;

    const params = buildPlannerDerivedCrossRefBundleParams({
      plannerState,
      nodes: [],
      nodesById: new Map(),
      childrenByParent: new Map(),
      visibleTreeIdSet: new Set<string>(["node-1"]),
      resolveNodePosition: vi.fn(() => ({ x: 10, y: 20 })),
      defaultPortalPositionForAnchor: vi.fn(() => ({ x: 11, y: 22 })),
      persistNodeBody: vi.fn(),
    });

    expect(params.viewDerived.currentRootId).toBe("root-1");
    expect(params.crossRefDerived.selectedNodeId).toBe("node-1");
    expect(params.crossRefDerived.refs).toBe(plannerState.refs);
    expect(params.crossRefUiSync.setEditRefId).toBe(plannerState.setEditRefId);
    expect(params.bodySave.bodyDraft).toBe("Body draft");
  });
});
