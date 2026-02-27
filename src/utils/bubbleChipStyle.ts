import type { CSSProperties } from "react";
import { rgbaFromHex } from "./normalize";

export function buildBubbleChipStyle(color?: string | null, active = false): CSSProperties {
  const style: CSSProperties = {
    borderColor: rgbaFromHex(color, 0.9, "rgba(64,182,255,0.88)"),
    boxShadow: `0 0 0 1px ${rgbaFromHex(color, 0.25, "rgba(64,182,255,0.2)")}`,
  };

  if (active) {
    style.background = rgbaFromHex(color, 0.22, "rgba(64,182,255,0.2)");
  }

  return style;
}
