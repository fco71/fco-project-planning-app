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
  selectedNodeId: string | null;
  refs: CrossRef[];
  newRefCode: string;
  newRefLabel: string;
  newRefColor: string;
  newRefType: EntityType;
  nextAutoBubbleCode: string;
  bubblesSimplifiedMode: boolean;
  defaultBubbleColor: string;
};

export function resolveTemplateFromCodeInput(
  rawInput: string,
  refs: CrossRef[]
): { typedCode: string; templateByCode: CrossRef | null } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { typedCode: "", templateByCode: null };
  }

  const normalized = normalizeCode(trimmed);
  const directMatch = refs.find((ref) => ref.code === normalized) || null;
  if (directMatch) {
    return { typedCode: normalized, templateByCode: directMatch };
  }

  // Allow pasted text like "Mario Pinto (B012)" or "B012 - Mario Pinto".
  const rawUpper = trimmed.toUpperCase();
  const candidateParts = rawUpper.split(/[^A-Z0-9]+/).filter(Boolean);
  for (const part of candidateParts) {
    const candidateCode = normalizeCode(part);
    const match = refs.find((ref) => ref.code === candidateCode) || null;
    if (match) {
      return { typedCode: candidateCode, templateByCode: match };
    }
  }

  const embeddedCodeMatch = refs.find((ref) => rawUpper.includes(ref.code)) || null;
  if (embeddedCodeMatch) {
    return { typedCode: embeddedCodeMatch.code, templateByCode: embeddedCodeMatch };
  }

  return { typedCode: normalized, templateByCode: null };
}

export function resolveCreateCrossRefPlan({
  selectedNodeId,
  refs,
  newRefCode,
  newRefLabel,
  newRefColor,
  newRefType,
  nextAutoBubbleCode,
  bubblesSimplifiedMode,
  defaultBubbleColor,
}: ResolveCreateCrossRefPlanParams): ResolvedCreateCrossRefPlan | null {
  const targetNodeId = selectedNodeId;
  if (!targetNodeId || typeof targetNodeId !== "string") return null;

  const { typedCode, templateByCode } = resolveTemplateFromCodeInput(newRefCode, refs);
  const typedLabel = newRefLabel.trim();
  const label = typedLabel || (templateByCode ? templateByCode.label.trim() : "");
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
