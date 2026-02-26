import type { Dispatch, SetStateAction } from "react";
import type { PlannerCanvasSurfaceProps } from "../components/Planner/PlannerCanvasSurface";

type UsePlannerCanvasSurfacePropsParams = Omit<
  PlannerCanvasSurfaceProps,
  | "onCloseMobileSidebar"
  | "onCloseMobileToolbar"
  | "onCloseMobileQuickBubble"
  | "onCloseMobileQuickEditor"
  | "onOpenMobileQuickEditor"
  | "onDeletePortalByRefId"
  | "onClosePalette"
> & {
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setMobileToolbarOpen: Dispatch<SetStateAction<boolean>>;
  setMobileQuickBubbleOpen: Dispatch<SetStateAction<boolean>>;
  setMobileQuickEditorOpen: Dispatch<SetStateAction<boolean>>;
  setPaletteOpen: Dispatch<SetStateAction<boolean>>;
  setPaletteQuery: Dispatch<SetStateAction<string>>;
  setPaletteIndex: Dispatch<SetStateAction<number>>;
  onDeletePortalByRefIdAsync: (refId: string) => Promise<void> | void;
};

export function usePlannerCanvasSurfaceProps({
  setMobileSidebarOpen,
  setMobileToolbarOpen,
  setMobileQuickBubbleOpen,
  setMobileQuickEditorOpen,
  setPaletteOpen,
  setPaletteQuery,
  setPaletteIndex,
  onDeletePortalByRefIdAsync,
  ...surfaceProps
}: UsePlannerCanvasSurfacePropsParams): PlannerCanvasSurfaceProps {
  return {
    ...surfaceProps,
    onCloseMobileSidebar: () => setMobileSidebarOpen(false),
    onCloseMobileToolbar: () => setMobileToolbarOpen(false),
    onCloseMobileQuickBubble: () => setMobileQuickBubbleOpen(false),
    onCloseMobileQuickEditor: () => setMobileQuickEditorOpen(false),
    onOpenMobileQuickEditor: () => setMobileQuickEditorOpen(true),
    onDeletePortalByRefId: (refId) => {
      void onDeletePortalByRefIdAsync(refId);
    },
    onClosePalette: () => {
      setPaletteOpen(false);
      setPaletteQuery("");
      setPaletteIndex(0);
    },
  };
}
