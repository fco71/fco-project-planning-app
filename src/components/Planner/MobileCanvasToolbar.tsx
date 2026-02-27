import type { TreeNode } from "../../types/planner";

type MobileCanvasToolbarProps = {
  isMobileLayout: boolean;
  mobileToolbarOpen: boolean;
  selectedNodeId: string | null;
  selectedNode: TreeNode | null;
  crossReferencesEnabled: boolean;
  rootNodeId: string | null;
  currentRootHasParent: boolean;
  onToggleOpen: () => void;
  onOpenMenu: () => void;
  onOpenEditor: () => void;
  onOpenBubble: () => void;
  onAddChild: () => void;
  onToggleTaskStatus: () => void;
  onGoHome: () => void;
  onGoUp: () => void;
};

export function MobileCanvasToolbar({
  isMobileLayout,
  mobileToolbarOpen,
  selectedNodeId,
  selectedNode,
  crossReferencesEnabled,
  rootNodeId,
  currentRootHasParent,
  onToggleOpen,
  onOpenMenu,
  onOpenEditor,
  onOpenBubble,
  onAddChild,
  onToggleTaskStatus,
  onGoHome,
  onGoUp,
}: MobileCanvasToolbarProps) {
  if (!isMobileLayout) return null;

  return (
    <>
      <button
        type="button"
        className="planner-mobile-toolbar-launcher"
        aria-label={mobileToolbarOpen ? "Hide controls" : "Show controls"}
        onClick={onToggleOpen}
        data-testid="planner-mobile-toolbar-launcher"
      >
        {mobileToolbarOpen ? "×" : "☰"}
      </button>
      {mobileToolbarOpen ? (
        <div className="planner-mobile-toolbar" data-testid="planner-mobile-toolbar">
          <button onClick={onOpenMenu} data-testid="planner-mobile-toolbar-menu">
            ☰ Menu
          </button>
          <button onClick={onOpenEditor} disabled={!selectedNode} data-testid="planner-mobile-toolbar-edit">
            Edit
          </button>
          {crossReferencesEnabled ? (
            <button onClick={onOpenBubble} disabled={!selectedNodeId} data-testid="planner-mobile-toolbar-bubble">
              ◯ Bubble
            </button>
          ) : null}
          <button onClick={onAddChild} disabled={!selectedNodeId} data-testid="planner-mobile-toolbar-add-child">
            ＋ Child
          </button>
          <button
            onClick={onToggleTaskStatus}
            disabled={!selectedNode || selectedNode.kind === "root"}
            data-testid="planner-mobile-toolbar-toggle-task"
          >
            {selectedNode?.taskStatus === "done" ? "↩ Todo" : "✓ Done"}
          </button>
          <button onClick={onGoHome} disabled={!rootNodeId} data-testid="planner-mobile-toolbar-home">
            ⌂ Home
          </button>
          <button onClick={onGoUp} disabled={!currentRootHasParent} data-testid="planner-mobile-toolbar-up">
            ↑ Up
          </button>
        </div>
      ) : null}
    </>
  );
}
