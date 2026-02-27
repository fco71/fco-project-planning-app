import { useRef } from "react";
import type { CrossRef, TaskStatus, TreeNode } from "../../types/planner";
import { buildNodePath } from "../../utils/treeUtils";
import { nextNodeKind } from "../../utils/plannerConfig";
import { buildBubbleChipStyle } from "../../utils/bubbleChipStyle";

type MobileQuickEditorMode = "compact" | "full";

type MobileQuickEditorSheetProps = {
  open: boolean;
  mode: MobileQuickEditorMode;
  onModeChange: (mode: MobileQuickEditorMode) => void;
  selectedNode: TreeNode | null;
  selectedNodeId: string | null;
  nodesById: Map<string, TreeNode>;
  renameTitle: string;
  onRenameTitleChange: (value: string) => void;
  onRenameSelected: () => void | Promise<void>;
  busyAction: boolean;
  crossReferencesEnabled: boolean;
  selectedNodeRefs: CrossRef[];
  newRefLabel: string;
  onNewRefLabelChange: (value: string) => void;
  canCreateBubbleFromInput: boolean;
  onCreateCrossRef: (nodeId: string) => void | Promise<void>;
  onOpenMobileQuickBubble: (nodeId: string, focusInput?: boolean) => void;
  bodyDraft: string;
  onBodyDraftChange: (value: string) => void;
  onSaveSelectedBody: () => void | Promise<void>;
  selectedNodeBody: string;
  newRefCode: string;
  onNewRefCodeChange: (value: string) => void;
  nextAutoBubbleCode: string;
  newRefColor: string;
  onNewRefColorChange: (value: string) => void;
  bubblePrefixSuggestions: CrossRef[];
  onApplyBubbleSuggestion: (ref: CrossRef) => void;
  onOpenBubblesPanel: (focusInput?: boolean) => void;
  selectedNodeChildrenCount: number;
  selectedNodeCollapsed: boolean;
  onSetNodeTaskStatus: (nodeId: string, status: TaskStatus) => void | Promise<void>;
  onChangeType: (nodeId: string) => void | Promise<void>;
  onToggleNodeCollapse: (nodeId: string) => void;
  onFocusHere: (nodeId: string) => void;
  onAddChild: (nodeId: string) => void | Promise<void>;
  onOpenSelectedAsStoryLane: () => void;
  onOpenFullNodePanel: () => void;
  onClose: () => void;
};

