/**
 * useUndoRedo — local-only, delta-based undo/redo for the FCO Planning App.
 *
 * Each HistoryEntry stores both the forward (redo) and inverse (undo) ops
 * as lists of LocalOp (React state) and FirestoreOp (Firestore writes).
 *
 * The suppressSnapshotRef counter prevents Firestore onSnapshot handlers
 * from overwriting local state while an undo/redo Firestore write is in flight.
 * Once the write settles the counter returns to 0 and the next snapshot
 * naturally reconciles state from Firestore.
 */

import { useCallback, useRef, useState } from "react";
import {
  collection,
  deleteField,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

// ─── Types ───────────────────────────────────────────────────────────────────

export type LocalOp =
  | { target: "nodes"; op: "patch"; nodeId: string; patch: Record<string, unknown> }
  | { target: "nodes"; op: "add";   node: Record<string, unknown> }
  | { target: "nodes"; op: "remove"; nodeIds: string[] }
  | { target: "refs";  op: "patch"; refId: string;  patch: Record<string, unknown> }
  | { target: "refs";  op: "add";   ref: Record<string, unknown> }
  | { target: "refs";  op: "remove"; refIds: string[] };

export type FirestoreOp =
  | { kind: "updateNode"; nodeId: string; data: Record<string, unknown> }
  | { kind: "updateRef";  refId: string;  data: Record<string, unknown> }
  | { kind: "setNode";    nodeId: string; data: Record<string, unknown> }
  | { kind: "setRef";     refId: string;  data: Record<string, unknown> }
  | { kind: "deleteNode"; nodeId: string }
  | { kind: "deleteRef";  refId: string };

export type HistoryEntry = {
  id: string;
  label: string;
  forwardLocal: LocalOp[];
  forwardFirestore: FirestoreOp[];
  inverseLocal: LocalOp[];
  inverseFirestore: FirestoreOp[];
};

type UndoRedoStack = {
  past: HistoryEntry[];   // index 0 = oldest
  future: HistoryEntry[]; // index 0 = most-recently-undone
};

// Re-export deleteField so callers building FirestoreOp data can use it.
export { deleteField as firestoreDeleteField };

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HISTORY = 20;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useUndoRedo(uid: string) {
  const [stack, setStack] = useState<UndoRedoStack>({ past: [], future: [] });

  /**
   * When this counter is > 0, onSnapshot handlers in PlannerPage must
   * short-circuit and NOT call setNodes / setRefs.
   * It is a ref (not state) so incrementing/decrementing never triggers a render.
   */
  const suppressSnapshotRef = useRef<number>(0);

  const canUndo = stack.past.length > 0;
  const canRedo = stack.future.length > 0;

  // ── executeFirestoreOps ────────────────────────────────────────────────────

  const executeFirestoreOps = useCallback(
    async (ops: FirestoreOp[]): Promise<void> => {
      if (!db || ops.length === 0) return;
      const batch = writeBatch(db);
      for (const op of ops) {
        switch (op.kind) {
          case "updateNode":
            batch.update(
              doc(db, "users", uid, "nodes", op.nodeId),
              { ...op.data, updatedAt: serverTimestamp() }
            );
            break;
          case "updateRef":
            batch.update(
              doc(db, "users", uid, "crossRefs", op.refId),
              { ...op.data, updatedAt: serverTimestamp() }
            );
            break;
          case "setNode":
            batch.set(
              doc(db, "users", uid, "nodes", op.nodeId),
              { ...op.data, updatedAt: serverTimestamp() }
            );
            break;
          case "setRef":
            batch.set(
              doc(db, "users", uid, "crossRefs", op.refId),
              { ...op.data, updatedAt: serverTimestamp() }
            );
            break;
          case "deleteNode":
            batch.delete(doc(db, "users", uid, "nodes", op.nodeId));
            break;
          case "deleteRef":
            batch.delete(doc(db, "users", uid, "crossRefs", op.refId));
            break;
          default:
            break;
        }
      }
      await batch.commit();
    },
    [uid]
  );

  // ── push ──────────────────────────────────────────────────────────────────

  /**
   * Record a new history entry. Must be called BEFORE the Firestore write
   * so that the captured before-state is accurate. Clears the redo stack.
   */
  const push = useCallback((entry: HistoryEntry) => {
    setStack((prev) => ({
      past: [...prev.past.slice(-(MAX_HISTORY - 1)), entry],
      future: [], // new action discards any redo branch
    }));
  }, []);

  // ── undo ──────────────────────────────────────────────────────────────────

  const undo = useCallback(
    (applyLocalOps: (ops: LocalOp[]) => void) => {
      setStack((prev) => {
        if (prev.past.length === 0) return prev;
        const entry = prev.past[prev.past.length - 1];
        const nextStack: UndoRedoStack = {
          past: prev.past.slice(0, -1),
          future: [entry, ...prev.future],
        };

        // Apply local state immediately (optimistic).
        applyLocalOps(entry.inverseLocal);

        // Suppress snapshots, fire Firestore, then release suppress.
        suppressSnapshotRef.current += 1;
        executeFirestoreOps(entry.inverseFirestore).finally(() => {
          suppressSnapshotRef.current = Math.max(
            0,
            suppressSnapshotRef.current - 1
          );
        });

        return nextStack;
      });
    },
    [executeFirestoreOps]
  );

  // ── redo ──────────────────────────────────────────────────────────────────

  const redo = useCallback(
    (applyLocalOps: (ops: LocalOp[]) => void) => {
      setStack((prev) => {
        if (prev.future.length === 0) return prev;
        const entry = prev.future[0];
        const nextStack: UndoRedoStack = {
          past: [...prev.past, entry],
          future: prev.future.slice(1),
        };

        applyLocalOps(entry.forwardLocal);

        suppressSnapshotRef.current += 1;
        executeFirestoreOps(entry.forwardFirestore).finally(() => {
          suppressSnapshotRef.current = Math.max(
            0,
            suppressSnapshotRef.current - 1
          );
        });

        return nextStack;
      });
    },
    [executeFirestoreOps]
  );

  // ── helpers for callers building entries ──────────────────────────────────

  /**
   * Generate a new Firestore doc ID for the given sub-collection without
   * writing anything. Useful for "create node" operations that need to know
   * the ID before calling push().
   */
  const newNodeDocId = useCallback((): string => {
    if (!db) return `local-${Date.now()}`;
    return doc(collection(db, "users", uid, "nodes")).id;
  }, [uid]);

  const newRefDocId = useCallback((): string => {
    if (!db) return `local-${Date.now()}`;
    return doc(collection(db, "users", uid, "crossRefs")).id;
  }, [uid]);

  return {
    canUndo,
    canRedo,
    push,
    undo,
    redo,
    suppressSnapshotRef,
    newNodeDocId,
    newRefDocId,
    // Expose stack label for optional UI tooltip (e.g. "Undo: Rename 'Foo'")
    undoLabel: stack.past.length > 0 ? stack.past[stack.past.length - 1].label : null,
    redoLabel: stack.future.length > 0 ? stack.future[0].label : null,
  };
}
