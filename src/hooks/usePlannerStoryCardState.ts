import { useCallback, useState } from "react";

type PlannerStoryCardState = {
  expandedStoryNodeIds: Set<string>;
  toggleStoryCardExpand: (nodeId: string) => void;
};

export function usePlannerStoryCardState(): PlannerStoryCardState {
  const [expandedStoryNodeIds, setExpandedStoryNodeIds] = useState<Set<string>>(new Set());

  const toggleStoryCardExpand = useCallback((nodeId: string) => {
    setExpandedStoryNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  return {
    expandedStoryNodeIds,
    toggleStoryCardExpand,
  };
}
