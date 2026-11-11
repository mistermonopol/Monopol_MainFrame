import { mockWidgets } from "./widget-fixture";
import { test, expect } from "@playwright/test";
test("agent saves a task and the knowledge graph opens linked notes", async ({
  page,
  isMobile,
}) => {
  let tasks: any[] = [];
  const actions = [
    {
      type: "create_item",
      title: "Agent task",
      kind: "tasks",
      id: "agent-task",
    },
  ];
  await page.route("**/api/v1/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    let json: any = {};
    if (path.endsWith("/dashboard"))
      json = {
        tasks,
        music: [],
        notes: [],
        events: [],
        health: { days: [], last_sync: null },
      };
    else if (path.endsWith("/integrations"))
      json = {
        ai: true,
        obsidian: true,
        writes: true,
        brain: "mono_frame_brain",
        model: "test",
      };
    else if (path.endsWith("/agent/activity"))
      json = tasks.length ? [{ actions, finished: true }] : [];
    else if (path.endsWith("/agent/chat")) {
      expect(r.request().postDataJSON().request_id).toMatch(/^[a-f0-9-]{36}$/);
      tasks = [
        {
          id: "agent-task",
          version: 1,
          title: "Agent task",
          description: "",
          completed: false,
        },
      ];
      json = { reply: "Saved the task.", actions };
    } else if (path.endsWith("/obsidian/notes"))
      json = [
        { path: "AI_Brain.md", title: "AI_Brain" },
        { path: "Music.md", title: "Music" },
      ];
    else if (path.endsWith("/obsidian/graph"))
      json = {
        name: "mono_frame_brain",
        total: 2,
        truncated: false,
        unresolved: 0,
        skipped: 0,
        nodes: [
          { path: "AI_Brain.md", title: "AI_Brain", links: 1 },
          { path: "Music.md", title: "Music", links: 1 },
        ],
        edges: [{ source: "AI_Brain.md", target: "Music.md" }],
      };
    else if (path.endsWith("/obsidian/note"))
      json = {
        path: "Music.md",
        content: "# Music\n[[AI_Brain]]",
        version: "one",
      };
    await r.fulfill({ json });
  });
  async function nav(name: string) {
    if (isMobile)
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
    await page
      .locator("aside")
      .getByRole("button", { name, exact: true })
      .click();
  }
  await mockWidgets(page);
  await page.goto("/");
  await nav("AI Agent");
  await page.getByLabel("Message the agent").fill("Create an Agent task");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Saved the task.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".agent-actions")).toContainText("Agent task");
  await nav("Tasks");
  await expect(page.getByRole("button", { name: /Agent task/ })).toBeVisible();
  await nav("Obsidian");
  const graph = page.getByRole("region", {
    name: "Knowledge graph",
    exact: true,
  });
  await expect(
    graph.getByRole("heading", { name: "mono_frame_brain" }),
  ).toBeVisible();
  await graph
    .getByRole("button", { name: "Music: 1 Connections", exact: true })
    .click();
  await graph.getByRole("button", { name: "Open note", exact: true }).click();
  await expect(page.getByLabel("Markdown content")).toHaveValue(
    "# Music\n[[AI_Brain]]",
  );
  await graph.getByLabel("Search graph").fill("Music");
  await graph.getByRole("button", { name: "Zoom in", exact: true }).click();
  expect(
    await page.locator("body").evaluate((e) => e.scrollWidth <= innerWidth),
  ).toBe(true);
});

test("task editor saves explicit reminder settings and browser push can be toggled", async ({
  page,
  isMobile,
}) => {
  let subscription: any = null,
    saved: any = null;
  await page.addInitScript(() => {
    let current: any = null;
    const manager = {
      getSubscription: async () => current,
      subscribe: async () => {
        current = {
          endpoint: "https://fcm.googleapis.com/fcm/send/test",
          toJSON: () => ({
            endpoint: "https://fcm.googleapis.com/fcm/send/test",
            keys: { p256dh: "test-key", auth: "test-auth" },
          }),
          unsubscribe: async () => {
            current = null;
            return true;
          },
        };
        return current;
      },
    };
    const reg = { pushManager: manager };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: async () => reg,
        register: async () => reg,
        ready: Promise.resolve(reg),
      },
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        requestPermission: async () => "granted",
      },
    });
    if (!("PushManager" in window))
      Object.defineProperty(window, "PushManager", { value: class {} });
  });
  await page.route("**/api/v1/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    let json: any = {};
    if (path.endsWith("/dashboard"))
      json = {
        tasks: saved ? [saved] : [],
        music: [],
        notes: [],
        events: [],
        health: { days: [], last_sync: null },
      };
    else if (path.endsWith("/notifications/config"))
      json = {
        public_key:
          "BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      };
    else if (path.endsWith("/notifications/subscriptions"))
      subscription = r.request().postDataJSON();
    else if (path.endsWith("/notifications/unsubscribe")) subscription = null;
    else if (path.endsWith("/items/tasks")) {
      saved = { ...r.request().postDataJSON(), id: "task-1", version: 1 };
      json = saved;
    }
    await r.fulfill({ json });
  });
  await mockWidgets(page);
  await page.goto("/");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Reminder task");
  await page
    .getByLabel("Custom reminder time (local device time)", { exact: true })
    .fill("2026-12-01T14:30");
  await page.getByLabel("Reminder enabled", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Reminder task/ }),
  ).toBeVisible();
  expect(saved.reminders_enabled).toBe(false);
  expect(saved.remind_at).toMatch(/^2026-12-01T/);
  if (isMobile)
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page
    .locator("aside")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Enable notifications", exact: true })
    .click();
  await expect(
    page.getByText("Notifications enabled", { exact: true }),
  ).toBeVisible();
  expect(subscription.endpoint).toContain("fcm.googleapis.com");
  await page
    .getByRole("button", { name: "Disable notifications", exact: true })
    .click();
  await expect(
    page.getByText("Notifications disabled", { exact: true }),
  ).toBeVisible();
  expect(subscription).toBe(null);
});
