import { useRef } from "react";
import type { RefObject } from "react";
import type { CrossRef, TreeNode } from "../../types/planner";
import { buildNodePathTail } from "../../utils/treeUtils";
import { buildBubbleChipStyle } from "../../utils/bubbleChipStyle";

type MobileQuickBubbleSheetProps = {
  open: boolean;
  selectedNode: TreeNode | null;
  nodesById: Map<string, TreeNode>;
  mobileQuickBubbleInputRef: RefObject<HTMLInputElement | null>;
  newRefLabel: string;
  onNewRefLabelChange: (value: string) => void;
  busyAction: boolean;
  canCreateBubbleFromInput: boolean;
  onCreateBubble: (nodeId: string) => Promise<void> | void;
  focusMobileQuickBubbleInput: (delayMs?: number) => void;
  blurActiveInput: () => void;
  openBubblesPanel: (focusInput?: boolean) => void;
  newRefColor: string;
  onNewRefColorChange: (value: string) => void;
  newRefCode: string;
  onNewRefCodeChange: (value: string) => void;
  nextAutoBubbleCode: string;
  effectiveNewBubbleCode: string;
  bubblePrefixSuggestions: CrossRef[];
  applyBubbleSuggestion: (ref: CrossRef) => void;
  selectedNodeRefs: CrossRef[];
  onSelectRefForEditing: (refId: string) => void;
  activePortalRef: CrossRef | null;
  mobileQuickBubbleEditName: string;
  onMobileQuickBubbleEditNameChange: (value: string) => void;
  onSaveMobileQuickBubbleName: () => Promise<void> | void;
  onUpdateCrossRefColor: (refId: string, color: string) => Promise<void> | void;
  defaultBubbleColor: string;
  onDeletePortalByRefId: (refId: string) => Promise<void> | void;
  onClose: () => void;
};

