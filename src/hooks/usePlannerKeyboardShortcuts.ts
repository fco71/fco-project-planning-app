import { useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { LocalOp } from "./useUndoRedo";
import { showPlannerShortcutsHelp } from "../utils/shortcutsHelp";

type UsePlannerKeyboardShortcutsParams<TItem extends { action: () => void }> = {
  paletteOpen: boolean;
  setPaletteOpen: Dispatch<SetStateAction<boolean>>;
  paletteIndex: number;
  setPaletteIndex: Dispatch<SetStateAction<number>>;
  setPaletteQuery: Dispatch<SetStateAction<string>>;
  paletteItems: TItem[];
  paletteInputRef: MutableRefObject<HTMLInputElement | null>;
  runPaletteAction: (item: TItem) => void;
  contextMenuOpen: boolean;
  activePortalRefId: string | null;
  deletePortalByRefId: (refId: string) => Promise<void>;
  handleContextAddChild: (nodeId: string) => void | Promise<void>;
  handleContextDelete: (nodeId: string) => void | Promise<void>;
  handleContextDuplicate: (nodeId: string) => void | Promise<void>;
  selectedNodeId: string | null;
  mobileQuickEditorOpen: boolean;
  setMobileQuickEditorOpen: Dispatch<SetStateAction<boolean>>;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setActivePortalRefId: Dispatch<SetStateAction<string | null>>;
  searchInputRef: MutableRefObject<HTMLInputElement | null>;
  canUndo: boolean;
  canRedo: boolean;
  undo: (applyLocalOps: (ops: LocalOp[]) => void) => void;
  redo: (applyLocalOps: (ops: LocalOp[]) => void) => void;
  applyLocalOps: (ops: LocalOp[]) => void;
  busyAction: boolean;
};

export function usePlannerKeyboardShortcuts<TItem extends { action: () => void }>({
  paletteOpen,
  setPaletteOpen,
  paletteIndex,
  setPaletteIndex,
  setPaletteQuery,
  paletteItems,
  paletteInputRef,
  runPaletteAction,
  contextMenuOpen,
  activePortalRefId,
  deletePortalByRefId,
  handleContextAddChild,
  handleContextDelete,
  handleContextDuplicate,
  selectedNodeId,
  mobileQuickEditorOpen,
  setMobileQuickEditorOpen,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  searchQuery,
  setSearchQuery,
  setSelectedNodeId,
  setActivePortalRefId,
  searchInputRef,
  canUndo,
  canRedo,
  undo,
  redo,
  applyLocalOps,
  busyAction,
}: UsePlannerKeyboardShortcutsParams<TItem>): void {
  useEffect(() => {
    if (!paletteOpen) return;
    setPaletteIndex(0);
    const id = window.setTimeout(() => {
      paletteInputRef.current?.focus();
      paletteInputRef.current?.select();
    }, 10);
    return () => window.clearTimeout(id);
  }, [paletteInputRef, paletteOpen, setPaletteIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (canUndo && !busyAction) undo(applyLocalOps);
        return;
      }

      if ((cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z") || (!isMac && e.ctrlKey && e.key.toLowerCase() === "y")) {
        e.preventDefault();
        if (canRedo && !busyAction) redo(applyLocalOps);
        return;
      }

      if (cmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => {
          const next = !prev;
          if (next) {
            setPaletteQuery("");
            setPaletteIndex(0);
          }
          return next;
        });
        return;
      }

      if (cmdOrCtrl && (e.key === "?" || (e.key === "/" && e.shiftKey))) {
        e.preventDefault();
        showPlannerShortcutsHelp();
        return;
      }

      if (paletteOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setPaletteOpen(false);
          setPaletteQuery("");
          setPaletteIndex(0);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setPaletteIndex((prev) => Math.min(prev + 1, Math.max(0, paletteItems.length - 1)));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setPaletteIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const item = paletteItems[paletteIndex];
          if (item) runPaletteAction(item);
          return;
        }
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable || contextMenuOpen) {
        return;
      }

      if (cmdOrCtrl && e.key === "n") {
        e.preventDefault();
        if (selectedNodeId) {
          void handleContextAddChild(selectedNodeId);
        }
        return;
      }

      if (cmdOrCtrl && e.key === "d") {
        e.preventDefault();
        if (selectedNodeId) {
          void handleContextDuplicate(selectedNodeId);
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && !e.shiftKey && !cmdOrCtrl) {
        e.preventDefault();
        if (activePortalRefId) {
          void deletePortalByRefId(activePortalRefId);
          return;
        }
        if (selectedNodeId) {
          void handleContextDelete(selectedNodeId);
        }
        return;
      }

      if (cmdOrCtrl && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        if (mobileQuickEditorOpen) {
          setMobileQuickEditorOpen(false);
          return;
        }
        if (mobileSidebarOpen) {
          setMobileSidebarOpen(false);
          return;
        }
        if (searchQuery) {
          setSearchQuery("");
        } else {
          setSelectedNodeId(null);
          setActivePortalRefId(null);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    contextMenuOpen,
    activePortalRefId,
    deletePortalByRefId,
    handleContextAddChild,
    handleContextDelete,
    handleContextDuplicate,
    paletteIndex,
    paletteItems,
    paletteOpen,
    mobileQuickEditorOpen,
    mobileSidebarOpen,
    runPaletteAction,
    searchQuery,
    selectedNodeId,
    canUndo,
    canRedo,
    undo,
    redo,
    applyLocalOps,
    busyAction,
    searchInputRef,
    setActivePortalRefId,
    setMobileQuickEditorOpen,
    setMobileSidebarOpen,
    setPaletteIndex,
    setPaletteOpen,
    setPaletteQuery,
    setSearchQuery,
    setSelectedNodeId,
  ]);
}
