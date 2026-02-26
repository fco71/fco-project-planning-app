import type { CrossRef, EntityType } from "../types/planner";
import { normalizeHexColor } from "../utils/normalize";
import { initialsFromLabel, normalizeCode } from "../utils/treeUtils";

export type ResolvedCreateCrossRefPlan = {
  targetNodeId: string;
  typedCode: string;
  templateByCode: CrossRef | null;
  label: string;
  code: string;
  color: string;
  entityType: EntityType;
  tags: string[];
  notes: string;
  contact: string;
  links: string[];
};

type ResolveCreateCrossRefPlanParams = {
  targetNodeIdOverride?: unknown;
  effectiveBubbleTargetId: string | null;
  refs: CrossRef[];
  newRefCode: string;
  newRefLabel: string;
  newRefColor: string;
  newRefType: EntityType;
  nextAutoBubbleCode: string;
  bubblesSimplifiedMode: boolean;
  defaultBubbleColor: string;
};

export function resolveCreateCrossRefPlan({
  targetNodeIdOverride,
  effectiveBubbleTargetId,
  refs,
  newRefCode,
  newRefLabel,
  newRefColor,
  newRefType,
  nextAutoBubbleCode,
  bubblesSimplifiedMode,
  defaultBubbleColor,
}: ResolveCreateCrossRefPlanParams): ResolvedCreateCrossRefPlan | null {
  const targetNodeId =
    typeof targetNodeIdOverride === "string" ? targetNodeIdOverride : effectiveBubbleTargetId;
  if (!targetNodeId || typeof targetNodeId !== "string") return null;

  const typedCode = newRefCode.trim() ? normalizeCode(newRefCode) : "";
  const templateByCode = typedCode ? refs.find((ref) => ref.code === typedCode) || null : null;
  const label = templateByCode ? templateByCode.label.trim() : newRefLabel.trim();
  if (!label) return null;

  const code = typedCode
    ? (bubblesSimplifiedMode && templateByCode ? nextAutoBubbleCode : typedCode)
    : (bubblesSimplifiedMode ? nextAutoBubbleCode : initialsFromLabel(label));
  const color = normalizeHexColor(templateByCode?.color) || normalizeHexColor(newRefColor) || defaultBubbleColor;
  const entityType = templateByCode?.entityType ?? newRefType;
  const tags = templateByCode ? [...templateByCode.tags] : [];
  const notes = templateByCode?.notes ?? "";
  const contact = templateByCode?.contact ?? "";
  const links = templateByCode ? [...templateByCode.links] : [];

  return {
    targetNodeId,
    typedCode,
    templateByCode,
    label,
    code,
    color,
    entityType,
    tags,
    notes,
    contact,
    links,
  };
}
