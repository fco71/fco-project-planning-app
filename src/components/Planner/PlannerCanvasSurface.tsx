import type { MouseEvent as ReactMouseEvent, MutableRefObject, RefObject } from "react";
import ReactFlow, {
  Background,
  SelectionMode,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnNodesChange,
  type ReactFlowInstance,
} from "reactflow";
import type { PaletteItem } from "../../hooks/usePlannerPaletteItems";
import type { CrossRef, TreeNode } from "../../types/planner";
import type { NodeKind } from "../../utils/treeUtils";
import { NodeContextMenu } from "./NodeContextMenu";
import { PortalContextMenu } from "./PortalContextMenu";
import { CommandPalette } from "./CommandPalette";
import { SaveErrorToast } from "./SaveErrorToast";
import { MobileCanvasToolbar } from "./MobileCanvasToolbar";

type NodeContextMenuState = { x: number; y: number; nodeId: string } | null;
type PortalContextMenuState = { x: number; y: number; refId: string } | null;
type QuickEditorMode = "compact" | "full";

export type PlannerCanvasSurfaceProps = {
  isMobileLayout: boolean;
  mobileToolbarOpen: boolean;
  selectedNodeId: string | null;
  selectedNode: TreeNode | null | undefined;
  crossReferencesEnabled: boolean;
  rootNodeId: string | null;
  currentRootHasParent: boolean;
  reactFlowNodes: Node[];
  flowEdges: Edge[];
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
  onInit: (instance: ReactFlowInstance) => void;
  onNodesChange: OnNodesChange;
  activePortalRefId: string | null;
  onSetActivePortalRefId: (refId: string | null) => void;
  onSelectRefForEditing: (refId: string) => void;
  onOpenBubblesPanel: (focusInput?: boolean) => void;
  onSetSelectedNodeId: (nodeId: string | null) => void;
  onCloseMobileSidebar: () => void;
  onCloseMobileToolbar: () => void;
  onCloseMobileQuickBubble: () => void;
  onCloseMobileQuickEditor: () => void;
  onSetMobileQuickEditorMode: (mode: QuickEditorMode) => void;
  onOpenMobileQuickEditor: () => void;
  onNodeDoubleClick: (_event: ReactMouseEvent, node: Node) => void;
  scheduleHoverUpdate: (nodeId: string | null, edgeId: string | null) => void;
  hoveredEdgeId: string | null;
  hoveredNodeId: string | null;
  isDraggingRef: MutableRefObject<boolean>;
  onNodeDrag: (_event: ReactMouseEvent, node: Node) => void;
  onNodeDragStop: (_event: ReactMouseEvent, node: Node) => void;
  onSelectionDragStop: (_event: ReactMouseEvent, nodes: Node[]) => void;
  onSetPortalContextMenu: (menu: PortalContextMenuState) => void;
  portalContextMenu: PortalContextMenuState;
  onSetContextMenu: (menu: NodeContextMenuState) => void;
  contextMenu: NodeContextMenuState;
  nodesById: Map<string, TreeNode>;
  childrenByParent: Map<string | null, string[]>;
  onContextAddChild: (nodeId: string) => void;
  onContextAddStorySibling: (nodeId: string) => void;
  onContextDelete: (nodeId: string) => void;
  onContextDuplicate: (nodeId: string) => void;
  onContextRename: (nodeId: string) => void;
  onContextAddCrossRef?: (nodeId: string) => void;
  onContextChangeType: (nodeId: string, nextKind?: NodeKind) => void;
  onContextToggleTaskStatus: (nodeId: string) => void;
  refs: CrossRef[];
  busyAction: boolean;
  onDeletePortalByRefId: (refId: string) => void;
  paletteOpen: boolean;
  paletteQuery: string;
  paletteIndex: number;
  paletteItems: PaletteItem[];
  paletteInputRef: RefObject<HTMLInputElement | null>;
  onClosePalette: () => void;
  onPaletteQueryChange: (value: string) => void;
  onSetPaletteIndex: (index: number) => void;
  onRunPaletteAction: (item: PaletteItem) => void;
  showSaveErrorToast: boolean;
  onToolbarToggleOpen: () => void;
  onToolbarOpenMenu: () => void;
  onToolbarOpenEditor: () => void;
  onToolbarOpenBubble: () => void;
  onToolbarAddChild: () => void;
  onToolbarToggleTaskStatus: () => void;
  onToolbarGoHome: () => void;
  onToolbarGoUp: () => void;
};

