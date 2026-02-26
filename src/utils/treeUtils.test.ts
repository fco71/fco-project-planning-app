import { describe, expect, it } from "vitest";
import {
  buildNodePath,
  buildNodePathTail,
  collectDescendants,
  getMasterNodeFor,
  initialsFromLabel,
  normalizeCode,
} from "./treeUtils";

describe("treeUtils", () => {
  it("normalizes cross-reference codes", () => {
    expect(normalizeCode(" vendor-a ")).toBe("VEND");
    expect(normalizeCode("a b")).toBe("AB");
    expect(normalizeCode("###")).toBe("REF");
  });

  it("builds initials from labels", () => {
    expect(initialsFromLabel("Acme Partners")).toBe("AP");
    expect(initialsFromLabel("ettore")).toBe("ETTO");
    expect(initialsFromLabel("")).toBe("REF");
  });

  it("builds full and tail node paths", () => {
    const nodesById = new Map([
      ["root", { title: "Root", parentId: null }],
      ["p1", { title: "Project 1", parentId: "root" }],
      ["i1", { title: "Item 1", parentId: "p1" }],
      ["s1", { title: "Story 1", parentId: "i1" }],
    ]);

    expect(buildNodePath("s1", nodesById)).toBe("Root / Project 1 / Item 1 / Story 1");
    expect(buildNodePathTail("s1", nodesById, 3)).toBe("... / Project 1 / Item 1 / Story 1");
    expect(buildNodePathTail("i1", nodesById, 3)).toBe("Root / Project 1 / Item 1");
  });

  it("collects descendants in stable depth-first order", () => {
    const childrenByParent = new Map<string, string[]>([
      ["root", ["a", "b"]],
      ["a", ["a1", "a2"]],
      ["b", ["b1"]],
    ]);

    expect(collectDescendants("root", childrenByParent)).toEqual(["root", "a", "a1", "a2", "b", "b1"]);
  });

  it("resolves master node under the current root", () => {
    const nodesById = new Map([
      ["root", { id: "root", parentId: null }],
      ["project", { id: "project", parentId: "root" }],
      ["item", { id: "item", parentId: "project" }],
      ["story", { id: "story", parentId: "item" }],
    ]);

    expect(getMasterNodeFor("story", "root", nodesById)).toBe("project");
    expect(getMasterNodeFor("story", null, nodesById)).toBe("story");
  });
});
