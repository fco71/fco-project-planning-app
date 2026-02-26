import type { RefObject } from "react";
import { buildNodePath, buildNodePathTail } from "../../utils/treeUtils";
import { rgbaFromHex } from "../../utils/normalize";
import type { CrossRef, TreeNode } from "../../types/planner";

type SimpleBubblesPanelProps = {
  bubbleTargetNode: TreeNode | null | undefined;
  nodesById: Map<string, TreeNode>;
  isMobileLayout: boolean;
  busyAction: boolean;
  selectedNodeId: string | null;
  selectedNodeRefs: CrossRef[];
  activePortalRef: CrossRef | null;
  effectiveBubbleTargetId: string | null;
  newRefLabelInputRef: RefObject<HTMLInputElement | null>;
  newRefLabel: string;
  onNewRefLabelChange: (value: string) => void;
  newRefColor: string;
  onNewRefColorChange: (value: string) => void;
  newRefCode: string;
  onNewRefCodeChange: (value: string) => void;
  nextAutoBubbleCode: string;
  effectiveNewBubbleCode: string;
  canCreateBubbleFromInput: boolean;
  bubblePrefixSuggestions: CrossRef[];
  defaultBubbleColor: string;
  onSelectBubbleTarget: (nodeId: string) => void;
  onCreateCrossRef: () => Promise<void>;
  onOpenMobileQuickBubble: (targetNodeId?: string, focusInput?: boolean) => void;
  onCloseMobilePanels: () => void;
  onBlurActiveInput: () => void;
  onApplyBubbleSuggestion: (ref: CrossRef) => void;
  onToggleActivePortalRef: (refId: string) => void;
  onDeletePortalByRefId: (refId: string) => void;
  onUpdateCrossRefColor: (refId: string, color: string) => Promise<void>;
};

function bubbleChipStyle(color?: string | null) {
  return {
    borderColor: rgbaFromHex(color, 0.9, "rgba(64,182,255,0.88)"),
    boxShadow: `0 0 0 1px ${rgbaFromHex(color, 0.25, "rgba(64,182,255,0.2)")}`,
  };
}

