import type { RefObject } from "react";
import type { CrossRef, EntityType, TreeNode } from "../../types/planner";
import { ENTITY_TYPE_GROUPS } from "../../utils/plannerConfig";
import { buildNodePath, initialsFromLabel, normalizeCode } from "../../utils/treeUtils";

type SharedBubblesTopPanelProps = {
  refs: CrossRef[];
  selectedNode: TreeNode | null | undefined;
  selectedNodeId: string | null;
  selectedNodeRefs: CrossRef[];
  nodesById: Map<string, TreeNode>;
  activePortalRef: CrossRef | null;
  activePortalTargets: TreeNode[];
  busyAction: boolean;
  canCreateBubbleFromInput: boolean;
  newRefLabelInputRef: RefObject<HTMLInputElement | null>;
  newRefLabel: string;
  onNewRefLabelChange: (value: string) => void;
  newRefCode: string;
  onNewRefCodeChange: (value: string) => void;
  newRefType: EntityType;
  onNewRefTypeChange: (value: EntityType) => void;
  newRefSuggestions: CrossRef[];
  onCreateCrossRef: () => Promise<void>;
  describeRefTargets: (ref: CrossRef, limit?: number) => string;
  onLinkCrossRefToNode: (refId: string, nodeId: string) => Promise<void> | void;
  onSelectRefForEditing: (refId: string) => void;
  onDetachCrossRef: (refId: string, nodeId: string) => Promise<void> | void;
  onJumpToReferencedNode: (nodeId: string) => void;
};

export function SharedBubblesTopPanel({
  refs,
  selectedNode,
  selectedNodeId,
  selectedNodeRefs,
  nodesById,
  activePortalRef,
  activePortalTargets,
  busyAction,
  canCreateBubbleFromInput,
  newRefLabelInputRef,
  newRefLabel,
  onNewRefLabelChange,
  newRefCode,
  onNewRefCodeChange,
  newRefType,
  onNewRefTypeChange,
  newRefSuggestions,
  onCreateCrossRef,
  describeRefTargets,
  onLinkCrossRefToNode,
  onSelectRefForEditing,
  onDetachCrossRef,
  onJumpToReferencedNode,
}: SharedBubblesTopPanelProps) {
  const typedCode = newRefCode.trim() ? normalizeCode(newRefCode) : (newRefLabel.trim() ? initialsFromLabel(newRefLabel) : "");
  const codeCollisions = typedCode ? refs.filter((ref) => ref.code === typedCode) : [];

  return (
    <>
      <h3>Bubbles</h3>
      <p className="planner-subtle">
        Shared entities across branches — vendor, partner, person, etc.
      </p>

      <div className="planner-row-label">
        {selectedNode ? `Attach to: ${selectedNode.title}` : "Select a node to attach"}
      </div>
      <input
        ref={newRefLabelInputRef}
        value={newRefLabel}
        onChange={(event) => onNewRefLabelChange(event.target.value)}
        placeholder="Name (e.g., Mario Pinto, ACME Corp)"
      />
      <div className="planner-inline-buttons">
        <input
          value={newRefCode}
          onChange={(event) => onNewRefCodeChange(event.target.value)}
          placeholder="Code (e.g., MP)"
          className="planner-flex-1"
        />
        <select value={newRefType} onChange={(event) => onNewRefTypeChange(event.target.value as EntityType)} className="planner-flex-1">
          {ENTITY_TYPE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {entityType}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {codeCollisions.length > 0 ? (
        <p className="planner-code-collision-warn">
          ⚠ Code <strong>{typedCode}</strong> already used by:{" "}
          {codeCollisions.map((ref) => ref.label).join(", ")}. Consider a longer code (e.g. <em>MPinto</em> vs <em>MPérez</em>).
        </p>
      ) : null}
      <button
        onClick={() => {
          void onCreateCrossRef();
        }}
        disabled={busyAction || !selectedNodeId || !canCreateBubbleFromInput}
      >
        Create and attach to selected
      </button>

      {newRefSuggestions.length > 0 ? (
        <>
          <div className="planner-row-label">Or attach existing</div>
          <div className="planner-chip-list">
            {newRefSuggestions.map((ref) => (
              <button
                key={ref.id}
                className="chip"
                onClick={() => {
                  if (!selectedNodeId) return;
                  void onLinkCrossRefToNode(ref.id, selectedNodeId);
                }}
                title={describeRefTargets(ref, 4)}
              >
                {`${ref.code} — ${ref.label}`}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="planner-row-label">On selected node</div>
      <div className="planner-chip-list">
        {selectedNodeRefs.length === 0 || !selectedNodeId ? (
          <span className="planner-subtle">None attached.</span>
        ) : (
          selectedNodeRefs.map((ref) => (
            <div key={ref.id} className="chip with-action">
              <button onClick={() => onSelectRefForEditing(ref.id)} title={describeRefTargets(ref, 4)}>
                {`${ref.code} — ${ref.label}`}
              </button>
              <button
                className="chip-action"
                onClick={() => {
                  void onDetachCrossRef(ref.id, selectedNodeId);
                }}
                title="Detach from selected node"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {activePortalRef ? (
        <div className="planner-panel-block planner-panel-block-tight">
          <div className="planner-bubble-active-title">
            {`${activePortalRef.code} — ${activePortalRef.label}`}
            <span className="planner-kind-badge planner-kind-badge-inline">{activePortalRef.entityType}</span>
          </div>
          {activePortalRef.contact ? <p className="planner-subtle planner-subtle-tight">{activePortalRef.contact}</p> : null}
          {activePortalRef.notes ? <p className="planner-subtle planner-subtle-tight">{activePortalRef.notes}</p> : null}
          {activePortalRef.links.length > 0 ? (
            <div className="planner-bubble-links-wrap">
              {activePortalRef.links.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="planner-bubble-link">
                  {url}
                </a>
              ))}
            </div>
          ) : null}
          <div className="planner-row-label planner-row-label-mt-6">Linked nodes</div>
          <div className="planner-reference-list">
            {activePortalTargets.map((target) => (
              <button key={target.id} onClick={() => onJumpToReferencedNode(target.id)}>
                {buildNodePath(target.id, nodesById)}
              </button>
            ))}
          </div>
          <div className="planner-inline-buttons planner-inline-buttons-mt-6">
            <button
              onClick={() => {
                if (!selectedNodeId) return;
                if (activePortalRef.nodeIds.includes(selectedNodeId)) {
                  void onDetachCrossRef(activePortalRef.id, selectedNodeId);
                } else {
                  void onLinkCrossRefToNode(activePortalRef.id, selectedNodeId);
                }
              }}
              disabled={busyAction || !selectedNodeId}
            >
              {!selectedNodeId ? "Select node" : activePortalRef.nodeIds.includes(selectedNodeId) ? "Unlink selected" : "Link to selected"}
            </button>
            <button
              onClick={() => {
                onSelectRefForEditing(activePortalRef.id);
              }}
              disabled={busyAction}
            >
              Edit bubble
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
