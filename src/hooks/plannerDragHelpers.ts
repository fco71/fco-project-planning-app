import type { TreeNode } from "../types/planner";
import type { FirestoreOp, LocalOp } from "./useUndoRedo";

export type DescendantMove = {
  id: string;
  oldX: number;
  oldY: number;
  newX: number;
  newY: number;
};

export type NodeMoveEntry = {
  id: string;
  title: string;
  oldX: number;
  oldY: number;
  newX: number;
  newY: number;
};

export type DraggedNodePosition = {
  id: string;
  position: { x: number; y: number };
};

export type NodeFirestoreUpdate = {
  id: string;
  data: Record<string, unknown>;
};

export function pickNodeDropTarget(
  intersectingIds: string[],
  forbiddenIds: Set<string>,
  currentParentId: string | null
): string | null {
  for (const candidateId of intersectingIds) {
    if (forbiddenIds.has(candidateId)) continue;
    if (candidateId === currentParentId) continue;
    return candidateId;
  }
  return null;
}

type ComputeCollapsedDescendantMovesParams = {
  nodeId: string;
  deltaX: number;
  deltaY: number;
  collapsedNodeIds: Set<string>;
  collectNodeDescendants: (nodeId: string) => string[];
  nodesById: Map<string, TreeNode>;
};

export function computeCollapsedDescendantMoves({
  nodeId,
  deltaX,
  deltaY,
  collapsedNodeIds,
  collectNodeDescendants,
  nodesById,
}: ComputeCollapsedDescendantMovesParams): DescendantMove[] {
  if (!collapsedNodeIds.has(nodeId) || (deltaX === 0 && deltaY === 0)) return [];
  return collectNodeDescendants(nodeId)
    .slice(1)
    .map((descendantId) => {
      const descendant = nodesById.get(descendantId);
      if (!descendant) return null;
      const descendantOldX = typeof descendant.x === "number" ? descendant.x : 0;
      const descendantOldY = typeof descendant.y === "number" ? descendant.y : 0;
      return {
        id: descendantId,
        oldX: descendantOldX,
        oldY: descendantOldY,
        newX: descendantOldX + deltaX,
        newY: descendantOldY + deltaY,
      };
    })
    .filter((entry): entry is DescendantMove => !!entry);
}

type BuildMovedEntriesParams = {
  nodeId: string;
  nodeTitle: string;
  oldX: number;
  oldY: number;
  newX: number;
  newY: number;
  descendantMoves: DescendantMove[];
  nodesById: Map<string, TreeNode>;
};

export function buildMovedEntries({
  nodeId,
  nodeTitle,
  oldX,
  oldY,
  newX,
  newY,
  descendantMoves,
  nodesById,
}: BuildMovedEntriesParams): NodeMoveEntry[] {
  return [
    { id: nodeId, title: nodeTitle || nodeId, oldX, oldY, newX, newY },
    ...descendantMoves.map((entry) => ({
      id: entry.id,
      title: nodesById.get(entry.id)?.title || entry.id,
      oldX: entry.oldX,
      oldY: entry.oldY,
      newX: entry.newX,
      newY: entry.newY,
    })),
  ].filter((entry) => entry.oldX !== entry.newX || entry.oldY !== entry.newY);
}

export function buildMoveOps(movedEntries: NodeMoveEntry[]): {
  forwardLocal: LocalOp[];
  forwardFirestore: FirestoreOp[];
  inverseLocal: LocalOp[];
  inverseFirestore: FirestoreOp[];
} {
  return {
    forwardLocal: movedEntries.map(
      (entry): LocalOp => ({ target: "nodes", op: "patch", nodeId: entry.id, patch: { x: entry.newX, y: entry.newY } })
    ),
    forwardFirestore: movedEntries.map(
      (entry): FirestoreOp => ({ kind: "updateNode", nodeId: entry.id, data: { x: entry.newX, y: entry.newY } })
    ),
    inverseLocal: movedEntries.map(
      (entry): LocalOp => ({ target: "nodes", op: "patch", nodeId: entry.id, patch: { x: entry.oldX, y: entry.oldY } })
    ),
    inverseFirestore: movedEntries.map(
      (entry): FirestoreOp => ({ kind: "updateNode", nodeId: entry.id, data: { x: entry.oldX, y: entry.oldY } })
    ),
  };
}

export function buildPositionNodeUpdates(movedEntries: NodeMoveEntry[]): NodeFirestoreUpdate[] {
  return movedEntries.map((entry) => ({
    id: entry.id,
    data: { x: entry.newX, y: entry.newY },
  }));
}

type BuildReparentNodeUpdatesParams = {
  nodeId: string;
  newParentId: string;
  newX: number;
  newY: number;
  descendantMoves: DescendantMove[];
};

