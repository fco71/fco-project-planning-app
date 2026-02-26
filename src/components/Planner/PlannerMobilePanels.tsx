import type { ComponentProps } from "react";
import { MobileOverlayBackdrops } from "./MobileOverlayBackdrops";
import { MobileQuickEditorSheet } from "./MobileQuickEditorSheet";
import { MobileQuickBubbleSheet } from "./MobileQuickBubbleSheet";

type PlannerMobilePanelsProps = {
  overlaysProps: ComponentProps<typeof MobileOverlayBackdrops>;
  quickEditorProps: ComponentProps<typeof MobileQuickEditorSheet>;
  quickBubbleProps: ComponentProps<typeof MobileQuickBubbleSheet>;
};

export function PlannerMobilePanels({
  overlaysProps,
  quickEditorProps,
  quickBubbleProps,
}: PlannerMobilePanelsProps) {
  return (
    <>
      <MobileOverlayBackdrops {...overlaysProps} />
      <MobileQuickEditorSheet {...quickEditorProps} />
      <MobileQuickBubbleSheet {...quickBubbleProps} />
    </>
  );
}
