import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { doc, serverTimestamp, writeBatch, type Firestore } from "firebase/firestore";
import type { HistoryEntry } from "./useUndoRedo";
import type { TreeNode } from "../types/planner";

type UsePlannerLayoutActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  treeLayout: Map<string, { x: number; y: number }>;
  filteredTreeIds: string[];
  filteredTreeIdSet: Set<string>;
  selectedNodeId: string | null;
  nodesById: Map<string, TreeNode>;
  childrenByParent: Map<string | null, string[]>;
  pushHistory: (entry: HistoryEntry) => void;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNodes: Dispatch<SetStateAction<TreeNode[]>>;
};

function collectBranchDescendants(rootId: string, index: Map<string | null, string[]>): string[] {
  const result: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    result.push(current);
    const children = index.get(current) || [];
    children.forEach((id) => queue.push(id));
  }
  return result;
}

export function usePlannerLayoutActions({
  firestore,
  userUid,
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
}: UsePlannerLayoutActionsParams) {
  const organizeNodesByIds = useCallback(
    async (targetIds: string[], historyLabel: string) => {
      if (!firestore || targetIds.length === 0) return;
      const plannedPositions = targetIds
        .map((id) => {
          const position = treeLayout.get(id);
          if (!position) return null;
          return { id, position };
        })
        .filter((entry): entry is { id: string; position: { x: number; y: number } } => !!entry);

      if (plannedPositions.length === 0) return;

      const movedEntries = plannedPositions
        .map((entry) => {
          const previous = nodesById.get(entry.id);
          if (!previous) return null;
          const oldX = typeof previous.x === "number" ? previous.x : 0;
          const oldY = typeof previous.y === "number" ? previous.y : 0;
          if (oldX === entry.position.x && oldY === entry.position.y) return null;
          return {
            id: entry.id,
            title: previous.title || entry.id,
            oldX,
            oldY,
            newX: entry.position.x,
            newY: entry.position.y,
          };
        })
        .filter(
          (entry): entry is { id: string; title: string; oldX: number; oldY: number; newX: number; newY: number } =>
            !!entry
        );

      if (movedEntries.length === 0) return;

      pushHistory({
        id: crypto.randomUUID(),
        label: historyLabel,
        forwardLocal: movedEntries.map((entry) => ({
          target: "nodes" as const,
          op: "patch" as const,
          nodeId: entry.id,
          patch: { x: entry.newX, y: entry.newY },
        })),
        forwardFirestore: movedEntries.map((entry) => ({
          kind: "updateNode" as const,
          nodeId: entry.id,
          data: { x: entry.newX, y: entry.newY },
        })),
        inverseLocal: movedEntries.map((entry) => ({
          target: "nodes" as const,
          op: "patch" as const,
          nodeId: entry.id,
          patch: { x: entry.oldX, y: entry.oldY },
        })),
        inverseFirestore: movedEntries.map((entry) => ({
          kind: "updateNode" as const,
          nodeId: entry.id,
          data: { x: entry.oldX, y: entry.oldY },
        })),
      });

      const nextPositions = new Map(plannedPositions.map((entry) => [entry.id, entry.position] as const));
      setBusyAction(true);
      setError(null);
      setNodes((prevNodes) =>
        prevNodes.map((entry) => {
          const next = nextPositions.get(entry.id);
          if (!next) return entry;
          return { ...entry, x: next.x, y: next.y };
        })
      );

      try {
        let batch = writeBatch(firestore);
        let operations = 0;
        for (const entry of plannedPositions) {
          batch.update(doc(firestore, "users", userUid, "nodes", entry.id), {
            x: entry.position.x,
            y: entry.position.y,
            updatedAt: serverTimestamp(),
          });
          operations += 1;
          if (operations >= 450) {
            await batch.commit();
            batch = writeBatch(firestore);
            operations = 0;
          }
        }
        if (operations > 0) {
          await batch.commit();
        }
      } catch (actionError: unknown) {
        setError(actionError instanceof Error ? actionError.message : "Could not organize node layout.");
      } finally {
        setBusyAction(false);
      }
    },
    [firestore, nodesById, pushHistory, setBusyAction, setError, setNodes, treeLayout, userUid]
  );

  const organizeVisibleTree = useCallback(async () => {
    await organizeNodesByIds(filteredTreeIds, "Clean up visible tree layout");
  }, [filteredTreeIds, organizeNodesByIds]);

  const organizeSelectedBranch = useCallback(async () => {
    if (!selectedNodeId) return;
    const branchIds = collectBranchDescendants(selectedNodeId, childrenByParent).filter((id) => filteredTreeIdSet.has(id));
    const selectedTitle = nodesById.get(selectedNodeId)?.title || "Selected";
    await organizeNodesByIds(branchIds, `Clean up "${selectedTitle}" branch`);
  }, [childrenByParent, filteredTreeIdSet, nodesById, organizeNodesByIds, selectedNodeId]);

  return {
    organizeNodesByIds,
    organizeVisibleTree,
    organizeSelectedBranch,
  };
}
