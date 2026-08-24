import { test, expect } from "@playwright/test";

test("health check", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.status).toBeDefined();
});

test("schedule CRUD flow (auth mocked)", async ({ page }) => {
  // This is a scaffold — fill with auth helpers + mocked Google token
  // Example: add class, search, export .ics
  await page.goto("/");
  await expect(page.locator("text=Scheduler")).toBeVisible();
});
