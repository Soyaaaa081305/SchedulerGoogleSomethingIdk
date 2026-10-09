import { expect, test, type Locator, type Page } from "@playwright/test";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/2ioAAAAASUVORK5CYII=",
  "base64"
);

const weekdays = ["TUE", "WED", "THU", "FRI", "SAT", "SUN", "MON"];

function importedCourses(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const slot = Math.floor(index / weekdays.length);
    const startHour = 10 + slot * 2;
    return {
      courseName: `Course ${String(index + 1).padStart(2, "0")}`,
      daysOfWeek: [weekdays[index % weekdays.length]],
      startTime: `${String(startHour).padStart(2, "0")}:00`,
      endTime: `${String(startHour + 1).padStart(2, "0")}:00`,
      room: `Room ${index + 1}`,
    };
  });
}

function asSchedule(course: ReturnType<typeof importedCourses>[number], id: string, synced = false) {
  return {
    id,
    ...course,
    googleEventId: synced ? `event-${id}` : null,
    lastSyncedAt: synced ? new Date().toISOString() : null,
    synced,
  };
}

async function openPreview(page: Page) {
  await page.goto("/e2e-preview");
  await expect(page.getByRole("heading", { name: "Scheduler" })).toBeVisible();
  await expect(page.locator('[data-dashboard-ready="true"]')).toBeVisible();
}

async function expectDialogCentered(dialog: Locator, page: Page) {
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  const safeArea = await page.locator("[data-dialog-overlay]").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      top: Number.parseFloat(style.paddingTop),
      right: Number.parseFloat(style.paddingRight),
      bottom: Number.parseFloat(style.paddingBottom),
      left: Number.parseFloat(style.paddingLeft),
    };
  });
  const centerX = bounds!.x + bounds!.width / 2;
  const centerY = bounds!.y + bounds!.height / 2;
  expect(Math.abs(centerX - (viewport!.width + safeArea.left - safeArea.right) / 2)).toBeLessThan(3);
  expect(Math.abs(centerY - (viewport!.height + safeArea.top - safeArea.bottom) / 2)).toBeLessThan(4);
  expect(bounds!.x).toBeGreaterThanOrEqual(safeArea.left - 1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width - safeArea.right + 1);
  expect(bounds!.y).toBeGreaterThanOrEqual(safeArea.top - 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height - safeArea.bottom + 1);
  expect(safeArea.top).toBeGreaterThanOrEqual(16);
  expect(safeArea.right).toBeGreaterThanOrEqual(16);
  expect(safeArea.bottom).toBeGreaterThanOrEqual(16);
  expect(safeArea.left).toBeGreaterThanOrEqual(16);
}

test("health check", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).status).toBeDefined();
});

test("class dialog stays centered, traps focus, and restores page scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 460 });
  await openPreview(page);

  const openButton = page.getByRole("button", { name: "+ Add class" });
  await openButton.scrollIntoViewIfNeeded();
  await openButton.focus();
  const scrollBeforeOpen = await page.evaluate(() => window.scrollY);
  await openButton.click();

  const dialog = page.getByRole("dialog", { name: "Add a class" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Course name" })).toBeFocused();
  await expectDialogCentered(dialog, page);
  expect(await page.locator("body").evaluate((body) => getComputedStyle(body).position)).toBe("fixed");

  await dialog.getByRole("button", { name: "Add class" }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(openButton).toBeFocused();
  expect(await page.locator("body").evaluate((body) => body.style.position)).toBe("");
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBeforeOpen)).toBeLessThan(2);
});

