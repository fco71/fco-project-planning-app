import { describe, expect, it } from "vitest";
import { resolveToolbarCreateTarget } from "./usePlannerMobileToolbarActions";

describe("resolveToolbarCreateTarget", () => {
  it("routes story nodes to story sibling creation", () => {
    expect(resolveToolbarCreateTarget("story")).toBe("story-sibling");
  });

  it("routes non-story nodes to child creation", () => {
    expect(resolveToolbarCreateTarget("item")).toBe("child");
    expect(resolveToolbarCreateTarget("project")).toBe("child");
    expect(resolveToolbarCreateTarget(null)).toBe("child");
    expect(resolveToolbarCreateTarget(undefined)).toBe("child");
  });
});