export function PlannerCanvasSurface({
  isMobileLayout,
  mobileToolbarOpen,
  selectedNodeId,
  selectedNode,
  crossReferencesEnabled,
  rootNodeId,
  currentRootHasParent,
  reactFlowNodes,
  flowEdges,
  nodeTypes,
  edgeTypes,
  onInit,
  onNodesChange,
  activePortalRefId,
  onSetActivePortalRefId,
  onSelectRefForEditing,
  onOpenBubblesPanel,
  onSetSelectedNodeId,
  onCloseMobileSidebar,
  onCloseMobileToolbar,
  onCloseMobileQuickBubble,
  onCloseMobileQuickEditor,
  onSetMobileQuickEditorMode,
  onOpenMobileQuickEditor,
  onNodeDoubleClick,
  scheduleHoverUpdate,
  hoveredEdgeId,
  hoveredNodeId,
  isDraggingRef,
  onNodeDrag,
  onNodeDragStop,
  onSelectionDragStop,
  onSetPortalContextMenu,
  portalContextMenu,
  onSetContextMenu,
  contextMenu,
  nodesById,
  childrenByParent,
  onContextAddChild,
  onContextAddStorySibling,
  onContextDelete,
  onContextDuplicate,
  onContextRename,
  onContextAddCrossRef,
  onContextChangeType,
  onContextToggleTaskStatus,
  refs,
  busyAction,
  onDeletePortalByRefId,
  paletteOpen,
  paletteQuery,
  paletteIndex,
  paletteItems,
  paletteInputRef,
  onClosePalette,
  onPaletteQueryChange,
  onSetPaletteIndex,
  onRunPaletteAction,
  showSaveErrorToast,
  onToolbarToggleOpen,
  onToolbarOpenMenu,
  onToolbarOpenEditor,
  onToolbarOpenBubble,
  onToolbarAddChild,
  onToolbarToggleTaskStatus,
  onToolbarGoHome,
  onToolbarGoUp,
}: PlannerCanvasSurfaceProps) {
  return (
    <main className="planner-canvas">
      <MobileCanvasToolbar
        isMobileLayout={isMobileLayout}
        mobileToolbarOpen={mobileToolbarOpen}
        selectedNodeId={selectedNodeId}
        selectedNode={selectedNode || null}
        crossReferencesEnabled={crossReferencesEnabled}
        rootNodeId={rootNodeId}
        currentRootHasParent={currentRootHasParent}
        onToggleOpen={onToolbarToggleOpen}
        onOpenMenu={onToolbarOpenMenu}
        onOpenEditor={onToolbarOpenEditor}
        onOpenBubble={onToolbarOpenBubble}
        onAddChild={onToolbarAddChild}
        onToggleTaskStatus={onToolbarToggleTaskStatus}
        onGoHome={onToolbarGoHome}
        onGoUp={onToolbarGoUp}
      />

      <ReactFlow
        nodes={reactFlowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: isMobileLayout ? 0.12 : 0.3, maxZoom: isMobileLayout ? 0.85 : 1 }}
        onlyRenderVisibleElements={false}
        nodesConnectable={false}
        selectionOnDrag={!isMobileLayout}
        selectionMode={isMobileLayout ? SelectionMode.Full : SelectionMode.Partial}
        panOnDrag={isMobileLayout ? [0, 1, 2] : [1, 2]}
        panOnScroll={!isMobileLayout}
        multiSelectionKeyCode={["Shift", "Meta", "Control"]}
        onInit={onInit}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => {
          onSetContextMenu(null);
          onSetPortalContextMenu(null);
          if (node.id.startsWith("portal:")) {
            const refId = node.id.split(":")[1];
            const nextSelected = activePortalRefId === refId ? null : refId;
            onSetActivePortalRefId(nextSelected);
            if (nextSelected) {
              onSelectRefForEditing(refId);
              onOpenBubblesPanel(false);
              window.setTimeout(() => {
                const section = document.getElementById("cross-ref-bubbles-panel");
                section?.scrollIntoView({ block: "start", behavior: "smooth" });
              }, 20);
            }
            if (isMobileLayout) onCloseMobileToolbar();
            return;
          }
          onSetSelectedNodeId(node.id);
          onSetActivePortalRefId(null);
          if (isMobileLayout) {
            onCloseMobileSidebar();
            onCloseMobileToolbar();
          }
        }}
        onNodeDoubleClick={(_, node) => {
          if (isMobileLayout) return;
          onNodeDoubleClick(_, node);
        }}
        onNodeMouseEnter={(_, node) => {
          if (node.id.startsWith("portal:")) return;
          scheduleHoverUpdate(node.id, hoveredEdgeId);
        }}
        onNodeMouseLeave={(_, node) => {
          if (node.id.startsWith("portal:")) return;
          scheduleHoverUpdate(null, hoveredEdgeId);
        }}
        onEdgeMouseEnter={(_, edge) => scheduleHoverUpdate(hoveredNodeId, edge.id)}
        onEdgeMouseLeave={() => scheduleHoverUpdate(hoveredNodeId, null)}
        onNodeDragStart={(_, node) => {
          if (!node.id.startsWith("portal:")) isDraggingRef.current = true;
        }}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onSelectionDragStop={onSelectionDragStop}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          if (node.id.startsWith("portal:")) {
            const refId = node.id.split(":")[1];
            onSetPortalContextMenu({ x: event.clientX, y: event.clientY, refId });
            return;
          }
          onSetPortalContextMenu(null);
          if (isMobileLayout) {
            onSetSelectedNodeId(node.id);
            onSetActivePortalRefId(null);
            onCloseMobileSidebar();
            onCloseMobileQuickBubble();
            onSetMobileQuickEditorMode("compact");
            onOpenMobileQuickEditor();
            onCloseMobileToolbar();
            return;
          }
          onSetSelectedNodeId(node.id);
          onSetActivePortalRefId(null);
          onSetContextMenu({
            x: event.clientX,
            y: event.clientY,
            nodeId: node.id,
          });
        }}
        onPaneClick={() => {
          onSetContextMenu(null);
          onSetPortalContextMenu(null);
          onSetActivePortalRefId(null);
          if (isMobileLayout) {
            onSetSelectedNodeId(null);
            onCloseMobileQuickEditor();
            onCloseMobileQuickBubble();
            onCloseMobileToolbar();
          }
        }}
        minZoom={0.3}
      >
        <Background gap={22} size={1} />
      </ReactFlow>

      {contextMenu ? (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          nodeTitle={nodesById.get(contextMenu.nodeId)?.title || "Node"}
          nodeKind={nodesById.get(contextMenu.nodeId)?.kind || "item"}
          taskStatus={nodesById.get(contextMenu.nodeId)?.taskStatus || "none"}
          hasChildren={(childrenByParent.get(contextMenu.nodeId) || []).length > 0}
          onClose={() => onSetContextMenu(null)}
          onAddChild={onContextAddChild}
          onAddStorySibling={onContextAddStorySibling}
          onDelete={onContextDelete}
          onDuplicate={onContextDuplicate}
          onRename={onContextRename}
          onAddCrossRef={onContextAddCrossRef}
          onChangeType={onContextChangeType}
          onToggleTaskStatus={onContextToggleTaskStatus}
        />
      ) : null}

      <PortalContextMenu
        contextMenu={portalContextMenu}
        refs={refs}
        busy={busyAction}
        onDelete={onDeletePortalByRefId}
        onClose={() => onSetPortalContextMenu(null)}
      />

      <CommandPalette
        open={paletteOpen}
        query={paletteQuery}
        paletteIndex={paletteIndex}
        items={paletteItems}
        inputRef={paletteInputRef}
        onClose={onClosePalette}
        onQueryChange={onPaletteQueryChange}
        onSetIndex={onSetPaletteIndex}
        onRunItem={onRunPaletteAction}
      />

      <SaveErrorToast open={showSaveErrorToast} message="Could not save node position" />
    </main>
  );
}