test("long imported schedules scroll inside the dialog and sync in the background", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 460 });
  await openPreview(page);
  const courses = importedCourses(18);
  const unsynced = courses.map((course, index) => asSchedule(course, `new-${index + 1}`));
  const synced = courses.map((course, index) => asSchedule(course, `new-${index + 1}`, true));
  let settingsSaved = false;

  await page.route("**/api/upload", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ courses }) })
  );
  await page.route("**/api/settings", (route) => {
    settingsSaved = true;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        settings: {
          reminderEnabled: false,
          reminderTime: "21:00",
          timezone: "Asia/Manila",
          semesterEnd: null,
        },
      }),
    });
  });
  await page.route("**/api/schedules/batch", async (route) => {
    const body = route.request().postDataJSON() as { schedules: unknown[] };
    expect(body.schedules).toHaveLength(18);
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ schedules: unsynced }) });
  });
  await page.route("**/api/schedules/sync", async (route) => {
    expect(settingsSaved).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        created: 18,
        repaired: 0,
        failed: 0,
        firstError: null,
        results: synced.map((schedule) => ({
          scheduleId: schedule.id,
          status: "created",
          googleEventId: schedule.googleEventId,
        })),
      }),
    });
  });
  await page.route("**/api/schedules", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schedules: synced }) })
      : route.continue()
  );

  await page.locator('input[type="file"]').setInputFiles({
    name: "timetable.png",
    mimeType: "image/png",
    buffer: onePixelPng,
  });

  const dialog = page.getByRole("dialog", { name: "Review imported schedule" });
  await expect(dialog).toBeVisible();
  await expectDialogCentered(dialog, page);
  await expect(dialog.locator('input[type="checkbox"]').first()).toBeFocused();

  const scrollRegion = dialog.locator(".overflow-y-auto").first();
  const dimensions = await scrollRegion.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
  await scrollRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await scrollRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Save 18 classes" }).click();
  await expect(dialog).toBeHidden();
  expect(await page.locator("body").evaluate((body) => body.style.position)).toBe("");
  await expect(page.getByText("Course 01", { exact: true })).toBeVisible();
  await expect(page.getByText("syncing", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("synced", { exact: true }).first()).toBeVisible({ timeout: 5_000 });
  expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain("scheduler-upload-preview");
});

test("review dialog dismisses by Escape and backdrop on a short screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 460 });
  await openPreview(page);
  await page.route("**/api/upload", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ courses: importedCourses(1) }),
    })
  );

  const uploadZone = page.getByRole("button", { name: "Upload schedule image or .ics file" });
  const input = page.locator('input[type="file"]');
  const dialog = page.getByRole("dialog", { name: "Review imported schedule" });

  await uploadZone.focus();
  const scrollBeforeOpen = await page.evaluate(() => window.scrollY);
  await input.setInputFiles({ name: "first.png", mimeType: "image/png", buffer: onePixelPng });
  await expect(dialog).toBeVisible();
  await expectDialogCentered(dialog, page);
  await expect(dialog.locator('input[type="checkbox"]').first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(uploadZone).toBeFocused();
  expect(await page.locator("body").evaluate((body) => body.style.position)).toBe("");
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBeforeOpen)).toBeLessThan(2);

  await uploadZone.focus();
  await input.setInputFiles({ name: "second.png", mimeType: "image/png", buffer: onePixelPng });
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  await expect(uploadZone).toBeFocused();
  expect(await page.locator("body").evaluate((body) => body.style.position)).toBe("");
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBeforeOpen)).toBeLessThan(2);
});

test("replacing a pending image ignores the older extraction result", async ({ page }) => {
  await openPreview(page);
  let requestCount = 0;
  await page.route("**/api/upload", async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ courses: importedCourses(1).map((course) => ({ ...course, courseName: "Stale Course" })) }),
      }).catch(() => undefined);
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ courses: importedCourses(1).map((course) => ({ ...course, courseName: "Fresh Course" })) }),
    });
  });

  const input = page.locator('input[type="file"]');
  const firstRequest = page.waitForRequest("**/api/upload");
  await input.setInputFiles({ name: "first.png", mimeType: "image/png", buffer: onePixelPng });
  await firstRequest;
  await input.setInputFiles({ name: "second.png", mimeType: "image/png", buffer: onePixelPng });
  const dialog = page.getByRole("dialog", { name: "Review imported schedule" });
  await expect(dialog.getByRole("textbox", { name: /Course name for row/ })).toHaveValue("Fresh Course");
  await page.waitForTimeout(600);
  await expect(dialog.getByRole("textbox", { name: /Course name for row/ })).toHaveValue("Fresh Course");
});

test("upload timeout is clear and the student can retry", async ({ page }) => {
  await openPreview(page);
  let attempts = 0;
  await page.route("**/api/upload", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({ error: "Reading your schedule timed out. Try again." }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ courses: importedCourses(1) }),
    });
  });

  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: "timetable.png", mimeType: "image/png", buffer: onePixelPng });
  await expect(page.getByText(/timed out/i)).toBeVisible();
  await input.setInputFiles({ name: "timetable.png", mimeType: "image/png", buffer: onePixelPng });
  await expect(page.getByRole("dialog", { name: "Review imported schedule" })).toBeVisible();
  expect(attempts).toBe(2);
});

