import { useCallback, useEffect } from "react";
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, writeBatch, type Firestore } from "firebase/firestore";
import type { User } from "firebase/auth";
import type { CrossRef, CrossRefDoc, EntityType, TreeNode, TreeNodeDoc } from "../types/planner";
import { ENTITY_TYPES } from "../types/planner";
import {
  asStringArray,
  normalizeHexColor,
  normalizeNodeBody,
  normalizeNodeKind,
  normalizeStorySteps,
  normalizeTaskStatus,
  timestampToMs,
} from "../utils/normalize";
import { normalizeCode } from "../utils/treeUtils";

function collapsedKeyFromIds(ids: Iterable<string>): string {
  return Array.from(ids).sort().join("|");
}

type UsePlannerRealtimeSyncParams = {
  user: User;
  firestore: Firestore | null;
  suppressSnapshotRef: React.MutableRefObject<number>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setCollapsedHydrated: React.Dispatch<React.SetStateAction<boolean>>;
  syncedCollapsedKeyRef: React.MutableRefObject<string>;
  setCollapsedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setProfileName: React.Dispatch<React.SetStateAction<string>>;
  setRootNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
  setRefs: React.Dispatch<React.SetStateAction<CrossRef[]>>;
  crossReferencesEnabled: boolean;
  bubblesSimplifiedMode: boolean;
};