export function SimpleBubblesPanel({
  bubbleTargetNode,
  nodesById,
  isMobileLayout,
  busyAction,
  selectedNodeId,
  selectedNodeRefs,
  activePortalRef,
  effectiveBubbleTargetId,
  newRefLabelInputRef,
  newRefLabel,
  onNewRefLabelChange,
  newRefColor,
  onNewRefColorChange,
  newRefCode,
  onNewRefCodeChange,
  nextAutoBubbleCode,
  effectiveNewBubbleCode,
  canCreateBubbleFromInput,
  bubblePrefixSuggestions,
  defaultBubbleColor,
  onSelectBubbleTarget,
  onCreateCrossRef,
  onOpenMobileQuickBubble,
  onCloseMobilePanels,
  onBlurActiveInput,
  onApplyBubbleSuggestion,
  onToggleActivePortalRef,
  onDeletePortalByRefId,
  onUpdateCrossRefColor,
}: SimpleBubblesPanelProps) {
  return (
    <div id="cross-ref-bubbles-panel" className="planner-panel-block">
      <h3>Bubbles</h3>
      <p className="planner-subtle">
        Local visual bubbles for each node. No cross-linking between nodes.
      </p>
      <div className="planner-row-label">Selected node target</div>
      <div className="planner-chip-list">
        {bubbleTargetNode ? (
          <button
            className="chip"
            onClick={() => onSelectBubbleTarget(bubbleTargetNode.id)}
            title={buildNodePath(bubbleTargetNode.id, nodesById)}
          >
            {bubbleTargetNode.title}
          </button>
        ) : (
          <span className="planner-subtle">Tap a node, then add a bubble.</span>
        )}
      </div>
      {bubbleTargetNode ? (
        <div className={`planner-path planner-bubble-target-path${isMobileLayout ? " planner-path-tail" : ""}`}>
          {isMobileLayout
            ? buildNodePathTail(bubbleTargetNode.id, nodesById, 3)
            : buildNodePath(bubbleTargetNode.id, nodesById)}
        </div>
      ) : (
        <p className="planner-subtle">
          Tap any node on the canvas. This panel always targets your current selection.
        </p>
      )}
      {isMobileLayout ? (
        <>
          <div className="planner-row-label">
            {bubbleTargetNode ? `Quick add to: ${bubbleTargetNode.title}` : "Tap a node first"}
          </div>
          <div className="planner-inline-buttons planner-mobile-bubble-aux-row">
            <button
              type="button"
              onClick={() => onOpenMobileQuickBubble(effectiveBubbleTargetId || undefined, true)}
              disabled={!effectiveBubbleTargetId}
            >
              Quick Add Bubble
            </button>
            <button type="button" onClick={onCloseMobilePanels}>
              Pick Node
            </button>
          </div>
          <p className="planner-subtle">
            Quick Add opens a short sheet with one input and one Add button.
          </p>
          <details className="planner-advanced-tools">
            <summary>Advanced bubble options</summary>
            <div className="planner-advanced-tools-content">
              <div className="planner-inline-buttons planner-mobile-bubble-input-row">
                <input
                  ref={newRefLabelInputRef}
                  value={newRefLabel}
                  onChange={(event) => onNewRefLabelChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    if (busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput) return;
                    void onCreateCrossRef();
                  }}
                  placeholder="Bubble name"
                />
                <button
                  onClick={() => {
                    void onCreateCrossRef();
                  }}
                  disabled={busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput}
                >
                  Add
                </button>
              </div>
              <div className="planner-inline-buttons planner-mobile-bubble-aux-row">
                <button type="button" onClick={onBlurActiveInput}>
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMobileQuickBubble(effectiveBubbleTargetId || undefined, true)}
                  disabled={!effectiveBubbleTargetId}
                >
                  Open Quick Add
                </button>
              </div>
              <div className="planner-inline-buttons">
                <label className="planner-bubble-color-input-wrap">
                  <span className="planner-subtle planner-subtle-11">Color</span>
                  <input
                    className="planner-color-input-sm"
                    type="color"
                    value={newRefColor}
                    onChange={(event) => onNewRefColorChange(event.target.value)}
                  />
                </label>
                <div className="planner-grid-gap-4 planner-flex-1">
                  <input
                    value={newRefCode}
                    onChange={(event) => onNewRefCodeChange(event.target.value)}
                    placeholder={`Code (auto ${nextAutoBubbleCode})`}
                    className="planner-flex-1"
                  />
                  <span className="planner-subtle planner-subtle-11">
                    New bubble code: <strong>{effectiveNewBubbleCode}</strong>
                  </span>
                </div>
              </div>
              {bubblePrefixSuggestions.length > 0 ? (
                <>
                  <div className="planner-row-label">Similar bubble styles</div>
                  <div className="planner-chip-list">
                    {bubblePrefixSuggestions.map((ref) => (
                      <button
                        key={`template:${ref.id}`}
                        className="chip"
                        onClick={() => onApplyBubbleSuggestion(ref)}
                        title={`Use style from ${ref.label} (${ref.code})`}
                        style={bubbleChipStyle(ref.color)}
                      >
                        {ref.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </details>
        </>
      ) : (
        <>
          <div className="planner-row-label">
            {bubbleTargetNode ? `Add bubble to: ${bubbleTargetNode.title}` : "Tap a node first"}
          </div>
          <input
            ref={newRefLabelInputRef}
            value={newRefLabel}
            onChange={(event) => onNewRefLabelChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput) return;
              void onCreateCrossRef();
            }}
            placeholder="Bubble name"
          />
          <button
            onClick={() => {
              void onCreateCrossRef();
            }}
            disabled={busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput}
          >
            {effectiveBubbleTargetId ? "Add Bubble to Selected Node" : "Select Node to Add Bubble"}
          </button>
          <div className="planner-inline-buttons">
            <label className="planner-bubble-color-input-wrap">
              <span className="planner-subtle planner-subtle-11">Color</span>
              <input
                className="planner-color-input-sm"
                type="color"
                value={newRefColor}
                onChange={(event) => onNewRefColorChange(event.target.value)}
              />
            </label>
            <div className="planner-grid-gap-4 planner-flex-1">
              <input
                value={newRefCode}
                onChange={(event) => onNewRefCodeChange(event.target.value)}
                placeholder={`Code (auto ${nextAutoBubbleCode})`}
                className="planner-flex-1"
              />
              <span className="planner-subtle planner-subtle-11">
                New bubble code: <strong>{effectiveNewBubbleCode}</strong>
              </span>
            </div>
          </div>
          {bubblePrefixSuggestions.length > 0 ? (
            <>
              <div className="planner-row-label">Similar bubble styles</div>
              <div className="planner-chip-list">
                {bubblePrefixSuggestions.map((ref) => (
                  <button
                    key={`template:${ref.id}`}
                    className="chip"
                    onClick={() => onApplyBubbleSuggestion(ref)}
                    title={`Use style from ${ref.label} (${ref.code})`}
                    style={bubbleChipStyle(ref.color)}
                  >
                    {ref.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
      <div className="planner-row-label">
        {bubbleTargetNode ? `Bubbles on ${bubbleTargetNode.title}` : "Bubbles on selected node"}
      </div>
      <div className="planner-chip-list">
        {selectedNodeRefs.length === 0 || !selectedNodeId ? (
          <span className="planner-subtle">No bubbles yet.</span>
        ) : (
          selectedNodeRefs.map((ref) => (
            <div key={ref.id} className="chip with-action">
              <button
                onClick={() => onToggleActivePortalRef(ref.id)}
                title={ref.label}
                style={bubbleChipStyle(ref.color)}
              >
                {ref.label}
              </button>
              <button
                className="chip-action"
                onClick={() => onDeletePortalByRefId(ref.id)}
                title="Delete bubble"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
      {activePortalRef ? (
        <div className="planner-panel-block planner-panel-block-tight">
          <div className="planner-row-label">Selected bubble</div>
          <div className="planner-inline-buttons">
            <span className="planner-subtle planner-inline-center">{`${activePortalRef.label} (${activePortalRef.code})`}</span>
            <input
              className="planner-color-input-md"
              type="color"
              value={activePortalRef.color || defaultBubbleColor}
              onChange={(event) => {
                void onUpdateCrossRefColor(activePortalRef.id, event.target.value);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
