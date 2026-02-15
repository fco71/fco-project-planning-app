# FCO Planning App - Improvement Plan

**Status:** Web deployment working ✅
**Approach:** Implement improvements ONE AT A TIME, test each thoroughly before moving to next

---

## ✅ COMPLETED (Already Working)

### 1. Remove MiniMap
- **Status:** ✅ Done
- **File:** `src/components/Planner/PlannerCanvas.tsx`
- **Change:** Removed MiniMap component, kept Controls only
- **Verified:** Working in production

### 2. Smoothstep Edges
- **Status:** ✅ Done
- **File:** `src/components/Planner/PlannerCanvas.tsx`
- **Change:** Changed edge type to 'smoothstep' for curved connections
- **Verified:** Working in production

### 3. Snap to Grid
- **Status:** ✅ Done
- **File:** `src/components/Planner/PlannerCanvas.tsx`
- **Change:** Added `snapToGrid={true}` with 16x16 grid
- **Verified:** Working in production

### 4. Error Boundaries
- **Status:** ✅ Pre-existing
- **File:** `src/components/ErrorBoundary.tsx`
- **Feature:** Graceful error handling with user-friendly messages
- **Verified:** Already implemented

### 5. Sidebar Collapse/Expand
- **Status:** ✅ Done
- **Files:** `src/pages/PlannerPage.tsx`, `src/index.css`
- **Changes:** Added collapse button, state management, grid transitions
- **Result:** Sidebar collapses to ~64px, canvas expands smoothly
- **Verified:** Working locally and in production

### 6. Node Dragging Smoothness
- **Status:** ✅ Done
- **File:** `src/pages/PlannerPage.tsx`
- **Changes:** Added `handleNodesChange` with `applyNodeChanges`, `displayNodes` state
- **Result:** Nodes drag smoothly with real-time position updates
- **Verified:** Working locally

### 7. Draggable Portal Bubbles
- **Status:** ✅ Done
- **File:** `src/pages/PlannerPage.tsx`
- **Changes:** Made portals draggable, preserved positions in displayNodes
- **Result:** Portal bubbles can be dragged and stay in position (session-based)
- **Verified:** Working locally

---

## 📋 TO IMPLEMENT (In Order)

### Phase 1: Zoom & Navigation

#### Improvement #8: Adjust Node Click Zoom Behavior
**Goal:** Make zoom less aggressive when clicking nodes, or disable/provide alternative activation

**Current behavior:** Clicking a node triggers aggressive fitView zoom with 350ms duration

**Options:**
1. **Reduce zoom aggression** - Increase padding, reduce zoom level
2. **Disable auto-zoom** - Remove fitView on click entirely
3. **Alternative activation** - Double-click to zoom, single click just selects

**User preference needed:** Which approach?

**Files to modify:**
- `src/pages/PlannerPage.tsx` (useEffect with rfInstance.fitView)

**Changes for Option 1 (Less aggressive):**
```typescript
rfInstance.fitView({
  nodes: [target],
  duration: 250,  // Faster
  padding: 0.8,   // More padding = less zoom
  maxZoom: 1.2    // Limit zoom level
});
```

**Changes for Option 2 (Disable):**
```typescript
// Comment out or remove the entire useEffect block
```

**Changes for Option 3 (Double-click):**
```typescript
// Remove auto-zoom useEffect
// Add onNodeDoubleClick handler instead
const onNodeDoubleClick = useCallback(
  (_: React.MouseEvent, node: Node) => {
    rfInstance?.fitView({ nodes: [node], duration: 250, padding: 0.6 });
  },
  [rfInstance]
);
```

**Testing checklist:**
- [ ] Click node - appropriate zoom behavior
- [ ] Selection still works correctly
- [ ] Portal clicks work as expected
- [ ] Test works locally
- [ ] Deploy and test on web

**Rollback if fails:** Revert changes

---

#### Improvement #9: Node Context Menu (Right-Click)
**Goal:** Decide on interaction model for node actions

**Question:** Should nodes have right-click context menus, or keep all controls in sidebar?

**Option A - Sidebar Only (Current):**
- ✅ Consistent interface
- ✅ Easier to discover features
- ✅ Better for mobile (no right-click)
- ❌ Requires sidebar to be visible
- ❌ More clicks to perform actions

**Option B - Right-Click Menus:**
- ✅ Faster access to common actions
- ✅ Standard desktop pattern
- ❌ Hidden until discovered
- ❌ Requires additional UI development
- ❌ Doesn't work on mobile/tablet

**Option C - Both:**
- ✅ Best of both worlds
- ❌ Most development work
- ❌ Two places to maintain

**User preference needed:** Which option?

**If implementing Option B or C, typical menu items:**
- Add child node
- Delete node
- Duplicate node
- Add cross-reference
- Change node type (project/item)
- View details

---

### Phase 2: Visual Feedback

#### Improvement #10: Auto-Save Indicator
**Goal:** Show visual feedback when saving (e.g., after dragging nodes)

**Files to modify:**
- `src/pages/PlannerPage.tsx` - Add state and logic
- `src/index.css` - Add indicator styles

