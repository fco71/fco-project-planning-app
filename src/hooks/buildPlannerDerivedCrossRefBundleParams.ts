import type { usePlannerPageState } from "./usePlannerPageState";
import type { usePlannerDerivedCrossRefBundle } from "./usePlannerDerivedCrossRefBundle";

type PlannerState = ReturnType<typeof usePlannerPageState>;
type DerivedCrossRefBundleParams = Parameters<typeof usePlannerDerivedCrossRefBundle>[0];
type ViewDerivedParams = DerivedCrossRefBundleParams["viewDerived"];
type CrossRefDerivedParams = DerivedCrossRefBundleParams["crossRefDerived"];
type DefaultPortalPositionParams = DerivedCrossRefBundleParams["defaultPortalPosition"];
type BodySaveParams = DerivedCrossRefBundleParams["bodySave"];

type BuildPlannerDerivedCrossRefBundleParamsInput = {
  plannerState: PlannerState;
  nodes: CrossRefDerivedParams["nodes"];
  nodesById: ViewDerivedParams["nodesById"];
  childrenByParent: ViewDerivedParams["childrenByParent"];
  visibleTreeIdSet: CrossRefDerivedParams["visibleTreeIdSet"];
  effectiveBubbleTargetId: CrossRefDerivedParams["effectiveBubbleTargetId"];
  resolveNodePosition: DefaultPortalPositionParams["resolveNodePosition"];
  defaultPortalPositionForAnchor: DefaultPortalPositionParams["defaultPortalPositionForAnchor"];
  persistNodeBody: BodySaveParams["persistNodeBody"];
};

export function buildPlannerDerivedCrossRefBundleParams({
  plannerState,
  nodes,
  nodesById,
  childrenByParent,
  visibleTreeIdSet,
  effectiveBubbleTargetId,
  resolveNodePosition,
  defaultPortalPositionForAnchor,
  persistNodeBody,
}: BuildPlannerDerivedCrossRefBundleParamsInput): DerivedCrossRefBundleParams {
  return {
    viewDerived: {
      currentRootId: plannerState.currentRootId,
      rootNodeId: plannerState.rootNodeId,
      selectedNodeId: plannerState.selectedNodeId,
      nodesById,
      childrenByParent,
      collapsedNodeIds: plannerState.collapsedNodeIds,
    },
    crossRefDerived: {
      refs: plannerState.refs,
      nodes,
      nodesById,
      visibleTreeIdSet,
      selectedNodeId: plannerState.selectedNodeId,
      activePortalRefId: plannerState.activePortalRefId,
      effectiveBubbleTargetId,
      editRefId: plannerState.editRefId,
      refSearchQuery: plannerState.refSearchQuery,
      refCategoryFilter: plannerState.refCategoryFilter,
      refScopeFilter: plannerState.refScopeFilter,
      newRefLabel: plannerState.newRefLabel,
      newRefCode: plannerState.newRefCode,
      linkNodeQuery: plannerState.linkNodeQuery,
    },
    crossRefUiSync: {
      isMobileLayout: plannerState.isMobileLayout,
      mobileQuickBubbleOpen: plannerState.mobileQuickBubbleOpen,
      selectedNodeId: plannerState.selectedNodeId,
      editRefId: plannerState.editRefId,
      refs: plannerState.refs,
      linkTargetNodeId: plannerState.linkTargetNodeId,
      portalContextMenu: plannerState.portalContextMenu,
      setPortalContextMenu: plannerState.setPortalContextMenu,
      setActivePortalRefId: plannerState.setActivePortalRefId,
      setMobileQuickBubbleEditName: plannerState.setMobileQuickBubbleEditName,
      setEditRefId: plannerState.setEditRefId,
      setEditRefLabel: plannerState.setEditRefLabel,
      setEditRefCode: plannerState.setEditRefCode,
      setEditRefType: plannerState.setEditRefType,
      setEditRefTags: plannerState.setEditRefTags,
      setEditRefNotes: plannerState.setEditRefNotes,
      setEditRefContact: plannerState.setEditRefContact,
      setEditRefLinks: plannerState.setEditRefLinks,
      setMergeFromRefId: plannerState.setMergeFromRefId,
      setLinkNodeQuery: plannerState.setLinkNodeQuery,
      setLinkTargetNodeId: plannerState.setLinkTargetNodeId,
    },
    defaultPortalPosition: {
      resolveNodePosition,
      defaultPortalPositionForAnchor,
    },
    bodySave: {
      persistNodeBody,
      selectedNodeId: plannerState.selectedNodeId,
      bodyDraft: plannerState.bodyDraft,
    },
  };
}
