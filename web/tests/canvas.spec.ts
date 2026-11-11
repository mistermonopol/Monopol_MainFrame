import { test, expect } from "@playwright/test";
import { mockWidgets, testConfig } from "./widget-fixture";
test("cogwheel edits the actual Home content with text, clocks and responsive boxes", async ({
  page,
  isMobile,
}) => {
  let saved: any = testConfig();
  await page.route("**/api/v1/dashboard", (r) =>
    r.fulfill({
      json: {
        tasks: [],
        music: [],
        notes: [],
        events: [],
        health: { days: [], last_sync: null },
      },
    }),
  );
  await mockWidgets(page);
  await page.route("**/api/v1/dashboard/config", (r) => {
    if (r.request().method() === "PUT")
      saved = { ...r.request().postDataJSON(), version: saved.version + 1 };
    return r.fulfill({ json: saved });
  });
  await page.goto("/");
  await page.getByTitle("Edit Home layout", { exact: true }).click();
  await page.getByLabel("Add widget", { exact: true }).selectOption("box");
  await page.getByRole("button", { name: "+ Add", exact: true }).click();
  const box = page.locator(".widget-box");
  await box.getByLabel("Title", { exact: true }).fill("My morning");
  await box
    .getByLabel("Width", { exact: true })
    .selectOption(isMobile ? "2" : "7");
  await page
    .getByRole("button", { name: "Close element settings", exact: true })
    .click();
  const boxId = await box.getAttribute("data-element-id");
  await page.getByLabel("Add to", { exact: true }).selectOption(boxId!);
  await page.getByLabel("Add widget", { exact: true }).selectOption("text");
  await page.getByRole("button", { name: "+ Add", exact: true }).click();
  const text = box.locator(".widget-text");
  await text
    .getByLabel("Text content", { exact: true })
    .fill("My Home. My layout.");
  await text.getByLabel("Font size", { exact: true }).fill("24");
  await text.getByLabel("Alignment", { exact: true }).selectOption("center");
  await page
    .getByRole("button", { name: "Close element settings", exact: true })
    .click();
  await page.getByLabel("Add widget", { exact: true }).selectOption("clock");
  await page.getByRole("button", { name: "+ Add", exact: true }).click();
  const clock = box.locator(".widget-clock");
  await clock.getByLabel("Time zone", { exact: true }).fill("UTC");
  await clock.getByLabel("Seconds", { exact: true }).check();
  await page
    .getByRole("button", { name: "Close element settings", exact: true })
    .click();
  await page
    .locator('[data-element-id="home-welcome"]')
    .getByRole("button", { name: "Remove widget", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save dashboard", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome to MainFrame.", exact: true }),
  ).toHaveCount(0);
  await expect(box.locator(".canvas-text")).toHaveText("My Home. My layout.");
  await expect(box.locator(".canvas-text")).toHaveCSS("text-align", "center");
  await expect(box.locator(".canvas-timezone")).toHaveText("UTC");
  const initial = await clock.locator("time").getAttribute("datetime");
  await expect
    .poll(() => clock.locator("time").getAttribute("datetime"))
    .not.toBe(initial);
  expect(
    saved.widgets.find((w: any) => w.type === "box")[
      isMobile ? "mobile" : "desktop"
    ].width,
  ).toBe(isMobile ? 2 : 7);
  expect(saved.widgets.filter((w: any) => w.parent_id === boxId)).toHaveLength(
    2,
  );
  await page.reload();
  await expect(box.locator(".canvas-text")).toHaveText("My Home. My layout.");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("canvas drag moves an element into a box and its corner handle resizes it", async ({
  page,
  isMobile,
}) => {
  let saved: any = {
    version: 1,
    editor_version: 2,
    widgets: [
      {
        id: "text",
        type: "text",
        title: "Text",
        options: { text: "Move me", size: 24, align: "left", bold: false },
        desktop: { order: 0, width: 4, height: 1 },
        mobile: { order: 0, width: 1, height: 1 },
      },
      {
        id: "box",
        type: "box",
        title: "My box",
        options: {},
        desktop: { order: 1, width: 8, height: 1 },
        mobile: { order: 1, width: 2, height: 1 },
      },
    ],
  };
  await page.route("**/api/v1/dashboard", (r) =>
    r.fulfill({
      json: {
        tasks: [],
        music: [],
        notes: [],
        events: [],
        health: { days: [], last_sync: null },
      },
    }),
  );
  await mockWidgets(page);
  await page.route("**/api/v1/dashboard/config", (r) => {
    if (r.request().method() === "PUT")
      saved = { ...r.request().postDataJSON(), version: 2 };
    return r.fulfill({ json: saved });
  });
  await page.goto("/");
  await page.getByTitle("Edit Home layout", { exact: true }).click();
  await page
    .locator('[data-element-id="text"]')
    .getByRole("button", { name: "Drag widget", exact: true })
    .dragTo(page.locator('[data-element-id="box"]>.widget-heading'));
  const child = page.locator(
    '[data-element-id="box"] [data-element-id="text"]',
  );
  await expect(child).toBeVisible();
  const handle = child.getByRole("button", {
    name: "Resize element",
    exact: true,
  });
  await handle.scrollIntoViewIfNeeded();
  const rect = (await handle.boundingBox())!;
  const step = await child.evaluate(
    (e, mobile) =>
      e.closest(".widget-grid")!.getBoundingClientRect().width /
      (mobile ? 2 : 12),
    isMobile,
  );
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width / 2 + step,
    rect.y + rect.height / 2,
  );
  await page.mouse.up();
  await page
    .getByRole("button", { name: "Save dashboard", exact: true })
    .click();
  expect(saved.widgets.find((w: any) => w.id === "text").parent_id).toBe("box");
  expect(
    saved.widgets.find((w: any) => w.id === "text")[
      isMobile ? "mobile" : "desktop"
    ].width,
  ).toBe(isMobile ? 2 : 5);
});