export function MobileQuickEditorSheet({
  open,
  mode,
  onModeChange,
  selectedNode,
  selectedNodeId,
  nodesById,
  renameTitle,
  onRenameTitleChange,
  onRenameSelected,
  busyAction,
  crossReferencesEnabled,
  selectedNodeRefs,
  newRefLabel,
  onNewRefLabelChange,
  canCreateBubbleFromInput,
  onCreateCrossRef,
  onOpenMobileQuickBubble,
  bodyDraft,
  onBodyDraftChange,
  onSaveSelectedBody,
  selectedNodeBody,
  newRefCode,
  onNewRefCodeChange,
  nextAutoBubbleCode,
  newRefColor,
  onNewRefColorChange,
  bubblePrefixSuggestions,
  onApplyBubbleSuggestion,
  onOpenBubblesPanel,
  selectedNodeChildrenCount,
  selectedNodeCollapsed,
  onSetNodeTaskStatus,
  onChangeType,
  onToggleNodeCollapse,
  onFocusHere,
  onAddChild,
  onOpenSelectedAsStoryLane,
  onOpenFullNodePanel,
  onClose,
}: MobileQuickEditorSheetProps) {
  const touchStartY = useRef<number | null>(null);
  if (!open) return null;

  return (
    <section
      className={`planner-mobile-sheet ${mode === "compact" ? "compact" : "full"}`}
      role="dialog"
      aria-label="Quick node editor"
    >
      <div
        className="planner-mobile-sheet-handle"
        onClick={onClose}
        role="button"
        aria-label="Close"
        onTouchStart={(event) => { touchStartY.current = event.touches[0]?.clientY ?? null; }}
        onTouchEnd={(event) => {
          const startY = touchStartY.current;
          if (startY === null) return;
          const endY = event.changedTouches[0]?.clientY ?? startY;
          touchStartY.current = null;
          if (endY - startY > 60) onClose();
        }}
      />
      {selectedNode ? (
        <>
          <div className="planner-mobile-sheet-header">
            <strong>{selectedNode.title}</strong>
            <span>{selectedNode.kind}</span>
          </div>
          <div className="planner-mobile-sheet-path">{buildNodePath(selectedNode.id, nodesById)}</div>
          <div className="planner-mobile-sheet-mode-toggle" role="tablist" aria-label="Editor detail level">
            <button
              type="button"
              className={mode === "compact" ? "active" : ""}
              onClick={() => onModeChange("compact")}
              aria-selected={mode === "compact"}
            >
              Compact
            </button>
            <button
              type="button"
              className={mode === "full" ? "active" : ""}
              onClick={() => onModeChange("full")}
              aria-selected={mode === "full"}
            >
              Full
            </button>
          </div>
          <input
            value={renameTitle}
            onChange={(event) => onRenameTitleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (busyAction) return;
              void onRenameSelected();
            }}
            placeholder="Rename node..."
          />
          <button onClick={() => void onRenameSelected()} disabled={busyAction || renameTitle.trim().length === 0}>
            Save Name
          </button>
          {mode === "compact" ? (
            <>
              <div className="planner-mobile-sheet-compact-summary">
                <div className="planner-row-label">Body preview</div>
                <div className="planner-subtle">
                  {selectedNodeBody.trim().length > 0
                    ? (selectedNodeBody.trim().length > 120
                      ? `${selectedNodeBody.trim().slice(0, 120)}...`
                      : selectedNodeBody.trim())
                    : "No body text yet."}
                </div>
                {crossReferencesEnabled ? (
                  <div className="planner-subtle">
                    {selectedNodeRefs.length} bubble{selectedNodeRefs.length === 1 ? "" : "s"} on this node
                  </div>
                ) : null}
              </div>
              {crossReferencesEnabled ? (
                <>
                  <div className="planner-row-label">Quick bubble on this node</div>
                  <div className="planner-inline-buttons planner-mobile-quick-bubble-row">
                    <input
                      value={newRefLabel}
                      onChange={(event) => onNewRefLabelChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        if (busyAction || !canCreateBubbleFromInput) return;
                        void onCreateCrossRef(selectedNode.id);
                      }}
                      placeholder="Bubble name"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void onCreateCrossRef(selectedNode.id);
                      }}
                      disabled={busyAction || !canCreateBubbleFromInput}
                    >
                      Add bubble
                    </button>
                  </div>
                </>
              ) : null}
              <div className="planner-mobile-sheet-grid planner-mobile-sheet-compact-grid">
                <button type="button" onClick={() => onModeChange("full")}>
                  Expand Editor
                </button>
                {crossReferencesEnabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMobileQuickBubble(selectedNode.id, true);
                    }}
                  >
                    Add Bubble
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <textarea
                value={bodyDraft}
                onChange={(event) => onBodyDraftChange(event.target.value)}
                placeholder={selectedNode.kind === "story" ? "Scene/story body..." : "Node notes..."}
                rows={selectedNode.kind === "story" ? 6 : 4}
              />
              <button onClick={() => void onSaveSelectedBody()} disabled={busyAction || bodyDraft.trim() === selectedNodeBody.trim()}>
                Save Body
              </button>
              {crossReferencesEnabled ? (
                <>
                  <div className="planner-row-label">Quick bubble on this node</div>
                  <input
                    value={newRefLabel}
                    onChange={(event) => onNewRefLabelChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      if (busyAction || !selectedNodeId || !canCreateBubbleFromInput) return;
                      void onCreateCrossRef(selectedNode.id);
                    }}
                    placeholder="Bubble name"
                  />
                  <div className="planner-inline-buttons">
                    <input
                      className="planner-flex-1"
                      value={newRefCode}
                      onChange={(event) => onNewRefCodeChange(event.target.value)}
                      placeholder={`Code (auto ${nextAutoBubbleCode})`}
                    />
                    <input
                      className="planner-color-input-sm"
                      type="color"
                      value={newRefColor}
                      onChange={(event) => onNewRefColorChange(event.target.value)}
                    />
                    <button
                      onClick={() => {
                        void onCreateCrossRef(selectedNode.id);
                      }}
                      disabled={busyAction || !selectedNodeId || !canCreateBubbleFromInput}
                    >
                      Add Bubble
                    </button>
                  </div>
                  {bubblePrefixSuggestions.length > 0 ? (
                    <div className="planner-chip-list">
                      {bubblePrefixSuggestions.slice(0, 3).map((ref) => (
                        <button
                          key={`mobile-template:${ref.id}`}
                          className="chip bubble-chip"
                          onClick={() => onApplyBubbleSuggestion(ref)}
                          title={`Use style from ${ref.label} (${ref.code})`}
                          style={buildBubbleChipStyle(ref.color)}
                        >
                          {ref.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <button
                    onClick={() => {
                      onClose();
                      onOpenBubblesPanel(false);
                    }}
                  >
                    Open Bubble Manager
                  </button>
                </>
              ) : null}
            </>
          )}
          <div className="planner-mobile-sheet-grid">
            <button
              onClick={() => {
                if (selectedNode.kind === "root") return;
                const current = selectedNode.taskStatus || "none";
                const nextStatus: TaskStatus = current === "done" ? "todo" : "done";
                void onSetNodeTaskStatus(selectedNode.id, nextStatus);
              }}
              disabled={busyAction || selectedNode.kind === "root"}
            >
              {selectedNode.taskStatus === "done" ? "Mark Todo" : "Mark Done"}
            </button>
            <button
              onClick={() => {
                void onChangeType(selectedNode.id);
              }}
              disabled={busyAction || selectedNode.kind === "root"}
            >
              {selectedNode.kind === "root" ? "Root" : `Set ${nextNodeKind(selectedNode.kind)}`}
            </button>
            <button onClick={() => onToggleNodeCollapse(selectedNode.id)} disabled={selectedNodeChildrenCount === 0}>
              {selectedNodeCollapsed ? "Expand kids" : "Collapse kids"}
            </button>
            <button
              onClick={() => {
                onFocusHere(selectedNode.id);
                onClose();
              }}
            >
              Focus Here
            </button>
            <button
              onClick={() => {
                void onAddChild(selectedNode.id);
              }}
              disabled={busyAction}
            >
              Add Child
            </button>
          </div>
          {selectedNode.kind === "story" ? (
            <div className="planner-mobile-sheet-story">
              <button onClick={onOpenSelectedAsStoryLane}>Open Story Lane</button>
              <button
                onClick={() => {
                  void onAddChild(selectedNode.id);
                }}
                disabled={busyAction}
              >
                Add Beat Node
              </button>
            </div>
          ) : null}
          <div className="planner-mobile-sheet-actions">
            <button onClick={onOpenFullNodePanel}>
              Open Full Node Panel
            </button>
            <button onClick={onClose}>Close</button>
          </div>
        </>
      ) : (
        <div className="planner-subtle">Select a node to edit.</div>
      )}
    </section>
  );
}
