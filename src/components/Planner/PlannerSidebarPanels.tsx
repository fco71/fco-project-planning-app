import type { ComponentProps } from "react";
import { ProjectSidebarPanel } from "./ProjectSidebarPanel";
import { SelectedNodePanel } from "./SelectedNodePanel";
import { SimpleBubblesPanel } from "./SimpleBubblesPanel";
import { SharedBubblesTopPanel } from "./SharedBubblesTopPanel";
import { SharedBubblesManager } from "./SharedBubblesManager";

type PlannerSidebarPanelsProps = {
  showProjectSection: boolean;
  showNodeSection: boolean;
  showSimpleBubblesSection: boolean;
  showBubblesSection: boolean;
  projectPanelProps: ComponentProps<typeof ProjectSidebarPanel>;
  selectedNodePanelProps: ComponentProps<typeof SelectedNodePanel>;
  simpleBubblesPanelProps: ComponentProps<typeof SimpleBubblesPanel>;
  sharedBubblesTopPanelProps: ComponentProps<typeof SharedBubblesTopPanel>;
  sharedBubblesManagerProps: ComponentProps<typeof SharedBubblesManager>;
  error: string | null;
};

export function PlannerSidebarPanels({
  showProjectSection,
  showNodeSection,
  showSimpleBubblesSection,
  showBubblesSection,
  projectPanelProps,
  selectedNodePanelProps,
  simpleBubblesPanelProps,
  sharedBubblesTopPanelProps,
  sharedBubblesManagerProps,
  error,
}: PlannerSidebarPanelsProps) {
  return (
    <>
      {showProjectSection ? <ProjectSidebarPanel {...projectPanelProps} /> : null}

      {showNodeSection ? <SelectedNodePanel {...selectedNodePanelProps} /> : null}

      {showSimpleBubblesSection ? <SimpleBubblesPanel {...simpleBubblesPanelProps} /> : null}

      {showBubblesSection ? (
        <div className="planner-panel-block">
          <SharedBubblesTopPanel {...sharedBubblesTopPanelProps} />
          <SharedBubblesManager {...sharedBubblesManagerProps} />
        </div>
      ) : null}

      {error ? <div className="planner-error">{error}</div> : null}
    </>
  );
}
