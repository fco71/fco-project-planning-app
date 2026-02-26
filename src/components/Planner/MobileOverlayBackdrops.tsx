type MobileOverlayBackdropsProps = {
  isMobileLayout: boolean;
  mobileSidebarOpen: boolean;
  mobileQuickEditorOpen: boolean;
  mobileQuickBubbleOpen: boolean;
  onCloseSidebar: () => void;
  onCloseQuickEditor: () => void;
  onCloseQuickBubble: () => void;
};

export function MobileOverlayBackdrops({
  isMobileLayout,
  mobileSidebarOpen,
  mobileQuickEditorOpen,
  mobileQuickBubbleOpen,
  onCloseSidebar,
  onCloseQuickEditor,
  onCloseQuickBubble,
}: MobileOverlayBackdropsProps) {
  if (!isMobileLayout) return null;

  return (
    <>
      {mobileSidebarOpen ? (
        <button
          type="button"
          className="planner-mobile-backdrop"
          aria-label="Close controls panel"
          onClick={onCloseSidebar}
        />
      ) : null}

      {mobileQuickEditorOpen ? (
        <button
          type="button"
          className="planner-mobile-backdrop planner-mobile-sheet-backdrop"
          aria-label="Close quick editor"
          onClick={onCloseQuickEditor}
        />
      ) : null}

      {mobileQuickBubbleOpen ? (
        <button
          type="button"
          className="planner-mobile-backdrop planner-mobile-sheet-backdrop"
          aria-label="Close quick bubble add"
          onClick={onCloseQuickBubble}
        />
      ) : null}
    </>
  );
}
