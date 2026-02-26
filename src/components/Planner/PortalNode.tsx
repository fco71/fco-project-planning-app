import { memo } from "react";
import { Handle, Position, type NodeProps, type NodeTypes } from "reactflow";

type PortalNodeData = {
  display: string;
  tooltip: string;
  isActive: boolean;
};

const PortalNode = memo(function PortalNode({ data }: NodeProps<PortalNodeData>) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="portal-target"
        isConnectable={false}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          border: "none",
          background: "transparent",
          pointerEvents: "none",
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="portal-source"
        isConnectable={false}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          border: "none",
          background: "transparent",
          pointerEvents: "none",
        }}
      />
      <div className={`planner-portal-label${data.isActive ? " active" : ""}`} data-tooltip={data.tooltip}>
        {data.display}
      </div>
    </div>
  );
});

export const plannerNodeTypes: NodeTypes = { portal: PortalNode };
