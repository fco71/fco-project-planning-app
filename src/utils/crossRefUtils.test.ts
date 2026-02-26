import { describe, expect, it } from "vitest";
import type { CrossRef } from "../types/planner";
import {
  bubbleDisplayToken,
  chooseAnchorNodeId,
  crossRefToFirestoreSetData,
  defaultPortalPositionForAnchor,
  resolvePortalFollowPosition,
} from "./crossRefUtils";

function makeRef(overrides: Partial<CrossRef> = {}): CrossRef {
  return {
    id: "ref-1",
    label: "Ettore",
    code: "B001",
    nodeIds: ["n1"],
    anchorNodeId: "n1",
    color: "#40B6FF",
    portalX: 100,
    portalY: 140,
    portalAnchorX: 10,
    portalAnchorY: 20,
    portalOffsetX: null,
    portalOffsetY: null,
    entityType: "entity",
    tags: ["alpha"],
    notes: "note",
    contact: "mail@example.com",
    links: ["https://example.com"],
    createdAtMs: 1,
    updatedAtMs: 2,
    ...overrides,
  };
}

describe("crossRefUtils", () => {
  it("builds compact bubble tokens", () => {
    expect(bubbleDisplayToken("Ettore", "B001")).toBe("ET");
    expect(bubbleDisplayToken("Alpha Beta", "B002")).toBe("AB");
    expect(bubbleDisplayToken("", "b003")).toBe("B00");
  });

  it("chooses anchor node with preferred fallback order", () => {
    expect(chooseAnchorNodeId(["n1", "n2"], "n2", "n1")).toBe("n2");
    expect(chooseAnchorNodeId(["n1", "n2"], "missing", "n1")).toBe("n1");
    expect(chooseAnchorNodeId([], "n1")).toBeNull();
  });

  it("computes deterministic default portal position", () => {
    const one = defaultPortalPositionForAnchor({ x: 200, y: 120 }, "seed-1");
    const two = defaultPortalPositionForAnchor({ x: 200, y: 120 }, "seed-1");
    const three = defaultPortalPositionForAnchor({ x: 200, y: 120 }, "seed-2");
    expect(one).toEqual(two);
    expect(one).not.toEqual(three);
  });

  it("resolves follow position by preserving anchor-relative offset", () => {
    const ref = makeRef({
      portalX: 140,
      portalY: 200,
      portalAnchorX: 20,
      portalAnchorY: 30,
    });
    const followed = resolvePortalFollowPosition(ref, { x: 35, y: 60 }, ref.id);
    expect(followed).toEqual({ x: 155, y: 230 });
  });

  it("serializes cross-ref payload for Firestore and clones arrays", () => {
    const ref = makeRef();
    const data = crossRefToFirestoreSetData(ref) as {
      nodeIds: string[];
      tags: string[];
      links: string[];
      label: string;
      code: string;
    };
    expect(data.label).toBe(ref.label);
    expect(data.code).toBe(ref.code);
    expect(data.nodeIds).toEqual(ref.nodeIds);
    expect(data.tags).toEqual(ref.tags);
    expect(data.links).toEqual(ref.links);
    expect(data.nodeIds).not.toBe(ref.nodeIds);
    expect(data.tags).not.toBe(ref.tags);
    expect(data.links).not.toBe(ref.links);
  });
});
