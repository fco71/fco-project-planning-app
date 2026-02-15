// src/components/Planner/PlannerSidebar.tsx
import React, { useEffect, useState } from "react";

type PlannerSidebarProps = {
  children: React.ReactNode;
  hasError: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

/**
 * PlannerSidebar - Collapsible sidebar wrapper with full and compact modes.
 * Persists collapse state to localStorage.
 */
export default function PlannerSidebar({ children, hasError, onCollapsedChange }: PlannerSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("planner-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("planner-sidebar-collapsed", String(collapsed));
      onCollapsedChange?.(collapsed);
    } catch {
      // Ignore localStorage errors
    }
  }, [collapsed, onCollapsedChange]);

  const toggleCollapse = () => setCollapsed((prev) => !prev);

  return (
    <aside className={`planner-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="planner-sidebar-header">
        <button
          onClick={toggleCollapse}
          className="planner-sidebar-toggle"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "→" : "←"}
        </button>
        {hasError && <div className="planner-sidebar-error-badge" title="Error present" />}
      </div>

      {!collapsed && <div className="planner-sidebar-content">{children}</div>}

      {collapsed && (
        <div className="planner-sidebar-compact">
          <div className="planner-compact-hint" title="Expand sidebar to access all controls">
            Controls
          </div>
        </div>
      )}
    </aside>
  );
}
