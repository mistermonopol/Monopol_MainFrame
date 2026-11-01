import { test, expect } from "@playwright/test";
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
  await page.getByRole("button", { name: "Gesundheit", exact: true }).click();
  await expect(page.getByText("Noch keine Gesundheitsdaten.")).toBeVisible();
});
