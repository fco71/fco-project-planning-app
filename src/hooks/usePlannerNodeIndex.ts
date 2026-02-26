import { useMemo } from "react";
import type { TreeNode } from "../types/planner";

type PlannerNodeIndex = {
  nodesById: Map<string, TreeNode>;
  childrenByParent: Map<string, string[]>;
};

export function usePlannerNodeIndex(nodes: TreeNode[]): PlannerNodeIndex {
  const nodesById = useMemo(() => new Map<string, TreeNode>(nodes.map((node) => [node.id, node])), [nodes]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, string[]>();
    nodes.forEach((node) => {
      if (!node.parentId) return;
      if (!map.has(node.parentId)) map.set(node.parentId, []);
      map.get(node.parentId)?.push(node.id);
    });
    map.forEach((list) => {
      list.sort((a, b) => {
        const aTitle = nodesById.get(a)?.title || "";
        const bTitle = nodesById.get(b)?.title || "";
        return aTitle.localeCompare(bTitle);
      });
    });
    return map;
  }, [nodes, nodesById]);

  return { nodesById, childrenByParent };
}
