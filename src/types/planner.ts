// src/types/planner.ts
// Shared type definitions for the planner feature

export type NodeKind = "root" | "project" | "item" | "story";
export type TaskStatus = "none" | "todo" | "done";

export type StoryStep = {
  id: string;
  text: string;
  done: boolean;
};

export type EntityType = "entity" | "investor" | "partner" | "vendor" | "contact" | "client" | "organization" | "person";

export const ENTITY_TYPES: EntityType[] = ["entity", "organization", "partner", "vendor", "investor", "person", "contact", "client"];
export const PEOPLE_ENTITY_TYPES = new Set<EntityType>(["person", "contact", "client"]);

export function isPeopleEntityType(entityType: EntityType): boolean {
  return PEOPLE_ENTITY_TYPES.has(entityType);
}

/** Firestore document shape for a tree node (no `id` field — that's the doc key). */
export type TreeNodeDoc = {
  title: string;
  parentId: string | null;
  kind: NodeKind;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
  taskStatus?: TaskStatus;
  storySteps?: StoryStep[];
  body?: string;
};

/** In-memory tree node (includes Firestore doc key as `id`). */
export type TreeNode = TreeNodeDoc & { id: string };

/** Firestore document shape for a cross-reference bubble. */
export type CrossRefDoc = {
  label: string;
  code: string;
  nodeIds: string[];
  anchorNodeId?: string;
  color?: string;
  portalX?: number;
  portalY?: number;
  portalAnchorX?: number;
  portalAnchorY?: number;
  portalOffsetX?: number;
  portalOffsetY?: number;
  entityType?: EntityType;
  tags?: string[];
  notes?: string;
  contact?: string;
  links?: string[];
};

/** In-memory cross-reference bubble (normalized from Firestore). */
export type CrossRef = {
  id: string;
  label: string;
  code: string;
  nodeIds: string[];
  anchorNodeId: string | null;
  color: string | null;
  portalX: number | null;
  portalY: number | null;
  portalAnchorX: number | null;
  portalAnchorY: number | null;
  portalOffsetX: number | null;
  portalOffsetY: number | null;
  entityType: EntityType;
  tags: string[];
  notes: string;
  contact: string;
  links: string[];
  createdAtMs: number;
  updatedAtMs: number;
};
