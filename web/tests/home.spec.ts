import { test, expect } from "@playwright/test";
test("light capabilities, commands and one-time bridge setup work", async ({
  page,
  isMobile,
}) => {
  let value = "on",
    brightness = 50;
  const sent: any[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const p = new URL(route.request().url()).pathname;
    let json: any = {};
    if (p.endsWith("/dashboard"))
      json = {
        tasks: [],
        music: [],
        notes: [],
        events: [],
        health: { days: [], last_sync: null },
        smart_home: { status: "online", light_count: 2 },
      };
    else if (p.endsWith("/smart-home/lights"))
      json = {
        status: "online",
        last_seen: new Date().toISOString(),
        lights: [
          {
            entity_id: "light.studio",
            name: "Studio",
            state: value,
            brightness_pct: brightness,
            rgb_color: [255, 0, 0],
            color_temp_kelvin: 3000,
            min_kelvin: 2000,
            max_kelvin: 6500,
            supported_color_modes: ["rgb", "color_temp"],
          },
          {
            entity_id: "light.hall",
            name: "Hall",
            state: "off",
            brightness_pct: null,
            rgb_color: null,
            color_temp_kelvin: null,
            min_kelvin: null,
            max_kelvin: null,
            supported_color_modes: ["onoff"],
          },
        ],
      };
    else if (p.endsWith("/smart-home/bridge-token"))
      json = { token: "test-one-time-token" };
    else if (p.endsWith("/smart-home/commands")) {
      const command = route.request().postDataJSON();
      sent.push(command);
      if (command.power) value = command.power;
      if (command.brightness_pct !== undefined)
        brightness = command.brightness_pct;
      json = { id: "one", status: "pending" };
    } else if (p.endsWith("/smart-home/commands/one"))
      json = { id: "one", status: "accepted" };
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
  await page.goto("/");
  await nav("Smart Home");
  await expect(
    page.getByRole("heading", { name: "Studio", exact: true }),
  ).toBeVisible();
  const hall = page
    .locator(".light-card")
    .filter({ has: page.getByRole("heading", { name: "Hall", exact: true }) });
  await expect(hall.getByRole("slider")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Turn off: Studio", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Turn on: Studio", exact: true }),
  ).toBeEnabled();
  expect(sent[0].power).toBe("off");
  expect(sent[0].entity_ids).toEqual(["light.studio"]);
  expect(sent[0].request_id).toMatch(/^[0-9a-f-]{36}$/);
  const dimmer = page.getByRole("slider", {
    name: "Brightness: Studio",
    exact: true,
  });
  await dimmer.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status")).toContainText("accepted");
  expect(sent.at(-1).brightness_pct).toBe(51);
  await expect(
    page.getByLabel("Light color: Studio", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", {
      name: "Color temperature: Studio",
      exact: true,
    }),
  ).toBeVisible();
  await nav("Settings");
  await page
    .getByRole("button", {
      name: "Generate / replace bridge token",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("One-time bridge token", { exact: true }),
  ).toHaveValue("test-one-time-token");
  expect(
    await page.evaluate(() =>
      Object.values(localStorage).some((v) =>
        v.includes("test-one-time-token"),
      ),
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await expect(
    page.getByLabel("One-time bridge token", { exact: true }),
  ).toHaveCount(0);
});

test("offline lights stay visible but cannot queue commands", async ({
  page,
  isMobile,
}) => {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({
      json: new URL(r.request().url()).pathname.endsWith("/dashboard")
        ? {
            tasks: [],
            music: [],
            notes: [],
            events: [],
            health: { days: [], last_sync: null },
          }
        : {
            status: "offline",
            lights: [
              {
                entity_id: "light.studio",
                name: "Studio",
                state: "on",
                brightness_pct: 50,
                rgb_color: null,
                color_temp_kelvin: null,
                min_kelvin: null,
                max_kelvin: null,
                supported_color_modes: ["brightness"],
              },
            ],
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
    .getByRole("button", { name: "Smart Home", exact: true })
    .click();
  await expect(page.getByText("Bridge offline", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Turn off: Studio", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("slider")).toBeDisabled();
  expect(
    await page.locator("body").evaluate((e) => e.scrollWidth <= innerWidth),
  ).toBe(true);
});
