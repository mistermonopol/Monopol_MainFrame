import { test, expect } from "@playwright/test";
import { mockWidgets, testCatalog, testConfig } from "./widget-fixture";

test("widget editor persists duplicates, sizes, options and independent placements", async ({
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
  await page.route("**/api/v1/dashboard/config", async (r) => {
    if (r.request().method() === "PUT") {
      saved = { ...r.request().postDataJSON(), version: saved.version + 1 };
    }
    await r.fulfill({ json: saved });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Edit widgets", exact: true }).click();
  await page.getByLabel("Add widget", { exact: true }).selectOption("metric");
  await page.getByRole("button", { name: "+ Add", exact: true }).click();
  const metric = page.locator(".widget-metric").last();
  await metric.getByLabel("Title", { exact: true }).fill("My pulse");
  await metric.getByLabel("Metric", { exact: true }).selectOption("heart_rate");
  await metric
    .getByLabel("Width", { exact: true })
    .selectOption(isMobile ? "1" : "3");
  await metric.getByLabel("Height", { exact: true }).selectOption("2");
  await metric.getByRole("button", { name: "Move up", exact: true }).click();
  await page
    .getByRole("button", { name: "Save dashboard", exact: true })
    .click();
  await expect(page.locator(".widget-metric")).toContainText("My pulse");
  expect(saved.version).toBe(1);
  const widget = saved.widgets.find((w: any) => w.title === "My pulse");
  expect(widget[isMobile ? "mobile" : "desktop"].width).toBe(isMobile ? 1 : 3);
  expect(widget[isMobile ? "desktop" : "mobile"].width).toBe(isMobile ? 6 : 2);
  await page.reload();
  await expect(page.locator(".widget-metric")).toContainText("My pulse");
  await page.getByRole("button", { name: "Edit widgets", exact: true }).click();
  await page
    .locator(".widget-metric")
    .getByRole("button", { name: "Remove widget", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".widget-metric")).toContainText("My pulse");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("configuration conflict preserves draft until explicit reload", async ({
  page,
}) => {
  const config = testConfig();
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
  await page.route("**/api/v1/dashboard/config", (r) =>
    r.request().method() === "PUT"
      ? r.fulfill({
          status: 409,
          json: { detail: "Dashboard changed. Reload before saving." },
        })
      : r.fulfill({ json: config }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Edit widgets", exact: true }).click();
  await page
    .locator(".widget-health")
    .getByLabel("Title", { exact: true })
    .fill("Unsaved");
  await page
    .getByRole("button", { name: "Save dashboard", exact: true })
    .click();
  await expect(page.locator(".widget-board").getByRole("alert")).toContainText(
    "Dashboard changed",
  );
  await expect(
    page.locator(".widget-health").getByLabel("Title", { exact: true }),
  ).toHaveValue("Unsaved");
  await page
    .getByRole("button", { name: "Reload dashboard", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit widgets", exact: true }),
  ).toBeVisible();
});

test("pulse chart loads on demand and distinguishes permissions and unavailable data", async ({
  page,
  isMobile,
}) => {
  const day = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(new Date());
  await page.route("**/api/v1/dashboard", (r) =>
    r.fulfill({
      json: {
        tasks: [],
        music: [],
        notes: [],
        events: [],
        health: {
          days: [{ day, steps: 100, heart_rate: 75, oxygen_pct: null }],
          last_sync: new Date().toISOString(),
        },
      },
    }),
  );
  await mockWidgets(page);
  await page.route("**/api/v1/health/metrics", (r) =>
    r.fulfill({
      json: {
        generation: "0",
        metrics: [
          {
            id: "heart_rate",
            permission: true,
            state: "ok",
            sources: ["watch"],
            last_sync: new Date().toISOString(),
            last_measurement: day + "T10:00:00Z",
          },
          { id: "oxygen_pct", permission: false, state: "denied", sources: [] },
        ],
      },
    }),
  );
  await page.route("**/api/v1/health/series?**", (r) =>
    r.fulfill({
      json: {
        metric: "heart_rate",
        source: "watch",
        sources: ["watch"],
        samples: [
          { at: day + "T10:00:00Z", value: 70 },
          { at: day + "T10:05:00Z", value: 80 },
        ],
        summary: { mean: 75, min: 70, max: 80 },
      },
    }),
  );
  await page.goto("/");
  if (isMobile)
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page
    .locator("aside")
    .getByRole("button", { name: "Health", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Heart rate", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("denied", { exact: true })).toBeVisible();
  await expect(page.getByText("Max 80.0 bpm", { exact: true })).toBeVisible();
  await page.getByLabel("Period", { exact: true }).selectOption("month");
  await expect(
    page.getByRole("img", { name: "Heart rate", exact: true }),
  ).toBeVisible();
});
