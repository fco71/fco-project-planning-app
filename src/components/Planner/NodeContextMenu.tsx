import { useEffect, useRef } from "react";
import type { NodeKind } from "../../utils/treeUtils";

type TaskStatus = "none" | "todo" | "done";

type ContextMenuProps = {
  x: number;
  y: number;
  nodeId: string;
  nodeTitle: string;
  nodeKind: NodeKind;
  taskStatus: TaskStatus;
  hasChildren: boolean;
  onClose: () => void;
  onAddChild: (nodeId: string) => void;
  onAddStorySibling: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onRename: (nodeId: string) => void;
  onAddCrossRef?: (nodeId: string) => void;
  onChangeType: (nodeId: string, nextKind?: NodeKind) => void;
  onToggleTaskStatus: (nodeId: string) => void;
};

export function NodeContextMenu({
  x,
  y,
  nodeId,
  nodeTitle,
  nodeKind,
  taskStatus,
  hasChildren,
  onClose,
  onAddChild,
  onAddStorySibling,
  onDelete,
  onDuplicate,
  onRename,
  onAddCrossRef,
  onChangeType,
  onToggleTaskStatus,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Close on escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu on screen
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    if (x + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 10;
    }

    if (y + rect.height > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 10;
    }

    menuRef.current.style.left = `${adjustedX}px`;
    menuRef.current.style.top = `${adjustedY}px`;
  }, [x, y]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const taskAction = taskStatus === "done" ? "Mark Task Todo" : "Mark Task Done";
  const addLabel = nodeKind === "story" ? "Add Story Sibling" : "Add Child Node";
  const addAction = nodeKind === "story" ? onAddStorySibling : onAddChild;
  const addIcon = nodeKind === "story" ? "↳" : "+";
  const typeTargets: Array<{ kind: Exclude<NodeKind, "root">; label: string; icon: string }> = [
    { kind: "project", label: "Project", icon: "▣" },
    { kind: "item", label: "Item", icon: "◦" },
    { kind: "story", label: "Story", icon: "✦" },
  ];

  return (
    <div
      ref={menuRef}
      className="ctx-menu"
      style={{ left: x, top: y }}
    >
      <div className="ctx-menu-header">
        {nodeTitle}
      </div>

      <div className="ctx-menu-items">
        <MenuItem
          icon={addIcon}
          label={addLabel}
          onClick={() => handleAction(() => addAction(nodeId))}
        />
        <MenuItem
          icon="⎘"
          label="Duplicate Node"
          onClick={() => handleAction(() => onDuplicate(nodeId))}
        />
        <MenuItem
          icon="✎"
          label="Rename Node"
          onClick={() => handleAction(() => onRename(nodeId))}
        />
        {onAddCrossRef ? (
          <MenuItem
            icon="🔗"
            label="Add / Manage Bubbles"
            onClick={() => handleAction(() => onAddCrossRef(nodeId))}
          />
        ) : null}
        {typeTargets.map((typeTarget) => (
          <MenuItem
            key={`type:${typeTarget.kind}`}
            icon={typeTarget.icon}
            label={nodeKind === typeTarget.kind ? `Type: ${typeTarget.label}` : `Set as ${typeTarget.label}`}
            onClick={() => handleAction(() => onChangeType(nodeId, typeTarget.kind))}
            disabled={nodeKind === "root" || nodeKind === typeTarget.kind}
            title={
              nodeKind === "root"
                ? "Root node type cannot be changed"
                : nodeKind === typeTarget.kind
                  ? `Already ${typeTarget.label.toLowerCase()}`
                  : undefined
            }
          />
        ))}
        <MenuItem
          icon="☑"
          label={taskAction}
          onClick={() => handleAction(() => onToggleTaskStatus(nodeId))}
          disabled={nodeKind === "root"}
          title={nodeKind === "root" ? "Root node cannot be a task" : undefined}
        />

        <div className="ctx-menu-separator" />

        <MenuItem
          icon="🗑"
          label="Delete Node"
          onClick={() => handleAction(() => onDelete(nodeId))}
          danger
          disabled={hasChildren}
          title={hasChildren ? "Cannot delete node with children" : undefined}
        />
      </div>
    </div>
  );
}

type MenuItemProps = {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
};

function MenuItem({ icon, label, onClick, danger, disabled, title }: MenuItemProps) {
  const className = [
    "ctx-menu-item",
    danger ? "ctx-menu-item--danger" : "",
    disabled ? "ctx-menu-item--disabled" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={className}
    >
      <span className="ctx-menu-item-icon">{icon}</span>
      <span className="ctx-menu-item-label">{label}</span>
    </button>
  );
}
