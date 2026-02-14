// src/utils/portalUtils.ts
// Utility functions for portal node positioning and collision detection

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Position = {
  x: number;
  y: number;
};

/**
 * Checks if two bounding boxes intersect (overlap).
 * Uses axis-aligned bounding box (AABB) collision detection.
 * @param a - First bounding box
 * @param b - Second bounding box
 * @returns true if the boxes overlap
 */
export function detectCollision(a: Bounds, b: Bounds): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Adjusts portal position to avoid collisions with tree nodes and other portals.
 * Algorithm:
 * 1. Check if portal overlaps any tree node → shift right by 160px
 * 2. Check if portal overlaps any existing portal → shift down by 84px
 * 3. Repeat until no collisions (max 10 iterations to prevent infinite loops)
 *
 * @param initialPosition - Starting position for the portal
 * @param portalSize - Width and height of portal bubble (typically 48x48)
 * @param treeNodes - Array of tree node positions and sizes
 * @param existingPortals - Array of already-positioned portal positions
 * @returns Adjusted position that avoids collisions
 */
export function adjustPortalPosition(
  initialPosition: Position,
  portalSize: { width: number; height: number },
  treeNodes: Bounds[],
  existingPortals: Position[]
): Position {
  let position = { ...initialPosition };
  let maxIterations = 10;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration += 1;
    let hadCollision = false;

    // Create portal bounds at current position
    const portalBounds: Bounds = {
      x: position.x,
      y: position.y,
      width: portalSize.width,
      height: portalSize.height,
    };

    // Check collision with tree nodes
    for (const treeNode of treeNodes) {
      if (detectCollision(portalBounds, treeNode)) {
        // Collision detected: shift portal right by 160px
        position.x += 160;
        hadCollision = true;
        break; // Re-check with new position
      }
    }

    if (hadCollision) continue;

    // Check collision with other portals (with same size)
    for (const existingPortal of existingPortals) {
      const existingBounds: Bounds = {
        x: existingPortal.x,
        y: existingPortal.y,
        width: portalSize.width,
        height: portalSize.height,
      };

      if (detectCollision(portalBounds, existingBounds)) {
        // Collision detected: shift portal down by 84px
        position.y += 84;
        hadCollision = true;
        break; // Re-check with new position
      }
    }

    // If no collisions in this iteration, we're done
    if (!hadCollision) break;
  }

  return position;
}

/**
 * Builds an array of tree node bounds from ReactFlow node positions.
 * Assumes standard node dimensions: 260px width, 60px height (approximate).
 * @param nodes - Array of tree nodes with positions
 * @returns Array of bounding boxes for collision detection
 */
export function buildTreeNodeBounds(
  nodes: Array<{ id: string; position: Position }>
): Bounds[] {
  return nodes.map((node) => ({
    x: node.position.x,
    y: node.position.y,
    width: 260, // Standard tree node width from CSS
    height: 60, // Approximate height (padding + text)
  }));
}
