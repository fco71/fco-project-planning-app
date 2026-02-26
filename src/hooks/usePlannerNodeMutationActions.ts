import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { deleteField, doc, serverTimestamp, updateDoc, type Firestore } from "firebase/firestore";
import type { HistoryEntry } from "./useUndoRedo";
import { firestoreDeleteField } from "./useUndoRedo";
import type { StoryStep, TaskStatus, TreeNode } from "../types/planner";
import { normalizeHexColor } from "../utils/normalize";

type NodePatch = Partial<
  Pick<TreeNode, "title" | "parentId" | "kind" | "x" | "y" | "width" | "height" | "color" | "taskStatus" | "storySteps" | "body">
>;

type UsePlannerNodeMutationActionsParams = {
  firestore: Firestore | null;
  userUid: string;
  selectedNodeId: string | null;
  selectedNode: TreeNode | null;
  renameTitle: string;
  setRenameTitle: Dispatch<SetStateAction<string>>;
  newStoryStepText: string;
  setNewStoryStepText: Dispatch<SetStateAction<string>>;
  nodesById: Map<string, TreeNode>;
  pushHistory: (entry: HistoryEntry) => void;
  applyLocalNodePatch: (nodeId: string, patch: NodePatch) => void;
  setBusyAction: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
};

function createStoryStep(text: string): StoryStep {
  return {
    id: `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    done: false,
  };
}

export function usePlannerNodeMutationActions({
  firestore,
  userUid,
  selectedNodeId,
  selectedNode,
  renameTitle,
  setRenameTitle,
  newStoryStepText,
  setNewStoryStepText,
  nodesById,
  pushHistory,
  applyLocalNodePatch,
  setBusyAction,
  setError,
}: UsePlannerNodeMutationActionsParams) {
  const renameSelected = useCallback(async () => {
    if (!firestore || !selectedNodeId) return;
    const title = renameTitle.trim();
    const currentTitle = nodesById.get(selectedNodeId)?.title || "";
    if (!title) {
      setRenameTitle(currentTitle);
      return;
    }
    if (title === currentTitle) return;
    pushHistory({
      id: crypto.randomUUID(),
      label: `Rename "${currentTitle}"`,
      forwardLocal: [{ target: "nodes", op: "patch", nodeId: selectedNodeId, patch: { title } }],
      forwardFirestore: [{ kind: "updateNode", nodeId: selectedNodeId, data: { title } }],
      inverseLocal: [{ target: "nodes", op: "patch", nodeId: selectedNodeId, patch: { title: currentTitle } }],
      inverseFirestore: [{ kind: "updateNode", nodeId: selectedNodeId, data: { title: currentTitle } }],
    });
    applyLocalNodePatch(selectedNodeId, { title });
    setBusyAction(true);
    setError(null);
    try {
      await updateDoc(doc(firestore, "users", userUid, "nodes", selectedNodeId), {
        title,
        updatedAt: serverTimestamp(),
      });
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not rename node.");
    } finally {
      setBusyAction(false);
    }
  }, [
    applyLocalNodePatch,
    firestore,
    nodesById,
    pushHistory,
    renameTitle,
    selectedNodeId,
    setBusyAction,
    setError,
    setRenameTitle,
    userUid,
  ]);

  const setNodeTaskStatus = useCallback(
    async (nodeId: string, taskStatus: TaskStatus) => {
      if (!firestore) return;
      const previousTaskStatus = nodesById.get(nodeId)?.taskStatus || "none";
      pushHistory({
        id: crypto.randomUUID(),
        label: `Set task status "${taskStatus}"`,
        forwardLocal: [{ target: "nodes", op: "patch", nodeId, patch: { taskStatus } }],
        forwardFirestore: [
          { kind: "updateNode", nodeId, data: { taskStatus: taskStatus === "none" ? firestoreDeleteField() : taskStatus } },
        ],
        inverseLocal: [{ target: "nodes", op: "patch", nodeId, patch: { taskStatus: previousTaskStatus } }],
        inverseFirestore: [
          {
            kind: "updateNode",
            nodeId,
            data: { taskStatus: previousTaskStatus === "none" ? firestoreDeleteField() : previousTaskStatus },
          },
        ],
      });
      setBusyAction(true);
      setError(null);
      applyLocalNodePatch(nodeId, { taskStatus });
      try {
        await updateDoc(doc(firestore, "users", userUid, "nodes", nodeId), {
          taskStatus: taskStatus === "none" ? deleteField() : taskStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        applyLocalNodePatch(nodeId, { taskStatus: previousTaskStatus });
        setError(actionError instanceof Error ? actionError.message : "Could not update task status.");
      } finally {
        setBusyAction(false);
      }
    },
    [applyLocalNodePatch, firestore, nodesById, pushHistory, setBusyAction, setError, userUid]
  );

  const saveStorySteps = useCallback(
    async (nodeId: string, storySteps: StoryStep[]) => {
      if (!firestore) return;
      const previousStorySteps = nodesById.get(nodeId)?.storySteps || [];
      setBusyAction(true);
      setError(null);
      applyLocalNodePatch(nodeId, { storySteps });
      try {
        await updateDoc(doc(firestore, "users", userUid, "nodes", nodeId), {
          storySteps: storySteps.length > 0 ? storySteps : deleteField(),
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        applyLocalNodePatch(nodeId, { storySteps: previousStorySteps });
        setError(actionError instanceof Error ? actionError.message : "Could not save story steps.");
      } finally {
        setBusyAction(false);
      }
    },
    [applyLocalNodePatch, firestore, nodesById, setBusyAction, setError, userUid]
  );

  const addStoryStep = useCallback(async () => {
    if (!selectedNode || selectedNode.kind !== "story") return;
    const text = newStoryStepText.trim();
    if (!text) return;
    const nextSteps = [...(selectedNode.storySteps || []), createStoryStep(text)];
    await saveStorySteps(selectedNode.id, nextSteps);
    setNewStoryStepText("");
  }, [newStoryStepText, saveStorySteps, selectedNode, setNewStoryStepText]);

  const toggleStoryStepDone = useCallback(
    async (stepId: string) => {
      if (!selectedNode || selectedNode.kind !== "story") return;
      const nextSteps = (selectedNode.storySteps || []).map((step) =>
        step.id === stepId ? { ...step, done: !step.done } : step
      );
      await saveStorySteps(selectedNode.id, nextSteps);
    },
    [saveStorySteps, selectedNode]
  );

  const deleteStoryStep = useCallback(
    async (stepId: string) => {
      if (!selectedNode || selectedNode.kind !== "story") return;
      const nextSteps = (selectedNode.storySteps || []).filter((step) => step.id !== stepId);
      await saveStorySteps(selectedNode.id, nextSteps);
    },
    [saveStorySteps, selectedNode]
  );

  const moveStoryStep = useCallback(
    async (stepId: string, direction: -1 | 1) => {
      if (!selectedNode || selectedNode.kind !== "story") return;
      const current = [...(selectedNode.storySteps || [])];
      const index = current.findIndex((step) => step.id === stepId);
      if (index < 0) return;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return;
      const [moved] = current.splice(index, 1);
      current.splice(targetIndex, 0, moved);
      await saveStorySteps(selectedNode.id, current);
    },
    [saveStorySteps, selectedNode]
  );

  const setNodeColor = useCallback(
    async (nodeId: string, color: string | undefined) => {
      if (!firestore) return;
      const normalized = normalizeHexColor(color);
      const previousColor = nodesById.get(nodeId)?.color;
      pushHistory({
        id: crypto.randomUUID(),
        label: normalized ? `Set color "${normalized}"` : "Clear color",
        forwardLocal: [{ target: "nodes", op: "patch", nodeId, patch: { color: normalized } }],
        forwardFirestore: [{ kind: "updateNode", nodeId, data: { color: normalized ?? firestoreDeleteField() } }],
        inverseLocal: [{ target: "nodes", op: "patch", nodeId, patch: { color: previousColor } }],
        inverseFirestore: [{ kind: "updateNode", nodeId, data: { color: previousColor ?? firestoreDeleteField() } }],
      });
      setBusyAction(true);
      setError(null);
      applyLocalNodePatch(nodeId, { color: normalized });
      try {
        await updateDoc(doc(firestore, "users", userUid, "nodes", nodeId), {
          color: normalized ?? deleteField(),
          updatedAt: serverTimestamp(),
        });
      } catch (actionError: unknown) {
        applyLocalNodePatch(nodeId, { color: previousColor });
        setError(actionError instanceof Error ? actionError.message : "Could not update node color.");
      } finally {
        setBusyAction(false);
      }
    },
    [applyLocalNodePatch, firestore, nodesById, pushHistory, setBusyAction, setError, userUid]
  );

  return {
    renameSelected,
    setNodeTaskStatus,
    saveStorySteps,
    addStoryStep,
    toggleStoryStepDone,
    deleteStoryStep,
    moveStoryStep,
    setNodeColor,
  };
}
