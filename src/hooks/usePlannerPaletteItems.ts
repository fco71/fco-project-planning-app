import { useMemo } from "react";
import type { CrossRef, NodeKind, TreeNode } from "../types/planner";
import { buildNodePath } from "../utils/treeUtils";
import { showPlannerShortcutsHelp } from "../utils/shortcutsHelp";

export type PaletteItem = {
  id: string;
  label: string;
  hint?: string;
  action: () => void;
};

type UsePlannerPaletteItemsParams = {
  paletteQuery: string;
  crossReferencesEnabled: boolean;
  bubblesSimplifiedMode: boolean;
  currentRootKind: NodeKind | null;
  storyLaneMode: boolean;
  selectedNodeId: string | null;
  nodesById: Map<string, TreeNode>;
  nodes: TreeNode[];
  refs: CrossRef[];
  goGrandmotherView: () => void;
  goUpOneView: () => void;
  organizeVisibleTree: () => void | Promise<void>;
  cleanUpCrossRefs: () => void | Promise<void>;
  toggleStoryLane: () => void;
  openSelectedAsMaster: () => void;
  organizeSelectedBranch: () => void | Promise<void>;
  openSelectedAsStoryLane: () => void;
  handleContextAddStorySibling: (nodeId: string) => void | Promise<void>;
  handleContextAddChild: (nodeId: string) => void | Promise<void>;
  handleContextChangeType: (nodeId: string, targetKind?: NodeKind) => void | Promise<void>;
  handleContextToggleTaskStatus: (nodeId: string) => void;
  focusNodeSearch: () => void;
  jumpToReferencedNode: (nodeId: string) => void;
  openBubblesPanel: (focusInput?: boolean) => void;
  selectRefForEditing: (refId: string) => void;
  linkCrossRefToNode: (refId: string, nodeId: string) => void | Promise<void>;
  nextNodeKind: (kind: NodeKind) => NodeKind;
};

