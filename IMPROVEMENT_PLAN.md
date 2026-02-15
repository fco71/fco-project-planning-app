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

---

## 📋 TO IMPLEMENT (In Order)

### Phase 1: Sidebar Improvements

#### Improvement #1: Fix Sidebar Collapse/Expand
**Goal:** When sidebar collapses, canvas should expand to fill the space

**Files to modify:**
- `src/index.css`

**Changes needed:**
```css
.planner-shell {
  /* Add transition */
  transition: grid-template-columns 350ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Detect collapsed state and adjust grid */
.planner-shell:has(.planner-sidebar.collapsed) {
  grid-template-columns: 64px 1fr;
}

.planner-sidebar.collapsed {
  /* Remove fixed width, let grid control it */
  padding: 8px;
  overflow: hidden;
}
```

**Testing checklist:**
- [ ] Click collapse button (←)
- [ ] Sidebar shrinks to ~64px
- [ ] Canvas expands smoothly to fill space
- [ ] Click expand button (→)
- [ ] Sidebar returns to full width
- [ ] Canvas shrinks smoothly
- [ ] Test works locally
- [ ] Deploy and test on web
- [ ] Verify in both Chrome and Safari

**Rollback if fails:** Revert `src/index.css` changes

---

### Phase 2: Visual Feedback

#### Improvement #2: Auto-Save Indicator
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

#### Improvement #3: Faster Transitions
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

#### Improvement #4: Node Hover Effects
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

#### Improvement #5: Draggable Portal Bubbles
**Goal:** Make cross-reference portal bubbles draggable

**Files to modify:**
- `src/pages/PlannerPage.tsx`

**Changes needed:**

In `basePortalNodes` useMemo:
```typescript
style: {
  // ... existing styles
  cursor: "grab",
  transition: "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease",
},
draggable: true,  // Change from false to true
```

Update `onNodeDragStop` to handle portal positions if needed.

**Testing checklist:**
- [ ] Can grab and drag portal bubbles
- [ ] Cursor changes to "grab"
- [ ] Position persists after drag
- [ ] Doesn't break tree node dragging
- [ ] Portal edges update correctly
- [ ] Test works locally
- [ ] Deploy and test on web

**Rollback if fails:** Set `draggable: false`

---

## 🚀 Optional: GitHub Actions (Later)

### Improvement #6: Auto-Deploy on Push
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

- **Phase 1:** Ready to start (Sidebar collapse fix)
- **Phase 2:** Pending Phase 1 completion
- **Phase 3:** Pending Phase 2 completion
- **Optional:** Can be done anytime after core improvements

---

**Next Step:** Implement Improvement #1 (Sidebar Collapse Fix)

Ready to begin! 🚀
