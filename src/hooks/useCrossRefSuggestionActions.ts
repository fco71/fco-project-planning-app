import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { CrossRef, EntityType } from "../types/planner";

type UseCrossRefSuggestionActionsParams = {
  defaultBubbleColor: string;
  newRefCode: string;
  nextAutoBubbleCode: string;
  newRefLabelInputRef: MutableRefObject<HTMLInputElement | null>;
  setNewRefLabel: Dispatch<SetStateAction<string>>;
  setNewRefCode: Dispatch<SetStateAction<string>>;
  setNewRefColor: Dispatch<SetStateAction<string>>;
  setNewRefType: Dispatch<SetStateAction<EntityType>>;
};

export function useCrossRefSuggestionActions({
  defaultBubbleColor,
  newRefCode,
  nextAutoBubbleCode,
  newRefLabelInputRef,
  setNewRefLabel,
  setNewRefCode,
  setNewRefColor,
  setNewRefType,
}: UseCrossRefSuggestionActionsParams) {
  const applyBubbleSuggestion = useCallback(
    (ref: CrossRef) => {
      setNewRefLabel((previous) => (previous.trim().length > 0 ? previous : ref.label));
      setNewRefColor(ref.color || defaultBubbleColor);
      setNewRefType(ref.entityType);
      if (!newRefCode.trim()) {
        setNewRefCode(nextAutoBubbleCode);
      }
      window.setTimeout(() => {
        newRefLabelInputRef.current?.focus();
      }, 0);
    },
    [
      defaultBubbleColor,
      newRefCode,
      newRefLabelInputRef,
      nextAutoBubbleCode,
      setNewRefCode,
      setNewRefColor,
      setNewRefLabel,
      setNewRefType,
    ]
  );

  return { applyBubbleSuggestion };
}
