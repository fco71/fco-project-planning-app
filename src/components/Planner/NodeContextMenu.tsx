import React, { useEffect, useRef } from "react";

type ContextMenuProps = {
  x: number;
  y: number;
  nodeId: string;
  nodeTitle: string;
  hasChildren: boolean;
  onClose: () => void;
  onAddChild: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onAddCrossRef: (nodeId: string) => void;
  onChangeType: (nodeId: string) => void;
};

export function NodeContextMenu({
  x,
  y,
  nodeId,
  nodeTitle,
  hasChildren,
  onClose,
  onAddChild,
  onDelete,
  onDuplicate,
  onAddCrossRef,
  onChangeType,
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

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 9999,
        background: "rgba(20, 26, 38, 0.98)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: "8px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)",
        minWidth: "200px",
        padding: "4px",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          fontSize: "12px",
          color: "rgba(255, 255, 255, 0.5)",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {nodeTitle}
      </div>

      {/* Menu Items */}
      <div style={{ padding: "4px 0" }}>
        <MenuItem
          icon="+"
          label="Add Child Node"
          onClick={() => handleAction(() => onAddChild(nodeId))}
        />
        <MenuItem
          icon="⎘"
          label="Duplicate Node"
          onClick={() => handleAction(() => onDuplicate(nodeId))}
        />
        <MenuItem
          icon="🔗"
          label="Add Cross-Reference"
          onClick={() => handleAction(() => onAddCrossRef(nodeId))}
        />
        <MenuItem
          icon="⚙"
          label="Change Type"
          onClick={() => handleAction(() => onChangeType(nodeId))}
        />

        <div
          style={{
            height: "1px",
            background: "rgba(255, 255, 255, 0.1)",
            margin: "4px 8px",
          }}
        />

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
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 12px",
        border: "none",
        background: "transparent",
        color: danger
          ? disabled
            ? "rgba(248, 113, 113, 0.3)"
            : "rgba(248, 113, 113, 0.9)"
          : disabled
            ? "rgba(245, 248, 255, 0.3)"
            : "rgba(245, 248, 255, 0.94)",
        fontSize: "14px",
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        borderRadius: "6px",
        transition: "background 120ms ease",
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background = danger
            ? "rgba(248, 113, 113, 0.12)"
            : "rgba(255, 255, 255, 0.08)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}