export function buildReparentNodeUpdates({
  nodeId,
  newParentId,
  newX,
  newY,
  descendantMoves,
}: BuildReparentNodeUpdatesParams): NodeFirestoreUpdate[] {
  return [
    { id: nodeId, data: { parentId: newParentId, x: newX, y: newY } },
    ...descendantMoves.map((entry) => ({
      id: entry.id,
      data: { x: entry.newX, y: entry.newY },
    })),
  ];
}

type BuildSelectionMovedPositionMapParams = {
  movedTreeNodes: DraggedNodePosition[];
  collapsedNodeIds: Set<string>;
  nodesById: Map<string, TreeNode>;
  collectNodeDescendants: (nodeId: string) => string[];
};

export function buildSelectionMovedPositionMap({
  movedTreeNodes,
  collapsedNodeIds,
  nodesById,
  collectNodeDescendants,
}: BuildSelectionMovedPositionMapParams): Map<string, { x: number; y: number }> {
  const movedTreePositions = new Map(movedTreeNodes.map((entry) => [entry.id, entry.position] as const));
  const extraCollapsedPositions = new Map<string, { x: number; y: number }>();

  movedTreeNodes.forEach((entry) => {
    const previous = nodesById.get(entry.id);
    if (!previous) return;
    const previousX = typeof previous.x === "number" ? previous.x : entry.position.x;
    const previousY = typeof previous.y === "number" ? previous.y : entry.position.y;
    const deltaX = entry.position.x - previousX;
    const deltaY = entry.position.y - previousY;
    const descendantMoves = computeCollapsedDescendantMoves({
      nodeId: entry.id,
      deltaX,
      deltaY,
      collapsedNodeIds,
      collectNodeDescendants,
      nodesById,
    });
    descendantMoves.forEach((descendantMove) => {
      if (movedTreePositions.has(descendantMove.id) || extraCollapsedPositions.has(descendantMove.id)) return;
      extraCollapsedPositions.set(descendantMove.id, { x: descendantMove.newX, y: descendantMove.newY });
    });
  });

  return new Map([...movedTreePositions, ...extraCollapsedPositions]);
}

export function buildMoveEntriesFromPositionMap(
  movedPositions: Map<string, { x: number; y: number }>,
  nodesById: Map<string, TreeNode>
): NodeMoveEntry[] {
  return Array.from(movedPositions.entries())
    .map(([id, position]) => {
      const previous = nodesById.get(id);
      if (!previous) return null;
      const oldX = typeof previous.x === "number" ? previous.x : 0;
      const oldY = typeof previous.y === "number" ? previous.y : 0;
      if (oldX === position.x && oldY === position.y) return null;
      return {
        id,
        title: previous.title || id,
        oldX,
        oldY,
        newX: position.x,
        newY: position.y,
      };
    })
    .filter((entry): entry is NodeMoveEntry => !!entry);
}

type BuildReparentOpsParams = {
  nodeId: string;
  oldParentId: string | null;
  newParentId: string;
  oldX: number;
  oldY: number;
  newX: number;
  newY: number;
  descendantMoves: DescendantMove[];
};

export function buildReparentOps({
  nodeId,
  oldParentId,
  newParentId,
  oldX,
  oldY,
  newX,
  newY,
  descendantMoves,
}: BuildReparentOpsParams): {
  forwardLocal: LocalOp[];
  forwardFirestore: FirestoreOp[];
  inverseLocal: LocalOp[];
  inverseFirestore: FirestoreOp[];
} {
  return {
    forwardLocal: [
      { target: "nodes", op: "patch", nodeId, patch: { parentId: newParentId, x: newX, y: newY } },
      ...descendantMoves.map(
        (entry): LocalOp => ({ target: "nodes", op: "patch", nodeId: entry.id, patch: { x: entry.newX, y: entry.newY } })
      ),
    ],
    forwardFirestore: [
      { kind: "updateNode", nodeId, data: { parentId: newParentId, x: newX, y: newY } },
      ...descendantMoves.map(
        (entry): FirestoreOp => ({ kind: "updateNode", nodeId: entry.id, data: { x: entry.newX, y: entry.newY } })
      ),
    ],
    inverseLocal: [
      { target: "nodes", op: "patch", nodeId, patch: { parentId: oldParentId, x: oldX, y: oldY } },
      ...descendantMoves.map(
        (entry): LocalOp => ({ target: "nodes", op: "patch", nodeId: entry.id, patch: { x: entry.oldX, y: entry.oldY } })
      ),
    ],
    inverseFirestore: [
      { kind: "updateNode", nodeId, data: { parentId: oldParentId, x: oldX, y: oldY } },
      ...descendantMoves.map(
        (entry): FirestoreOp => ({ kind: "updateNode", nodeId: entry.id, data: { x: entry.oldX, y: entry.oldY } })
      ),
    ],
  };
}
