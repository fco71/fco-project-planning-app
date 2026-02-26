import { useCallback, useEffect, useRef, useState } from "react";
import type { Node, ReactFlowInstance } from "reactflow";

export function usePlannerFlowUiFeedback(rfInstance: ReactFlowInstance | null) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "error">("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSaveError = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus("error");
    saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const onNodeDoubleClick = useCallback(
    (_event: unknown, node: Node) => {
      if (!rfInstance) return;
      rfInstance.fitView({
        nodes: [node],
        duration: 250,
        padding: 0.8,
        maxZoom: 1.2,
      });
    },
    [rfInstance]
  );

  return {
    saveStatus,
    showSaveError,
    onNodeDoubleClick,
  };
}
