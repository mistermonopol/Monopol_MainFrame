import { test, expect } from "@playwright/test";

async function openSettings(
  page: import("@playwright/test").Page,
  isMobile: boolean,
) {
  if (isMobile)
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
}

test("English is default and language plus light theme persist with sharp corners", async ({
  page,
  isMobile,
}) => {
  await page.route("**/api/v1/dashboard", (r) =>
    r.fulfill({
      json: {
        tasks: [],
        notes: [],
        events: [],
        health: { days: [], last_sync: null },
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Welcome to MainFrame." }),
  ).toBeVisible();
  await expect(
    page.getByText("Monopol_MainFrame your App for Everything", {
      exact: true,
    }),
  ).toHaveCount(2);
  await openSettings(page, isMobile);
  await page.getByLabel("Theme", { exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const rounded = await page
    .locator(".shell button,.shell input,.shell select,.shell .card")
    .evaluateAll((elements) =>
      elements.some(
        (element) =>
          parseFloat(getComputedStyle(element).borderTopLeftRadius) !== 0,
      ),
    );
  expect(rounded).toBe(false);
  await page.getByLabel("Language", { exact: true }).selectOption("de");
  await expect(
    page.getByRole("heading", { name: "Einstellungen", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  if (isMobile)
    await page
      .getByRole("button", { name: "Navigation öffnen", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await page.getByLabel("Sprache", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(
    /Life OS|live os/i,
  );
});

test("overview switches daily weekly and monthly step charts using recorded values", async ({
  page,
}) => {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(new Date());
  await page.route("**/api/v1/dashboard", (r) =>
    r.fulfill({
      json: {
        tasks: [],
        notes: [],
        events: [],
        health: {
          days: [
            {
              day: today,
              steps: 1200,
              sleep_minutes: null,
              resting_pulse: null,
              weight_kg: null,
            },
          ],
          last_sync: new Date().toISOString(),
        },
      },
    }),
  );
  await page.goto("/");
  const chart = page.getByRole("region", { name: "Steps chart", exact: true });
  await expect(chart.locator(".chart-column")).toHaveCount(14);
  await expect(chart.locator('.step-bar[data-steps="1200"]')).toHaveCount(1);
  await chart.getByRole("button", { name: "Weekly", exact: true }).click();
  await expect(chart.locator(".chart-column")).toHaveCount(8);
  await expect(chart.locator('.step-bar[data-steps="1200"]')).toHaveCount(1);
  await chart.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(chart.locator(".chart-column")).toHaveCount(12);
  await expect(chart.locator('.step-bar[data-steps="1200"]')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("password login opens the workspace without an external provider", async ({
  page,
}) => {
  let loggedIn = false;
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().url().endsWith("/auth/login")) {
      expect(route.request().postDataJSON()).toEqual({
        password: "my-private-password-2026",
      });
      loggedIn = true;
      return route.fulfill({ json: { ok: true } });
    }
    if (!loggedIn)
      return route.fulfill({ status: 401, json: { detail: "Please sign in" } });
    return route.fulfill({
      json: {
        tasks: [],
        notes: [],
        events: [],
        health: { days: [], last_sync: null },
      },
    });
  });
  await page.goto("/");
  await page
    .getByLabel("Password", { exact: true })
    .fill("my-private-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "New task", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
});
test.beforeEach(({ page }) => {
  page.on("pageerror", (error) =>
    console.error("Browser error:", error.message),
  );
});

test("create, complete and edit an actual dashboard task", async ({ page }) => {
  const tasks: any[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (path.endsWith("/dashboard"))
      return route.fulfill({
        json: {
          tasks,
          notes: [],
          events: [],
          health: { days: [], last_sync: null },
        },
      });
    const body = req.postDataJSON();
    if (req.method() === "POST") {
      const item = { ...body, id: "task-1", version: 1 };
      tasks.push(item);
      return route.fulfill({ status: 201, json: item });
    }
    if (req.method() === "PUT") {
      tasks[0] = { ...tasks[0], ...body, version: tasks[0].version + 1 };
      return route.fulfill({ json: tasks[0] });
    }
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/");
  await expect(page.getByText("Server connected")).toBeVisible();
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Musik-Content planen");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Musik-Content planen/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mark as incomplete" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Musik-Content planen/ }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Release-Content planen");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Release-Content planen/ }),
  ).toBeVisible();
});

test("offline cache stays readable and writes are disabled", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "life-cache",
      JSON.stringify({
        loaded: "2026-11-01T09:00:00Z",
        data: {
          tasks: [
            {
              id: "1",
              version: 1,
              title: "Offline-Aufgabe",
              description: "",
              completed: false,
            },
          ],
          notes: [],
          events: [],
          health: { days: [], last_sync: null },
        },
      }),
    ),
  );
  await page.route("**/api/v1/**", (r) => r.abort());
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Offline-Aufgabe/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New task", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("Last loaded:", { exact: false })).toBeVisible();
});

test("missing health values and disconnected services are explicit", async ({
  page,
  isMobile,
}) => {
  await page.route("**/api/v1/dashboard", (r) =>
    r.fulfill({
      json: {
        tasks: [],
        notes: [],
        events: [],
        health: { days: [], last_sync: null },
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByText("Not connected", { exact: true })).toHaveCount(3);
  await expect(page.locator(".stat strong").first()).toHaveText("—");
  if (isMobile)
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page.getByRole("button", { name: "Health", exact: true }).click();
  await expect(page.getByText("No health data yet.")).toBeVisible();
});

test("left navigation collapses on desktop and opens as a keyboard accessible mobile drawer", async ({
  page,
  isMobile,
}) => {
  await page.route("**/api/v1/dashboard", (route) =>
    route.fulfill({
      json: {
        tasks: [],
        notes: [],
        events: [],
        health: { days: [], last_sync: null },
      },
    }),
  );
  await page.goto("/");
  await expect(page).toHaveTitle("Monopol_MainFrame");
  const sidebar = page.locator("#sidebar");
  if (isMobile) {
    const trigger = page.getByRole("button", {
      name: "Open navigation",
      exact: true,
    });
    await expect(sidebar).toBeHidden();
    await trigger.click();
    await expect(
      page.getByRole("dialog", { name: "Sidebar navigation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close navigation", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sidebar).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(sidebar).toBeHidden();
  } else {
    await page
      .getByRole("button", { name: "Collapse sidebar", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Expand sidebar",
        exact: true,
      }),
    ).toHaveAttribute("aria-expanded", "false");
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Expand sidebar",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByRole("button", { name: "Expand sidebar", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Collapse sidebar",
        exact: true,
      }),
    ).toHaveAttribute("aria-expanded", "true");
  }
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
