import React, { useCallback } from "react";
import type { TreeNode } from "../../utils/treeUtils";

type CrossRef = {
  id: string;
  label: string;
  code: string;
  nodeIds: string[];
};

type DataBackupProps = {
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
  crossRefs: CrossRef[];
};

export default function DataBackup({ nodes, refs, profileName, rootNodeId }: DataBackupProps) {
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
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const backup = JSON.parse(event.target?.result as string) as BackupData;

          // Validate backup structure
          if (!backup.version || !backup.nodes || !backup.crossRefs) {
            alert("Invalid backup file format.");
            return;
          }

          // Show confirmation with stats
          const confirmMsg = `Import backup from ${new Date(backup.exportDate).toLocaleDateString()}?\n\n` +
            `Profile: ${backup.profileName}\n` +
            `Nodes: ${backup.nodes.length}\n` +
            `Cross-references: ${backup.crossRefs.length}\n\n` +
            `⚠️ This will NOT overwrite your current data. ` +
            `To import, you would need to implement merge logic or use Firebase import tools.`;

          alert(confirmMsg);

          // Note: Actual import would require Firebase Admin SDK or Firestore batch writes
          // For now, this just shows the data for manual import
          console.log("Backup data:", backup);

        } catch (error) {
          alert("Failed to parse backup file. Please check the file format.");
          console.error("Import error:", error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

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
          ⬇ Export JSON
        </button>
        <button onClick={importData}>
          ⬆ Import JSON
        </button>
      </div>

      <p className="planner-subtle" style={{ fontSize: "12px", marginTop: "8px" }}>
        💡 Exported files are safe to store in cloud storage or version control.
      </p>
    </div>
  );
}
