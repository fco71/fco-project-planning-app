import { describe, expect, it } from "vitest";
import { PLANNER_SHORTCUTS_HELP } from "./shortcutsHelp";

describe("PLANNER_SHORTCUTS_HELP", () => {
  it("includes core keyboard shortcuts", () => {
    expect(PLANNER_SHORTCUTS_HELP).toContain("Cmd/Ctrl+K");
    expect(PLANNER_SHORTCUTS_HELP).toContain("Cmd/Ctrl+?");
    expect(PLANNER_SHORTCUTS_HELP).toContain("Cmd/Ctrl+Z");
  });
});
