import { useCallback, useState } from "react";
import {
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import type { TreeNode, CrossRef } from "../../types/planner";

type DataBackupProps = {
  userId: string;
  nodes: TreeNode[];
  refs: CrossRef[];
  profileName: string;
  rootNodeId: string | null;
};

type BackupData = {
  version: "1.0";
  exportDate: string;
  profileName: string;
  rootNodeId: string | null;
  nodes: TreeNode[];
  crossRefs: Array<{
    id: string;
    label: string;
    code: string;
    nodeIds: string[];
    [key: string]: unknown;
  }>;
};

export default function DataBackup({ userId, nodes, refs, profileName, rootNodeId }: DataBackupProps) {
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const exportData = useCallback(() => {
    const backup: BackupData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      profileName,
      rootNodeId,
      nodes,
      crossRefs: refs,
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fco-planning-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [nodes, refs, profileName, rootNodeId]);

  const importData = useCallback(() => {
    if (!db || !userId) {
      setImportStatus("Firestore is not available.");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        // Narrow db to non-null (outer guard already returned if null)
        const firestore = db!;
        try {
          const backup = JSON.parse(event.target?.result as string) as BackupData;

          // Validate backup structure
          if (!backup.version || !Array.isArray(backup.nodes) || !Array.isArray(backup.crossRefs)) {
            setImportStatus("Invalid backup file format.");
            return;
          }

          // Show confirmation
          const confirmed = window.confirm(
            `Import backup from ${new Date(backup.exportDate).toLocaleDateString()}?\n\n` +
            `Profile: ${backup.profileName}\n` +
            `Nodes: ${backup.nodes.length}\n` +
            `Cross-references: ${backup.crossRefs.length}\n\n` +
            `This will merge with your current data. Existing nodes with the same ID will be overwritten.`
          );

          if (!confirmed) return;

          setImporting(true);
          setImportStatus(null);

          // Firestore batches are limited to 500 operations.
          // We'll chunk the writes accordingly.
          const MAX_BATCH_OPS = 450; // leave headroom
          let opsInBatch = 0;
          let batch = writeBatch(firestore);
          let totalOps = 0;

          // Import nodes
          for (const node of backup.nodes) {
            if (!node.id || typeof node.id !== "string") continue;
            const nodeRef = doc(firestore, "users", userId, "nodes", node.id);
            batch.set(nodeRef, {
              title: node.title || "Untitled",
              parentId: node.parentId ?? null,
              kind: node.kind || "item",
              ...(typeof node.x === "number" ? { x: node.x } : {}),
              ...(typeof node.y === "number" ? { y: node.y } : {}),
              ...(typeof node.width === "number" ? { width: node.width } : {}),
              ...(typeof node.height === "number" ? { height: node.height } : {}),
              ...(node.color ? { color: node.color } : {}),
              ...(node.taskStatus && node.taskStatus !== "none" ? { taskStatus: node.taskStatus } : {}),
              ...(node.storySteps?.length ? { storySteps: node.storySteps } : {}),
              ...(node.body ? { body: node.body } : {}),
              updatedAt: serverTimestamp(),
            });
            opsInBatch += 1;
            totalOps += 1;

            if (opsInBatch >= MAX_BATCH_OPS) {
              await batch.commit();
              batch = writeBatch(firestore);
              opsInBatch = 0;
            }
          }

          // Import cross-references
          for (const ref of backup.crossRefs) {
            if (!ref.id || typeof ref.id !== "string") continue;
            const refDoc = doc(firestore, "users", userId, "crossRefs", ref.id);
            batch.set(refDoc, {
              label: ref.label || ref.id,
              code: ref.code || "REF",
              nodeIds: Array.isArray(ref.nodeIds) ? ref.nodeIds : [],
              ...(ref.anchorNodeId ? { anchorNodeId: ref.anchorNodeId } : {}),
              ...(ref.color ? { color: ref.color } : {}),
              ...(ref.entityType ? { entityType: ref.entityType } : {}),
              ...(Array.isArray(ref.tags) && ref.tags.length ? { tags: ref.tags } : {}),
              ...(ref.notes ? { notes: ref.notes } : {}),
              ...(ref.contact ? { contact: ref.contact } : {}),
              ...(Array.isArray(ref.links) && ref.links.length ? { links: ref.links } : {}),
              updatedAt: serverTimestamp(),
            });
            opsInBatch += 1;
            totalOps += 1;

            if (opsInBatch >= MAX_BATCH_OPS) {
              await batch.commit();
              batch = writeBatch(firestore);
              opsInBatch = 0;
            }
          }

          // Commit remaining operations
          if (opsInBatch > 0) {
            await batch.commit();
          }

          setImportStatus(`Imported ${totalOps} items successfully.`);
        } catch (error) {
          console.error("Import error:", error);
          setImportStatus(
            error instanceof Error
              ? `Import failed: ${error.message}`
              : "Import failed. Check the file format."
          );
        } finally {
          setImporting(false);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [userId]);

  const nodeCount = nodes.length;
  const refCount = refs.length;

  return (
    <div className="data-backup">
      <h3>Data Backup</h3>
      <p className="planner-subtle">
        Export your planning tree as JSON for backup or import data from a previous export.
      </p>

      <div className="data-backup-stats">
        <div className="data-backup-stat">
          <span className="data-backup-stat-value">{nodeCount}</span>
          <span className="data-backup-stat-label">nodes</span>
        </div>
        <div className="data-backup-stat">
          <span className="data-backup-stat-value">{refCount}</span>
          <span className="data-backup-stat-label">cross-refs</span>
        </div>
      </div>

      <div className="planner-inline-buttons">
        <button onClick={exportData} className="success">
          Export JSON
        </button>
        <button onClick={importData} disabled={importing}>
          {importing ? "Importing..." : "Import JSON"}
        </button>
      </div>

      {importStatus && (
        <p className="planner-subtle planner-subtle-xs planner-subtle-mt-8">
          {importStatus}
        </p>
      )}

      <p className="planner-subtle planner-subtle-xs planner-subtle-mt-8">
        Exported files are safe to store in cloud storage or version control.
      </p>
    </div>
  );
}
