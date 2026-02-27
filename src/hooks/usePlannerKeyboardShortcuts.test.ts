import { describe, expect, it } from "vitest";
import { resolveDeleteShortcutTarget } from "./usePlannerKeyboardShortcuts";

describe("resolveDeleteShortcutTarget", () => {
  it("prioritizes active bubble selection over selected node", () => {
    expect(resolveDeleteShortcutTarget("ref-1", "node-1")).toBe("bubble");
  });

  it("targets selected node when no bubble is active", () => {
    expect(resolveDeleteShortcutTarget(null, "node-1")).toBe("node");
  });

  it("returns null when neither bubble nor node is selected", () => {
    expect(resolveDeleteShortcutTarget(null, null)).toBeNull();
  });
});

