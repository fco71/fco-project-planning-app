import type { RefObject } from "react";
import { buildNodePath } from "../../utils/treeUtils";
import type { CrossRef, TreeNode } from "../../types/planner";
import { buildBubbleChipStyle } from "../../utils/bubbleChipStyle";

type SimpleBubblesPanelProps = {
  bubbleTargetNode: TreeNode | null | undefined;
  nodesById: Map<string, TreeNode>;
  isMobileLayout: boolean;
  busyAction: boolean;
  selectedNodeId: string | null;
  selectedNodeRefs: CrossRef[];
  activePortalRef: CrossRef | null;
  mobileQuickBubbleEditName: string;
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
  onBlurActiveInput: () => void;
  onApplyBubbleSuggestion: (ref: CrossRef) => void;
  onToggleActivePortalRef: (refId: string) => void;
  onDeletePortalByRefId: (refId: string) => void;
  onMobileQuickBubbleEditNameChange: (value: string) => void;
  onSaveMobileQuickBubbleName: () => Promise<void> | void;
  onUpdateCrossRefColor: (refId: string, color: string) => Promise<void>;
};

export function SimpleBubblesPanel({
  bubbleTargetNode,
  nodesById,
  isMobileLayout,
  busyAction,
  selectedNodeId,
  selectedNodeRefs,
  activePortalRef,
  mobileQuickBubbleEditName,
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
  onBlurActiveInput,
  onApplyBubbleSuggestion,
  onToggleActivePortalRef,
  onDeletePortalByRefId,
  onMobileQuickBubbleEditNameChange,
  onSaveMobileQuickBubbleName,
  onUpdateCrossRefColor,
}: SimpleBubblesPanelProps) {
  const recoverableTargetId = !bubbleTargetNode && selectedNodeId && nodesById.has(selectedNodeId)
    ? selectedNodeId
    : null;

  return (
    <div id="cross-ref-bubbles-panel" className="planner-panel-block" data-testid="planner-bubbles-panel">
      <div className="planner-panel-title-row">
        <h3>Bubbles</h3>
        {isMobileLayout ? (
          <span
            className={`planner-bubble-target-badge ${bubbleTargetNode ? "is-active" : "is-empty"}`}
            title={bubbleTargetNode ? buildNodePath(bubbleTargetNode.id, nodesById) : "No node selected"}
            data-testid="planner-bubble-target-badge"
          >
            {bubbleTargetNode ? `Target: ${bubbleTargetNode.title}` : "Target: none"}
          </span>
        ) : null}
      </div>
      <p className="planner-subtle">
        Local visual bubbles for each node. No cross-linking between nodes.
      </p>
      {isMobileLayout ? (
        <>
          <div className="planner-row-label">Selected node</div>
          {bubbleTargetNode ? (
            <div className="planner-subtle planner-mobile-selected-node-label">
              {bubbleTargetNode.title}
            </div>
          ) : (
            <>
              <p className="planner-subtle">
                Tap a node on the canvas first. Bubble actions always apply to that selected node.
              </p>
              {recoverableTargetId ? (
                <button
                  type="button"
                  onClick={() => onSelectBubbleTarget(recoverableTargetId)}
                  data-testid="planner-bubble-recover-target-button"
                >
                  Use selected node
                </button>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          <div className="planner-row-label">Selected node target</div>
          <div className="planner-chip-list">
            {bubbleTargetNode ? (
              <button
                className="chip"
                onClick={() => onSelectBubbleTarget(bubbleTargetNode.id)}
                title={buildNodePath(bubbleTargetNode.id, nodesById)}
                data-testid="planner-bubble-target-chip"
              >
                {bubbleTargetNode.title}
              </button>
            ) : (
              <span className="planner-subtle">Tap a node, then add a bubble.</span>
            )}
          </div>
          {bubbleTargetNode ? (
            <div className="planner-path planner-bubble-target-path">
              {buildNodePath(bubbleTargetNode.id, nodesById)}
            </div>
          ) : (
            <p className="planner-subtle">
              Tap any node on the canvas. This panel always targets your current selection.
            </p>
          )}
        </>
      )}
      {isMobileLayout ? (
        <>
          <div className="planner-row-label">
            {bubbleTargetNode ? `Add bubble to: ${bubbleTargetNode.title}` : "Tap a node first"}
          </div>
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
              data-testid="planner-bubble-name-input"
            />
            <button
              onClick={() => {
                void onCreateCrossRef();
              }}
              disabled={busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput}
              data-testid="planner-bubble-add-button"
            >
              Add
            </button>
          </div>
          {!effectiveBubbleTargetId ? (
            <p className="planner-subtle">Select a node on the canvas first. Bubble add is node-specific.</p>
          ) : null}
          <div className="planner-inline-buttons planner-mobile-bubble-aux-row">
            <button type="button" onClick={onBlurActiveInput}>
              Done
            </button>
            <button
              type="button"
              onClick={() => onOpenMobileQuickBubble(effectiveBubbleTargetId || undefined, true)}
              disabled={!effectiveBubbleTargetId}
              data-testid="planner-bubble-quick-add-button"
            >
              Manage this node
            </button>
          </div>
          <details className="planner-advanced-tools">
            <summary>Advanced bubble options</summary>
            <div className="planner-advanced-tools-content">
              <div className="planner-inline-buttons">
                <label className="planner-bubble-color-input-wrap">
                  <span className="planner-subtle planner-subtle-11">Color</span>
                  <input
                    className="planner-color-input-sm"
                    type="color"
                    value={newRefColor}
                    onChange={(event) => onNewRefColorChange(event.target.value)}
                    data-testid="planner-bubble-color-input"
                  />
                </label>
                <div className="planner-grid-gap-4 planner-flex-1">
                  <input
                    value={newRefCode}
                    onChange={(event) => onNewRefCodeChange(event.target.value)}
                    placeholder={`Code (auto ${nextAutoBubbleCode})`}
                    className="planner-flex-1"
                    data-testid="planner-bubble-code-input"
                  />
                  <span className="planner-subtle planner-subtle-11">
                    New bubble code: <strong>{effectiveNewBubbleCode}</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenMobileQuickBubble(effectiveBubbleTargetId || undefined, true)}
                disabled={!effectiveBubbleTargetId}
                data-testid="planner-bubble-open-quick-add-button"
              >
                Open dedicated quick-add sheet
              </button>
              {bubblePrefixSuggestions.length > 0 ? (
                <>
                  <div className="planner-row-label">Similar bubble styles</div>
                  <div className="planner-chip-list">
                    {bubblePrefixSuggestions.map((ref) => (
                      <button
                        key={`template:${ref.id}`}
                        className="chip bubble-chip"
                        onClick={() => onApplyBubbleSuggestion(ref)}
                        title={`Use style from ${ref.label} (${ref.code})`}
                        style={buildBubbleChipStyle(ref.color)}
                        data-testid="planner-bubble-suggestion-chip"
                      >
                        {ref.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </details>
          <details className="planner-advanced-tools">
            <summary>
              Manage bubbles on this node ({selectedNodeRefs.length})
            </summary>
            <div className="planner-advanced-tools-content">
              <div className="planner-chip-list">
                {selectedNodeRefs.length === 0 || !selectedNodeId ? (
                  <span className="planner-subtle">No bubbles yet.</span>
                ) : (
                  selectedNodeRefs.map((ref) => (
                    <div key={ref.id} className="chip with-action">
                      <button
                        onClick={() => onToggleActivePortalRef(ref.id)}
                        title={ref.label}
                        className="bubble-chip"
                        style={buildBubbleChipStyle(ref.color)}
                        data-testid="planner-bubble-existing-chip"
                      >
                        {ref.label}
                      </button>
                      <button
                        className="chip-action"
                        onClick={() => onDeletePortalByRefId(ref.id)}
                        title="Delete bubble"
                        data-testid="planner-bubble-delete-chip-button"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
              {activePortalRef ? (
                <div className="planner-panel-block planner-panel-block-tight">
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
                    data-testid="planner-bubble-selected-name-input"
                  />
                  <div className="planner-inline-buttons">
                    <button
                      type="button"
                      onClick={() => {
                        void onSaveMobileQuickBubbleName();
                      }}
                      disabled={busyAction || mobileQuickBubbleEditName.trim().length === 0}
                      data-testid="planner-bubble-selected-name-save-button"
                    >
                      Save Name
                    </button>
                    <input
                      className="planner-color-input-md"
                      type="color"
                      value={activePortalRef.color || defaultBubbleColor}
                      onChange={(event) => {
                        void onUpdateCrossRefColor(activePortalRef.id, event.target.value);
                      }}
                      data-testid="planner-bubble-selected-color-input"
                    />
                  </div>
                </div>
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
            data-testid="planner-bubble-name-input"
          />
          <button
            onClick={() => {
              void onCreateCrossRef();
            }}
            disabled={busyAction || !effectiveBubbleTargetId || !canCreateBubbleFromInput}
            data-testid="planner-bubble-add-button"
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
                data-testid="planner-bubble-color-input"
              />
            </label>
            <div className="planner-grid-gap-4 planner-flex-1">
              <input
                value={newRefCode}
                onChange={(event) => onNewRefCodeChange(event.target.value)}
                placeholder={`Code (auto ${nextAutoBubbleCode})`}
                className="planner-flex-1"
                data-testid="planner-bubble-code-input"
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
                    className="chip bubble-chip"
                    onClick={() => onApplyBubbleSuggestion(ref)}
                    title={`Use style from ${ref.label} (${ref.code})`}
                    style={buildBubbleChipStyle(ref.color)}
                    data-testid="planner-bubble-suggestion-chip"
                  >
                    {ref.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
      {!isMobileLayout ? (
        <>
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
                    className="bubble-chip"
                    style={buildBubbleChipStyle(ref.color)}
                    data-testid="planner-bubble-existing-chip"
                  >
                    {ref.label}
                  </button>
                  <button
                    className="chip-action"
                    onClick={() => onDeletePortalByRefId(ref.id)}
                    title="Delete bubble"
                    data-testid="planner-bubble-delete-chip-button"
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
                  data-testid="planner-bubble-selected-color-input"
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
