import { Page } from "@playwright/test";
export const testCatalog = [
  {
    type: "health",
    title: "Health",
    sizes: [3, 6, 12],
    options: {
      metrics: ["steps", "sleep_minutes", "resting_pulse", "heart_rate"],
    },
  },
  {
    type: "metric",
    title: "Metric",
    sizes: [3, 6, 12],
    options: { metric: "heart_rate" },
  },
  {
    type: "chart",
    title: "Chart",
    sizes: [3, 6, 12],
    options: { metric: "steps", period: "week" },
  },
  {
    type: "tasks",
    title: "Tasks",
    sizes: [3, 6, 12],
    options: { filter: "all" },
  },
  {
    type: "music",
    title: "Music",
    sizes: [3, 6, 12],
    options: { project_id: "" },
  },
  {
    type: "lights",
    title: "Lights",
    sizes: [3, 6, 12],
    options: { entity_ids: [] },
  },
  {
    type: "obsidian",
    title: "Obsidian",
    sizes: [3, 6, 12],
    options: { path: "" },
  },
  { type: "agent", title: "AI chat", sizes: [3, 6, 12], options: {} },
];
export function testConfig() {
  return {
    version: 0,
    widgets: testCatalog
      .filter((c) => ["health", "chart", "tasks", "music"].includes(c.type))
      .map((c, i) => ({
        id: "default-" + c.type,
        type: c.type,
        title: "",
        options: structuredClone(c.options),
        desktop: { order: i, width: c.type === "health" ? 12 : 6, height: 1 },
        mobile: { order: i, width: 2, height: 1 },
      })),
  };
}
export async function mockWidgets(page: Page) {
  await page.route("**/api/v1/dashboard/config", (r) =>
    r.fulfill({ json: testConfig() }),
  );
  await page.route("**/api/v1/dashboard/catalog", (r) =>
    r.fulfill({ json: testCatalog }),
  );
  await page.route("**/api/v1/health/metrics", (r) =>
    r.fulfill({ json: { generation: "0", metrics: [] } }),
  );
}
