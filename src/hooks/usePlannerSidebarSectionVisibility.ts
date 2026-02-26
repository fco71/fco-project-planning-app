type MobileSidebarSection = "project" | "node" | "bubbles";

type UsePlannerSidebarSectionVisibilityParams = {
  isMobileLayout: boolean;
  mobileSidebarSection: MobileSidebarSection;
  crossReferencesEnabled: boolean;
  bubblesSimplifiedMode: boolean;
};

export function usePlannerSidebarSectionVisibility({
  isMobileLayout,
  mobileSidebarSection,
  crossReferencesEnabled,
  bubblesSimplifiedMode,
}: UsePlannerSidebarSectionVisibilityParams) {
  const showProjectSection = !isMobileLayout || mobileSidebarSection === "project";
  const showNodeSection = !isMobileLayout || mobileSidebarSection === "node";
  const showBubblesSection = crossReferencesEnabled
    && !bubblesSimplifiedMode
    && (!isMobileLayout || mobileSidebarSection === "bubbles");
  const showSimpleBubblesSection = crossReferencesEnabled
    && bubblesSimplifiedMode
    && (!isMobileLayout || mobileSidebarSection === "bubbles");

  return {
    showProjectSection,
    showNodeSection,
    showBubblesSection,
    showSimpleBubblesSection,
  };
}
