import { describe, expect, it } from "vitest";
import type { CrossRef } from "../types/planner";
import {
  buildCrossRefDocData,
  buildLocalCrossRef,
  computeExistingExactUpdate,
  findExistingExactRef,
  nextBubbleCode,
} from "./plannerCrossRefCreateExecutionHelpers";

function makeRef(overrides: Partial<CrossRef> = {}): CrossRef {
  return {
    id: "ref-1",
    label: "Alpha Partner",
    code: "APAR",
    nodeIds: ["n1"],
    anchorNodeId: "n1",
    color: "#40B6FF",
    portalX: 100,
    portalY: 120,
    portalAnchorX: 90,
    portalAnchorY: 110,
    portalOffsetX: null,
    portalOffsetY: null,
    entityType: "entity",
    tags: [],
    notes: "",
    contact: "",
    links: [],
    createdAtMs: 0,
    updatedAtMs: 0,
    ...overrides,
  };
}

describe("plannerCrossRefCreateExecutionHelpers", () => {
  it("computes next bubble code from existing B-codes", () => {
    expect(nextBubbleCode(["B001", "xx", "B120", "B099"])).toBe("B121");
  });

  it("finds an exact ref by code and case-insensitive trimmed label", () => {
    const refs = [makeRef({ label: "  Mario Pinto  ", code: "MPTO" })];
    const found = findExistingExactRef(refs, "MPTO", "mario pinto");
    expect(found?.id).toBe("ref-1");
  });

  it("builds cross-ref Firestore data and local in-memory shape", () => {
    const anchorPosition = { x: 10, y: 20 };
    const portalPosition = { x: 35, y: 45 };
    const docData = buildCrossRefDocData({
      label: "Vendor",
      code: "VEND",
      targetNodeId: "node-1",
      color: "#FF5500",
      portalPosition,
      anchorPosition,
      entityType: "vendor",
      tags: ["key"],
      notes: "note",
      contact: "x@y.com",
      links: ["https://example.com"],
    });

    expect(docData).toEqual({
      label: "Vendor",
      code: "VEND",
      nodeIds: ["node-1"],
      anchorNodeId: "node-1",
      color: "#FF5500",
      portalX: 35,
      portalY: 45,
      portalAnchorX: 10,
      portalAnchorY: 20,
      entityType: "vendor",
      tags: ["key"],
      notes: "note",
      contact: "x@y.com",
      links: ["https://example.com"],
    });

    const local = buildLocalCrossRef({
      id: "ref-77",
      label: "Vendor",
      code: "VEND",
      targetNodeId: "node-1",
      color: "#FF5500",
      portalPosition,
      anchorPosition,
      entityType: "vendor",
      tags: ["key"],
      notes: "note",
      contact: "x@y.com",
      links: ["https://example.com"],
    });

    expect(local.id).toBe("ref-77");
    expect(local.portalX).toBe(35);
    expect(local.portalAnchorY).toBe(20);
    expect(local.entityType).toBe("vendor");
  });

  it("computes existing-exact update and promotes type only from generic entity", () => {
    const existing = makeRef({ entityType: "entity", nodeIds: ["n1"] });
    const update = computeExistingExactUpdate({
      existingExact: existing,
      targetNodeId: "n2",
      newRefType: "person",
      chooseAnchorNodeId: (nodeIds) => nodeIds[0] || null,
      resolveNodePosition: () => ({ x: 11, y: 22 }),
      resolvePortalFollowPosition: () => ({ x: 33, y: 44 }),
    });

    expect(update.nextNodeIds).toEqual(["n1", "n2"]);
    expect(update.nextAnchorNodeId).toBe("n1");
    expect(update.nextPortalPosition).toEqual({ x: 33, y: 44 });
    expect(update.nextEntityType).toBe("person");
  });
});
