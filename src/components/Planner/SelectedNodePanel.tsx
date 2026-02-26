import type { RefObject } from "react";
import { buildNodePath } from "../../utils/treeUtils";
import { defaultNodeColor, nextNodeKind, storyContainerColor } from "../../utils/plannerConfig";
import type { TaskStatus, TreeNode } from "../../types/planner";

type SelectedNodePanelProps = {
  selectedNode: TreeNode | null | undefined;
  nodesById: Map<string, TreeNode>;
  busyAction: boolean;
  renameInputRef: RefObject<HTMLInputElement | null>;
  renameTitle: string;
  onRenameTitleChange: (value: string) => void;
  bodyDraft: string;
  onBodyDraftChange: (value: string) => void;
  rootNodeId: string | null;
  selectedNodeHasStoryChildren: boolean;
  selectedNodeChildren: TreeNode[];
  selectedNodeCollapsed: boolean;
  crossReferencesEnabled: boolean;
  newStoryStepText: string;
  onNewStoryStepTextChange: (value: string) => void;
  onOrganizeSelectedBranch: () => void | Promise<void>;
  onChangeNodeType: (nodeId: string) => void;
  onSetNodeTaskStatus: (nodeId: string, status: TaskStatus) => void | Promise<void>;
  onSetNodeColor: (nodeId: string, color?: string) => void | Promise<void>;
  onRenameSelected: () => void | Promise<void>;
  onDeleteSelected: () => void | Promise<void>;
  onSaveSelectedBody: () => void | Promise<void>;
  onSelectChildNode: (nodeId: string) => void;
  onToggleNodeCollapse: (nodeId: string) => void;
  onAddBubbleToNode: (nodeId: string) => void | Promise<void>;
  onOpenSelectedAsStoryLane: () => void;
  onAddChildNode: (nodeId: string) => void | Promise<void>;
  onToggleStoryStepDone: (stepId: string) => void | Promise<void>;
  onMoveStoryStep: (stepId: string, direction: -1 | 1) => void | Promise<void>;
  onDeleteStoryStep: (stepId: string) => void | Promise<void>;
  onAddStoryStep: () => void | Promise<void>;
};

