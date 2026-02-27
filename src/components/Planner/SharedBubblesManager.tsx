import type { EntityType, CrossRef } from "../../types/planner";
import { ENTITY_TYPE_GROUPS } from "../../utils/plannerConfig";
import type { RefCategoryFilter, RefScopeFilter } from "../../hooks/usePlannerCrossRefUiState";

type LinkedNodeOption = {
  id: string;
  path: string;
};

type SharedBubblesManagerProps = {
  refs: CrossRef[];
  refScopeFilter: RefScopeFilter;
  onRefScopeFilterChange: (value: RefScopeFilter) => void;
  refCategoryFilter: RefCategoryFilter;
  onRefCategoryFilterChange: (value: RefCategoryFilter) => void;
  refSearchQuery: string;
  onRefSearchQueryChange: (value: string) => void;
  filteredRefs: CrossRef[];
  selectedNodeId: string | null;
  selectedNodeRefIds: Set<string>;
  busyAction: boolean;
  onSelectRefForEditing: (refId: string) => void;
  describeRefLibraryPreview: (ref: CrossRef) => string;
  onLinkCrossRefToNode: (refId: string, nodeId: string) => void;
  onDetachCrossRef: (refId: string, nodeId: string) => void;
  editRefId: string;
  editRefLabel: string;
  onEditRefLabelChange: (value: string) => void;
  editRefCode: string;
  onEditRefCodeChange: (value: string) => void;
  editRefType: EntityType;
  onEditRefTypeChange: (value: EntityType) => void;
  editRefTags: string;
  onEditRefTagsChange: (value: string) => void;
  editRefContact: string;
  onEditRefContactChange: (value: string) => void;
  editRefNotes: string;
  onEditRefNotesChange: (value: string) => void;
  editRefLinks: string;
  onEditRefLinksChange: (value: string) => void;
  onSaveCrossRefEdits: () => void;
  onDuplicateCrossRef: (refId: string) => void;
  linkNodeQuery: string;
  onLinkNodeQueryChange: (value: string) => void;
  linkTargetNodeId: string;
  onLinkTargetNodeIdChange: (value: string) => void;
  linkableNodeOptions: LinkedNodeOption[];
  onLinkNodeFromEdit: (refId: string, nodeId: string) => void;
  editableRefTargets: LinkedNodeOption[];
  onJumpToReferencedNode: (nodeId: string) => void;
  mergeCandidateRefs: CrossRef[];
  mergeFromRefId: string;
  onMergeFromRefIdChange: (value: string) => void;
  onMergeCrossRefIntoEdited: () => void;
  onDeleteCrossRefBubble: () => void;
};

