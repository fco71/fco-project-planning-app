/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyNodeChanges,
  type Node,
  type NodeChange,
  type OnNodesChange,
} from "reactflow";

type UsePlannerBaseNodeStateParams = {
  baseTreeNodes: Node[];
};

export function usePlannerBaseNodeState({ baseTreeNodes }: UsePlannerBaseNodeStateParams) {
  const [baseNodes, setBaseNodes] = useState<Node[]>([]);
  const draggedNodeIdRef = useRef<string | null>(null);
  const nodesChangeRafRef = useRef<number | null>(null);
  const pendingNodeChangesRef = useRef<NodeChange[] | null>(null);

  useEffect(() => {
    setBaseNodes((prev) => {
      if (prev.length === 0) return baseTreeNodes;
      const livePos = new Map(prev.map((node) => [node.id, node.position] as const));
      return baseTreeNodes.map((node) => {
        const live = livePos.get(node.id);
        return live ? ({ ...node, position: live } as Node) : node;
      });
    });
  }, [baseTreeNodes]);

  useEffect(() => {
    return () => {
      if (nodesChangeRafRef.current !== null) {
        window.cancelAnimationFrame(nodesChangeRafRef.current);
      }
      nodesChangeRafRef.current = null;
      pendingNodeChangesRef.current = null;
    };
  }, []);

  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    const treeChanges = changes.filter((change: NodeChange) => {
      if (change.type === "add" || change.type === "reset") {
        return !change.item.id.startsWith("portal:");
      }
      return !change.id.startsWith("portal:");
    });
    if (treeChanges.length === 0) return;
    pendingNodeChangesRef.current = [
      ...(pendingNodeChangesRef.current ?? []),
      ...treeChanges,
    ];
    if (nodesChangeRafRef.current !== null) return;
    nodesChangeRafRef.current = window.requestAnimationFrame(() => {
      const pending = pendingNodeChangesRef.current;
      pendingNodeChangesRef.current = null;
      nodesChangeRafRef.current = null;
      if (pending && pending.length > 0) {
        setBaseNodes((nodes) => applyNodeChanges(pending, nodes));
      }
    });
  }, []);

  return {
    baseNodes,
    handleNodesChange,
    draggedNodeIdRef,
  };
}