export function usePlannerRealtimeSync({
  user,
  firestore,
  suppressSnapshotRef,
  setLoading,
  setError,
  setCollapsedHydrated,
  syncedCollapsedKeyRef,
  setCollapsedNodeIds,
  setProfileName,
  setRootNodeId,
  setNodes,
  setRefs,
  crossReferencesEnabled,
  bubblesSimplifiedMode,
}: UsePlannerRealtimeSyncParams): void {
  const ensureWorkspace = useCallback(async () => {
    if (!firestore) {
      setError("Firestore is not available. Check Firebase configuration.");
      setLoading(false);
      return;
    }
    const userRef = doc(firestore, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const existing = userSnap.exists() ? userSnap.data() : {};
    const preferredName =
      typeof existing.displayName === "string" && existing.displayName.trim()
        ? existing.displayName.trim()
        : (user.displayName || user.email?.split("@")[0] || "Main Node").trim();
    const rootId =
      typeof existing.rootNodeId === "string" && existing.rootNodeId.trim()
        ? existing.rootNodeId
        : doc(collection(firestore, "users", user.uid, "nodes")).id;

    const rootRef = doc(firestore, "users", user.uid, "nodes", rootId);
    const rootSnap = await getDoc(rootRef);
    const batch = writeBatch(firestore);
    let changed = false;

    if (!userSnap.exists()) {
      batch.set(userRef, {
        displayName: preferredName,
        email: user.email || "",
        rootNodeId: rootId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      changed = true;
    } else if (existing.displayName !== preferredName || existing.rootNodeId !== rootId) {
      batch.set(
        userRef,
        {
          displayName: preferredName,
          rootNodeId: rootId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      changed = true;
    }

    if (!rootSnap.exists()) {
      batch.set(rootRef, {
        title: preferredName,
        parentId: null,
        kind: "root",
        x: 0,
        y: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } satisfies TreeNodeDoc & { createdAt: unknown; updatedAt: unknown });
      changed = true;
    }

    if (changed) await batch.commit();
  }, [firestore, setError, setLoading, user.displayName, user.email, user.uid]);

  useEffect(() => {
    if (!firestore) {
      setLoading(false);
      setError("Firestore is not available. Check Firebase configuration.");
      return;
    }

    let unsubProfile: (() => void) | null = null;
    let unsubNodes: (() => void) | null = null;
    let unsubRefs: (() => void) | null = null;
    let cancelled = false;
    let gotProfile = false;
    let gotNodes = false;
    let gotRefs = false;
    const markReady = () => {
      if (!cancelled && gotProfile && gotNodes && gotRefs) setLoading(false);
    };

    setLoading(true);
    setError(null);
    setCollapsedHydrated(false);
    syncedCollapsedKeyRef.current = "";

    ensureWorkspace()
      .then(() => {
        if (cancelled) return;

        unsubProfile = onSnapshot(
          doc(firestore, "users", user.uid),
          (snapshot) => {
            const data = snapshot.data();
            const nextProfileName =
              typeof data?.displayName === "string" && data.displayName.trim()
                ? data.displayName.trim()
                : (user.displayName || user.email?.split("@")[0] || "Main Node");
            const nextRootId =
              typeof data?.rootNodeId === "string" && data.rootNodeId.trim() ? data.rootNodeId : null;

            const savedCollapsedNodes = Array.isArray(data?.collapsedNodes)
              ? data.collapsedNodes.filter((id): id is string => typeof id === "string")
              : [];
            const savedSet = new Set(savedCollapsedNodes);
            const savedKey = collapsedKeyFromIds(savedSet);
            syncedCollapsedKeyRef.current = savedKey;
            setCollapsedHydrated(true);
            setCollapsedNodeIds((prev) => {
              if (collapsedKeyFromIds(prev) === savedKey) return prev;
              return savedSet;
            });

            setProfileName(nextProfileName);
            setRootNodeId(nextRootId);
            gotProfile = true;
            markReady();
          },
          (snapshotError) => {
            setError(snapshotError.message);
            gotProfile = true;
            markReady();
          }
        );

        unsubNodes = onSnapshot(
          query(collection(firestore, "users", user.uid, "nodes")),
          (snapshot) => {
            if (suppressSnapshotRef.current > 0) return;
            const nextNodes = snapshot.docs.map((entry) => {
              const value = entry.data() as Partial<TreeNodeDoc>;
              return {
                id: entry.id,
                title: typeof value.title === "string" ? value.title : "Untitled",
                parentId: typeof value.parentId === "string" ? value.parentId : null,
                kind: normalizeNodeKind(value.kind),
                x: typeof value.x === "number" ? value.x : undefined,
                y: typeof value.y === "number" ? value.y : undefined,
                width: typeof value.width === "number" ? value.width : undefined,
                height: typeof value.height === "number" ? value.height : undefined,
                color: normalizeHexColor(value.color),
                taskStatus: normalizeTaskStatus(value.taskStatus),
                storySteps: normalizeStorySteps(value.storySteps),
                body: normalizeNodeBody(value.body),
              } satisfies TreeNode;
            });
            nextNodes.sort((a, b) => a.title.localeCompare(b.title));
            setNodes(nextNodes);
            gotNodes = true;
            markReady();
          },
          (snapshotError) => {
            setError(snapshotError.message);
            gotNodes = true;
            markReady();
          }
        );

        if (!crossReferencesEnabled) {
          setRefs([]);
          gotRefs = true;
          markReady();
        } else {
          unsubRefs = onSnapshot(
            query(collection(firestore, "users", user.uid, "crossRefs")),
            (snapshot) => {
              if (suppressSnapshotRef.current > 0) return;
              const nextRefs = snapshot.docs.map((entry) => {
                const value = entry.data() as Partial<CrossRefDoc> & { createdAt?: unknown; updatedAt?: unknown };
                const entityType = ENTITY_TYPES.includes(value.entityType as EntityType)
                  ? (value.entityType as EntityType)
                  : "entity";
                const parsedNodeIds = asStringArray(value.nodeIds);
                const parsedAnchorNodeId = typeof value.anchorNodeId === "string" ? value.anchorNodeId : null;
                const singleNodeId =
                  parsedNodeIds[0] ||
                  parsedAnchorNodeId ||
                  null;
                return {
                  id: entry.id,
                  label: typeof value.label === "string" ? value.label : entry.id,
                  code: typeof value.code === "string" ? normalizeCode(value.code) : "REF",
                  nodeIds: bubblesSimplifiedMode ? (singleNodeId ? [singleNodeId] : []) : parsedNodeIds,
                  anchorNodeId: bubblesSimplifiedMode ? singleNodeId : parsedAnchorNodeId,
                  color: normalizeHexColor(value.color) ?? null,
                  portalX: typeof value.portalX === "number" ? value.portalX : null,
                  portalY: typeof value.portalY === "number" ? value.portalY : null,
                  portalAnchorX: typeof value.portalAnchorX === "number" ? value.portalAnchorX : null,
                  portalAnchorY: typeof value.portalAnchorY === "number" ? value.portalAnchorY : null,
                  portalOffsetX: typeof value.portalOffsetX === "number" ? value.portalOffsetX : null,
                  portalOffsetY: typeof value.portalOffsetY === "number" ? value.portalOffsetY : null,
                  entityType,
                  tags: asStringArray(value.tags),
                  notes: typeof value.notes === "string" ? value.notes : "",
                  contact: typeof value.contact === "string" ? value.contact : "",
                  links: asStringArray(value.links),
                  createdAtMs: timestampToMs(value.createdAt),
                  updatedAtMs: timestampToMs(value.updatedAt),
                } satisfies CrossRef;
              });
              nextRefs.sort(
                (a, b) => b.updatedAtMs - a.updatedAtMs || a.code.localeCompare(b.code) || a.label.localeCompare(b.label)
              );
              setRefs(nextRefs);
              gotRefs = true;
              markReady();
            },
            (snapshotError) => {
              setError(snapshotError.message);
              gotRefs = true;
              markReady();
            }
          );
        }
      })
      .catch((workspaceError: unknown) => {
        if (cancelled) return;
        setError(workspaceError instanceof Error ? workspaceError.message : "Failed to initialize workspace.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      unsubProfile?.();
      unsubNodes?.();
      unsubRefs?.();
    };
  }, [
    bubblesSimplifiedMode,
    crossReferencesEnabled,
    ensureWorkspace,
    firestore,
    setCollapsedHydrated,
    setCollapsedNodeIds,
    setError,
    setLoading,
    setNodes,
    setProfileName,
    setRefs,
    setRootNodeId,
    suppressSnapshotRef,
    syncedCollapsedKeyRef,
    user.displayName,
    user.email,
    user.uid,
  ]);
}

