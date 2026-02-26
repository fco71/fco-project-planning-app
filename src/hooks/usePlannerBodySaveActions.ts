import { useCallback } from "react";

type UsePlannerBodySaveActionsParams = {
  persistNodeBody: (nodeId: string, nextBody: string) => Promise<void>;
  selectedNodeId: string | null;
  bodyDraft: string;
};

export function usePlannerBodySaveActions({
  persistNodeBody,
  selectedNodeId,
  bodyDraft,
}: UsePlannerBodySaveActionsParams) {
  const saveNodeBody = useCallback(
    async (nodeId: string, nextBody: string) => {
      await persistNodeBody(nodeId, nextBody);
    },
    [persistNodeBody]
  );

  const saveSelectedBody = useCallback(async () => {
    if (!selectedNodeId) return;
    await saveNodeBody(selectedNodeId, bodyDraft);
  }, [bodyDraft, saveNodeBody, selectedNodeId]);

  return {
    saveNodeBody,
    saveSelectedBody,
  };
}
