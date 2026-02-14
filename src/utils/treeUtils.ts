// src/utils/treeUtils.ts
// Utility functions for tree manipulation and navigation

export type TreeNode = {
  id: string;
  title: string;
  parentId: string | null;
  kind: "root" | "project" | "item";
  x?: number;
  y?: number;
};

/**
 * Normalizes a string into a 2-4 character uppercase alphanumeric code.
 * Used for generating cross-reference bubble codes.
 * @param input - The input string to normalize
 * @returns Normalized code (e.g., "MP" from "Mario Pinto")
 */
export function normalizeCode(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return cleaned || "REF";
}

/**
 * Generates initials from a label for cross-reference bubble codes.
 * Takes first letter of first two words, or first 4 chars if single word.
 * @param input - The label to generate initials from
 * @returns Normalized initials code
 */
export function initialsFromLabel(input: string): string {
  const parts = input
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "REF";
  if (parts.length === 1) return normalizeCode(parts[0].slice(0, 4));
  const code = `${parts[0][0] || ""}${parts[1][0] || ""}`;
  return normalizeCode(code);
}

/**
 * Builds a breadcrumb path string from root to the specified node.
 * Example: "Francisco Valdez / Film Production / Development / De Espacio"
 * @param nodeId - The target node ID
 * @param nodesById - Map of node IDs to node objects
 * @returns Formatted path string with " / " separators
 */
export function buildNodePath(nodeId: string, nodesById: Map<string, TreeNode>): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  let cursorId: string | null = nodeId;
  while (cursorId && !seen.has(cursorId)) {
    seen.add(cursorId);
    const node = nodesById.get(cursorId);
    if (!node) break;
    parts.unshift(node.title);
    cursorId = node.parentId;
  }
  return parts.join(" / ");
}

/**
 * Collects all descendant node IDs starting from a given node.
 * Uses depth-first traversal to maintain hierarchical order.
 * Includes the starting node in the result.
 * @param startId - The root node ID to start from
 * @param childrenByParent - Map of parent IDs to arrays of child IDs
 * @returns Array of all descendant node IDs in depth-first order
 */
export function collectDescendants(startId: string, childrenByParent: Map<string, string[]>): string[] {
  const ordered: string[] = [];
  const stack = [startId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    ordered.push(current);
    const children = childrenByParent.get(current) || [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }
  return ordered;
}

/**
 * Finds the "master" node for a given node - the top-level ancestor
 * within the current view hierarchy (one level below the root).
 * Used for navigation: when clicking a cross-reference bubble,
 * determines which master view to navigate to.
 * @param nodeId - The target node ID
 * @param rootNodeId - The current root node ID (grandmother view)
 * @param nodesById - Map of node IDs to node objects
 * @returns The master node ID (direct child of root, or root itself)
 */
export function getMasterNodeFor(nodeId: string, rootNodeId: string | null, nodesById: Map<string, TreeNode>): string {
  if (!rootNodeId) return nodeId;
  let cursor = nodesById.get(nodeId);
  if (!cursor) return rootNodeId;
  while (cursor.parentId && cursor.parentId !== rootNodeId) {
    const parent = nodesById.get(cursor.parentId);
    if (!parent) break;
    cursor = parent;
  }
  return cursor.id || rootNodeId;
}
