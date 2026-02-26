import type { EntityType, NodeKind } from "../types/planner";

export const DEFAULT_BUBBLE_COLOR = "#40B6FF";
export const STORY_NODE_MIN_WIDTH = 220;
export const STORY_NODE_MAX_WIDTH = 760;
export const STORY_NODE_MIN_HEIGHT = 150;
export const STORY_NODE_MAX_HEIGHT = 940;

export const CROSS_REFERENCES_ENABLED = true;
export const BUBBLES_SIMPLIFIED_MODE = true;

export const ENTITY_TYPE_GROUPS: Array<{ label: string; options: EntityType[] }> = [
  { label: "General", options: ["entity", "organization", "partner", "vendor", "investor"] },
  { label: "People", options: ["person", "contact", "client"] },
];

export function defaultNodeColor(kind: NodeKind): string {
  if (kind === "root") return "#52340A";
  if (kind === "project") return "#0A1A50";
  if (kind === "story") return "#063428";
  return "#141624";
}

export function storyContainerColor(): string {
  return "#3A166C";
}

export function nextNodeKind(kind: NodeKind): NodeKind {
  if (kind === "project") return "item";
  if (kind === "item") return "story";
  if (kind === "story") return "project";
  return "root";
}
