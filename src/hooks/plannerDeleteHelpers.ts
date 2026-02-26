import type { CrossRef } from "../types/planner";
import type { TreeNode } from "../types/planner";
import type { FirestoreOp, LocalOp } from "./useUndoRedo";
import { firestoreDeleteField } from "./useUndoRedo";

type Position = { x: number; y: number };
type ChooseAnchorNodeId = (nodeIds: string[], ...preferredIds: Array<string | null | undefined>) => string | null;
type ResolveNodePosition = (nodeId: string) => Position;
type ResolvePortalFollowPosition = (
  ref: Pick<CrossRef, "portalX" | "portalY" | "portalAnchorX" | "portalAnchorY">,
  anchor: Position | null,
  seed: string
) => Position;

export type RefDeleteImpact = {
  ref: CrossRef;
  keepNodeIds: string[];
  removeCompletely: boolean;
};

export type RefDeletePlan = RefDeleteImpact & {
  nextAnchorNodeId: string | null;
  nextAnchorPosition: Position | null;
  nextPortalPosition: Position | null;
};

type BuildRefDeletePlansParams = {
  impacts: RefDeleteImpact[];
  chooseAnchorNodeId: ChooseAnchorNodeId;
  resolveNodePosition: ResolveNodePosition;
  resolvePortalFollowPosition: ResolvePortalFollowPosition;
};

type BuildRefDeleteHistoryOpsParams = {
  plans: RefDeletePlan[];
  crossRefToFirestoreSetData: (ref: CrossRef) => Record<string, unknown>;
};

export function getRefDeleteImpacts(refs: CrossRef[], deletedNodeIds: Set<string>): RefDeleteImpact[] {
  return refs
    .map((ref) => {
      const keepNodeIds = ref.nodeIds.filter((id) => !deletedNodeIds.has(id));
      if (keepNodeIds.length === ref.nodeIds.length) return null;
      return {
        ref,
        keepNodeIds,
        removeCompletely: keepNodeIds.length === 0,
      };
    })
    .filter((entry): entry is RefDeleteImpact => !!entry);
}

export function buildRefDeletePlans({
  impacts,
  chooseAnchorNodeId,
  resolveNodePosition,
  resolvePortalFollowPosition,
}: BuildRefDeletePlansParams): RefDeletePlan[] {
  return impacts.map(({ ref, keepNodeIds, removeCompletely }) => {
    if (removeCompletely) {
      return {
        ref,
        keepNodeIds,
        removeCompletely,
        nextAnchorNodeId: null,
        nextAnchorPosition: null,
        nextPortalPosition: null,
      };
    }
    const nextAnchorNodeId = chooseAnchorNodeId(keepNodeIds, ref.anchorNodeId);
    const nextAnchorPosition = nextAnchorNodeId ? resolveNodePosition(nextAnchorNodeId) : null;
    const nextPortalPosition = resolvePortalFollowPosition(ref, nextAnchorPosition, `${ref.id}:context-delete`);
    return {
      ref,
      keepNodeIds,
      removeCompletely,
      nextAnchorNodeId,
      nextAnchorPosition,
      nextPortalPosition,
    };
  });
}

export function buildRefDeleteHistoryOps({
  plans,
  crossRefToFirestoreSetData,
}: BuildRefDeleteHistoryOpsParams): {
  fwdLocalRefs: LocalOp[];
  fwdFirestoreRefs: FirestoreOp[];
  invLocalRefs: LocalOp[];
  invFirestoreRefs: FirestoreOp[];
} {
  const fwdLocalRefs: LocalOp[] = [];
  const fwdFirestoreRefs: FirestoreOp[] = [];
  const invLocalRefs: LocalOp[] = [];
  const invFirestoreRefs: FirestoreOp[] = [];

  plans.forEach((plan) => {
    const { ref, keepNodeIds, removeCompletely } = plan;
    if (removeCompletely) {
      fwdLocalRefs.push({ target: "refs", op: "remove", refIds: [ref.id] });
      fwdFirestoreRefs.push({ kind: "deleteRef", refId: ref.id });
      invLocalRefs.push({
        target: "refs",
        op: "add",
        ref: cloneRefForLocalAdd(ref),
      });
      invFirestoreRefs.push({
        kind: "setRef",
        refId: ref.id,
        data: crossRefToFirestoreSetData(ref),
      });
      return;
    }

    const nextPortalPosition = plan.nextPortalPosition as Position;
    fwdLocalRefs.push({
      target: "refs",
      op: "patch",
      refId: ref.id,
      patch: {
        nodeIds: keepNodeIds,
        anchorNodeId: plan.nextAnchorNodeId,
        portalX: nextPortalPosition.x,
        portalY: nextPortalPosition.y,
      },
    });
    fwdFirestoreRefs.push({
      kind: "updateRef",
      refId: ref.id,
      data: {
        nodeIds: keepNodeIds,
        anchorNodeId: plan.nextAnchorNodeId ?? firestoreDeleteField(),
        portalX: nextPortalPosition.x,
        portalY: nextPortalPosition.y,
        portalAnchorX: plan.nextAnchorPosition?.x ?? firestoreDeleteField(),
        portalAnchorY: plan.nextAnchorPosition?.y ?? firestoreDeleteField(),
      },
    });
    invLocalRefs.push({
      target: "refs",
      op: "patch",
      refId: ref.id,
      patch: { nodeIds: ref.nodeIds, anchorNodeId: ref.anchorNodeId, portalX: ref.portalX, portalY: ref.portalY },
    });
    invFirestoreRefs.push({
      kind: "updateRef",
      refId: ref.id,
      data: {
        nodeIds: ref.nodeIds,
        anchorNodeId: ref.anchorNodeId ?? firestoreDeleteField(),
        portalX: ref.portalX,
        portalY: ref.portalY,
        portalAnchorX: ref.portalAnchorX ?? firestoreDeleteField(),
        portalAnchorY: ref.portalAnchorY ?? firestoreDeleteField(),
      },
    });
  });

  return {
    fwdLocalRefs,
    fwdFirestoreRefs,
    invLocalRefs,
    invFirestoreRefs,
  };
}

export function toNodeFirestoreSetData(node: TreeNode): Record<string, unknown> {
  return {
    title: node.title,
    parentId: node.parentId,
    kind: node.kind,
    x: node.x ?? 0,
    y: node.y ?? 0,
    ...(typeof node.width === "number" ? { width: node.width } : {}),
    ...(typeof node.height === "number" ? { height: node.height } : {}),
    ...(node.color ? { color: node.color } : {}),
    ...(node.taskStatus && node.taskStatus !== "none" ? { taskStatus: node.taskStatus } : {}),
    ...(node.body ? { body: node.body } : {}),
    ...(node.storySteps ? { storySteps: node.storySteps } : {}),
  };
}

function cloneRefForLocalAdd(ref: CrossRef): CrossRef {
  return {
    ...ref,
    nodeIds: [...ref.nodeIds],
    tags: [...ref.tags],
    links: [...ref.links],
  };
}
