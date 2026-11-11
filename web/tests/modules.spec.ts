import { mockWidgets } from "./widget-fixture";
import { test, expect } from "@playwright/test";

test("four themes persist and new music agent vault navigation works", async ({
  page,
  isMobile,
}) => {
  let project: any = null;
  await page.route("https://vault.monopol-ai.de/spotify", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Spotify test dashboard</h1>",
    }),
  );
  let note = {
    path: "Music/Release.md",
    content: "# My release",
    version: "first",
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    let json: any = {};
    if (path.endsWith("/dashboard"))
      json = {
        tasks: [],
        notes: [],
        events: [],
        music: [],
        health: { days: [], last_sync: null },
      };
    else if (path.endsWith("/integrations"))
      json = { ai: true, obsidian: true, model: "test-model" };
    else if (path.endsWith("/items/music")) {
      if (method === "POST")
        project = {
          ...route.request().postDataJSON(),
          id: "music-1",
          version: 1,
        };
      json = method === "POST" ? project : project ? [project] : [];
    } else if (path.endsWith("/agent/chat")) {
      expect(route.request().postDataJSON().messages.at(-1).content).toBe(
        "What is next?",
      );
      json = { reply: "Finish your next release.", model: "test-model" };
    } else if (path.endsWith("/obsidian/notes"))
      json = [{ path: note.path, title: "Release" }];
    else if (path.endsWith("/obsidian/note")) {
      if (method === "PUT")
        note = { ...route.request().postDataJSON(), version: "second" };
      json = note;
    }
    await route.fulfill({ json });
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
  await nav("Settings");
  await expect(
    page.getByLabel("Theme", { exact: true }).locator("option"),
  ).toHaveCount(4);
  for (const theme of ["dark", "light", "amber", "cyan"]) {
    await page.getByLabel("Theme", { exact: true }).selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cyan");
  await expect(
    page
      .locator("aside")
      .getByRole("button", { name: "Calendar", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator("aside").getByRole("button", { name: "Notes", exact: true }),
  ).toHaveCount(0);
  await nav("Music");
  await expect(
    page.locator('iframe[title="Spotify Dashboard"]'),
  ).toHaveAttribute("src", "https://vault.monopol-ai.de/spotify");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("New single");
  await page.getByLabel("Description", { exact: true }).fill("Finish the mix");
  await page.getByLabel("Release date", { exact: true }).fill("2026-12-01");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "New single", exact: true }),
  ).toBeVisible();
  await nav("AI Agent");
  await page.getByLabel("Message the agent").fill("What is next?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Finish your next release.", { exact: true }),
  ).toBeVisible();
  await nav("Obsidian");
  await page
    .getByRole("button", { name: "Music/Release.md", exact: true })
    .click();
  await page.getByLabel("Markdown content").fill("# Updated release");
  await page.getByRole("button", { name: /Save/ }).click();
  await expect(page.getByLabel("Markdown content")).toHaveValue(
    "# Updated release",
  );
  expect(note.content).toBe("# Updated release");
  expect(
    await page.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
  ).toBe(false);
});
