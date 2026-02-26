import { doc, serverTimestamp, writeBatch, type Firestore } from "firebase/firestore";
import type { NodeFirestoreUpdate } from "./plannerDragHelpers";

type PersistNodeFirestoreUpdatesParams = {
  firestore: Firestore;
  userUid: string;
  updates: NodeFirestoreUpdate[];
  maxBatchSize?: number;
};

export async function persistNodeFirestoreUpdates({
  firestore,
  userUid,
  updates,
  maxBatchSize = 450,
}: PersistNodeFirestoreUpdatesParams): Promise<void> {
  if (updates.length === 0) return;

  let batch = writeBatch(firestore);
  let count = 0;

  for (const update of updates) {
    batch.update(doc(firestore, "users", userUid, "nodes", update.id), {
      ...update.data,
      updatedAt: serverTimestamp(),
    });
    count += 1;
    if (count >= maxBatchSize) {
      await batch.commit();
      batch = writeBatch(firestore);
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
}
