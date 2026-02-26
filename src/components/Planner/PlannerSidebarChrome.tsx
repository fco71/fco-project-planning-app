import type { ReactNode, RefObject } from "react";

type MobileSidebarSection = "project" | "node" | "bubbles";

type PlannerSidebarChromeProps = {
  sidebarIsCollapsed: boolean;
  isMobileLayout: boolean;
  canUndo: boolean;
  canRedo: boolean;
  busyAction: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  searchMatchCount: number;
  selectedNodeId: string | null;
  crossReferencesEnabled: boolean;
  bubblesSimplifiedMode: boolean;
  mobileSidebarSection: MobileSidebarSection;
  children: ReactNode;
  onUndo: () => void;
  onRedo: () => void;
  onCloseMobileSidebar: () => void;
  onToggleSidebarCollapse: () => void;
  onSearchQueryChange: (value: string) => void;
  onOpenPalette: () => void;
  onOrganizeSelectedBranch: () => void;
  onCleanUpCrossRefs: () => void;
  onSetMobileSidebarSection: (section: MobileSidebarSection) => void;
  onOpenBubblesPanel: () => void;
};

export function PlannerSidebarChrome({
  sidebarIsCollapsed,
  isMobileLayout,
  canUndo,
  canRedo,
  busyAction,
  undoLabel,
  redoLabel,
  searchInputRef,
  searchQuery,
  searchMatchCount,
  selectedNodeId,
  crossReferencesEnabled,
  bubblesSimplifiedMode,
  mobileSidebarSection,
  children,
  onUndo,
  onRedo,
  onCloseMobileSidebar,
  onToggleSidebarCollapse,
  onSearchQueryChange,
  onOpenPalette,
  onOrganizeSelectedBranch,
  onCleanUpCrossRefs,
  onSetMobileSidebarSection,
  onOpenBubblesPanel,
}: PlannerSidebarChromeProps) {
  return (
    <>
      <div className="planner-sidebar-header">
        {!sidebarIsCollapsed ? (
          <div className="planner-undo-redo-btns">
            <button
              className="planner-undo-redo-btn"
              onClick={onUndo}
              disabled={!canUndo || busyAction}
              title={undoLabel ? `Undo: ${undoLabel}` : "Undo (⌘Z)"}
              aria-label="Undo"
            >
              ↩
            </button>
            <button
              className="planner-undo-redo-btn"
              onClick={onRedo}
              disabled={!canRedo || busyAction}
              title={redoLabel ? `Redo: ${redoLabel}` : "Redo (⌘⇧Z)"}
              aria-label="Redo"
            >
              ↪
            </button>
          </div>
        ) : null}
        <button
          onClick={() => {
            if (isMobileLayout) {
              onCloseMobileSidebar();
              return;
            }
            onToggleSidebarCollapse();
          }}
          className="planner-sidebar-toggle"
          aria-label={isMobileLayout ? "Close controls" : sidebarIsCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isMobileLayout ? "✕" : sidebarIsCollapsed ? "→" : "←"}
        </button>
      </div>

      {sidebarIsCollapsed ? (
        <div className="planner-collapsed-controls">
          <div className="planner-collapsed-controls-label">
            Controls
          </div>
        </div>
      ) : (
        <>
          <div className="planner-search-wrap">
            <input
              className="planner-search-input"
              ref={searchInputRef}
              type="text"
              placeholder={isMobileLayout ? "Search nodes..." : "Search nodes... (Ctrl+F)"}
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
            />
            {searchMatchCount > 0 ? (
              <div className="planner-search-match">
                {searchMatchCount} match{searchMatchCount !== 1 ? "es" : ""} found
              </div>
            ) : null}
            <button className="planner-palette-launcher" onClick={onOpenPalette}>
              Command palette (Cmd/Ctrl+K)
            </button>
            {!isMobileLayout ? (
              <div className="planner-top-actions">
                <button onClick={onOrganizeSelectedBranch} disabled={busyAction || !selectedNodeId}>
                  Clean up selected branch
                </button>
                {crossReferencesEnabled && !bubblesSimplifiedMode ? (
                  <button onClick={onCleanUpCrossRefs} disabled={busyAction}>
                    Clean stale bubbles
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {isMobileLayout ? (
            <div className="planner-mobile-section-tabs">
              <button
                className={mobileSidebarSection === "project" ? "active" : ""}
                onClick={() => onSetMobileSidebarSection("project")}
              >
                Project
              </button>
              <button
                className={mobileSidebarSection === "node" ? "active" : ""}
                onClick={() => onSetMobileSidebarSection("node")}
              >
                Node
              </button>
              {crossReferencesEnabled ? (
                <button
                  className={mobileSidebarSection === "bubbles" ? "active" : ""}
                  onClick={onOpenBubblesPanel}
                >
                  Bubbles
                </button>
              ) : null}
            </div>
          ) : null}

          {children}
        </>
      )}
    </>
  );
}