export function SelectedNodePanel({
  selectedNode,
  nodesById,
  busyAction,
  renameInputRef,
  renameTitle,
  onRenameTitleChange,
  bodyDraft,
  onBodyDraftChange,
  rootNodeId,
  selectedNodeHasStoryChildren,
  selectedNodeChildren,
  selectedNodeCollapsed,
  crossReferencesEnabled,
  newStoryStepText,
  onNewStoryStepTextChange,
  onOrganizeSelectedBranch,
  onChangeNodeType,
  onSetNodeTaskStatus,
  onSetNodeColor,
  onRenameSelected,
  onDeleteSelected,
  onSaveSelectedBody,
  onSelectChildNode,
  onToggleNodeCollapse,
  onAddBubbleToNode,
  onOpenSelectedAsStoryLane,
  onAddChildNode,
  onToggleStoryStepDone,
  onMoveStoryStep,
  onDeleteStoryStep,
  onAddStoryStep,
}: SelectedNodePanelProps) {
  return (
    <div className="planner-panel-block">
      <h3>Selected Node</h3>
      {selectedNode ? (
        <>
          <div className="planner-row-label">Path</div>
          <div className="planner-path">{buildNodePath(selectedNode.id, nodesById)}</div>
          <div className="planner-inline-buttons">
            <button onClick={onOrganizeSelectedBranch} disabled={busyAction}>
              Clean up this branch
            </button>
          </div>
          <div className="planner-row-label">Type</div>
          <div className="planner-inline-buttons">
            <button
              onClick={() => onChangeNodeType(selectedNode.id)}
              disabled={busyAction || selectedNode.kind === "root"}
            >
              {selectedNode.kind === "root" ? "Root" : `Set as ${nextNodeKind(selectedNode.kind)}`}
            </button>
            <button disabled>{selectedNode.kind}</button>
          </div>
          <div className="planner-row-label">Task status</div>
          <div className="planner-inline-buttons">
            <select
              value={selectedNode.taskStatus || "none"}
              onChange={(event) => {
                void onSetNodeTaskStatus(selectedNode.id, event.target.value as TaskStatus);
              }}
              disabled={busyAction || selectedNode.kind === "root"}
            >
              <option value="none">No task</option>
              <option value="todo">Todo</option>
              <option value="done">Done</option>
            </select>
            <button
              onClick={() => {
                const current = selectedNode.taskStatus || "none";
                const nextStatus: TaskStatus = current === "done" ? "todo" : "done";
                void onSetNodeTaskStatus(selectedNode.id, nextStatus);
              }}
              disabled={busyAction || selectedNode.kind === "root"}
            >
              {selectedNode.taskStatus === "done" ? "Mark todo" : "Mark done"}
            </button>
          </div>
          <div className="planner-row-label">Color</div>
          <div className="planner-inline-buttons">
            <input
              type="color"
              value={selectedNode.color || (selectedNodeHasStoryChildren ? storyContainerColor() : defaultNodeColor(selectedNode.kind))}
              onChange={(event) => {
                void onSetNodeColor(selectedNode.id, event.target.value);
              }}
              disabled={busyAction}
              className="planner-color-input-lg"
            />
            <button
              onClick={() => {
                void onSetNodeColor(selectedNode.id, undefined);
              }}
              disabled={busyAction || !selectedNode.color}
            >
              Reset color
            </button>
          </div>
          <input
            ref={renameInputRef}
            value={renameTitle}
            onChange={(event) => onRenameTitleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (busyAction) return;
              void onRenameSelected();
            }}
          />
          <div className="planner-inline-buttons">
            <button onClick={onRenameSelected} disabled={busyAction || renameTitle.trim().length === 0}>
              Rename
            </button>
            <button
              className="danger"
              onClick={onDeleteSelected}
              disabled={busyAction || selectedNode.id === rootNodeId}
            >
              Delete subtree
            </button>
          </div>
          <div className="planner-row-label">Body text</div>
          <textarea
            value={bodyDraft}
            onChange={(event) => onBodyDraftChange(event.target.value)}
            placeholder={
              selectedNode.kind === "story"
                ? "Write scene/story details for this node..."
                : "Write extended notes for this node..."
            }
            rows={selectedNode.kind === "story" ? 7 : 5}
            disabled={busyAction}
          />
          <button onClick={onSaveSelectedBody} disabled={busyAction || bodyDraft.trim() === (selectedNode.body || "").trim()}>
            Save body text
          </button>

          <div className="planner-row-label">Children</div>
          <div className="planner-chip-list">
            {selectedNodeChildren.length === 0 ? (
              <span className="planner-subtle">No child nodes yet.</span>
            ) : (
              selectedNodeChildren.map((child) => (
                <button
                  key={child.id}
                  className="chip"
                  onClick={() => {
                    onSelectChildNode(child.id);
                  }}
                >
                  <span className={child.taskStatus === "done" ? "planner-node-title done" : ""}>{child.title}</span>
                </button>
              ))
            )}
          </div>
          {selectedNodeChildren.length > 0 ? (
            <button
              onClick={() => onToggleNodeCollapse(selectedNode.id)}
              type="button"
            >
              {selectedNodeCollapsed ? "Expand children" : "Collapse children"}
            </button>
          ) : null}
          {crossReferencesEnabled ? (
            <>
              <div className="planner-row-label">Bubbles</div>
              <div className="planner-inline-buttons">
                <button
                  onClick={() => {
                    void onAddBubbleToNode(selectedNode.id);
                  }}
                >
                  Add bubble to this node
                </button>
              </div>
            </>
          ) : null}

          {selectedNode.kind === "story" ? (
            <>
              <div className="planner-row-label">Story lane</div>
              <div className="planner-inline-buttons">
                <button onClick={onOpenSelectedAsStoryLane}>Open this story in lane view</button>
                <button
                  onClick={() => {
                    void onAddChildNode(selectedNode.id);
                  }}
                  disabled={busyAction}
                >
                  Add beat node
                </button>
              </div>
              <p className="planner-subtle">
                Lane view arranges child nodes left-to-right as beats. Use each beat node&apos;s body text for long scene notes.
              </p>
              <details className="planner-advanced-tools">
                <summary>Legacy checklist beats (optional)</summary>
                <div className="planner-advanced-tools-content">
                  <div className="planner-reference-list">
                    {(selectedNode.storySteps || []).length === 0 ? (
                      <span className="planner-subtle">No checklist beats yet.</span>
                    ) : (
                      (selectedNode.storySteps || []).map((step, index) => (
                        <div key={step.id} className="planner-story-step-item">
                          <button
                            className="planner-story-step-toggle"
                            onClick={() => {
                              void onToggleStoryStepDone(step.id);
                            }}
                            disabled={busyAction}
                            title={step.done ? "Mark as not done" : "Mark as done"}
                          >
                            {step.done ? "☑" : "☐"}
                          </button>
                          <span className={step.done ? "planner-story-step-text done" : "planner-story-step-text"}>
                            {`${index + 1}. ${step.text}`}
                          </span>
                          <div className="planner-story-step-actions">
                            <button
                              onClick={() => {
                                void onMoveStoryStep(step.id, -1);
                              }}
                              disabled={busyAction || index === 0}
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => {
                                void onMoveStoryStep(step.id, 1);
                              }}
                              disabled={busyAction || index === (selectedNode.storySteps || []).length - 1}
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              className="danger"
                              onClick={() => {
                                void onDeleteStoryStep(step.id);
                              }}
                              disabled={busyAction}
                              title="Delete step"
                            >
                              x
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="planner-story-step-add">
                    <input
                      value={newStoryStepText}
                      onChange={(event) => onNewStoryStepTextChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        if (busyAction || newStoryStepText.trim().length === 0) return;
                        void onAddStoryStep();
                      }}
                      placeholder="Add checklist beat..."
                      disabled={busyAction}
                    />
                    <button onClick={onAddStoryStep} disabled={busyAction || newStoryStepText.trim().length === 0}>
                      Add step
                    </button>
                  </div>
                </div>
              </details>
            </>
          ) : null}
        </>
      ) : (
        <p className="planner-subtle">No node selected.</p>
      )}
    </div>
  );
}