export function MobileQuickBubbleSheet({
  open,
  selectedNode,
  nodesById,
  mobileQuickBubbleInputRef,
  newRefLabel,
  onNewRefLabelChange,
  busyAction,
  canCreateBubbleFromInput,
  onCreateBubble,
  focusMobileQuickBubbleInput,
  blurActiveInput,
  openBubblesPanel,
  newRefColor,
  onNewRefColorChange,
  newRefCode,
  onNewRefCodeChange,
  nextAutoBubbleCode,
  effectiveNewBubbleCode,
  bubblePrefixSuggestions,
  applyBubbleSuggestion,
  selectedNodeRefs,
  onSelectRefForEditing,
  activePortalRef,
  mobileQuickBubbleEditName,
  onMobileQuickBubbleEditNameChange,
  onSaveMobileQuickBubbleName,
  onUpdateCrossRefColor,
  defaultBubbleColor,
  onDeletePortalByRefId,
  onClose,
}: MobileQuickBubbleSheetProps) {
  const touchStartY = useRef<number | null>(null);
  if (!open) return null;

  return (
    <section
      className="planner-mobile-sheet compact planner-mobile-bubble-sheet"
      role="dialog"
      aria-label="Quick bubble add"
      data-testid="planner-mobile-quick-bubble-sheet"
    >
      <div
        className="planner-mobile-sheet-handle"
        onClick={onClose}
        role="button"
        aria-label="Close"
        data-testid="planner-mobile-quick-bubble-close-handle"
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
            <span>bubble</span>
          </div>
          <div className="planner-mobile-sheet-path planner-mobile-sheet-path-tail">
            {buildNodePathTail(selectedNode.id, nodesById, 3)}
          </div>
          <div className="planner-row-label">Bubble name</div>
          <div className="planner-inline-buttons planner-mobile-bubble-input-row">
            <input
              ref={mobileQuickBubbleInputRef}
              value={newRefLabel}
              onChange={(event) => onNewRefLabelChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (busyAction || !canCreateBubbleFromInput) return;
                void Promise.resolve(onCreateBubble(selectedNode.id)).then(() => {
                  focusMobileQuickBubbleInput(30);
                });
              }}
              placeholder="Bubble name"
              data-testid="planner-mobile-quick-bubble-name-input"
            />
            <button
              type="button"
              onClick={() => {
                void Promise.resolve(onCreateBubble(selectedNode.id)).then(() => {
                  focusMobileQuickBubbleInput(30);
                });
              }}
              disabled={busyAction || !canCreateBubbleFromInput}
              data-testid="planner-mobile-quick-bubble-add-button"
            >
              Add
            </button>
          </div>
          <div className="planner-inline-buttons planner-mobile-bubble-aux-row">
            <button type="button" onClick={blurActiveInput} data-testid="planner-mobile-quick-bubble-done-button">
              Done
            </button>
            <button type="button" onClick={() => openBubblesPanel(false)} data-testid="planner-mobile-quick-bubble-manage-button">
              Manage
            </button>
          </div>
          <div className="planner-inline-buttons planner-mobile-bubble-meta-row">
            <details className="planner-advanced-tools planner-mobile-bubble-advanced">
              <summary>Advanced style and code (optional)</summary>
              <div className="planner-advanced-tools-content">
                <label className="planner-bubble-color-input-wrap">
                  <span className="planner-subtle planner-subtle-11">Color</span>
                  <input
                    className="planner-color-input-md"
                    type="color"
                    value={newRefColor}
                    onChange={(event) => onNewRefColorChange(event.target.value)}
                    data-testid="planner-mobile-quick-bubble-color-input"
                  />
                </label>
                <div className="planner-grid-gap-4">
                  <input
                    className="planner-flex-1"
                    value={newRefCode}
                    onChange={(event) => onNewRefCodeChange(event.target.value)}
                    placeholder={`Internal code (auto ${nextAutoBubbleCode})`}
                    data-testid="planner-mobile-quick-bubble-code-input"
                  />
                  <span className="planner-subtle planner-subtle-11">
                    Internal code: <strong>{effectiveNewBubbleCode}</strong>
                  </span>
                </div>
              </div>
            </details>
          </div>
          {bubblePrefixSuggestions.length > 0 ? (
            <div className="planner-chip-list">
              {bubblePrefixSuggestions.slice(0, 4).map((ref) => (
                <button
                  key={`mobile-quick-template:${ref.id}`}
                  className="chip bubble-chip"
                  onClick={() => applyBubbleSuggestion(ref)}
                  title={`Use style from ${ref.label} (${ref.code})`}
                  style={buildBubbleChipStyle(ref.color)}
                >
                  {ref.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="planner-subtle">
            {selectedNodeRefs.length} bubble{selectedNodeRefs.length === 1 ? "" : "s"} currently on this node.
          </div>
          <div className="planner-row-label">Bubbles on this node</div>
          <div className="planner-chip-list">
            {selectedNodeRefs.length === 0 ? (
              <span className="planner-subtle">No bubbles yet.</span>
            ) : (
              selectedNodeRefs.map((ref) => (
                <button
                  key={`mobile-quick-node-ref:${ref.id}`}
                  className="chip bubble-chip"
                  onClick={() => onSelectRefForEditing(ref.id)}
                  style={buildBubbleChipStyle(ref.color, activePortalRef?.id === ref.id)}
                  data-testid="planner-mobile-quick-bubble-node-chip"
                >
                  {ref.label}
                </button>
              ))
            )}
          </div>
          {activePortalRef && activePortalRef.nodeIds.includes(selectedNode.id) ? (
            <>
              <div className="planner-row-label">Edit selected bubble</div>
              <input
                value={mobileQuickBubbleEditName}
                onChange={(event) => onMobileQuickBubbleEditNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (busyAction || mobileQuickBubbleEditName.trim().length === 0) return;
                  void onSaveMobileQuickBubbleName();
                }}
                placeholder="Bubble name"
                data-testid="planner-mobile-quick-bubble-edit-name-input"
              />
              <div className="planner-inline-buttons planner-mobile-bubble-edit-row">
                <input
                  className="planner-color-input-md"
                  type="color"
                  value={activePortalRef.color || defaultBubbleColor}
                  onChange={(event) => {
                    void onUpdateCrossRefColor(activePortalRef.id, event.target.value);
                  }}
                  data-testid="planner-mobile-quick-bubble-edit-color-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    void onSaveMobileQuickBubbleName();
                  }}
                  disabled={busyAction || mobileQuickBubbleEditName.trim().length === 0}
                  data-testid="planner-mobile-quick-bubble-save-name-button"
                >
                  Save Name
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void onDeletePortalByRefId(activePortalRef.id);
                  }}
                  disabled={busyAction}
                  data-testid="planner-mobile-quick-bubble-delete-button"
                >
                  Delete
                </button>
              </div>
            </>
          ) : null}
          <div className="planner-mobile-sheet-actions">
            <button onClick={onClose} data-testid="planner-mobile-quick-bubble-close-button">Close</button>
          </div>
        </>
      ) : (
        <>
          <div className="planner-subtle">Select a node first, then use Bubble.</div>
          <div className="planner-mobile-sheet-actions">
            <button onClick={onClose} data-testid="planner-mobile-quick-bubble-close-button">Close</button>
          </div>
        </>
      )}
    </section>
  );
}