export function SharedBubblesManager({
  refs,
  refScopeFilter,
  onRefScopeFilterChange,
  refCategoryFilter,
  onRefCategoryFilterChange,
  refSearchQuery,
  onRefSearchQueryChange,
  filteredRefs,
  selectedNodeId,
  selectedNodeRefIds,
  busyAction,
  onSelectRefForEditing,
  describeRefLibraryPreview,
  onLinkCrossRefToNode,
  onDetachCrossRef,
  editRefId,
  editRefLabel,
  onEditRefLabelChange,
  editRefCode,
  onEditRefCodeChange,
  editRefType,
  onEditRefTypeChange,
  editRefTags,
  onEditRefTagsChange,
  editRefContact,
  onEditRefContactChange,
  editRefNotes,
  onEditRefNotesChange,
  editRefLinks,
  onEditRefLinksChange,
  onSaveCrossRefEdits,
  onDuplicateCrossRef,
  linkNodeQuery,
  onLinkNodeQueryChange,
  linkTargetNodeId,
  onLinkTargetNodeIdChange,
  linkableNodeOptions,
  onLinkNodeFromEdit,
  editableRefTargets,
  onJumpToReferencedNode,
  mergeCandidateRefs,
  mergeFromRefId,
  onMergeFromRefIdChange,
  onMergeCrossRefIntoEdited,
  onDeleteCrossRefBubble,
}: SharedBubblesManagerProps) {
  return (
    <details className="planner-advanced-tools">
      <summary>Manage all bubbles ({refs.length})</summary>
      <div className="planner-advanced-tools-content">
        <p className="planner-subtle">
          Pick a bubble from the list, then use quick actions. Open advanced sections only when needed.
        </p>
        <div className="planner-filter-toggle">
          <button type="button" className={refScopeFilter === "view" ? "active" : ""} onClick={() => onRefScopeFilterChange("view")}>
            This view
          </button>
          <button type="button" className={refScopeFilter === "all" ? "active" : ""} onClick={() => onRefScopeFilterChange("all")}>
            All
          </button>
          <button
            type="button"
            className={refCategoryFilter === "people" ? "active" : ""}
            onClick={() => onRefCategoryFilterChange(refCategoryFilter === "people" ? "all" : "people")}
          >
            People
          </button>
        </div>
        <input
          value={refSearchQuery}
          onChange={(event) => onRefSearchQueryChange(event.target.value)}
          placeholder="Search bubbles..."
        />
        <div className="planner-reference-list">
          {filteredRefs.length === 0 ? (
            <span className="planner-subtle">
              {refs.length === 0 ? "No bubbles yet." : "No matches."}
            </span>
          ) : (
            filteredRefs.map((ref) => {
              const linkedOnSelected = selectedNodeId ? selectedNodeRefIds.has(ref.id) : false;
              const isEditing = editRefId === ref.id;
              return (
                <div key={ref.id} className={`planner-reference-item ${isEditing ? "is-active" : ""}`}>
                  <button onClick={() => onSelectRefForEditing(ref.id)}>{`${ref.code} — ${ref.label}`}</button>
                  <div className="planner-reference-actions">
                    <button
                      onClick={() => onSelectRefForEditing(ref.id)}
                      disabled={busyAction}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedNodeId) return;
                        if (linkedOnSelected) {
                          onDetachCrossRef(ref.id, selectedNodeId);
                        } else {
                          onLinkCrossRefToNode(ref.id, selectedNodeId);
                        }
                      }}
                      disabled={busyAction || !selectedNodeId}
                    >
                      {!selectedNodeId ? "Select node" : linkedOnSelected ? "Unlink" : "Link to selected"}
                    </button>
                  </div>
                  {isEditing ? (
                    <div className="planner-reference-preview">{describeRefLibraryPreview(ref)}</div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {editRefId ? (
          <>
            <div className="planner-row-label">
              Editing bubble: {editRefLabel || "—"}
            </div>
            <input
              value={editRefLabel}
              onChange={(event) => onEditRefLabelChange(event.target.value)}
              placeholder="Bubble name"
            />
            <div className="planner-inline-buttons">
              <input
                value={editRefCode}
                onChange={(event) => onEditRefCodeChange(event.target.value)}
                placeholder="Code"
                className="planner-flex-1"
              />
              <select
                value={editRefType}
                onChange={(event) => onEditRefTypeChange(event.target.value as EntityType)}
                className="planner-flex-1"
              >
                {ENTITY_TYPE_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((entityType) => (
                      <option key={entityType} value={entityType}>{entityType}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="planner-inline-buttons">
              <button onClick={onSaveCrossRefEdits} disabled={busyAction || editRefLabel.trim().length === 0}>
                Save
              </button>
              <button onClick={() => onDuplicateCrossRef(editRefId)} disabled={busyAction}>
                Duplicate
              </button>
            </div>

            <details className="planner-advanced-tools">
              <summary>Notes and metadata</summary>
              <div className="planner-advanced-tools-content">
                <input
                  value={editRefTags}
                  onChange={(event) => onEditRefTagsChange(event.target.value)}
                  placeholder="Tags (comma-separated)"
                />
                <input
                  value={editRefContact}
                  onChange={(event) => onEditRefContactChange(event.target.value)}
                  placeholder="Contact info"
                />
                <textarea
                  value={editRefNotes}
                  onChange={(event) => onEditRefNotesChange(event.target.value)}
                  placeholder="Notes"
                  rows={3}
                />
                <textarea
                  value={editRefLinks}
                  onChange={(event) => onEditRefLinksChange(event.target.value)}
                  placeholder="One URL per line"
                  rows={2}
                />
              </div>
            </details>

            <details className="planner-advanced-tools">
              <summary>Node links</summary>
              <div className="planner-advanced-tools-content">
                <div className="planner-row-label">Link to node</div>
                <input
                  value={linkNodeQuery}
                  onChange={(event) => onLinkNodeQueryChange(event.target.value)}
                  placeholder="Search node..."
                />
                <select value={linkTargetNodeId} onChange={(event) => onLinkTargetNodeIdChange(event.target.value)}>
                  <option value="">Choose node...</option>
                  {linkableNodeOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.path}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (!editRefId || !linkTargetNodeId) return;
                    onLinkNodeFromEdit(editRefId, linkTargetNodeId);
                  }}
                  disabled={busyAction || !linkTargetNodeId}
                >
                  Link node
                </button>

                <div className="planner-row-label">All linked nodes</div>
                <div className="planner-reference-list">
                  {editableRefTargets.length === 0 ? (
                    <span className="planner-subtle">Not linked to any node yet.</span>
                  ) : (
                    editableRefTargets.map((entry) => (
                      <div key={entry.id} className="planner-reference-target-item">
                        <button onClick={() => onJumpToReferencedNode(entry.id)}>{entry.path}</button>
                        <button className="danger" onClick={() => onDetachCrossRef(editRefId, entry.id)} disabled={busyAction}>
                          Unlink
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </details>

            <details className="planner-advanced-tools">
              <summary>Merge and delete</summary>
              <div className="planner-advanced-tools-content">
                {mergeCandidateRefs.length > 0 ? (
                  <>
                    <div className="planner-row-label">Merge duplicate</div>
                    <select value={mergeFromRefId} onChange={(event) => onMergeFromRefIdChange(event.target.value)}>
                      <option value="">Select duplicate...</option>
                      {mergeCandidateRefs.map((ref) => (
                        <option key={ref.id} value={ref.id}>{`${ref.code} — ${ref.label}`}</option>
                      ))}
                    </select>
                    <button onClick={onMergeCrossRefIntoEdited} disabled={busyAction || !mergeFromRefId}>
                      Merge into current
                    </button>
                  </>
                ) : null}

                <button className="danger" onClick={onDeleteCrossRefBubble} disabled={busyAction}>
                  Delete bubble
                </button>
              </div>
            </details>
          </>
        ) : (
          <p className="planner-subtle">Click a bubble above to edit it.</p>
        )}
      </div>
    </details>
  );
}
