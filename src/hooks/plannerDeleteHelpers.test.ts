import { describe, expect, it } from "vitest";
import type { CrossRef } from "../types/planner";
import type { TreeNode } from "../types/planner";
import {
  buildRefDeleteHistoryOps,
  buildRefDeletePlans,
  getRefDeleteImpacts,
  toNodeFirestoreSetData,
} from "./plannerDeleteHelpers";

function makeRef(id: string, nodeIds: string[]): CrossRef {
  return {
    id,
    label: id,
    code: id.toUpperCase(),
    nodeIds,
    anchorNodeId: nodeIds[0] || null,
    color: "#40B6FF",
    portalX: null,
    portalY: null,
    portalAnchorX: null,
    portalAnchorY: null,
    portalOffsetX: null,
    portalOffsetY: null,
    entityType: "entity",
    tags: [],
    notes: "",
    contact: "",
    links: [],
    createdAtMs: 0,
    updatedAtMs: 0,
  };
}

describe("plannerDeleteHelpers", () => {
  it("returns delete impact when all linked nodes are removed", () => {
    const refs = [makeRef("r1", ["n1", "n2"])];
    const impacts = getRefDeleteImpacts(refs, new Set(["n1", "n2"]));
    expect(impacts).toHaveLength(1);
    expect(impacts[0].ref.id).toBe("r1");
    expect(impacts[0].keepNodeIds).toEqual([]);
    expect(impacts[0].removeCompletely).toBe(true);
  });

  it("returns update impact when only some links are removed", () => {
    const refs = [makeRef("r2", ["n1", "n2", "n3"])];
    const impacts = getRefDeleteImpacts(refs, new Set(["n2"]));
    expect(impacts).toHaveLength(1);
    expect(impacts[0].keepNodeIds).toEqual(["n1", "n3"]);
    expect(impacts[0].removeCompletely).toBe(false);
  });

  it("ignores refs unaffected by deleted node set", () => {
    const refs = [makeRef("r3", ["n7"])];
    const impacts = getRefDeleteImpacts(refs, new Set(["n1", "n2"]));
    expect(impacts).toEqual([]);
  });

  it("builds anchor and portal plans for partial ref removals", () => {
    const refs = [makeRef("r4", ["n1", "n2"])];
    const impacts = getRefDeleteImpacts(refs, new Set(["n2"]));
    const plans = buildRefDeletePlans({
      impacts,
      chooseAnchorNodeId: (nodeIds) => nodeIds[0] || null,
      resolveNodePosition: (nodeId) => ({ x: nodeId === "n1" ? 10 : 20, y: nodeId === "n1" ? 15 : 25 }),
      resolvePortalFollowPosition: () => ({ x: 30, y: 40 }),
    });

    expect(plans).toHaveLength(1);
    expect(plans[0].removeCompletely).toBe(false);
    expect(plans[0].nextAnchorNodeId).toBe("n1");
    expect(plans[0].nextAnchorPosition).toEqual({ x: 10, y: 15 });
    expect(plans[0].nextPortalPosition).toEqual({ x: 30, y: 40 });
  });

  it("builds forward and inverse history ops for mixed ref plans", () => {
    const keepRef = makeRef("keep", ["n1", "n2"]);
    const removeRef = makeRef("remove", ["n9"]);
    const plans = buildRefDeletePlans({
      impacts: [
        { ref: keepRef, keepNodeIds: ["n1"], removeCompletely: false },
        { ref: removeRef, keepNodeIds: [], removeCompletely: true },
      ],
      chooseAnchorNodeId: (nodeIds) => nodeIds[0] || null,
      resolveNodePosition: () => ({ x: 11, y: 22 }),
      resolvePortalFollowPosition: () => ({ x: 33, y: 44 }),
    });
    const ops = buildRefDeleteHistoryOps({
      plans,
      crossRefToFirestoreSetData: (ref) => ({ label: ref.label, nodeIds: ref.nodeIds }),
    });

    expect(ops.fwdLocalRefs).toHaveLength(2);
    expect(ops.invLocalRefs).toHaveLength(2);
    expect(ops.fwdFirestoreRefs.map((entry) => entry.kind).sort()).toEqual(["deleteRef", "updateRef"]);
    expect(ops.invFirestoreRefs.map((entry) => entry.kind).sort()).toEqual(["setRef", "updateRef"]);
  });

  it("maps node shape into Firestore set payload", () => {
    const node: TreeNode = {
      id: "node-1",
      title: "Story beat",
      parentId: "root",
      kind: "story",
      x: 10,
      y: 12,
      width: 300,
      height: 160,
      color: "#FFFFFF",
      taskStatus: "done",
      body: "body",
      storySteps: [{ id: "s1", text: "step", done: false }],
    };

    expect(toNodeFirestoreSetData(node)).toEqual({
      title: "Story beat",
      parentId: "root",
      kind: "story",
      x: 10,
      y: 12,
      width: 300,
      height: 160,
      color: "#FFFFFF",
      taskStatus: "done",
      body: "body",
      storySteps: [{ id: "s1", text: "step", done: false }],
    });
  });
});
