// src/components/Planner/PlannerCanvas.tsx
import React from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
  type OnNodesChange,
} from "reactflow";
import "reactflow/dist/style.css";

type PlannerCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  onInit: (instance: ReactFlowInstance) => void;
  onNodesChange?: OnNodesChange;
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
  onNodesChange,
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
        nodesDraggable={true}
        elementsSelectable={true}
        onInit={onInit}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onNodeDragStop={onNodeDragStop}
        minZoom={0.3}
        maxZoom={1.8}
        zoomOnScroll={true}
        panOnScroll={false}
        panOnDrag={[1, 2]}
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
        connectionLineType="smoothstep"
        snapToGrid={true}
        snapGrid={[16, 16]}
      >
        <Background gap={22} size={1} />
        <Controls
          showInteractive={false}
          style={{
            background: "rgba(11, 16, 25, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "8px",
          }}
        />
      </ReactFlow>
    </main>
  );
}
