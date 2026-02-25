// src/utils/normalize.ts
// Pure normalization functions used by Firestore snapshot listeners and actions.

import type { NodeKind, TaskStatus, StoryStep } from "../types/planner";

const HEX_COLOR_REGEX = /^#?[0-9a-fA-F]{6}$/;

export function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) return undefined;
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  return `#${hex.toUpperCase()}`;
}

export function normalizeNodeKind(value: unknown): NodeKind {
  if (value === "root" || value === "project" || value === "item" || value === "story") return value;
  return "item";
}

export function normalizeTaskStatus(value: unknown): TaskStatus {
  if (value === "todo" || value === "done") return value;
  return "none";
}

export function normalizeStorySteps(value: unknown): StoryStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const raw = entry as { id?: unknown; text?: unknown; title?: unknown; done?: unknown };
      const textCandidate = typeof raw.text === "string" ? raw.text : typeof raw.title === "string" ? raw.title : "";
      const text = textCandidate.trim();
      if (!text) return null;
      const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : `step-${index + 1}`;
      return {
        id,
        text,
        done: raw.done === true,
      } satisfies StoryStep;
    })
    .filter((entry): entry is StoryStep => !!entry);
}

export function normalizeNodeBody(value: unknown): string {
  if (typeof value !== "string") return "";
  return value;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

export function timestampToMs(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const raw = normalized.slice(1);
  const parsed = Number.parseInt(raw, 16);
  if (!Number.isFinite(parsed)) return null;
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

export function rgbaFromHex(hex: string | null | undefined, alpha: number, fallback: string): string {
  if (!hex) return fallback;
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}
