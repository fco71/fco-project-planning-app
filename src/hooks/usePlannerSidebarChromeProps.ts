import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { PlannerSidebarChrome } from "../components/Planner/PlannerSidebarChrome";
import type { LocalOp } from "./useUndoRedo";

type SidebarChromeProps = Omit<Parameters<typeof PlannerSidebarChrome>[0], "children">;

type UsePlannerSidebarChromePropsParams = {
  sidebarIsCollapsed: boolean;
  isMobileLayout: boolean;
  canUndo: boolean;
  canRedo: boolean;
  busyAction: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  searchInputRef: MutableRefObject<HTMLInputElement | null>;
  searchQuery: string;
  searchMatchCount: number;
  crossReferencesEnabled: boolean;
  mobileSidebarSection: "project" | "node" | "bubbles";
  undo: (applyLocalOps: (ops: LocalOp[]) => void) => void;
  redo: (applyLocalOps: (ops: LocalOp[]) => void) => void;
  applyLocalOps: (ops: LocalOp[]) => void;
  openBubblesPanel: (focusInput?: boolean) => void;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setPaletteOpen: Dispatch<SetStateAction<boolean>>;
  setPaletteQuery: Dispatch<SetStateAction<string>>;
  setPaletteIndex: Dispatch<SetStateAction<number>>;
  setMobileSidebarSection: Dispatch<SetStateAction<"project" | "node" | "bubbles">>;
};

export function usePlannerSidebarChromeProps({
  sidebarIsCollapsed,
  isMobileLayout,
  canUndo,
  canRedo,
  busyAction,
  undoLabel,
  redoLabel,
  searchInputRef,
  searchQuery,
  searchMatchCount,
  crossReferencesEnabled,
  mobileSidebarSection,
  undo,
  redo,
  applyLocalOps,
  openBubblesPanel,
  setMobileSidebarOpen,
  setSidebarCollapsed,
  setSearchQuery,
  setPaletteOpen,
  setPaletteQuery,
  setPaletteIndex,
  setMobileSidebarSection,
}: UsePlannerSidebarChromePropsParams): SidebarChromeProps {
  return {
    sidebarIsCollapsed,
    isMobileLayout,
    canUndo,
    canRedo,
    busyAction,
    undoLabel,
    redoLabel,
    searchInputRef,
    searchQuery,
    searchMatchCount,
    crossReferencesEnabled,
    mobileSidebarSection,
    onUndo: () => undo(applyLocalOps),
    onRedo: () => redo(applyLocalOps),
    onCloseMobileSidebar: () => setMobileSidebarOpen(false),
    onToggleSidebarCollapse: () => setSidebarCollapsed((prev) => !prev),
    onSearchQueryChange: setSearchQuery,
    onOpenPalette: () => {
      setPaletteOpen(true);
      setPaletteQuery("");
      setPaletteIndex(0);
    },
    onSetMobileSidebarSection: setMobileSidebarSection,
    onOpenBubblesPanel: () => openBubblesPanel(true),
  };
}
