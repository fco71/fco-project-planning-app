// src/components/Planner/PlannerCanvas.tsx
import React from "react";
import ReactFlow, {
  Background,
  type Edge,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

type PlannerCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  onInit: (instance: ReactFlowInstance) => void;
  onNodeClick: (_: React.MouseEvent, node: Node) => void;
  onNodeDoubleClick: (_: React.MouseEvent, node: Node) => void;
  onNodeMouseEnter: (_: React.MouseEvent, node: Node) => void;
  onNodeMouseLeave: () => void;
  onEdgeMouseEnter: (_: React.MouseEvent, edge: Edge) => void;
  onEdgeMouseLeave: () => void;
  onNodeDragStop: (_: React.MouseEvent, node: Node) => void;
};

/**
 * PlannerCanvas - Renders the ReactFlow visualization canvas
 * for the hierarchical project tree with cross-reference portals.
 */
export default function PlannerCanvas({
  nodes,
  edges,
  nodeTypes,
  onInit,
  onNodeClick,
  onNodeDoubleClick,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onEdgeMouseEnter,
  onEdgeMouseLeave,
  onNodeDragStop,
}: PlannerCanvasProps) {
  return (
    <main className="planner-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesConnectable={false}
        onInit={onInit}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onNodeDragStop={onNodeDragStop}
        minZoom={0.3}
      >
        <Background gap={22} size={1} />
      </ReactFlow>
    </main>
  );
}
