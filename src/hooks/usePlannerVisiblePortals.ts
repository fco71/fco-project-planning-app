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
    const PORTAL_GAP = isMobileLayout ? 54 : 50;
    const PORTAL_VERTICAL_GAP = isMobileLayout ? 34 : 30;
    const PORTAL_SIDE_GAP = isMobileLayout ? 56 : 52;
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
    const sceneMidX = (sceneBounds.minX + sceneBounds.maxX) / 2;
    const sceneMidY = (sceneBounds.minY + sceneBounds.maxY) / 2;
    const minX = sceneBounds.minX - (isMobileLayout ? 100 : 120);
    const maxX = sceneBounds.maxX + (isMobileLayout ? 100 : 140);
    const minY = sceneBounds.minY - (isMobileLayout ? 80 : 70);
    const maxY = sceneBounds.maxY + (isMobileLayout ? 100 : 80);

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
    const anchorOrder = Array.from(refsByAnchor.keys()).sort((a, b) => {
      const aBounds = boundsByNodeId.get(a);
      const bBounds = boundsByNodeId.get(b);
      if (!aBounds || !bBounds) return a.localeCompare(b);
      if (aBounds.y !== bBounds.y) return aBounds.y - bBounds.y;
      if (aBounds.x !== bBounds.x) return aBounds.x - bBounds.x;
      return a.localeCompare(b);
    });

    for (const anchorNodeId of anchorOrder) {
      const anchorRefs = refsByAnchor.get(anchorNodeId);
      const anchorBounds = boundsByNodeId.get(anchorNodeId);
      if (!anchorRefs || anchorRefs.length === 0 || !anchorBounds) continue;
      const anchorNudge = getNudge(anchorNodeId, 12, 6);
      const stackHeight = (anchorRefs.length - 1) * PORTAL_GAP;
      const stackXBase = anchorBounds.x + anchorBounds.width / 2 - PORTAL_SIZE / 2 + anchorNudge.x;
      const placeBelow = anchorBounds.y + anchorBounds.height / 2 <= sceneMidY;
      let stackYBase = placeBelow
        ? anchorBounds.y + anchorBounds.height + PORTAL_VERTICAL_GAP
        : anchorBounds.y - PORTAL_VERTICAL_GAP - stackHeight - PORTAL_SIZE;
      stackYBase = clamp(stackYBase + anchorNudge.y, minY, maxY - stackHeight - PORTAL_SIZE);
      const sideXBase =
        anchorBounds.x +
        (anchorBounds.x + anchorBounds.width / 2 >= sceneMidX
          ? -(PORTAL_SIDE_GAP + PORTAL_SIZE)
          : anchorBounds.width + PORTAL_SIDE_GAP);
      let sideYBase = anchorBounds.y + anchorBounds.height / 2 - stackHeight / 2 + anchorNudge.y;
      sideYBase = clamp(sideYBase, minY, maxY - stackHeight - PORTAL_SIZE);
      const anchorRect = {
        x: anchorBounds.x,
        y: anchorBounds.y,
        width: anchorBounds.width,
        height: anchorBounds.height,
      };

      anchorRefs.forEach((ref, idx) => {
        const refNudge = getNudge(`${ref.id}:${anchorNodeId}`, 8, 8);
        let x = clamp(stackXBase + refNudge.x * 0.22, minX, maxX - PORTAL_SIZE);
        let y = clamp(stackYBase + idx * PORTAL_GAP + refNudge.y * 0.22, minY, maxY - PORTAL_SIZE);
        const overlapsAnchor = !(
          x + PORTAL_SIZE < anchorRect.x ||
          x > anchorRect.x + anchorRect.width ||
          y + PORTAL_SIZE < anchorRect.y ||
          y > anchorRect.y + anchorRect.height
        );
        if (overlapsAnchor) {
          x = clamp(sideXBase + refNudge.x * 0.2, minX, maxX - PORTAL_SIZE);
          y = clamp(sideYBase + idx * PORTAL_GAP + refNudge.y * 0.2, minY, maxY - PORTAL_SIZE);
        }
        const isActive = activePortalRefId === ref.id;
        const bubbleColor = ref.color || defaultBubbleColor;
        result.push({
          id: `portal:${ref.id}`,
          position: { x, y },
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
