import { describe, expect, it } from "vitest";
import type { CrossRef } from "../types/planner";
import { resolveCreateCrossRefPlan } from "./plannerCrossRefCreationHelpers";

function makeRef(overrides: Partial<CrossRef> = {}): CrossRef {
  return {
    id: "ref-1",
    label: "Alice Vendor",
    code: "ALVC",
    nodeIds: ["n1"],
    anchorNodeId: "n1",
    color: "#40B6FF",
    portalX: 100,
    portalY: 100,
    portalAnchorX: 90,
    portalAnchorY: 90,
    portalOffsetX: null,
    portalOffsetY: null,
    entityType: "vendor",
    tags: ["preferred"],
    notes: "notes",
    contact: "alice@example.com",
    links: ["https://example.com"],
    createdAtMs: 1,
    updatedAtMs: 1,
    ...overrides,
  };
}

describe("plannerCrossRefCreationHelpers", () => {
  it("returns null when target node cannot be resolved", () => {
    const plan = resolveCreateCrossRefPlan({
      selectedNodeId: null,
      refs: [],
      newRefCode: "",
      newRefLabel: "Alpha",
      newRefColor: "#123456",
      newRefType: "entity",
      nextAutoBubbleCode: "B001",
      bubblesSimplifiedMode: false,
      defaultBubbleColor: "#40B6FF",
    });
    expect(plan).toBeNull();
  });

  it("inherits template values when code matches existing bubble", () => {
    const template = makeRef({
      label: "Mario Pinto",
      code: "MPTO",
      color: "#FF5500",
      entityType: "person",
      tags: ["key"],
      notes: "has context",
      contact: "mario@x.com",
      links: ["https://x.com"],
    });
    const plan = resolveCreateCrossRefPlan({
      selectedNodeId: "node-1",
      refs: [template],
      newRefCode: "mpto",
      newRefLabel: "Ignored",
      newRefColor: "#000000",
      newRefType: "entity",
      nextAutoBubbleCode: "B099",
      bubblesSimplifiedMode: true,
      defaultBubbleColor: "#40B6FF",
    });

    expect(plan).not.toBeNull();
    expect(plan?.targetNodeId).toBe("node-1");
    expect(plan?.label).toBe("Mario Pinto");
    expect(plan?.code).toBe("B099");
    expect(plan?.color).toBe("#FF5500");
    expect(plan?.entityType).toBe("person");
    expect(plan?.tags).toEqual(["key"]);
    expect(plan?.notes).toBe("has context");
    expect(plan?.contact).toBe("mario@x.com");
    expect(plan?.links).toEqual(["https://x.com"]);
  });

  it("derives initials-based code in non-simplified mode when no code typed", () => {
    const plan = resolveCreateCrossRefPlan({
      selectedNodeId: "node-2",
      refs: [],
      newRefCode: "",
      newRefLabel: "Venture Partner",
      newRefColor: "#1A2b3c",
      newRefType: "partner",
      nextAutoBubbleCode: "B002",
      bubblesSimplifiedMode: false,
      defaultBubbleColor: "#40B6FF",
    });

    expect(plan).not.toBeNull();
    expect(plan?.label).toBe("Venture Partner");
    expect(plan?.code).toBe("VP");
    expect(plan?.color).toBe("#1A2B3C");
    expect(plan?.entityType).toBe("partner");
  });
});
