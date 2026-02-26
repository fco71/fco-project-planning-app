import { memo } from "react";
import { Handle, Position, type NodeProps, type NodeTypes } from "reactflow";

type PortalNodeData = {
  display: string;
  tooltip: string;
  isActive: boolean;
};

const PortalNode = memo(function PortalNode({ data }: NodeProps<PortalNodeData>) {
  return (
    <div className="planner-portal-node-inner">
      <Handle
        type="target"
        position={Position.Top}
        id="portal-target"
        isConnectable={false}
        className="planner-portal-handle"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="portal-source"
        isConnectable={false}
        className="planner-portal-handle"
      />
      <div className={`planner-portal-label${data.isActive ? " active" : ""}`} data-tooltip={data.tooltip}>
        {data.display}
      </div>
    </div>
  );
});

export const plannerNodeTypes: NodeTypes = { portal: PortalNode };
