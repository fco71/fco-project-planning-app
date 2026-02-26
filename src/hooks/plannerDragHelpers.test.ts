import { describe, expect, it } from "vitest";
import type { TreeNode } from "../types/planner";
import {
  buildMoveEntriesFromPositionMap,
  buildMoveOps,
  buildMovedEntries,
  buildPositionNodeUpdates,
  buildReparentOps,
  buildReparentNodeUpdates,
  buildSelectionMovedPositionMap,
  computeCollapsedDescendantMoves,
  pickNodeDropTarget,
} from "./plannerDragHelpers";

function makeNode(id: string, x: number, y: number, parentId: string | null = null): TreeNode {
  return {
    id,
    title: id,
    kind: "item",
    parentId,
    x,
    y,
  };
}

describe("plannerDragHelpers", () => {
  it("picks the first allowed intersecting candidate", () => {
    const candidate = pickNodeDropTarget(["a", "b", "c"], new Set(["a"]), null);
    expect(candidate).toBe("b");
  });

  it("skips current parent and forbidden descendants", () => {
    const candidate = pickNodeDropTarget(["parent", "child-1", "new-parent"], new Set(["child-1"]), "parent");
    expect(candidate).toBe("new-parent");
  });

  it("returns null when no valid target exists", () => {
    const candidate = pickNodeDropTarget(["x", "y"], new Set(["x", "y"]), null);
    expect(candidate).toBeNull();
  });

  it("computes descendant moves for collapsed dragged node", () => {
    const nodesById = new Map<string, TreeNode>([
      ["root", makeNode("root", 0, 0, null)],
      ["a", makeNode("a", 10, 20, "root")],
      ["b", makeNode("b", 40, 70, "a")],
    ]);
    const moves = computeCollapsedDescendantMoves({
      nodeId: "a",
      deltaX: 5,
      deltaY: -3,
      collapsedNodeIds: new Set(["a"]),
      collectNodeDescendants: () => ["a", "b"],
      nodesById,
    });
    expect(moves).toEqual([{ id: "b", oldX: 40, oldY: 70, newX: 45, newY: 67 }]);
  });

  it("returns empty descendant moves when node is not collapsed", () => {
    const nodesById = new Map<string, TreeNode>([["a", makeNode("a", 10, 20)]]);
    const moves = computeCollapsedDescendantMoves({
      nodeId: "a",
      deltaX: 5,
      deltaY: 1,
      collapsedNodeIds: new Set<string>(),
      collectNodeDescendants: () => ["a"],
      nodesById,
    });
    expect(moves).toEqual([]);
  });

  it("builds moved entries and move ops", () => {
    const nodesById = new Map<string, TreeNode>([["c1", makeNode("c1", 20, 30)]]);
    const movedEntries = buildMovedEntries({
      nodeId: "p",
      nodeTitle: "Parent",
      oldX: 0,
      oldY: 0,
      newX: 10,
      newY: 0,
      descendantMoves: [{ id: "c1", oldX: 20, oldY: 30, newX: 25, newY: 35 }],
      nodesById,
    });
    expect(movedEntries).toHaveLength(2);
    expect(movedEntries[0].title).toBe("Parent");
    const ops = buildMoveOps(movedEntries);
    expect(ops.forwardLocal).toHaveLength(2);
    expect(ops.inverseFirestore).toHaveLength(2);
  });

  it("builds reparent ops including parent and descendants", () => {
    const ops = buildReparentOps({
      nodeId: "n1",
      oldParentId: "old-parent",
      newParentId: "new-parent",
      oldX: 1,
      oldY: 2,
      newX: 11,
      newY: 12,
      descendantMoves: [{ id: "d1", oldX: 5, oldY: 6, newX: 15, newY: 16 }],
    });
    expect(ops.forwardFirestore[0]).toEqual({
      kind: "updateNode",
      nodeId: "n1",
      data: { parentId: "new-parent", x: 11, y: 12 },
    });
    expect(ops.inverseLocal).toHaveLength(2);
  });

  it("builds selection moved-position map with collapsed descendants", () => {
    const nodesById = new Map<string, TreeNode>([
      ["a", makeNode("a", 10, 20, "root")],
      ["b", makeNode("b", 40, 50, "a")],
      ["c", makeNode("c", 70, 80, "root")],
    ]);
    const moved = buildSelectionMovedPositionMap({
      movedTreeNodes: [
        { id: "a", position: { x: 20, y: 35 } },
        { id: "c", position: { x: 75, y: 85 } },
      ],
      collapsedNodeIds: new Set(["a"]),
      nodesById,
      collectNodeDescendants: (nodeId) => (nodeId === "a" ? ["a", "b"] : [nodeId]),
    });

    expect(moved.get("a")).toEqual({ x: 20, y: 35 });
    expect(moved.get("c")).toEqual({ x: 75, y: 85 });
    expect(moved.get("b")).toEqual({ x: 50, y: 65 });
  });

  it("builds move entries from position map and skips unchanged nodes", () => {
    const nodesById = new Map<string, TreeNode>([
      ["a", makeNode("a", 10, 20)],
      ["b", makeNode("b", 50, 60)],
    ]);
    const entries = buildMoveEntriesFromPositionMap(
      new Map<string, { x: number; y: number }>([
        ["a", { x: 10, y: 20 }],
        ["b", { x: 80, y: 90 }],
      ]),
      nodesById
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      id: "b",
      title: "b",
      oldX: 50,
      oldY: 60,
      newX: 80,
      newY: 90,
    });
  });

  it("builds position-only Firestore updates", () => {
    const updates = buildPositionNodeUpdates([
      { id: "n1", title: "n1", oldX: 0, oldY: 0, newX: 10, newY: 12 },
      { id: "n2", title: "n2", oldX: 1, oldY: 2, newX: 20, newY: 22 },
    ]);
    expect(updates).toEqual([
      { id: "n1", data: { x: 10, y: 12 } },
      { id: "n2", data: { x: 20, y: 22 } },
    ]);
  });

  it("builds reparent Firestore updates", () => {
    const updates = buildReparentNodeUpdates({
      nodeId: "n1",
      newParentId: "p2",
      newX: 100,
      newY: 200,
      descendantMoves: [{ id: "c1", oldX: 1, oldY: 2, newX: 11, newY: 22 }],
    });
    expect(updates).toEqual([
      { id: "n1", data: { parentId: "p2", x: 100, y: 200 } },
      { id: "c1", data: { x: 11, y: 22 } },
    ]);
  });
});
