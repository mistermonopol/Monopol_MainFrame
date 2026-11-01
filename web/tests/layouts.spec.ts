import { test, expect } from "@playwright/test";
test("every structural layout supports every palette and preserves the workspace", async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({
      json: {
        tasks: [
          {
            id: "one",
            version: 1,
            title: "Mix the single",
            description: "",
            completed: false,
          },
        ],
        music: [
          {
            id: "release",
            version: 1,
            title: "After Hours",
            description: "Mix revision",
            completed: false,
          },
        ],
        notes: [],
        events: [],
        health: { days: [], last_sync: null },
      },
    }),
  );
  await page.goto("/");
  async function navigate(label: string) {
    if (isMobile)
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
    await page
      .locator("aside")
      .getByRole("button", { name: label, exact: true })
      .click();
  }
  for (const layout of ["index", "studio", "control", "focus"]) {
    await navigate("Settings");
    await page
      .getByRole("group", { name: "Choose layout", exact: true })
      .getByRole("button", { name: new RegExp(layout, "i") })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-layout", layout);
    for (const palette of ["dark", "light", "amber", "cyan"]) {
      await page.getByLabel("Theme", { exact: true }).selectOption(palette);
      await expect(page.locator("html")).toHaveAttribute("data-theme", palette);
      await expect(page.locator("html")).toHaveAttribute("data-layout", layout);
    }
    await navigate("Overview");
    await expect(
      page.locator(`[data-dashboard-layout="${layout}"]`),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Mix the single/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Steps chart", exact: true }),
    ).toBeVisible();
    expect(
      await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
    ).toBe(true);
    const rounded = await page
      .locator(".shell button,.shell .card")
      .evaluateAll((nodes) =>
        nodes.some(
          (el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) !== 0,
        ),
      );
    expect(rounded).toBe(false);
    const chartBars = await page.locator(".chart-bars").boundingBox();
    const chartReadout = await page.locator(".chart-readout").boundingBox();
    expect(chartReadout!.y).toBeGreaterThanOrEqual(
      chartBars!.y + chartBars!.height,
    );
    await navigate("Tasks");
    await expect(page.locator(`.task-workspace-${layout}`)).toBeVisible();
    await page.getByRole("button", { name: /Mix the single/ }).click();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Mix the single",
    );
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-layout", layout);
  }
  expect(errors).toEqual([]);
});