export function usePlannerPaletteItems({
  paletteQuery,
  crossReferencesEnabled,
  bubblesSimplifiedMode,
  currentRootKind,
  storyLaneMode,
  selectedNodeId,
  nodesById,
  nodes,
  refs,
  goGrandmotherView,
  goUpOneView,
  organizeVisibleTree,
  cleanUpCrossRefs,
  toggleStoryLane,
  openSelectedAsMaster,
  organizeSelectedBranch,
  openSelectedAsStoryLane,
  handleContextAddStorySibling,
  handleContextAddChild,
  handleContextChangeType,
  handleContextToggleTaskStatus,
  focusNodeSearch,
  jumpToReferencedNode,
  openBubblesPanel,
  selectRefForEditing,
  linkCrossRefToNode,
  nextNodeKind,
}: UsePlannerPaletteItemsParams): PaletteItem[] {
  return useMemo(() => {
    const items: PaletteItem[] = [];
    const queryText = paletteQuery.trim().toLowerCase();
    const includesQuery = (value: string) => !queryText || value.toLowerCase().includes(queryText);

    const addItem = (id: string, label: string, hint: string | undefined, action: () => void, searchBlob = label) => {
      if (!includesQuery(searchBlob)) return;
      items.push({ id, label, hint, action });
    };

    addItem("cmd-grandmother", "Open top view (root)", "Navigation", goGrandmotherView, "top root grandmother home");
    addItem("cmd-up", "Go to parent view", "Navigation", goUpOneView, "up parent back one level");
    addItem(
      "cmd-shortcuts-help",
      "Show keyboard shortcuts",
      "Help",
      showPlannerShortcutsHelp,
      "keyboard shortcuts hotkeys help cmd ctrl"
    );
    addItem("cmd-organize-tree", "Clean up tree layout", "Layout", organizeVisibleTree, "cleanup organize layout tidy tree auto arrange");
    if (crossReferencesEnabled && !bubblesSimplifiedMode) {
      addItem(
        "cmd-clean-bubbles",
        "Clean up cross-reference bubbles",
        "Cross-reference",
        cleanUpCrossRefs,
        "cleanup cross reference bubbles stale deleted"
      );
    }
    if (currentRootKind === "story") {
      addItem(
        "cmd-toggle-story-lane",
        storyLaneMode ? "Disable story lane view" : "Enable story lane view",
        "Layout",
        toggleStoryLane,
        "story lane linear sequence timeline"
      );
    }
    if (selectedNodeId) {
      addItem("cmd-open-master", "Open selected as master", "Navigation", openSelectedAsMaster, "open selected master");
      addItem(
        "cmd-organize-selected-branch",
        "Clean up selected branch layout",
        "Layout",
        organizeSelectedBranch,
        "cleanup organize selected branch subtree layout tidy"
      );
      const selected = nodesById.get(selectedNodeId);
      if (selected?.kind === "story") {
        addItem(
          "cmd-open-story-lane",
          "Open selected in story lane",
          "Navigation",
          openSelectedAsStoryLane,
          "story lane linear sequence open"
        );
      }
      addItem(
        selected?.kind === "story" ? "cmd-add-story-sibling" : "cmd-add-child",
        selected?.kind === "story" ? "Add story sibling to selected node" : "Add child to selected node",
        "Create",
        () => {
          if (selected?.kind === "story") {
            void handleContextAddStorySibling(selectedNodeId);
          } else {
            void handleContextAddChild(selectedNodeId);
          }
        },
        selected?.kind === "story" ? "add story sibling beat sequence" : "add child create node"
      );
      if (selected && selected.kind !== "root") {
        const nextKind = nextNodeKind(selected.kind);
        addItem(
          "cmd-toggle-type",
          `Set selected node as ${nextKind}`,
          "Node type",
          () => {
            void handleContextChangeType(selectedNodeId);
          },
          "toggle type project item story"
        );
        addItem(
          "cmd-toggle-task-status",
          selected.taskStatus === "done" ? "Mark selected task as todo" : "Mark selected task as done",
          "Task",
          () => handleContextToggleTaskStatus(selectedNodeId),
          "task done complete strike toggle"
        );
      }
    }
    addItem(
      "cmd-focus-search",
      "Focus node search",
      "Sidebar",
      focusNodeSearch,
      "focus search find node"
    );

    const nodeMatches = nodes
      .map((node) => ({ node, path: buildNodePath(node.id, nodesById) }))
      .filter((entry) => includesQuery(`${entry.node.title} ${entry.path}`))
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, 8);
    nodeMatches.forEach((entry) => {
      items.push({
        id: `node:${entry.node.id}`,
        label: entry.node.title,
        hint: entry.path,
        action: () => jumpToReferencedNode(entry.node.id),
      });
    });

    if (crossReferencesEnabled && !bubblesSimplifiedMode) {
      const entityMatches = refs
        .filter((ref) =>
          includesQuery(`${ref.code} ${ref.label} ${ref.entityType} ${ref.tags.join(" ")} ${ref.notes} ${ref.contact}`)
        )
        .slice(0, 8);
      entityMatches.forEach((ref) => {
        items.push({
          id: `entity:${ref.id}`,
          label: `${ref.code} - ${ref.label}`,
          hint: `${ref.entityType} · ${ref.nodeIds.length} links`,
          action: () => {
            openBubblesPanel(false);
            selectRefForEditing(ref.id);
          },
        });
      });

      if (selectedNodeId) {
        refs
          .filter((ref) => !ref.nodeIds.includes(selectedNodeId))
          .filter((ref) => includesQuery(`link ${ref.code} ${ref.label} ${ref.entityType} ${ref.tags.join(" ")}`))
          .slice(0, 6)
          .forEach((ref) => {
            items.push({
              id: `link:${ref.id}`,
              label: `Link selected to ${ref.code} - ${ref.label}`,
              hint: "Entity link",
              action: () => {
                void linkCrossRefToNode(ref.id, selectedNodeId);
              },
            });
          });
      }
    }

    return items;
  }, [
    bubblesSimplifiedMode,
    cleanUpCrossRefs,
    crossReferencesEnabled,
    currentRootKind,
    focusNodeSearch,
    goGrandmotherView,
    goUpOneView,
    handleContextAddChild,
    handleContextAddStorySibling,
    handleContextChangeType,
    handleContextToggleTaskStatus,
    jumpToReferencedNode,
    linkCrossRefToNode,
    nextNodeKind,
    nodes,
    nodesById,
    openBubblesPanel,
    openSelectedAsMaster,
    openSelectedAsStoryLane,
    organizeSelectedBranch,
    organizeVisibleTree,
    paletteQuery,
    refs,
    selectRefForEditing,
    selectedNodeId,
    storyLaneMode,
    toggleStoryLane,
  ]);
}
