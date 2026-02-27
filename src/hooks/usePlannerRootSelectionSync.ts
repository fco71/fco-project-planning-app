import { useEffect, useMemo, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { TreeNode } from "../types/planner";

type UsePlannerRootSelectionSyncParams = {
  rootNodeId: string | null;
  loading: boolean;
  nodesById: Map<string, TreeNode>;
  currentRootId: string | null;
  setCurrentRootId: Dispatch<SetStateAction<string | null>>;
  selectedNodeId: string | null;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  pendingSelectedNodeId: string | null;
  setPendingSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  isMobileLayout: boolean;
  setRenameTitle: Dispatch<SetStateAction<string>>;
  setBodyDraft: Dispatch<SetStateAction<string>>;
  storyLaneMode: boolean;
  setStoryLaneMode: Dispatch<SetStateAction<boolean>>;
  pendingRenameNodeId: string | null;
  setPendingRenameNodeId: Dispatch<SetStateAction<string | null>>;
  renameInputRef: RefObject<HTMLInputElement | null>;
};

export function usePlannerRootSelectionSync({
  rootNodeId,
  loading,
  nodesById,
  currentRootId,
  setCurrentRootId,
  selectedNodeId,
  setSelectedNodeId,
  pendingSelectedNodeId,
  setPendingSelectedNodeId,
  isMobileLayout,
  setRenameTitle,
  setBodyDraft,
  storyLaneMode,
  setStoryLaneMode,
  pendingRenameNodeId,
  setPendingRenameNodeId,
  renameInputRef,
}: UsePlannerRootSelectionSyncParams) {
  const initialPageParamHydratedRef = useRef(false);

  useEffect(() => {
    if (!rootNodeId || loading) return;
    if (!initialPageParamHydratedRef.current) {
      initialPageParamHydratedRef.current = true;
      if (typeof window !== "undefined") {
        const pageParam = new URLSearchParams(window.location.search).get("page");
        if (pageParam && nodesById.has(pageParam)) {
          setCurrentRootId(pageParam);
          return;
        }
      }
    }
    if (!currentRootId) {
      setCurrentRootId(rootNodeId);
      return;
    }
    if (!nodesById.has(currentRootId) && nodesById.has(rootNodeId)) {
      setCurrentRootId(rootNodeId);
    }
  }, [currentRootId, loading, nodesById, rootNodeId, setCurrentRootId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!rootNodeId || !currentRootId) return;
    const url = new URL(window.location.href);
    if (currentRootId === rootNodeId) {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("page", currentRootId);
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) {
      window.history.replaceState({}, "", next);
    }
  }, [currentRootId, rootNodeId]);

  useEffect(() => {
    if (selectedNodeId && !nodesById.has(selectedNodeId)) {
      if (pendingSelectedNodeId === selectedNodeId) return;
      setSelectedNodeId(null);
    }
  }, [pendingSelectedNodeId, selectedNodeId, nodesById, setSelectedNodeId]);

  useEffect(() => {
    if (!pendingSelectedNodeId) return;
    if (!nodesById.has(pendingSelectedNodeId)) return;
    setSelectedNodeId(pendingSelectedNodeId);
    setPendingSelectedNodeId(null);
  }, [nodesById, pendingSelectedNodeId, setPendingSelectedNodeId, setSelectedNodeId]);

  useEffect(() => {
    if (isMobileLayout) return;
    if (!selectedNodeId && currentRootId) {
      setSelectedNodeId(currentRootId);
    }
  }, [selectedNodeId, currentRootId, isMobileLayout, setSelectedNodeId]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodesById.get(selectedNodeId) || null : null),
    [selectedNodeId, nodesById]
  );

  useEffect(() => {
    setRenameTitle(selectedNode?.title || "");
  }, [selectedNode?.id, selectedNode?.title, setRenameTitle]);

  useEffect(() => {
    setBodyDraft(selectedNode?.body || "");
  }, [selectedNode?.body, selectedNode?.id, setBodyDraft]);

  useEffect(() => {
    if (!storyLaneMode) return;
    const current = currentRootId ? nodesById.get(currentRootId) : null;
    if (current?.kind === "story") return;
    setStoryLaneMode(false);
  }, [currentRootId, nodesById, storyLaneMode, setStoryLaneMode]);

  useEffect(() => {
    if (!pendingRenameNodeId) return;
    if (!selectedNodeId || selectedNodeId !== pendingRenameNodeId) return;
    const timeout = window.setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
      setPendingRenameNodeId(null);
    }, 60);
    return () => window.clearTimeout(timeout);
  }, [
    pendingRenameNodeId,
    renameInputRef,
    selectedNodeId,
    setPendingRenameNodeId,
  ]);

  return {
    selectedNode,
  };
}
