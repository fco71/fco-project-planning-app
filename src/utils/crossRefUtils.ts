import type { CrossRef } from "../types/planner";
import { normalizeCode } from "./treeUtils";

type AnchorPosition = { x: number; y: number };

export function bubbleDisplayToken(label: string, fallbackCode: string): string {
  const words = label
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return normalizeCode(fallbackCode).slice(0, 3);
  if (words.length === 1) {
    const cleaned = words[0].replace(/[^a-zA-Z0-9]/g, "");
    if (!cleaned) return normalizeCode(fallbackCode).slice(0, 3);
    return cleaned.slice(0, Math.min(2, cleaned.length)).toUpperCase();
  }
  const initials = `${words[0][0] || ""}${words[1][0] || ""}`;
  return normalizeCode(initials).slice(0, 2);
}

export function crossRefToFirestoreSetData(ref: CrossRef): Record<string, unknown> {
  return {
    label: ref.label,
    code: ref.code,
    nodeIds: [...ref.nodeIds],
    ...(ref.anchorNodeId ? { anchorNodeId: ref.anchorNodeId } : {}),
    ...(ref.color ? { color: ref.color } : {}),
    ...(typeof ref.portalX === "number" ? { portalX: ref.portalX } : {}),
    ...(typeof ref.portalY === "number" ? { portalY: ref.portalY } : {}),
    ...(typeof ref.portalAnchorX === "number" ? { portalAnchorX: ref.portalAnchorX } : {}),
    ...(typeof ref.portalAnchorY === "number" ? { portalAnchorY: ref.portalAnchorY } : {}),
    entityType: ref.entityType,
    tags: [...ref.tags],
    notes: ref.notes,
    contact: ref.contact,
    links: [...ref.links],
  };
}

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

export function chooseAnchorNodeId(nodeIds: string[], ...preferredIds: Array<string | null | undefined>): string | null {
  for (const preferred of preferredIds) {
    if (preferred && nodeIds.includes(preferred)) return preferred;
  }
  return nodeIds[0] || null;
}

export function defaultPortalPositionForAnchor(anchor: AnchorPosition | null, seed: string): AnchorPosition {
  const baseX = anchor?.x ?? 0;
  const baseY = anchor?.y ?? 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const angle = (((hash >>> 0) % 360) * Math.PI) / 180;
  const radius = 96 + ((((hash >>> 8) & 0xff) / 255) * 96);
  const wobble = getNudge(`${seed}:portal`, 16, 16);
  return {
    x: baseX + 140 - 23 + Math.cos(angle) * radius + wobble.x,
    y: baseY + 60 - 23 + Math.sin(angle) * radius + wobble.y,
  };
}

export function resolvePortalFollowPosition(
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: AnchorPosition | null,
  seed: string
): AnchorPosition {
  if (!anchor) {
    return {
      x: typeof ref.portalX === "number" ? ref.portalX : 0,
      y: typeof ref.portalY === "number" ? ref.portalY : 0,
    };
  }
  if (typeof ref.portalX === "number" && typeof ref.portalY === "number") {
    const savedAnchorX = typeof ref.portalAnchorX === "number" ? ref.portalAnchorX : anchor.x;
    const savedAnchorY = typeof ref.portalAnchorY === "number" ? ref.portalAnchorY : anchor.y;
    return {
      x: ref.portalX + (anchor.x - savedAnchorX),
      y: ref.portalY + (anchor.y - savedAnchorY),
    };
  }
  return defaultPortalPositionForAnchor(anchor, seed);
}
