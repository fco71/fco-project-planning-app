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
      >
        {mobileToolbarOpen ? "×" : "☰"}
      </button>
      {mobileToolbarOpen ? (
        <div className="planner-mobile-toolbar">
          <button onClick={onOpenMenu}>
            ☰ Menu
          </button>
          <button onClick={onOpenEditor} disabled={!selectedNode}>
            Edit
          </button>
          {crossReferencesEnabled ? (
            <button onClick={onOpenBubble} disabled={!selectedNodeId}>
              ◯ Bubble
            </button>
          ) : null}
          <button onClick={onAddChild} disabled={!selectedNodeId}>
            ＋ Child
          </button>
          <button onClick={onToggleTaskStatus} disabled={!selectedNode || selectedNode.kind === "root"}>
            {selectedNode?.taskStatus === "done" ? "↩ Todo" : "✓ Done"}
          </button>
          <button onClick={onGoHome} disabled={!rootNodeId}>
            ⌂ Home
          </button>
          <button onClick={onGoUp} disabled={!currentRootHasParent}>
            ↑ Up
          </button>
        </div>
      ) : null}
    </>
  );
}
