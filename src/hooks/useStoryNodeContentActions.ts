import { useCallback } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import { deleteField, doc, serverTimestamp, updateDoc, type Firestore } from "firebase/firestore";
import type { HistoryEntry } from "./useUndoRedo";
import { firestoreDeleteField } from "./useUndoRedo";
import type { TreeNode } from "../types/planner";

type NodePatch = Partial<
  Pick<TreeNode, "title" | "parentId" | "kind" | "x" | "y" | "width" | "height" | "color" | "taskStatus" | "storySteps" | "body">
>;

type UseStoryNodeContentActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  nodesById: Map<string, TreeNode>;
  pushHistory: (entry: HistoryEntry) => void;
  applyLocalNodePatch: (nodeId: string, patch: NodePatch) => void;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNodes: Dispatch<SetStateAction<TreeNode[]>>;
  storyNodeMinWidth: number;
  storyNodeMaxWidth: number;
  storyNodeMinHeight: number;
  storyNodeMaxHeight: number;
};

function clamp(value: number, min: number, max: number): number {
  if (min > max) return value;
  return Math.min(max, Math.max(min, value));
}

export function useStoryNodeContentActions({
  firestore,
  userUid,
  nodesById,
  pushHistory,
  applyLocalNodePatch,
  setBusyAction,
  setError,
  setNodes,
  storyNodeMinWidth,
  storyNodeMaxWidth,
  storyNodeMinHeight,
  storyNodeMaxHeight,
}: UseStoryNodeContentActionsParams) {
  const persistNodeBody = useCallback(
    async (nodeId: string, nextBody: string) => {
      if (!firestore) return;
      const previousBody = nodesById.get(nodeId)?.body || "";
      const normalizedBody = nextBody.replace(/\r\n/g, "\n");
      const canonicalBody = normalizedBody.trim().length === 0 ? "" : normalizedBody;
      if (canonicalBody === previousBody) return;
      pushHistory({
        id: crypto.randomUUID(),
        label: "Edit body",
        forwardLocal: [{ target: "nodes", op: "patch", nodeId, patch: { body: canonicalBody } }],
        forwardFirestore: [{ kind: "updateNode", nodeId, data: { body: canonicalBody || firestoreDeleteField() } }],
        inverseLocal: [{ target: "nodes", op: "patch", nodeId, patch: { body: previousBody } }],
        inverseFirestore: [{ kind: "updateNode", nodeId, data: { body: previousBody || firestoreDeleteField() } }],
      });
      setBusyAction(true);
      setError(null);
      applyLocalNodePatch(nodeId, { body: canonicalBody });
      try {
        await updateDoc(doc(firestore, "users", userUid, "nodes", nodeId), {
          body: canonicalBody ? canonicalBody : deleteField(),
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        applyLocalNodePatch(nodeId, { body: previousBody });
        setError(actionError instanceof Error ? actionError.message : "Could not save node body text.");
      } finally {
        setBusyAction(false);
      }
    },
    [applyLocalNodePatch, firestore, nodesById, pushHistory, setBusyAction, setError, userUid]
  );

  const saveStoryNodeSize = useCallback(
    async (
      nodeId: string,
      previousWidth: number | undefined,
      previousHeight: number | undefined,
      nextWidth: number,
      nextHeight: number
    ) => {
      if (!firestore) return;
      const node = nodesById.get(nodeId);
      if (!node) return;
      const width = clamp(Math.round(nextWidth), storyNodeMinWidth, storyNodeMaxWidth);
      const height = clamp(Math.round(nextHeight), storyNodeMinHeight, storyNodeMaxHeight);
      const prevWidthRounded = typeof previousWidth === "number" ? Math.round(previousWidth) : undefined;
      const prevHeightRounded = typeof previousHeight === "number" ? Math.round(previousHeight) : undefined;
      if (prevWidthRounded === width && prevHeightRounded === height) return;
      pushHistory({
        id: crypto.randomUUID(),
        label: `Resize "${node.title}"`,
        forwardLocal: [{ target: "nodes", op: "patch", nodeId, patch: { width, height } }],
        forwardFirestore: [{ kind: "updateNode", nodeId, data: { width, height } }],
        inverseLocal: [{ target: "nodes", op: "patch", nodeId, patch: { width: previousWidth, height: previousHeight } }],
        inverseFirestore: [{
          kind: "updateNode",
          nodeId,
          data: {
            width: typeof previousWidth === "number" ? previousWidth : firestoreDeleteField(),
            height: typeof previousHeight === "number" ? previousHeight : firestoreDeleteField(),
          },
        }],
      });
      setBusyAction(true);
      setError(null);
      applyLocalNodePatch(nodeId, { width, height });
      try {
        await updateDoc(doc(firestore, "users", userUid, "nodes", nodeId), {
          width,
          height,
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        applyLocalNodePatch(nodeId, { width: previousWidth, height: previousHeight });
        setError(actionError instanceof Error ? actionError.message : "Could not resize story node.");
      } finally {
        setBusyAction(false);
      }
    },
    [
      applyLocalNodePatch,
      firestore,
      nodesById,
      pushHistory,
      setBusyAction,
      setError,
      storyNodeMaxHeight,
      storyNodeMaxWidth,
      storyNodeMinHeight,
      storyNodeMinWidth,
      userUid,
    ]
  );

  const resetStoryNodeSize = useCallback(
    async (nodeId: string) => {
      if (!firestore) return;
      const node = nodesById.get(nodeId);
      if (!node) return;
      const previousWidth = node.width;
      const previousHeight = node.height;
      if (typeof previousWidth !== "number" && typeof previousHeight !== "number") return;
      pushHistory({
        id: crypto.randomUUID(),
        label: `Reset size "${node.title}"`,
        forwardLocal: [{ target: "nodes", op: "patch", nodeId, patch: { width: undefined, height: undefined } }],
        forwardFirestore: [{
          kind: "updateNode",
          nodeId,
          data: { width: firestoreDeleteField(), height: firestoreDeleteField() },
        }],
        inverseLocal: [{ target: "nodes", op: "patch", nodeId, patch: { width: previousWidth, height: previousHeight } }],
        inverseFirestore: [{
          kind: "updateNode",
          nodeId,
          data: {
            width: typeof previousWidth === "number" ? previousWidth : firestoreDeleteField(),
            height: typeof previousHeight === "number" ? previousHeight : firestoreDeleteField(),
          },
        }],
      });
      setBusyAction(true);
      setError(null);
      applyLocalNodePatch(nodeId, { width: undefined, height: undefined });
      try {
        await updateDoc(doc(firestore, "users", userUid, "nodes", nodeId), {
          width: deleteField(),
          height: deleteField(),
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        applyLocalNodePatch(nodeId, { width: previousWidth, height: previousHeight });
        setError(actionError instanceof Error ? actionError.message : "Could not reset story node size.");
      } finally {
        setBusyAction(false);
      }
    },
    [applyLocalNodePatch, firestore, nodesById, pushHistory, setBusyAction, setError, userUid]
  );

  const startStoryNodeResize = useCallback(
    (
      nodeId: string,
      initialWidth: number,
      initialHeight: number,
      previousStoredWidth: number | undefined,
      previousStoredHeight: number | undefined,
      event: ReactPointerEvent<HTMLButtonElement>
    ) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startY = event.clientY;
      let latestWidth = initialWidth;
      let latestHeight = initialHeight;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Some browsers/input types can throw if capture is unavailable.
      }
      const applyPreview = (width: number, height: number) => {
        setNodes((prev) => prev.map((entry) => (
          entry.id === nodeId ? { ...entry, width, height } : entry
        )));
      };
      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = clamp(
          Math.round(initialWidth + (moveEvent.clientX - startX)),
          storyNodeMinWidth,
          storyNodeMaxWidth
        );
        const nextHeight = clamp(
          Math.round(initialHeight + (moveEvent.clientY - startY)),
          storyNodeMinHeight,
          storyNodeMaxHeight
        );
        if (nextWidth === latestWidth && nextHeight === latestHeight) return;
        latestWidth = nextWidth;
        latestHeight = nextHeight;
        applyPreview(nextWidth, nextHeight);
      };
      const stopResize = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        if (latestWidth !== initialWidth || latestHeight !== initialHeight) {
          void saveStoryNodeSize(nodeId, previousStoredWidth, previousStoredHeight, latestWidth, latestHeight);
        }
      };
      const handlePointerUp = () => {
        stopResize();
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [saveStoryNodeSize, setNodes, storyNodeMaxHeight, storyNodeMaxWidth, storyNodeMinHeight, storyNodeMinWidth]
  );

  return {
    persistNodeBody,
    saveStoryNodeSize,
    resetStoryNodeSize,
    startStoryNodeResize,
  };
}

