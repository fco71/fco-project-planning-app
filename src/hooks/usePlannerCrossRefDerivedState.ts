import { useCallback, useMemo } from "react";
import { buildNodePath, normalizeCode } from "../utils/treeUtils";
import { isPeopleEntityType, type CrossRef, type TreeNode } from "../types/planner";

type RefCategoryFilter = "all" | "people" | "other";
type RefScopeFilter = "view" | "all";

type UsePlannerCrossRefDerivedStateParams = {
  refs: CrossRef[];
  nodes: TreeNode[];
  nodesById: Map<string, TreeNode>;
  visibleTreeIdSet: Set<string>;
  selectedNodeId: string | null;
  activePortalRefId: string | null;
  editRefId: string;
  refSearchQuery: string;
  refCategoryFilter: RefCategoryFilter;
  refScopeFilter: RefScopeFilter;
  newRefLabel: string;
  newRefCode: string;
  linkNodeQuery: string;
};

function nextBubbleCode(codes: Iterable<string>): string {
  let maxSeen = 0;
  for (const raw of codes) {
    const match = /^B(\d{1,6})$/i.exec(raw.trim());
    if (!match) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed)) maxSeen = Math.max(maxSeen, parsed);
  }
  return `B${String(maxSeen + 1).padStart(3, "0")}`;
}

