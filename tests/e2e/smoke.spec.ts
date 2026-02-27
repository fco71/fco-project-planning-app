import { expect, test, type Page } from "@playwright/test";

async function isVisible(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().isVisible().catch(() => false);
}

async function ensureSignedIn(page: Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated smoke tests.");

  if (await page.getByTestId("app-signout-button").isVisible().catch(() => false)) {
    return;
  }

  const loginForm = page.getByTestId("auth-signin-form");
  await expect(loginForm).toBeVisible();

  await loginForm.getByLabel("Email").fill(email ?? "");
  await loginForm.getByLabel("Password").fill(password ?? "");
  await page.getByTestId("auth-submit-button").click();
  await expect(page.getByTestId("app-signout-button")).toBeVisible();
}

async function ensureDesktopSidebarOpen(page: Page) {
  const searchInput = page.getByTestId("planner-search-input");
  if (await searchInput.isVisible().catch(() => false)) return;
  await page.getByTestId("planner-sidebar-toggle").click();
  await expect(searchInput).toBeVisible();
}

async function createBubbleOnFirstNode(page: Page, bubbleName: string) {
  const firstNodeCard = page.locator("[data-testid^='planner-node-card-']").first();
  await expect(firstNodeCard).toBeVisible();
  await firstNodeCard.click();

  const bubbleTargetButton = page.getByTestId("planner-selected-node-add-bubble-button");
  await expect(bubbleTargetButton).toBeVisible();
  await bubbleTargetButton.click();

  const bubbleInput = page.getByTestId("planner-bubble-name-input");
  await expect(bubbleInput).toBeVisible();
  await bubbleInput.fill(bubbleName);
  await page.getByTestId("planner-bubble-add-button").click();
  await expect(page.getByTestId("planner-bubble-existing-chip").filter({ hasText: bubbleName })).toHaveCount(1);
}

test("app bootstraps without crash", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Something went wrong")).toHaveCount(0);

  // Wait for Firebase auth to resolve (loading state disappears)
  await page.locator(".planner-loading-state").waitFor({ state: "hidden", timeout: 15000 }).catch(() => undefined);

  const hasAuthCard = await isVisible(page, "[data-testid='auth-card']");
  const hasPlannerShell = await isVisible(page, "[data-testid='planner-shell']");
  const hasEmptyState = await isVisible(page, ".planner-empty-state");
  expect(hasAuthCard || hasPlannerShell || hasEmptyState).toBeTruthy();
});

test("forgot password screen is reachable from sign in", async ({ page }) => {
  await page.goto("/");

  if (await page.getByText("Firebase is not configured").isVisible().catch(() => false)) {
    test.skip(true, "Firebase env is missing in this environment.");
  }

  if (await page.getByTestId("app-signout-button").isVisible().catch(() => false)) {
    test.skip(true, "Session is already authenticated.");
  }

  const signInForm = page.getByTestId("auth-signin-form");
  await signInForm.waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
  if (!(await signInForm.isVisible().catch(() => false))) {
    test.skip(true, "Sign-in form is not visible in this environment.");
  }

  const forgotButton = page.getByTestId("auth-forgot-password-button");
  if (!(await forgotButton.isVisible().catch(() => false))) {
    test.skip(true, "Sign-in form is not visible in this environment.");
  }

  await forgotButton.click();
  await expect(page.getByTestId("auth-send-reset-button")).toBeVisible();
  await page.getByTestId("auth-back-to-signin-button").click();
  await expect(page.getByTestId("auth-signin-form")).toBeVisible();
});

test("authenticated planner smoke (desktop/mobile)", async ({ page }) => {
  await page.goto("/");
  await ensureSignedIn(page);

  const firestoreUnavailable = page.getByText("Firestore is not available");
  if (await firestoreUnavailable.isVisible().catch(() => false)) {
    test.skip(true, "Firestore is unavailable in this environment.");
  }

  await expect(page.getByTestId("planner-shell")).toBeVisible();

  const hasMobileTabs = await isVisible(page, "[data-testid='planner-mobile-tab-project']");
  if (hasMobileTabs) {
    await expect(page.getByTestId("planner-mobile-tab-project")).toBeVisible();
    await expect(page.getByTestId("planner-mobile-tab-node")).toBeVisible();
  } else {
    await expect(page.getByTestId("planner-command-palette-button")).toBeVisible();
    await expect(page.getByTestId("planner-search-input")).toBeVisible();
  }
});

test("authenticated desktop bubble add and delete flow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only flow.");

  await page.goto("/");
  await ensureSignedIn(page);

  const firestoreUnavailable = page.getByText("Firestore is not available");
  if (await firestoreUnavailable.isVisible().catch(() => false)) {
    test.skip(true, "Firestore is unavailable in this environment.");
  }

  await expect(page.getByTestId("planner-shell")).toBeVisible();

  await ensureDesktopSidebarOpen(page);
  const bubbleName = `E2E Desktop Bubble ${Date.now()}`;
  await createBubbleOnFirstNode(page, bubbleName);

  await page
    .locator(".chip.with-action")
    .filter({ hasText: bubbleName })
    .first()
    .getByTestId("planner-bubble-delete-chip-button")
    .click();
  await expect(page.getByTestId("planner-bubble-existing-chip").filter({ hasText: bubbleName })).toHaveCount(0);
});

