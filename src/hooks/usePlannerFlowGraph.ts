import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { Edge, Node } from "reactflow";

type UsePlannerFlowGraphParams = {
  baseEdges: Edge[];
  hoverEdgeIds: Set<string>;
  hoveredEdgeId: string | null;
  hoveredNodeId: string | null;
  flowNodes: Node[];
  visiblePortals: Node[];
};

export function usePlannerFlowGraph({
  baseEdges,
  hoverEdgeIds,
  hoveredEdgeId,
  hoveredNodeId,
  flowNodes,
  visiblePortals,
}: UsePlannerFlowGraphParams) {
  const flowEdges = useMemo(() => {
    return baseEdges.map((edge) => {
      const isHoverRelated = hoverEdgeIds.has(edge.id);
      const edgeStyle = (edge.style || {}) as CSSProperties;
      const baseStroke = (edgeStyle.stroke as string | undefined) || "rgba(125, 211, 252, 0.45)";
      const baseWidth = typeof edgeStyle.strokeWidth === "number" ? edgeStyle.strokeWidth : 2;
      return {
        ...edge,
        style: {
          ...edgeStyle,
          stroke: isHoverRelated ? "rgba(255, 255, 255, 0.9)" : baseStroke,
          strokeWidth: isHoverRelated ? Math.max(baseWidth, 3) : baseWidth,
          opacity: hoveredNodeId || hoveredEdgeId ? (isHoverRelated ? 1 : 0.35) : 1,
          transition:
            "opacity 180ms cubic-bezier(0.4, 0, 0.2, 1), stroke 180ms cubic-bezier(0.4, 0, 0.2, 1), stroke-width 180ms cubic-bezier(0.4, 0, 0.2, 1)",
        },
      } as Edge;
    });
  }, [baseEdges, hoverEdgeIds, hoveredEdgeId, hoveredNodeId]);

  const reactFlowNodes = useMemo(
    () => [...flowNodes, ...visiblePortals],
    [flowNodes, visiblePortals]
  );

  return {
    flowEdges,
    reactFlowNodes,
  };
}
