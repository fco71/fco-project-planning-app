import type { ComponentProps } from "react";
import { PlannerCanvasSurface } from "./PlannerCanvasSurface";
import { PlannerMobilePanels } from "./PlannerMobilePanels";
import { PlannerSidebarChrome } from "./PlannerSidebarChrome";
import { PlannerSidebarPanels } from "./PlannerSidebarPanels";

type PlannerWorkspaceLayoutProps = {
  sidebarIsCollapsed: boolean;
  isMobileLayout: boolean;
  mobileSidebarOpen: boolean;
  sidebarChromeProps: Omit<ComponentProps<typeof PlannerSidebarChrome>, "children">;
  sidebarPanelsProps: ComponentProps<typeof PlannerSidebarPanels>;
  mobilePanelsProps: ComponentProps<typeof PlannerMobilePanels>;
  canvasSurfaceProps: ComponentProps<typeof PlannerCanvasSurface>;
};

export function PlannerWorkspaceLayout({
  sidebarIsCollapsed,
  isMobileLayout,
  mobileSidebarOpen,
  sidebarChromeProps,
  sidebarPanelsProps,
  mobilePanelsProps,
  canvasSurfaceProps,
}: PlannerWorkspaceLayoutProps) {
  return (
    <div
      className={`planner-shell ${sidebarIsCollapsed ? "sidebar-collapsed" : ""} ${isMobileLayout ? "mobile" : ""}`}
      data-testid="planner-shell"
    >
      <aside
        className={`planner-sidebar ${sidebarIsCollapsed ? "collapsed" : ""} ${isMobileLayout ? (mobileSidebarOpen ? "mobile-open" : "mobile-hidden") : ""}`}
        data-testid="planner-sidebar"
      >
        <PlannerSidebarChrome {...sidebarChromeProps}>
          <PlannerSidebarPanels {...sidebarPanelsProps} />
        </PlannerSidebarChrome>
      </aside>

      <PlannerMobilePanels {...mobilePanelsProps} />

      <PlannerCanvasSurface {...canvasSurfaceProps} />
    </div>
  );
}
