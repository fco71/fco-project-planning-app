import type { CrossRef } from "../../types/planner";

type PortalContextMenuState = {
  x: number;
  y: number;
  refId: string;
} | null;

type PortalContextMenuProps = {
  contextMenu: PortalContextMenuState;
  refs: CrossRef[];
  busy: boolean;
  onDelete: (refId: string) => void;
  onClose: () => void;
};

export function PortalContextMenu({
  contextMenu,
  refs,
  busy,
  onDelete,
  onClose,
}: PortalContextMenuProps) {
  if (!contextMenu) return null;
  const menuRef = refs.find((entry) => entry.id === contextMenu.refId);

  return (
    <div
      data-portal-context-menu
      className="portal-context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      {menuRef ? (
        <div className="portal-context-menu__header">
          {menuRef.label} ({menuRef.code})
        </div>
      ) : null}

      <button
        type="button"
        className="portal-context-menu__action portal-context-menu__action--danger"
        onClick={() => onDelete(contextMenu.refId)}
        disabled={busy}
      >
        <span className="portal-context-menu__icon">🗑</span>
        {busy ? "Deleting…" : "Delete bubble"}
      </button>

      <button
        type="button"
        className="portal-context-menu__action portal-context-menu__action--muted"
        onClick={onClose}
      >
        Cancel
      </button>
    </div>
  );
}