**Changes needed:**

1. **Add state** (in PlannerPage.tsx):
```typescript
const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const showSaveIndicator = useCallback((status: "saving" | "saved" | "error") => {
  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  setSaveStatus(status);
  if (status === "saved") {
    saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  }
}, []);
```

2. **Update onNodeDragStop**:
```typescript
showSaveIndicator("saving");
try {
  await updateDoc(...);
  showSaveIndicator("saved");
} catch (error) {
  showSaveIndicator("error");
}
```

3. **Add UI indicator**:
```tsx
{saveStatus !== "idle" && (
  <div className={`auto-save-indicator auto-save-${saveStatus}`}>
    {/* Status content */}
  </div>
)}
```

4. **Add CSS** (see full styles in previous IMPROVEMENTS.md)

**Testing checklist:**
- [ ] Drag a node
- [ ] See "Saving..." indicator (blue, top-right)
- [ ] After save: See "Saved ✓" (green)
- [ ] Auto-dismisses after 2 seconds
- [ ] Simulate error: See "Error ⚠" indicator (red)
- [ ] Test works locally
- [ ] Deploy and test on web

**Rollback if fails:** Revert both files

---

### Phase 3: Animation Improvements

#### Improvement #11: Faster Transitions
**Goal:** Reduce transition duration from 300ms to 180ms for snappier feel

**Files to modify:**
- `src/pages/PlannerPage.tsx`

**Changes needed:**

In `flowNodes` useMemo (tree nodes section):
```typescript
transition: "all 180ms cubic-bezier(0.34, 1.56, 0.64, 1)",
```

In `flowNodes` useMemo (portal nodes section):
```typescript
transition: "all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
```

In `flowEdges` useMemo:
```typescript
transition: "all 180ms cubic-bezier(0.4, 0, 0.2, 1)",
```

**Testing checklist:**
- [ ] Hover over nodes - transitions feel snappier
- [ ] Hover over portals - animations are smooth
- [ ] Hover over edges - highlighting is responsive
- [ ] No jittery or jarring animations
- [ ] Test works locally
- [ ] Deploy and test on web

**Rollback if fails:** Change back to 300ms

---

#### Improvement #12: Node Hover Effects
**Goal:** Add subtle scale effect when hovering nodes

**Files to modify:**
- `src/pages/PlannerPage.tsx`

**Changes needed:**

In `flowNodes` useMemo (tree nodes):
```typescript
transform: isHoverRelated ? "scale(1.02)" : "scale(1)",
```

In `flowNodes` useMemo (portal nodes):
```typescript
transform: isHoverRelated ? "scale(1.15)" : isActive ? "scale(1.08)" : "scale(1)",
```

**Testing checklist:**
- [ ] Hover tree node - subtle grow (1.02x)
- [ ] Hover portal bubble - noticeable bounce (1.15x)
- [ ] Active portal shows medium scale (1.08x)
- [ ] Animations feel natural with spring easing
- [ ] Test works locally
- [ ] Deploy and test on web

**Rollback if fails:** Remove transform properties

---

## 🚀 Optional: GitHub Actions (Later)

### Improvement #13: Auto-Deploy on Push
**Goal:** Automatically deploy to Firebase when pushing to main branch

**Files to create:**
- `.github/workflows/firebase-hosting-merge.yml`
- `.github/workflows/firebase-hosting-pull-request.yml`

**Setup steps:**
1. Run `npx firebase login:ci` to get token
2. Add `FIREBASE_TOKEN` to GitHub Secrets
3. Push workflow files
4. Test by pushing a small change

**See:** `GITHUB_ACTIONS_SETUP.md` for detailed instructions

---

## 📝 Implementation Process

For EACH improvement:

1. **Read the plan** for that specific improvement
2. **Make the changes** in the specified files
3. **Test locally first** - verify it works
4. **If local works:**
   - Build: `npm run build`
   - Deploy: `npx firebase deploy --only hosting`
   - Test on web (Incognito mode)
5. **If it works on web:** ✅ Mark as complete, move to next
6. **If it breaks:** ⚠️ Rollback changes immediately, debug before retrying

---

## ⚠️ Important Rules

1. **ONE improvement at a time** - Never combine multiple changes
2. **Test locally FIRST** - Always verify locally before deploying
3. **Test on web AFTER** - Confirm deployment works
4. **Rollback immediately** if anything breaks
5. **Don't rush** - Each improvement should be solid before moving on

---

## 🎯 Success Criteria

Each improvement must:
- ✅ Work correctly locally
- ✅ Work correctly on deployed site
- ✅ Not break any existing functionality
- ✅ Feel smooth and polished

If any of these fail, rollback and reconsider the approach.

---

## Current Status

- **Completed:** Items #1-7 ✅
- **Phase 1 (Zoom & Navigation):** Need user decisions on #8 and #9
- **Phase 2 (Visual Feedback):** Ready after Phase 1
- **Phase 3 (Animation):** Ready after Phase 2
- **Optional:** Can be done anytime after core improvements

---

**Next Step:** Get user input on zoom behavior (#8) and context menu preference (#9)
