import type { CrossRef, CrossRefDoc, EntityType } from "../types/planner";

type Position = { x: number; y: number };
type ChooseAnchorNodeId = (
  nodeIds: string[],
  ...preferredIds: Array<string | null | undefined>
) => string | null;
type ResolveNodePosition = (nodeId: string) => Position;
type ResolvePortalFollowPosition = (
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: Position | null,
  seed: string
) => Position;

type BuildCrossRefDocDataParams = {
  label: string;
  code: string;
  targetNodeId: string;
  color: string;
  portalPosition: Position | null;
  anchorPosition: Position;
  entityType: EntityType;
  tags: string[];
  notes: string;
  contact: string;
  links: string[];
};

type BuildLocalCrossRefParams = {
  id: string;
  label: string;
  code: string;
  targetNodeId: string;
  color: string;
  portalPosition: Position | null;
  anchorPosition: Position;
  entityType: EntityType;
  tags: string[];
  notes: string;
  contact: string;
  links: string[];
};

type ComputeExistingExactUpdateParams = {
  existingExact: CrossRef;
  targetNodeId: string;
  newRefType: EntityType;
  chooseAnchorNodeId: ChooseAnchorNodeId;
  resolveNodePosition: ResolveNodePosition;
  resolvePortalFollowPosition: ResolvePortalFollowPosition;
};

export function nextBubbleCode(codes: Iterable<string>): string {
  let maxSeen = 0;
  for (const raw of codes) {
    const match = /^B(\d{1,6})$/i.exec(raw.trim());
    if (!match) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed)) maxSeen = Math.max(maxSeen, parsed);
  }
  return `B${String(maxSeen + 1).padStart(3, "0")}`;
}

export function findExistingExactRef(refs: CrossRef[], code: string, label: string): CrossRef | null {
  return (
    refs.find((ref) => ref.code === code && ref.label.trim().toLowerCase() === label.toLowerCase()) || null
  );
}

export function buildCrossRefDocData({
  label,
  code,
  targetNodeId,
  color,
  portalPosition,
  anchorPosition,
  entityType,
  tags,
  notes,
  contact,
  links,
}: BuildCrossRefDocDataParams): CrossRefDoc {
  return {
    label,
    code,
    nodeIds: [targetNodeId],
    anchorNodeId: targetNodeId,
    color,
    ...(portalPosition ? { portalX: portalPosition.x, portalY: portalPosition.y } : {}),
    portalAnchorX: anchorPosition.x,
    portalAnchorY: anchorPosition.y,
    entityType,
    tags,
    notes,
    contact,
    links,
  };
}

export function buildLocalCrossRef({
  id,
  label,
  code,
  targetNodeId,
  color,
  portalPosition,
  anchorPosition,
  entityType,
  tags,
  notes,
  contact,
  links,
}: BuildLocalCrossRefParams): CrossRef {
  return {
    id,
    label,
    code,
    nodeIds: [targetNodeId],
    anchorNodeId: targetNodeId,
    color,
    portalX: portalPosition?.x ?? null,
    portalY: portalPosition?.y ?? null,
    portalAnchorX: anchorPosition.x,
    portalAnchorY: anchorPosition.y,
    portalOffsetX: null,
    portalOffsetY: null,
    entityType,
    tags,
    notes,
    contact,
    links,
    createdAtMs: 0,
    updatedAtMs: 0,
  };
}

export function computeExistingExactUpdate({
  existingExact,
  targetNodeId,
  newRefType,
  chooseAnchorNodeId,
  resolveNodePosition,
  resolvePortalFollowPosition,
}: ComputeExistingExactUpdateParams): {
  nextNodeIds: string[];
  nextAnchorNodeId: string | null;
  nextAnchorPosition: Position | null;
  nextPortalPosition: Position;
  nextEntityType: EntityType;
} {
  const nextNodeIds = existingExact.nodeIds.includes(targetNodeId)
    ? existingExact.nodeIds
    : [...existingExact.nodeIds, targetNodeId];
  const nextAnchorNodeId = chooseAnchorNodeId(nextNodeIds, existingExact.anchorNodeId, targetNodeId);
  const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
  const nextPortalPosition = resolvePortalFollowPosition(existingExact, nextAnchorPosition, existingExact.id);
  const nextEntityType = existingExact.entityType === "entity" ? newRefType : existingExact.entityType;

  return {
    nextNodeIds,
    nextAnchorNodeId,
    nextAnchorPosition,
    nextPortalPosition,
    nextEntityType,
  };
}
