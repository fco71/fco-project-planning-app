import { describe, expect, it, vi } from "vitest";
import { buildPlannerCanvasGraphStateParams } from "./buildPlannerCanvasGraphStateParams";
import type { usePlannerPageState } from "./usePlannerPageState";

type PlannerState = ReturnType<typeof usePlannerPageState>;

describe("buildPlannerCanvasGraphStateParams", () => {
  it("maps planner state and external inputs into canvas graph params", () => {
    const persistNodeBody = vi.fn();
    const toggleStoryCardExpand = vi.fn();
    const startStoryNodeResize = vi.fn();
    const resetStoryNodeSize = vi.fn();
    const chooseAnchorNodeId = vi.fn(() => "node-1");
    const bubbleDisplayToken = vi.fn((label: string, fallback: string) => `${label}:${fallback}`);
    const rgbaFromHex = vi.fn(() => "rgba(1,2,3,0.5)");

    const plannerState = {
      currentRootId: "root-1",
      collapsedNodeIds: new Set<string>(["a"]),
      setCollapsedNodeIds: vi.fn(),
      collapsedHydrated: true,
      syncedCollapsedKeyRef: { current: "root-1" },
      searchQuery: "plan",
      storyLaneMode: false,
      rootNodeId: "root-main",
      isMobileLayout: true,
      refs: [{ id: "ref-1" }],
      hoveredNodeId: "node-hover",
      hoveredEdgeId: "edge-hover",
      activePortalRefId: "ref-1",
      selectedNodeId: "node-2",
      dropTargetNodeId: "node-drop",
      setSelectedNodeId: vi.fn(),
    } as unknown as PlannerState;

    const params = buildPlannerCanvasGraphStateParams({
      plannerState,
      firestore: null,
      userUid: "user-1",
      nodesById: new Map(),
      childrenByParent: new Map(),
      expandedStoryNodeIds: new Set<string>(["story-1"]),
      persistNodeBody,
      toggleStoryCardExpand,
      startStoryNodeResize,
      resetStoryNodeSize,
      crossReferencesEnabled: true,
      storyNodeMinWidth: 220,
      storyNodeMaxWidth: 780,
      storyNodeMinHeight: 120,
      storyNodeMaxHeight: 920,
      defaultBubbleColor: "#40B6FF",
      chooseAnchorNodeId,
      bubbleDisplayToken,
      rgbaFromHex,
    });

    expect(params.treeView.currentRootId).toBe("root-1");
    expect(params.baseGraph.expandedStoryNodeIds).toEqual(new Set(["story-1"]));
    expect(params.flowNodes.persistNodeBody).toBe(persistNodeBody);
    expect(params.visiblePortals.chooseAnchorNodeId).toBe(chooseAnchorNodeId);
    expect(params.visiblePortals.bubbleDisplayToken).toBe(bubbleDisplayToken);
    expect(params.visiblePortals.rgbaFromHex).toBe(rgbaFromHex);
  });
});
