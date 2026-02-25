// src/components/sections/CrossRefPanel.tsx
import { useState } from "react";
import type { TreeNode } from "../../utils/treeUtils";

type CrossRef = {
  id: string;
  label: string;
  code: string;
  nodeIds: string[];
};

type CrossRefPanelProps = {
  selectedNodeId: string | null;
  refs: CrossRef[];
  nodes: Map<string, TreeNode>;
  busyAction: boolean;
  newRefLabel: string;
  setNewRefLabel: (value: string) => void;
  newRefCode: string;
  setNewRefCode: (value: string) => void;
  createCrossRef: () => void;
  attachCrossRefToNode: (refId: string) => Promise<void>;
  detachCrossRef: (refId: string, nodeId: string) => void;
  setActivePortalRefId: (id: string | null) => void;
  buildNodePath: (nodeId: string, nodes: Map<string, TreeNode>) => string;
};

export default function CrossRefPanel({
  selectedNodeId,
  refs,
  nodes,
  busyAction,
  newRefLabel,
  setNewRefLabel,
  newRefCode,
  setNewRefCode,
  createCrossRef,
  attachCrossRefToNode,
  detachCrossRef,
  setActivePortalRefId,
  buildNodePath,
}: CrossRefPanelProps) {
  const [expandedRefId, setExpandedRefId] = useState<string | null>(null);

  return (
    <div className="planner-panel-block crossref-panel">
      <h3>🔗 Cross-Reference Bubbles</h3>
      <p className="planner-subtle">
        Create reusable bubbles for shared entities (investors, team members, resources).
      </p>

      {/* Create new bubble */}
      <div className="crossref-create-section">
        <input
          value={newRefLabel}
          onChange={(event) => setNewRefLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && newRefLabel.trim().length > 0 && selectedNodeId && !busyAction) {
              event.preventDefault();
              createCrossRef();
            }
          }}
          placeholder="New bubble name (e.g., Vendor A)"
        />
        <input
          value={newRefCode}
          onChange={(event) => setNewRefCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && newRefLabel.trim().length > 0 && selectedNodeId && !busyAction) {
              event.preventDefault();
              createCrossRef();
            }
          }}
          placeholder="Code (optional, e.g., VA)"
        />
        <button
          onClick={createCrossRef}
          disabled={busyAction || !selectedNodeId || newRefLabel.trim().length === 0}
          title={!selectedNodeId ? "Select a node first" : "Create and attach to selected node"}
          className={!selectedNodeId ? "disabled-hint" : ""}
        >
          {selectedNodeId ? "✨ Create & Attach" : "👆 Select a node first"}
        </button>
      </div>

      {/* Show all bubbles */}
      {refs.length > 0 && (
        <div className="crossref-list-section">
          <div className="planner-row-label">All Bubbles ({refs.length})</div>
          <div className="crossref-bubble-list">
            {refs.map((ref) => {
              const isExpanded = expandedRefId === ref.id;
              const isOnSelectedNode = selectedNodeId && ref.nodeIds.includes(selectedNodeId);

              return (
                <div key={ref.id} className={`crossref-bubble-item ${isOnSelectedNode ? 'attached' : ''}`}>
                  <div className="crossref-bubble-header">
                    <button
                      className="crossref-bubble-name"
                      onClick={() => setActivePortalRefId(ref.id)}
                      title="View all locations"
                    >
                      <span className="crossref-code">{ref.code}</span>
                      <span className="crossref-label">{ref.label}</span>
                      <span className="crossref-count">({ref.nodeIds.length})</span>
                    </button>

                    <div className="crossref-bubble-actions">
                      {isOnSelectedNode ? (
                        <button
                          className="crossref-action-detach"
                          onClick={() => selectedNodeId && detachCrossRef(ref.id, selectedNodeId)}
                          disabled={busyAction}
                          title="Detach from selected node"
                        >
                          ✓ Attached
                        </button>
                      ) : selectedNodeId ? (
                        <button
                          className="crossref-action-attach"
                          onClick={() => attachCrossRefToNode(ref.id)}
                          disabled={busyAction}
                          title="Attach to selected node"
                        >
                          + Attach
                        </button>
                      ) : null}

                      <button
                        className="crossref-action-expand"
                        onClick={() => setExpandedRefId(isExpanded ? null : ref.id)}
                        title={isExpanded ? "Collapse" : "Show attached nodes"}
                      >
                        {isExpanded ? "▼" : "▶"}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="crossref-bubble-nodes">
                      {ref.nodeIds.length === 0 ? (
                        <span className="planner-subtle">📌 Not attached to any nodes yet</span>
                      ) : (
                        ref.nodeIds.map((nodeId) => {
                          const node = nodes.get(nodeId);
                          if (!node) return null;
                          return (
                            <div key={nodeId} className="crossref-node-item">
                              <span className="crossref-node-path">
                                {buildNodePath(nodeId, nodes)}
                              </span>
                              <button
                                className="crossref-node-remove"
                                onClick={() => detachCrossRef(ref.id, nodeId)}
                                disabled={busyAction}
                                title="Detach"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!selectedNodeId && (
        <p className="planner-subtle" style={{ marginTop: '12px', fontStyle: 'italic' }}>
          💡 Tip: Click on a node in the tree to create or attach bubbles
        </p>
      )}
    </div>
  );
}