test("authenticated desktop bubble delete supports undo and redo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only flow.");

  await page.goto("/");
  await ensureSignedIn(page);

  const firestoreUnavailable = page.getByText("Firestore is not available");
  if (await firestoreUnavailable.isVisible().catch(() => false)) {
    test.skip(true, "Firestore is unavailable in this environment.");
  }

  await expect(page.getByTestId("planner-shell")).toBeVisible();
  await ensureDesktopSidebarOpen(page);

  const bubbleName = `E2E Undo Bubble ${Date.now()}`;
  await createBubbleOnFirstNode(page, bubbleName);

  await page
    .locator(".chip.with-action")
    .filter({ hasText: bubbleName })
    .first()
    .getByTestId("planner-bubble-delete-chip-button")
    .click();
  await expect(page.getByTestId("planner-bubble-existing-chip").filter({ hasText: bubbleName })).toHaveCount(0);

  await page.getByTestId("planner-undo-button").click();
  await expect(page.getByTestId("planner-bubble-existing-chip").filter({ hasText: bubbleName })).toHaveCount(1);

  await page.getByTestId("planner-redo-button").click();
  await expect(page.getByTestId("planner-bubble-existing-chip").filter({ hasText: bubbleName })).toHaveCount(0);
});

test("authenticated desktop bubble selection clears on escape and canvas click", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only flow.");

  await page.goto("/");
  await ensureSignedIn(page);

  const firestoreUnavailable = page.getByText("Firestore is not available");
  if (await firestoreUnavailable.isVisible().catch(() => false)) {
    test.skip(true, "Firestore is unavailable in this environment.");
  }

  await expect(page.getByTestId("planner-shell")).toBeVisible();
  await ensureDesktopSidebarOpen(page);

  const bubbleName = `E2E Select Bubble ${Date.now()}`;
  await createBubbleOnFirstNode(page, bubbleName);

  await page.getByTestId("planner-bubble-existing-chip").filter({ hasText: bubbleName }).first().click();
  await expect(page.getByTestId("planner-bubble-selected-color-input")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("planner-bubble-selected-color-input")).toHaveCount(0);

  await page.getByTestId("planner-bubble-existing-chip").filter({ hasText: bubbleName }).first().click();
  await expect(page.getByTestId("planner-bubble-selected-color-input")).toBeVisible();

  await page.getByTestId("planner-reactflow-surface").click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId("planner-bubble-selected-color-input")).toHaveCount(0);
});

test("authenticated mobile bubble quick add and delete flow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile-only flow.");

  await page.goto("/");
  await ensureSignedIn(page);

  const firestoreUnavailable = page.getByText("Firestore is not available");
  if (await firestoreUnavailable.isVisible().catch(() => false)) {
    test.skip(true, "Firestore is unavailable in this environment.");
  }

  await expect(page.getByTestId("planner-shell")).toBeVisible();
  await expect(page.getByTestId("planner-mobile-toolbar-launcher")).toBeVisible();

  const firstNodeCard = page.locator("[data-testid^='planner-node-card-']").first();
  await expect(firstNodeCard).toBeVisible();
  await firstNodeCard.click();

  await page.getByTestId("planner-mobile-toolbar-launcher").click();
  const bubbleAction = page.getByTestId("planner-mobile-toolbar-bubble");
  if (!(await bubbleAction.isVisible().catch(() => false))) {
    test.skip(true, "Bubble action is not available in current config.");
  }
  await bubbleAction.click();

  await expect(page.getByTestId("planner-mobile-quick-bubble-sheet")).toBeVisible();
  const bubbleName = `E2E Bubble ${Date.now()}`;
  await page.getByTestId("planner-mobile-quick-bubble-name-input").fill(bubbleName);
  await page.getByTestId("planner-mobile-quick-bubble-add-button").click();
  await expect(page.getByTestId("planner-mobile-quick-bubble-success")).toContainText("Added:");

  const bubbleChip = page
    .getByTestId("planner-mobile-quick-bubble-node-chip")
    .filter({ hasText: bubbleName })
    .first();
  await expect(bubbleChip).toBeVisible();

  await bubbleChip.click();
  await expect(page.getByTestId("planner-mobile-quick-bubble-delete-button")).toBeVisible();
  await page.getByTestId("planner-mobile-quick-bubble-delete-button").click();
  await expect(bubbleChip).toHaveCount(0);
});

test("desktop shortcuts help opens via keyboard and palette command", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only flow.");

  await page.goto("/");
  await ensureSignedIn(page);

  const firestoreUnavailable = page.getByText("Firestore is not available");
  if (await firestoreUnavailable.isVisible().catch(() => false)) {
    test.skip(true, "Firestore is unavailable in this environment.");
  }

  await expect(page.getByTestId("planner-shell")).toBeVisible();

  const keyboardDialogPromise = page.waitForEvent("dialog");
  await page.keyboard.press("Control+Shift+/");
  const keyboardDialog = await keyboardDialogPromise;
  await expect(keyboardDialog.message()).toContain("Keyboard Shortcuts");
  await keyboardDialog.accept();

  await page.getByTestId("planner-command-palette-button").click();
  await expect(page.getByTestId("planner-command-palette-input")).toBeVisible();
  await page.getByTestId("planner-command-palette-input").fill("shortcuts");

  const paletteDialogPromise = page.waitForEvent("dialog");
  await page
    .getByTestId("planner-command-palette-item")
    .filter({ hasText: "Show keyboard shortcuts" })
    .first()
    .click();
  const paletteDialog = await paletteDialogPromise;
  await expect(paletteDialog.message()).toContain("Cmd/Ctrl+K");
  await paletteDialog.accept();
});
