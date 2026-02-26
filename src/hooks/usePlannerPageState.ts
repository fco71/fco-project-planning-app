import { useRef, useState } from "react";
import type { ReactFlowInstance } from "reactflow";
import type { CrossRef, TreeNode } from "../types/planner";
import { usePlannerCrossRefUiState } from "./usePlannerCrossRefUiState";
import { usePlannerHoverState } from "./usePlannerHoverState";

type UsePlannerPageStateParams = {
  defaultBubbleColor: string;
};

export function usePlannerPageState({ defaultBubbleColor }: UsePlannerPageStateParams) {
  const [profileName, setProfileName] = useState("");
  const [rootNodeId, setRootNodeId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [refs, setRefs] = useState<CrossRef[]>([]);
  const [currentRootId, setCurrentRootId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingSelectedNodeId, setPendingSelectedNodeId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 980px)").matches : false
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSidebarSection, setMobileSidebarSection] = useState<"project" | "node" | "bubbles">("project");
  const [mobileQuickEditorOpen, setMobileQuickEditorOpen] = useState(false);
  const [mobileQuickBubbleOpen, setMobileQuickBubbleOpen] = useState(false);
  const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false);
  const [mobileQuickEditorMode, setMobileQuickEditorMode] = useState<"compact" | "full">("compact");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newRefLabelInputRef = useRef<HTMLInputElement>(null);
  const mobileQuickBubbleInputRef = useRef<HTMLInputElement>(null);
  const [newChildTitle, setNewChildTitle] = useState("");
  const [newStoryStepText, setNewStoryStepText] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [pendingRenameNodeId, setPendingRenameNodeId] = useState<string | null>(null);
  const [storyLaneMode, setStoryLaneMode] = useState(false);
  const crossRefUiState = usePlannerCrossRefUiState({
    defaultBubbleColor,
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const hoverState = usePlannerHoverState();
  const [dropTargetNodeId, setDropTargetNodeId] = useState<string | null>(null);
  // Track drop target via ref during drag — avoids calling setDropTargetNodeId
  // on every mousemove frame which would recompute flowNodes each frame.
  const dropTargetIdRef = useRef<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [collapsedHydrated, setCollapsedHydrated] = useState(false);
  const syncedCollapsedKeyRef = useRef("");

  return {
    profileName,
    setProfileName,
    rootNodeId,
    setRootNodeId,
    nodes,
    setNodes,
    refs,
    setRefs,
    currentRootId,
    setCurrentRootId,
    selectedNodeId,
    setSelectedNodeId,
    pendingSelectedNodeId,
    setPendingSelectedNodeId,
    sidebarCollapsed,
    setSidebarCollapsed,
    isMobileLayout,
    setIsMobileLayout,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    mobileSidebarSection,
    setMobileSidebarSection,
    mobileQuickEditorOpen,
    setMobileQuickEditorOpen,
    mobileQuickBubbleOpen,
    setMobileQuickBubbleOpen,
    mobileToolbarOpen,
    setMobileToolbarOpen,
    mobileQuickEditorMode,
    setMobileQuickEditorMode,
    searchQuery,
    setSearchQuery,
    searchInputRef,
    renameInputRef,
    newRefLabelInputRef,
    mobileQuickBubbleInputRef,
    newChildTitle,
    setNewChildTitle,
    newStoryStepText,
    setNewStoryStepText,
    renameTitle,
    setRenameTitle,
    bodyDraft,
    setBodyDraft,
    pendingRenameNodeId,
    setPendingRenameNodeId,
    storyLaneMode,
    setStoryLaneMode,
    ...crossRefUiState,
    paletteOpen,
    setPaletteOpen,
    paletteQuery,
    setPaletteQuery,
    paletteIndex,
    setPaletteIndex,
    paletteInputRef,
    collapsedNodeIds,
    setCollapsedNodeIds,
    ...hoverState,
    dropTargetNodeId,
    setDropTargetNodeId,
    dropTargetIdRef,
    contextMenu,
    setContextMenu,
    busyAction,
    setBusyAction,
    loading,
    setLoading,
    error,
    setError,
    rfInstance,
    setRfInstance,
    collapsedHydrated,
    setCollapsedHydrated,
    syncedCollapsedKeyRef,
  };
}
