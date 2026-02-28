import { useMemo } from "react";
import type { Node } from "reactflow";
import type { CrossRef } from "../types/planner";

type UsePlannerVisiblePortalsParams = {
  crossReferencesEnabled: boolean;
  refs: CrossRef[];
  filteredTreeIdSet: Set<string>;
  baseNodes: Node[];
  isMobileLayout: boolean;
  activePortalRefId: string | null;
  defaultBubbleColor: string;
  chooseAnchorNodeId: (nodeIds: string[], ...preferredIds: Array<string | null | undefined>) => string | null;
  bubbleDisplayToken: (label: string, fallbackCode: string) => string;
  rgbaFromHex: (hex: string | null | undefined, alpha: number, fallback: string) => string;
};

function getNudge(seed: string, xRange = 12, yRange = 8): { x: number; y: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const x = ((hash % (xRange * 2 + 1)) + (xRange * 2 + 1)) % (xRange * 2 + 1) - xRange;
  const yHash = ((hash >> 8) % (yRange * 2 + 1) + (yRange * 2 + 1)) % (yRange * 2 + 1) - yRange;
  return { x, y: yHash };
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) return value;
  return Math.min(max, Math.max(min, value));
}

type Rect = { x: number; y: number; width: number; height: number };

function intersectsRect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function usePlannerVisiblePortals({
  crossReferencesEnabled,
  refs,
  filteredTreeIdSet,
  baseNodes,
  isMobileLayout,
  activePortalRefId,
  defaultBubbleColor,
  chooseAnchorNodeId,
  bubbleDisplayToken,
  rgbaFromHex,
}: UsePlannerVisiblePortalsParams) {
  return useMemo((): Node[] => {
    if (!crossReferencesEnabled) return [];
    const PORTAL_SIZE = isMobileLayout ? 48 : 40;
    const STACK_GAP = isMobileLayout ? 56 : 50;
    // Keep bubbles clearly near their node; collision logic still prevents overlap.
    const STACK_VERTICAL_GAP = isMobileLayout ? 46 : 42;
    const SIDE_GAP = isMobileLayout ? 44 : 38;
    const COLUMN_GAP = isMobileLayout ? 30 : 26;
    const NODE_FALLBACK_WIDTH = isMobileLayout ? 280 : 260;
    const NODE_FALLBACK_HEIGHT = isMobileLayout ? 96 : 80;

    const nodeBounds = baseNodes.map((node) => {
      const style = node.style || {};
      const width = asFiniteNumber(style.width) ?? asFiniteNumber(node.width) ?? NODE_FALLBACK_WIDTH;
      const measuredHeight = asFiniteNumber(style.height) ?? asFiniteNumber(node.height) ?? NODE_FALLBACK_HEIGHT;
      const minHeight = asFiniteNumber(style.minHeight) ?? 0;
      return {
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width,
        height: Math.max(measuredHeight, minHeight, NODE_FALLBACK_HEIGHT),
      };
    });
    if (nodeBounds.length === 0) return [];
    const boundsByNodeId = new Map(nodeBounds.map((entry) => [entry.id, entry] as const));
    const sceneBounds = nodeBounds.reduce(
      (acc, rect) => ({
        minX: Math.min(acc.minX, rect.x),
        maxX: Math.max(acc.maxX, rect.x + rect.width),
        minY: Math.min(acc.minY, rect.y),
        maxY: Math.max(acc.maxY, rect.y + rect.height),
      }),
      {
        minX: nodeBounds[0].x,
        maxX: nodeBounds[0].x + nodeBounds[0].width,
        minY: nodeBounds[0].y,
        maxY: nodeBounds[0].y + nodeBounds[0].height,
      }
    );
    // Use generous world bounds so collapsing distant branches does not clamp/move unrelated bubbles.
    const minX = sceneBounds.minX - (isMobileLayout ? 240 : 260);
    const maxX = sceneBounds.maxX + (isMobileLayout ? 320 : 340);
    const minY = sceneBounds.minY - (isMobileLayout ? 220 : 240);
    const maxY = sceneBounds.maxY + (isMobileLayout ? 260 : 280);

    const refsByAnchor = new Map<string, CrossRef[]>();
    for (const ref of refs) {
      const visibleNodeIds = ref.nodeIds.filter((nodeId) => filteredTreeIdSet.has(nodeId));
      if (visibleNodeIds.length === 0) continue;
      const anchorNodeId = chooseAnchorNodeId(visibleNodeIds, ref.anchorNodeId);
      if (!anchorNodeId || !boundsByNodeId.has(anchorNodeId)) continue;
      if (!refsByAnchor.has(anchorNodeId)) refsByAnchor.set(anchorNodeId, []);
      refsByAnchor.get(anchorNodeId)?.push(ref);
    }
    refsByAnchor.forEach((anchorRefs) =>
      anchorRefs.sort((a, b) => a.code.localeCompare(b.code) || a.label.localeCompare(b.label))
    );

    const result: Node[] = [];
    const placedPortalRects: Rect[] = [];
    // Keep order stable by id so collapsing one subtree doesn't reorder the whole bubble pass.
    const anchorOrder = Array.from(refsByAnchor.keys()).sort((a, b) => a.localeCompare(b));

    for (const anchorNodeId of anchorOrder) {
      const anchorRefs = refsByAnchor.get(anchorNodeId);
      const anchorBounds = boundsByNodeId.get(anchorNodeId);
      if (!anchorRefs || anchorRefs.length === 0 || !anchorBounds) continue;

      const resolveCollision = (startX: number, startY: number, sideDirection: -1 | 1) => {
        let x = clamp(startX, minX, maxX - PORTAL_SIZE);
        let y = clamp(startY, minY, maxY - PORTAL_SIZE);
        const rowStep = Math.max(12, Math.round(STACK_GAP * 0.72));
        const columnStep = PORTAL_SIZE + COLUMN_GAP;
        for (let attempt = 0; attempt < 140; attempt += 1) {
          const candidate: Rect = { x, y, width: PORTAL_SIZE, height: PORTAL_SIZE };
          const nodeCollision = nodeBounds.some((rect) => intersectsRect(candidate, rect));
          const portalCollision = placedPortalRects.some((rect) => intersectsRect(candidate, rect));
          if (!nodeCollision && !portalCollision) {
            return { x, y };
          }

          y += rowStep;
          if (y > maxY - PORTAL_SIZE) {
            y = minY + (attempt % 4) * (rowStep * 0.5);
            x = clamp(x + sideDirection * columnStep, minX, maxX - PORTAL_SIZE);
          }
        }
        return { x, y };
      };

      const anchorNudge = getNudge(anchorNodeId, 10, 6);
      const stackHeight = (anchorRefs.length - 1) * STACK_GAP;
      const stackX = anchorBounds.x + anchorBounds.width / 2 - PORTAL_SIZE / 2 + anchorNudge.x * 0.22;
      const stackStartBelow = anchorBounds.y + anchorBounds.height + STACK_VERTICAL_GAP + anchorNudge.y * 0.26;
      const stackStartAbove = anchorBounds.y - STACK_VERTICAL_GAP - stackHeight - PORTAL_SIZE + anchorNudge.y * 0.26;
      const estimateStackCollisions = (startY: number) => {
        let score = 0;
        for (let i = 0; i < anchorRefs.length; i += 1) {
          const probe: Rect = {
            x: stackX,
            y: startY + i * STACK_GAP,
            width: PORTAL_SIZE,
            height: PORTAL_SIZE,
          };
          if (
            nodeBounds.some((rect) => rect.id !== anchorNodeId && intersectsRect(probe, rect))
          ) {
            score += 1;
          }
        }
        return score;
      };
      const belowCollisionScore = estimateStackCollisions(stackStartBelow);
      const aboveCollisionScore = estimateStackCollisions(stackStartAbove);
      const placeBelow = belowCollisionScore <= aboveCollisionScore;
      let stackStartY = placeBelow ? stackStartBelow : stackStartAbove;
      stackStartY = clamp(stackStartY, minY, maxY - stackHeight - PORTAL_SIZE);

      const sideDirectionNudge = getNudge(`${anchorNodeId}:side`, 1, 0);
      const sideDirection: -1 | 1 = sideDirectionNudge.x < 0 ? -1 : 1;
      const sideX = anchorBounds.x + (sideDirection === -1 ? -(SIDE_GAP + PORTAL_SIZE) : anchorBounds.width + SIDE_GAP);
      let sideStartY = anchorBounds.y + anchorBounds.height / 2 - stackHeight / 2 + anchorNudge.y * 0.22;
      sideStartY = clamp(sideStartY, minY, maxY - stackHeight - PORTAL_SIZE);

      const anchorRect: Rect = {
        x: anchorBounds.x,
        y: anchorBounds.y,
        width: anchorBounds.width,
        height: anchorBounds.height,
      };

      anchorRefs.forEach((ref, idx) => {
        const refNudge = getNudge(`${ref.id}:${anchorNodeId}`, 6, 6);
        let startX = stackX + refNudge.x * 0.2;
        let startY = stackStartY + idx * STACK_GAP + refNudge.y * 0.2;

        const stackRect: Rect = {
          x: startX,
          y: startY,
          width: PORTAL_SIZE,
          height: PORTAL_SIZE,
        };
        if (intersectsRect(stackRect, anchorRect)) {
          startX = sideX + refNudge.x * 0.2;
          startY = sideStartY + idx * STACK_GAP + refNudge.y * 0.2;
        }

        const resolved = resolveCollision(startX, startY, sideDirection);
        const isActive = activePortalRefId === ref.id;
        const bubbleColor = ref.color || defaultBubbleColor;
        placedPortalRects.push({
          x: resolved.x,
          y: resolved.y,
          width: PORTAL_SIZE,
          height: PORTAL_SIZE,
        });
        result.push({
          id: `portal:${ref.id}`,
          position: { x: resolved.x, y: resolved.y },
          type: "portal",
          className: "planner-portal-node",
          data: {
            display: bubbleDisplayToken(ref.label, ref.code),
            tooltip:
              ref.nodeIds.length > 1
                ? `${ref.label}\n${ref.nodeIds.length} linked nodes`
                : ref.label,
            isActive,
          },
          draggable: false,
          selectable: true,
          zIndex: 10,
          style: {
            width: PORTAL_SIZE,
            height: PORTAL_SIZE,
            borderRadius: 999,
            border: isActive
              ? "2px solid rgba(251,191,36,0.95)"
              : `2px solid ${rgbaFromHex(bubbleColor, 0.95, "rgba(64,182,255,0.95)")}`,
            background: isActive ? "rgba(48,30,4,0.88)" : rgbaFromHex(bubbleColor, 0.26, "rgba(12,36,72,0.82)"),
            color: isActive ? "rgba(255,230,130,0.98)" : rgbaFromHex(bubbleColor, 0.98, "rgba(200,235,255,0.95)"),
            fontSize: PORTAL_SIZE >= 48 ? 11 : 10,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.50)",
            opacity: 1,
            visibility: "visible",
            pointerEvents: "all",
            padding: 0,
          },
        } as Node);
      });
    }
    return result;
  }, [
    activePortalRefId,
    baseNodes,
    bubbleDisplayToken,
    chooseAnchorNodeId,
    crossReferencesEnabled,
    defaultBubbleColor,
    filteredTreeIdSet,
    isMobileLayout,
    refs,
    rgbaFromHex,
  ]);
}
