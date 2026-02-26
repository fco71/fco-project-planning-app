import { useMemo } from "react";
import type { Edge } from "reactflow";
import type { CrossRef } from "../types/planner";

type UsePlannerEdgeHoverStateParams = {
  baseEdges: Edge[];
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  activePortalRefId: string | null;
  refs: CrossRef[];
};

export function usePlannerEdgeHoverState({
  baseEdges,
  hoveredNodeId,
  hoveredEdgeId,
  activePortalRefId,
  refs,
}: UsePlannerEdgeHoverStateParams) {
  const hoverIndex = useMemo(() => {
    const nodeToEdges = new Map<string, Set<string>>();
    const nodeToNeighbors = new Map<string, Set<string>>();
    const edgeToNodes = new Map<string, { source: string; target: string }>();
    baseEdges.forEach((edge) => {
      edgeToNodes.set(edge.id, { source: edge.source, target: edge.target });
      if (!nodeToEdges.has(edge.source)) nodeToEdges.set(edge.source, new Set());
      if (!nodeToEdges.has(edge.target)) nodeToEdges.set(edge.target, new Set());
      nodeToEdges.get(edge.source)?.add(edge.id);
      nodeToEdges.get(edge.target)?.add(edge.id);
      if (!nodeToNeighbors.has(edge.source)) nodeToNeighbors.set(edge.source, new Set());
      if (!nodeToNeighbors.has(edge.target)) nodeToNeighbors.set(edge.target, new Set());
      nodeToNeighbors.get(edge.source)?.add(edge.target);
      nodeToNeighbors.get(edge.target)?.add(edge.source);
    });
    return { nodeToEdges, nodeToNeighbors, edgeToNodes };
  }, [baseEdges]);

  const hoverNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (hoveredNodeId) {
      ids.add(hoveredNodeId);
      hoverIndex.nodeToNeighbors.get(hoveredNodeId)?.forEach((id) => ids.add(id));
    }
    if (hoveredEdgeId) {
      const edge = hoverIndex.edgeToNodes.get(hoveredEdgeId);
      if (edge) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
    }
    return ids;
  }, [hoverIndex, hoveredEdgeId, hoveredNodeId]);

  const hoverEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    if (hoveredEdgeId) ids.add(hoveredEdgeId);
    if (hoveredNodeId) {
      hoverIndex.nodeToEdges.get(hoveredNodeId)?.forEach((id) => ids.add(id));
    }
    return ids;
  }, [hoverIndex, hoveredEdgeId, hoveredNodeId]);

  const activeLinkedNodeIds = useMemo(() => {
    if (!activePortalRefId) return new Set<string>();
    const activeRef = refs.find((ref) => ref.id === activePortalRefId);
    return new Set(activeRef?.nodeIds || []);
  }, [activePortalRefId, refs]);

  return {
    hoverNodeIds,
    hoverEdgeIds,
    activeLinkedNodeIds,
  };
}
