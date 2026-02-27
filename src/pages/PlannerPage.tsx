import type { User } from "firebase/auth";
import { db } from "../firebase";
import {
  DEFAULT_BUBBLE_COLOR,
} from "../utils/plannerConfig";
import { usePlannerPageState } from "../hooks/usePlannerPageState";
import { usePlannerWorkspaceOrchestration } from "../hooks/usePlannerWorkspaceOrchestration";
import { PlannerWorkspaceLayout } from "../components/Planner/PlannerWorkspaceLayout";
import "reactflow/dist/style.css";

type PlannerPageProps = {
  user: User;
};

export default function PlannerPage({ user }: PlannerPageProps) {
  const plannerState = usePlannerPageState({
    defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
  });
  const {
    loading,
    isMobileLayout,
    mobileSidebarOpen,
    sidebarIsCollapsed,
    plannerCanvasSurfaceProps,
    plannerMobilePanelsProps,
    plannerSidebarPanelsProps,
    plannerSidebarChromeProps,
  } = usePlannerWorkspaceOrchestration({ user, plannerState });

  if (!db) {
    return (
      <div className="planner-empty-state">
        Firestore is not available. Configure Firebase credentials to use the planning graph editor.
      </div>
    );
  }

  if (loading) {
    return <div className="planner-empty-state">Loading your planning graph...</div>;
  }

  return (
    <PlannerWorkspaceLayout
      sidebarIsCollapsed={sidebarIsCollapsed}
      isMobileLayout={isMobileLayout}
      mobileSidebarOpen={mobileSidebarOpen}
      sidebarChromeProps={plannerSidebarChromeProps}
      sidebarPanelsProps={plannerSidebarPanelsProps}
      mobilePanelsProps={plannerMobilePanelsProps}
      canvasSurfaceProps={plannerCanvasSurfaceProps}
    />
  );
}
