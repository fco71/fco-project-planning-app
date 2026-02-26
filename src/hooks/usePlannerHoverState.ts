import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

type HoverPending = {
  nodeId: string | null;
  edgeId: string | null;
};

type PlannerHoverState = {
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  isDraggingRef: MutableRefObject<boolean>;
  scheduleHoverUpdate: (nodeId: string | null, edgeId: string | null) => void;
};

export function usePlannerHoverState(): PlannerHoverState {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const hoverPendingRef = useRef<HoverPending | null>(null);
  const isDraggingRef = useRef(false);

  const scheduleHoverUpdate = useCallback((nodeId: string | null, edgeId: string | null) => {
    if (isDraggingRef.current) return;
    hoverPendingRef.current = { nodeId, edgeId };
    if (hoverRafRef.current !== null) return;
    hoverRafRef.current = window.requestAnimationFrame(() => {
      const pending = hoverPendingRef.current;
      hoverPendingRef.current = null;
      hoverRafRef.current = null;
      if (isDraggingRef.current) return;
      setHoveredNodeId(pending?.nodeId ?? null);
      setHoveredEdgeId(pending?.edgeId ?? null);
    });
  }, []);

  useEffect(
    () => () => {
      if (hoverRafRef.current !== null) {
        window.cancelAnimationFrame(hoverRafRef.current);
      }
      hoverRafRef.current = null;
      hoverPendingRef.current = null;
    },
    []
  );

  return {
    hoveredNodeId,
    hoveredEdgeId,
    isDraggingRef,
    scheduleHoverUpdate,
  };
}
