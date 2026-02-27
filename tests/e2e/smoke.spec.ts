import { expect, test, type Page } from "@playwright/test";

async function isVisible(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().isVisible().catch(() => false);
}

async function ensureSignedIn(page: Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated smoke tests.");

  if (await page.getByRole("button", { name: "Sign out" }).isVisible().catch(() => false)) {
    return;
  }

  const loginForm = page.locator("form.auth-form").first();
  await expect(loginForm).toBeVisible();

  await loginForm.getByLabel("Email").fill(email ?? "");
  await loginForm.getByLabel("Password").fill(password ?? "");
  await loginForm.getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

test("app bootstraps without crash", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Something went wrong")).toHaveCount(0);

  const hasAuthCard = await isVisible(page, ".auth-card");
  const hasPlannerShell = await isVisible(page, ".planner-shell");
  const hasEmptyState = await isVisible(page, ".planner-empty-state");
  expect(hasAuthCard || hasPlannerShell || hasEmptyState).toBeTruthy();
});

test("forgot password screen is reachable from sign in", async ({ page }) => {
  await page.goto("/");

  if (await page.getByText("Firebase is not configured").isVisible().catch(() => false)) {
    test.skip(true, "Firebase env is missing in this environment.");
  }

  if (await page.getByRole("button", { name: "Sign out" }).isVisible().catch(() => false)) {
    test.skip(true, "Session is already authenticated.");
  }

  const forgotButton = page.getByRole("button", { name: "Forgot password?" });
  if (!(await forgotButton.isVisible().catch(() => false))) {
    test.skip(true, "Sign-in form is not visible in this environment.");
  }

  await forgotButton.click();
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  await page.getByRole("button", { name: /Back to sign in/ }).click();
  await expect(
    page.locator("form.auth-form").first().getByRole("button", { name: /^Sign in$/ })
  ).toBeVisible();
});

test("authenticated planner smoke (desktop/mobile)", async ({ page }) => {
  await page.goto("/");
  await ensureSignedIn(page);

  const firestoreUnavailable = page.getByText("Firestore is not available");
  if (await firestoreUnavailable.isVisible().catch(() => false)) {
    test.skip(true, "Firestore is unavailable in this environment.");
  }

  await expect(page.locator(".planner-shell")).toBeVisible();

  const hasMobileTabs = await isVisible(page, ".planner-mobile-section-tabs");
  if (hasMobileTabs) {
    await expect(page.getByRole("button", { name: "Project" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Node" })).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: /Command palette/i })).toBeVisible();
    await expect(page.locator(".planner-search-input")).toBeVisible();
  }
});
