import { useMemo } from "react";
import type {
  CSSProperties,
  Dispatch,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react";
import type { Node } from "reactflow";
import type { NodeKind } from "../types/planner";

type UsePlannerFlowNodesParams = {
  baseNodes: Node[];
  selectedNodeId: string | null;
  activeLinkedNodeIds: Set<string>;
  hoverNodeIds: Set<string>;
  dropTargetNodeId: string | null;
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  isMobileLayout: boolean;
  toggleNodeCollapse: (nodeId: string) => void;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  persistNodeBody: (nodeId: string, nextBody: string) => Promise<void>;
  toggleStoryCardExpand: (nodeId: string) => void;
  startStoryNodeResize: (
    nodeId: string,
    currentWidth: number,
    currentHeight: number,
    storedWidth: number | undefined,
    storedHeight: number | undefined,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void;
  resetStoryNodeSize: (nodeId: string) => void | Promise<void>;
};

export function usePlannerFlowNodes({
  baseNodes,
  selectedNodeId,
  activeLinkedNodeIds,
  hoverNodeIds,
  dropTargetNodeId,
  hoveredNodeId,
  hoveredEdgeId,
  isMobileLayout,
  toggleNodeCollapse,
  setSelectedNodeId,
  persistNodeBody,
  toggleStoryCardExpand,
  startStoryNodeResize,
  resetStoryNodeSize,
}: UsePlannerFlowNodesParams): Node[] {
  return useMemo(() => {
    return baseNodes.map((node) => {
      const data = node.data as {
        nodeId: string;
        title: string;
        kind: NodeKind;
        childCount: number;
        isCollapsed: boolean;
        isRoot: boolean;
        isSearchMatch: boolean;
        isProject: boolean;
        isStory: boolean;
        hasStoryChildren: boolean;
        isTaskTodo: boolean;
        isTaskDone: boolean;
        isStoryLaneBeat: boolean;
        showStoryBody: boolean;
        isExpandedStoryCard: boolean;
        bodyText: string;
        nodeWidth: number;
        nodeHeight: number;
        storedWidth?: number;
        storedHeight?: number;
      };
      const isSelected = selectedNodeId === node.id;
      const isActivePortalTarget = activeLinkedNodeIds.has(node.id);
      const isHoverRelated = hoverNodeIds.has(node.id);
      const isDropTarget = node.id === dropTargetNodeId;
      const isInlineStoryEditor = data.showStoryBody && data.isExpandedStoryCard;

      const labelContent = (
        <div
          className={`planner-node-card${data.showStoryBody ? " story" : ""}`}
          data-testid={`planner-node-card-${data.nodeId}`}
        >
          <div className="planner-node-label">
            {data.childCount > 0 ? (
              <button
                className={`nodrag nopan planner-collapse-toggle${isMobileLayout ? " mobile" : ""}`}
                type="button"
                aria-label={data.isCollapsed ? "Expand children" : "Collapse children"}
                data-testid={`planner-node-collapse-toggle-${data.nodeId}`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleNodeCollapse(data.nodeId);
                }}
                onTouchStart={(event) => {
                  event.stopPropagation();
                }}
              >
                {data.isCollapsed ? "▶" : "▼"}
              </button>
            ) : null}
            <span className={data.isTaskDone ? "planner-node-title done" : "planner-node-title"}>{data.title}</span>
            {!data.isRoot ? <span className={`planner-kind-badge ${data.kind}`}>{data.kind}</span> : null}
            {!data.isRoot && (data.isTaskTodo || data.isTaskDone) ? (
              <span className={`planner-task-badge ${data.isTaskDone ? "done" : "todo"}`}>
                {data.isTaskDone ? "Done" : "Task"}
              </span>
            ) : null}
            {data.childCount > 0 ? <span className="planner-node-count">{data.childCount}</span> : null}
          </div>
          {data.showStoryBody ? (
            <>
              {isInlineStoryEditor ? (
                <textarea
                  key={`story-inline:${data.nodeId}:${data.bodyText}`}
                  className={`planner-node-body-editor nodrag nopan ${data.isExpandedStoryCard ? "expanded" : ""}`}
                  defaultValue={data.bodyText}
                  placeholder="Write story text directly on the node..."
                  rows={1}
                  data-testid={`planner-story-node-editor-${data.nodeId}`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  onFocus={(event) => {
                    event.stopPropagation();
                    setSelectedNodeId(data.nodeId);
                  }}
                  onBlur={(event) => {
                    void persistNodeBody(data.nodeId, event.currentTarget.value);
                  }}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <div className={`planner-node-body-preview ${data.isExpandedStoryCard ? "expanded" : ""}`}>
                  {data.bodyText || "No body text yet. Select this node and write directly on the card."}
                </div>
              )}
              <button
                className="planner-story-card-expand"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleStoryCardExpand(data.nodeId);
                }}
                type="button"
                data-testid={`planner-story-node-expand-toggle-${data.nodeId}`}
              >
                {data.isExpandedStoryCard ? "Collapse text" : "Expand text"}
              </button>
              {isSelected ? (
                <button
                  className="planner-story-resize-handle nodrag nopan"
                  type="button"
                  title="Drag corner to resize. Double-click to reset size."
                  aria-label="Resize story card"
                  data-testid={`planner-story-node-resize-handle-${data.nodeId}`}
                  onPointerDown={(event) => {
                    startStoryNodeResize(
                      data.nodeId,
                      data.nodeWidth,
                      data.nodeHeight,
                      data.storedWidth,
                      data.storedHeight,
                      event
                    );
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void resetStoryNodeSize(data.nodeId);
                  }}
                >
                  ◢
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      );

      return {
        ...node,
        data: { ...node.data, label: labelContent },
        className: isDropTarget ? "drop-target-hover" : undefined,
        style: {
          ...(node.style || {}),
          border: isSelected
            ? "2px solid rgba(253, 224, 71, 0.95)"
            : isDropTarget
              ? "2px solid rgba(52, 211, 153, 0.95)"
              : isActivePortalTarget
                ? "2px solid rgba(251, 146, 60, 0.85)"
                : (node.style as CSSProperties)?.border,
          boxShadow: isSelected
            ? "0 0 0 3px rgba(253, 224, 71, 0.18), 0 14px 32px rgba(0,0,0,0.45)"
            : isDropTarget
              ? "0 0 0 4px rgba(52, 211, 153, 0.28), 0 14px 32px rgba(0,0,0,0.5)"
              : isActivePortalTarget
                ? "0 0 0 2px rgba(251,146,60,0.2), 0 14px 30px rgba(0,0,0,0.42)"
                : isHoverRelated
                  ? "0 0 0 2px rgba(125,211,252,0.22), 0 14px 30px rgba(0,0,0,0.42)"
                  : (node.style as CSSProperties)?.boxShadow,
          opacity: hoveredNodeId || hoveredEdgeId ? (isHoverRelated ? 1 : 0.4) : 1,
          transition:
            "opacity 180ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1), border-color 180ms cubic-bezier(0.4, 0, 0.2, 1)",
        },
      } as Node;
    });
  }, [
    activeLinkedNodeIds,
    baseNodes,
    dropTargetNodeId,
    hoverNodeIds,
    hoveredEdgeId,
    hoveredNodeId,
    isMobileLayout,
    persistNodeBody,
    resetStoryNodeSize,
    selectedNodeId,
    setSelectedNodeId,
    startStoryNodeResize,
    toggleNodeCollapse,
    toggleStoryCardExpand,
  ]);
}