test("failed background sync keeps saved classes and Sync now retries without resaving", async ({ page }) => {
  await openPreview(page);
  const [course] = importedCourses(1);
  let saved = asSchedule(course, "retry-class");
  let batchSaves = 0;
  let syncAttempts = 0;

  await page.route("**/api/upload", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ courses: [course] }) })
  );
  await page.route("**/api/settings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ settings: { reminderEnabled: false, reminderTime: "21:00", timezone: "Asia/Manila", semesterEnd: null } }),
    })
  );
  await page.route("**/api/schedules/batch", async (route) => {
    batchSaves += 1;
    expect(route.request().postDataJSON()).toMatchObject({ schedules: [course] });
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ schedules: [saved] }) });
  });
  await page.route("**/api/schedules/sync", async (route) => {
    syncAttempts += 1;
    if (syncAttempts === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          created: 0,
          repaired: 0,
          failed: 1,
          firstError: "Google Calendar is unavailable.",
          results: [{ scheduleId: saved.id, status: "failed", googleEventId: null, error: "Google Calendar is unavailable." }],
        }),
      });
      return;
    }
    saved = asSchedule(course, "retry-class", true);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        created: 1,
        repaired: 0,
        failed: 0,
        firstError: null,
        results: [{ scheduleId: saved.id, status: "created", googleEventId: saved.googleEventId }],
      }),
    });
  });
  await page.route("**/api/schedules", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schedules: [saved] }) })
      : route.continue()
  );

  const uploadInput = page.locator('input[type="file"]');
  await uploadInput.setInputFiles({
    name: "timetable.png",
    mimeType: "image/png",
    buffer: onePixelPng,
  });
  const wizard = page.getByRole("dialog", { name: "Review imported schedule" });
  await expect(page.getByText(/Found 1 course/)).toBeVisible({ timeout: 10_000 });
  await expect(wizard).toBeVisible();
  await wizard.getByRole("button", { name: "Next" }).click();
  await wizard.getByRole("button", { name: "Next" }).click();
  await wizard.getByRole("button", { name: "Next" }).click();
  await wizard.getByRole("button", { name: "Save 1 class" }).click();

  await expect(wizard).toBeHidden();
  await expect(page.getByText("Course 01", { exact: true })).toBeVisible();
  await expect(page.getByText("unsynced", { exact: true })).toBeVisible();
  await expect(page.getByText(/saved but not synced/i)).toBeVisible();
  await expect.poll(() => syncAttempts).toBe(1);

  await page.route("**/api/ical/token", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ feedUrl: "https://example.test/calendar.ics" }) })
  );
  await page.goto("/e2e-preview/settings");
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByRole("main").getByText("Synced 1 class to Google Calendar.")).toBeVisible();
  expect(syncAttempts).toBe(2);
  expect(batchSaves).toBe(1);
});

test("command palette opens accessibly on touch and keyboard", async ({ page }, testInfo) => {
  await openPreview(page);
  const trigger = page.getByRole("button", { name: "Open command palette" });
  await trigger.focus();
  await trigger.click();
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await expectDialogCentered(palette, page);
  await expect(palette.getByRole("textbox", { name: "Search classes and settings" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await page.locator("body").evaluate((body) => body.style.position)).toBe("");

  await trigger.click();
  await expect(palette).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(palette).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await page.locator("body").evaluate((body) => body.style.position)).toBe("");

  if (testInfo.project.name !== "webkit-mobile") {
    await page.keyboard.press("Control+k");
    await expect(palette).toBeVisible();
    await expectDialogCentered(palette, page);
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  }
});

test("confirmation and onboarding dialogs close and restore page scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 460 });
  await openPreview(page);
  const deleteTrigger = page.getByRole("button", { name: "Delete CS 101" });
  await deleteTrigger.click();
  const confirmation = page.getByRole("dialog", { name: "Delete this class?" });
  await expect(confirmation).toBeVisible();
  await expectDialogCentered(confirmation, page);
  await expect(confirmation.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(deleteTrigger).toBeFocused();
  expect(await page.locator("body").evaluate((body) => body.style.position)).toBe("");

  await deleteTrigger.click();
  await expect(confirmation).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(confirmation).toBeHidden();
  expect(await page.locator("body").evaluate((body) => body.style.position)).toBe("");

  await page.goto("/e2e-preview/onboarding");
  const onboarding = page.getByRole("dialog", { name: "Welcome to Scheduler" });
  await expect(onboarding).toBeVisible({ timeout: 3_000 });
  await expectDialogCentered(onboarding, page);
  await expect(onboarding.getByRole("button", { name: "Next" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(onboarding).toBeHidden();
  expect(await page.locator("body").evaluate((body) => body.style.position)).toBe("");

  await page.reload();
  await expect(onboarding).toBeVisible({ timeout: 3_000 });
  await expectDialogCentered(onboarding, page);
  await page.mouse.click(2, 2);
  await expect(onboarding).toBeHidden();
  expect(await page.locator("body").evaluate((body) => body.style.position)).toBe("");
});
