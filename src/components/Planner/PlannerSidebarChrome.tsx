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
  crossReferencesEnabled: boolean;
  mobileSidebarSection: MobileSidebarSection;
  children: ReactNode;
  onUndo: () => void;
  onRedo: () => void;
  onCloseMobileSidebar: () => void;
  onToggleSidebarCollapse: () => void;
  onSearchQueryChange: (value: string) => void;
  onOpenPalette: () => void;
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
  crossReferencesEnabled,
  mobileSidebarSection,
  children,
  onUndo,
  onRedo,
  onCloseMobileSidebar,
  onToggleSidebarCollapse,
  onSearchQueryChange,
  onOpenPalette,
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
              data-testid="planner-undo-button"
            >
              ↩
            </button>
            <button
              className="planner-undo-redo-btn"
              onClick={onRedo}
              disabled={!canRedo || busyAction}
              title={redoLabel ? `Redo: ${redoLabel}` : "Redo (⌘⇧Z)"}
              aria-label="Redo"
              data-testid="planner-redo-button"
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
          data-testid="planner-sidebar-toggle"
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
              data-testid="planner-search-input"
            />
            {searchMatchCount > 0 ? (
              <div className="planner-search-match">
                {searchMatchCount} match{searchMatchCount !== 1 ? "es" : ""} found
              </div>
            ) : null}
            <button className="planner-palette-launcher" onClick={onOpenPalette} data-testid="planner-command-palette-button">
              Command palette (Cmd/Ctrl+K) · Shortcuts (Cmd/Ctrl+?)
            </button>
          </div>

          {isMobileLayout ? (
            <div className="planner-mobile-section-tabs">
              <button
                className={mobileSidebarSection === "project" ? "active" : ""}
                onClick={() => onSetMobileSidebarSection("project")}
                data-testid="planner-mobile-tab-project"
              >
                Project
              </button>
              <button
                className={mobileSidebarSection === "node" ? "active" : ""}
                onClick={() => onSetMobileSidebarSection("node")}
                data-testid="planner-mobile-tab-node"
              >
                Node
              </button>
              {crossReferencesEnabled ? (
                <button
                  className={mobileSidebarSection === "bubbles" ? "active" : ""}
                  onClick={onOpenBubblesPanel}
                  data-testid="planner-mobile-tab-bubbles"
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