export function usePlannerCrossRefDerivedState({
  refs,
  nodes,
  nodesById,
  visibleTreeIdSet,
  selectedNodeId,
  activePortalRefId,
  editRefId,
  refSearchQuery,
  refCategoryFilter,
  refScopeFilter,
  newRefLabel,
  newRefCode,
  linkNodeQuery,
}: UsePlannerCrossRefDerivedStateParams) {
  const selectedNodeRefs = useMemo(() => {
    if (!selectedNodeId) return [] as CrossRef[];
    return refs.filter((ref) => ref.nodeIds.includes(selectedNodeId));
  }, [refs, selectedNodeId]);

  const selectedNodeRefIds = useMemo(() => new Set(selectedNodeRefs.map((ref) => ref.id)), [selectedNodeRefs]);

  const refTargetPathsById = useMemo(() => {
    const map = new Map<string, string[]>();
    refs.forEach((ref) => {
      const paths = ref.nodeIds
        .map((id) => (nodesById.has(id) ? buildNodePath(id, nodesById) : null))
        .filter((path): path is string => !!path)
        .sort((a, b) => a.localeCompare(b));
      map.set(ref.id, paths);
    });
    return map;
  }, [nodesById, refs]);

  const describeRefTargets = useCallback(
    (ref: CrossRef, limit = 2) => {
      const paths = refTargetPathsById.get(ref.id) || [];
      if (paths.length === 0) return "Unlinked";
      const preview = paths.slice(0, limit).join(" | ");
      const remaining = paths.length - limit;
      return remaining > 0 ? `${preview} +${remaining} more` : preview;
    },
    [refTargetPathsById]
  );

  const describeRefLibraryPreview = useCallback((ref: CrossRef) => {
    const tagPreview = ref.tags.length > 0 ? ` · ${ref.tags.slice(0, 2).join(", ")}` : "";
    const linkPreview = ref.nodeIds.length === 0 ? "unlinked" : `${ref.nodeIds.length} link${ref.nodeIds.length === 1 ? "" : "s"}`;
    return `${ref.entityType}${tagPreview} · ${linkPreview}`;
  }, []);

  const filteredRefs = useMemo(() => {
    const queryText = refSearchQuery.trim().toLowerCase();
    const scopedRefs =
      refScopeFilter === "view" ? refs.filter((ref) => ref.nodeIds.some((nodeId) => visibleTreeIdSet.has(nodeId))) : refs;
    return scopedRefs.filter((ref) => {
      const categoryMatch =
        refCategoryFilter === "all"
          ? true
          : refCategoryFilter === "people"
            ? isPeopleEntityType(ref.entityType)
            : !isPeopleEntityType(ref.entityType);
      if (!categoryMatch) return false;
      if (!queryText) return true;
      return `${ref.code} ${ref.label} ${ref.entityType} ${ref.tags.join(" ")} ${ref.notes} ${ref.contact} ${ref.links.join(" ")}`
        .toLowerCase()
        .includes(queryText);
    });
  }, [refCategoryFilter, refScopeFilter, refSearchQuery, refs, visibleTreeIdSet]);

  const newRefSuggestions = useMemo(() => {
    if (!selectedNodeId) return [] as CrossRef[];
    const labelQuery = newRefLabel.trim().toLowerCase();
    const codeQuery = normalizeCode(newRefCode.trim());
    if (!labelQuery && !newRefCode.trim()) return [] as CrossRef[];
    return refs
      .filter((ref) => !ref.nodeIds.includes(selectedNodeId))
      .filter((ref) => {
        const labelMatches = labelQuery ? ref.label.toLowerCase().includes(labelQuery) : false;
        const codeMatches = newRefCode.trim().length > 0 ? ref.code.includes(codeQuery) : false;
        return labelMatches || codeMatches;
      })
      .slice(0, 6);
  }, [selectedNodeId, newRefCode, newRefLabel, refs]);

  const nextAutoBubbleCode = useMemo(() => nextBubbleCode(refs.map((ref) => ref.code)), [refs]);

  const effectiveNewBubbleCode = useMemo(
    () => (newRefCode.trim() ? normalizeCode(newRefCode) : nextAutoBubbleCode),
    [newRefCode, nextAutoBubbleCode]
  );

  const bubbleTemplateFromCode = useMemo(() => {
    const typedCode = newRefCode.trim();
    if (!typedCode) return null;
    const normalized = normalizeCode(typedCode);
    return refs.find((ref) => ref.code === normalized) || null;
  }, [newRefCode, refs]);

  const canCreateBubbleFromInput = useMemo(
    () => newRefLabel.trim().length > 0 || !!bubbleTemplateFromCode,
    [bubbleTemplateFromCode, newRefLabel]
  );

  const bubblePrefixSuggestions = useMemo(() => {
    const queryText = newRefLabel.trim().toLowerCase();
    if (!queryText) return [] as CrossRef[];
    const dedupe = new Set<string>();
    return refs
      .filter((ref) => ref.label.toLowerCase().startsWith(queryText) || ref.code.toLowerCase().startsWith(queryText))
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs || a.label.localeCompare(b.label))
      .filter((ref) => {
        const key = `${ref.label.trim().toLowerCase()}|${ref.color || ""}|${ref.entityType}`;
        if (dedupe.has(key)) return false;
        dedupe.add(key);
        return true;
      })
      .slice(0, 6);
  }, [newRefLabel, refs]);

  const editableRef = useMemo(() => {
    if (!editRefId) return null;
    return refs.find((ref) => ref.id === editRefId) || null;
  }, [editRefId, refs]);

  const editableRefTargets = useMemo(() => {
    if (!editableRef) return [] as Array<{ id: string; path: string }>;
    return editableRef.nodeIds
      .map((id) => {
        if (!nodesById.has(id)) return null;
        return { id, path: buildNodePath(id, nodesById) };
      })
      .filter((entry): entry is { id: string; path: string } => !!entry)
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [editableRef, nodesById]);

  const linkableNodeOptions = useMemo(() => {
    if (!editableRef) return [] as Array<{ id: string; path: string }>;
    const linkedIds = new Set(editableRef.nodeIds);
    const queryText = linkNodeQuery.trim().toLowerCase();
    const options = nodes
      .filter((node) => !linkedIds.has(node.id))
      .map((node) => ({
        id: node.id,
        path: buildNodePath(node.id, nodesById),
      }));
    const filtered = queryText
      ? options.filter((entry) => entry.path.toLowerCase().includes(queryText) || entry.id.toLowerCase().includes(queryText))
      : options;
    return filtered.sort((a, b) => a.path.localeCompare(b.path)).slice(0, 120);
  }, [editableRef, linkNodeQuery, nodes, nodesById]);

  const activePortalRef = useMemo(() => {
    if (!activePortalRefId) return null;
    return refs.find((ref) => ref.id === activePortalRefId) || null;
  }, [activePortalRefId, refs]);

  const activePortalTargets = useMemo(() => {
    if (!activePortalRef) return [] as TreeNode[];
    return activePortalRef.nodeIds
      .map((id) => nodesById.get(id))
      .filter((node): node is TreeNode => !!node)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [activePortalRef, nodesById]);

  const mergeCandidateRefs = useMemo(() => {
    if (!editRefId) return [] as CrossRef[];
    const current = refs.find((ref) => ref.id === editRefId);
    if (!current) return [] as CrossRef[];
    return refs
      .filter((ref) => ref.id !== current.id)
      .filter((ref) => {
        const sameCode = ref.code === current.code;
        const sameLabel = ref.label.trim().toLowerCase() === current.label.trim().toLowerCase();
        const codeContains = ref.code.includes(current.code) || current.code.includes(ref.code);
        const labelContains =
          ref.label.toLowerCase().includes(current.label.toLowerCase()) ||
          current.label.toLowerCase().includes(ref.label.toLowerCase());
        return sameCode || sameLabel || codeContains || labelContains;
      })
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
      .slice(0, 12);
  }, [editRefId, refs]);

  return {
    selectedNodeRefs,
    selectedNodeRefIds,
    describeRefTargets,
    describeRefLibraryPreview,
    filteredRefs,
    newRefSuggestions,
    nextAutoBubbleCode,
    effectiveNewBubbleCode,
    bubbleTemplateFromCode,
    canCreateBubbleFromInput,
    bubblePrefixSuggestions,
    editableRef,
    editableRefTargets,
    linkableNodeOptions,
    activePortalRef,
    activePortalTargets,
    mergeCandidateRefs,
  };
}
