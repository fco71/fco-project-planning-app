export const PLANNER_SHORTCUTS_HELP = [
  "Keyboard Shortcuts",
  "",
  "Global",
  "• Cmd/Ctrl+K: Open command palette",
  "• Cmd/Ctrl+?: Show this shortcuts help",
  "• Cmd/Ctrl+F: Focus node search",
  "• Esc: Close overlays / clear selection",
  "",
  "Editing",
  "• Cmd/Ctrl+N: Add child to selected node",
  "• Cmd/Ctrl+D: Duplicate selected node",
  "• Delete/Backspace: Delete selected node or selected bubble",
  "",
  "History",
  "• Cmd/Ctrl+Z: Undo",
  "• Cmd/Ctrl+Shift+Z (or Ctrl+Y on Windows): Redo",
].join("\n");

export function showPlannerShortcutsHelp(): void {
  window.alert(PLANNER_SHORTCUTS_HELP);
}
