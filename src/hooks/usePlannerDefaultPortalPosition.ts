import { useCallback } from "react";

type Position = { x: number; y: number } | null;
type ResolveNodePosition = (nodeId: string) => { x: number; y: number } | null;
type DefaultPortalPositionForAnchor = (anchor: Position, seed: string) => { x: number; y: number };

type UsePlannerDefaultPortalPositionParams = {
  resolveNodePosition: ResolveNodePosition;
  defaultPortalPositionForAnchor: DefaultPortalPositionForAnchor;
};

export function usePlannerDefaultPortalPosition({
  resolveNodePosition,
  defaultPortalPositionForAnchor,
}: UsePlannerDefaultPortalPositionParams) {
  return useCallback(
    (anchorNodeId: string | null, seed: string) => {
      if (!anchorNodeId) return null;
      return defaultPortalPositionForAnchor(resolveNodePosition(anchorNodeId), `${seed}:${anchorNodeId}`);
    },
    [defaultPortalPositionForAnchor, resolveNodePosition]
  );
}
