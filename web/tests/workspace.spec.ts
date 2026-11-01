import { test, expect } from "@playwright/test";

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
      return route.fulfill({ status: 401, json: { detail: "Bitte anmelden" } });
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
    .getByLabel("Passwort", { exact: true })
    .fill("my-private-password-2026");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Neue Aufgabe", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Passwort", { exact: true })).toHaveCount(0);
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
  await expect(page.getByText("Server verbunden")).toBeVisible();
  await page.getByRole("button", { name: "Neue Aufgabe", exact: true }).click();
  await page.getByLabel("Titel", { exact: true }).fill("Musik-Content planen");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Musik-Content planen/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Erledigen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Als offen markieren" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Musik-Content planen/ }).click();
  await page
    .getByLabel("Titel", { exact: true })
    .fill("Release-Content planen");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
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
    page.getByRole("button", { name: "Neue Aufgabe", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Letzter geladener Stand:", { exact: false }),
  ).toBeVisible();
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
  await expect(page.getByText("Nicht verbunden", { exact: true })).toHaveCount(
    3,
  );
  await expect(page.locator(".stat strong").first()).toHaveText("—");
  if (isMobile)
    await page
      .getByRole("button", { name: "Navigation öffnen", exact: true })
      .click();
  await page.getByRole("button", { name: "Gesundheit", exact: true }).click();
  await expect(page.getByText("Noch keine Gesundheitsdaten.")).toBeVisible();
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
      name: "Navigation öffnen",
      exact: true,
    });
    await expect(sidebar).toBeHidden();
    await trigger.click();
    await expect(
      page.getByRole("dialog", { name: "Seitennavigation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Navigation schließen", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sidebar).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page
      .getByRole("button", { name: "Einstellungen", exact: true })
      .click();
    await expect(sidebar).toBeHidden();
  } else {
    await page
      .getByRole("button", { name: "Seitenleiste einklappen", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Seitenleiste ausklappen",
        exact: true,
      }),
    ).toHaveAttribute("aria-expanded", "false");
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Seitenleiste ausklappen",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Einstellungen", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Seitenleiste ausklappen", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Seitenleiste einklappen",
        exact: true,
      }),
    ).toHaveAttribute("aria-expanded", "true");
  }
  await expect(
    page.getByRole("heading", { name: "Einstellungen", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
