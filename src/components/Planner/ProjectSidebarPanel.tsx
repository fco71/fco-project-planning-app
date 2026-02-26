import type { NodeKind } from "../../types/planner";

type ProjectPage = {
  id: string;
  title: string;
};

type ProjectSidebarPanelProps = {
  profileName: string;
  userEmail?: string | null;
  currentRootPath: string;
  currentRootId: string | null;
  rootNodeId: string | null;
  projectPages: ProjectPage[];
  activeProjectPageId: string;
  activeProjectPageIndex: number;
  selectedNodeId: string | null;
  selectedNodeKind?: NodeKind;
  currentRootHasParent: boolean;
  currentRootKind?: NodeKind | null;
  storyLaneMode: boolean;
  busyAction: boolean;
  visibleTreeCount: number;
  crossReferencesEnabled: boolean;
  bubblesSimplifiedMode: boolean;
  newChildTitle: string;
  canCreateChild: boolean;
  onNewChildTitleChange: (value: string) => void;
  onGoPrevProjectPage: () => void;
  onGoNextProjectPage: () => void;
  onOpenProjectPage: (projectId: string) => void;
  onGoGrandmotherView: () => void;
  onGoUpOneView: () => void;
  onOpenSelectedAsMaster: () => void;
  onOpenSelectedAsStoryLane: () => void;
  onToggleStoryLaneMode: () => void;
  onOrganizeVisibleTree: () => void;
  onOrganizeSelectedBranch: () => void;
  onCleanUpCrossRefs: () => void;
  onCreateChild: () => void;
};

export function ProjectSidebarPanel({
  profileName,
  userEmail,
  currentRootPath,
  currentRootId,
  rootNodeId,
  projectPages,
  activeProjectPageId,
  activeProjectPageIndex,
  selectedNodeId,
  selectedNodeKind,
  currentRootHasParent,
  currentRootKind,
  storyLaneMode,
  busyAction,
  visibleTreeCount,
  crossReferencesEnabled,
  bubblesSimplifiedMode,
  newChildTitle,
  canCreateChild,
  onNewChildTitleChange,
  onGoPrevProjectPage,
  onGoNextProjectPage,
  onOpenProjectPage,
  onGoGrandmotherView,
  onGoUpOneView,
  onOpenSelectedAsMaster,
  onOpenSelectedAsStoryLane,
  onToggleStoryLaneMode,
  onOrganizeVisibleTree,
  onOrganizeSelectedBranch,
  onCleanUpCrossRefs,
  onCreateChild,
}: ProjectSidebarPanelProps) {
  return (
    <>
      <div id="project-overview-panel" className="planner-panel-block">
        <h2>{profileName || "Main Node"}</h2>
        <p className="planner-subtle">{userEmail || ""}</p>
        <p className="planner-subtle">
          Current view: <strong>{currentRootPath || "No selection"}</strong>
        </p>
        {currentRootId && rootNodeId && currentRootId !== rootNodeId ? (
          <p className="planner-subtle">Isolated view active. Use “Back to main workspace” to return.</p>
        ) : null}
        <div className="planner-row-label">Project pages</div>
        {projectPages.length === 0 ? (
          <p className="planner-subtle">No top-level project pages yet.</p>
        ) : (
          <>
            <div className="planner-inline-buttons">
              <button onClick={onGoPrevProjectPage} disabled={projectPages.length < 2}>
                Previous project
              </button>
              <button onClick={onGoNextProjectPage} disabled={projectPages.length < 2}>
                Next project
              </button>
            </div>
            <select
              value={activeProjectPageId}
              onChange={(event) => {
                if (!event.target.value) return;
                onOpenProjectPage(event.target.value);
              }}
            >
              {activeProjectPageId === "" ? <option value="">Select a project page</option> : null}
              {projectPages.map((project, index) => (
                <option key={project.id} value={project.id}>
                  {`${index + 1}. ${project.title}`}
                </option>
              ))}
            </select>
            <p className="planner-subtle">
              {activeProjectPageIndex >= 0
                ? `Page ${activeProjectPageIndex + 1} of ${projectPages.length} — URL keeps this page.`
                : "You are outside top-level project pages. Pick one above to normalize."}
            </p>
          </>
        )}
        <div className="planner-inline-buttons">
          <button onClick={onGoGrandmotherView} disabled={!rootNodeId} title="Return to your full workspace root">
            Back to main workspace
          </button>
          <button onClick={onGoUpOneView} disabled={!currentRootHasParent} title="Move one level up from the current view">
            Parent view
          </button>
        </div>
        <p className="planner-subtle">Back to main workspace returns to the root. Parent view moves one level up.</p>
        <button onClick={onOpenSelectedAsMaster} disabled={!selectedNodeId}>
          Open selected as master
        </button>
        <div className="planner-inline-buttons">
          <button onClick={onOpenSelectedAsStoryLane} disabled={!selectedNodeId || selectedNodeKind !== "story"}>
            Open selected in story lane
          </button>
          <button onClick={onToggleStoryLaneMode} disabled={currentRootKind !== "story"}>
            {storyLaneMode ? "Story lane: on" : "Story lane: off"}
          </button>
        </div>
        <div className="planner-row-label">Quick maintenance</div>
        <div className="planner-inline-buttons">
          <button onClick={onOrganizeVisibleTree} disabled={busyAction || visibleTreeCount === 0}>
            Clean up visible tree
          </button>
          <button onClick={onOrganizeSelectedBranch} disabled={busyAction || !selectedNodeId}>
            Clean up selected branch
          </button>
          {crossReferencesEnabled && !bubblesSimplifiedMode ? (
            <button onClick={onCleanUpCrossRefs} disabled={busyAction}>
              Clean stale bubbles
            </button>
          ) : null}
        </div>
      </div>

      <div className="planner-panel-block">
        <h3>Add Child Node</h3>
        <p className="planner-subtle">Leave blank to create a default node name and rename immediately.</p>
        <input
          value={newChildTitle}
          onChange={(event) => onNewChildTitleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (busyAction) return;
            onCreateChild();
          }}
          placeholder="Film Production, Education, Finance..."
        />
        <button
          onClick={onCreateChild}
          disabled={busyAction || !canCreateChild}
        >
          Add child
        </button>
      </div>
    </>
  );
}
