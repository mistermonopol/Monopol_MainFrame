import { test, expect } from "@playwright/test";
import { stepBuckets } from "../app/steps";
test("daily chart distinguishes missing measurements from a measured zero", () => {
  const buckets = stepBuckets(
    [
      { day: "2026-10-25", steps: 0 },
      { day: "2026-10-24", steps: null },
    ],
    "daily",
    "2026-10-25",
  );
  expect(buckets.at(-1)).toMatchObject({ steps: 0, recorded: 1, expected: 1 });
  expect(buckets.at(-2)).toMatchObject({
    steps: null,
    recorded: 0,
    expected: 1,
  });
});
test("weeks start on Monday, deduplicate dates and exclude future records", () => {
  const buckets = stepBuckets(
    [
      { day: "2026-10-26", steps: 100 },
      { day: "2026-10-26", steps: 150 },
      { day: "2026-11-01", steps: 200 },
      { day: "2026-11-02", steps: 900 },
    ],
    "weekly",
    "2026-11-01",
  );
  expect(buckets.at(-1)).toEqual({
    start: "2026-10-26",
    end: "2026-11-01",
    steps: 350,
    recorded: 2,
    expected: 7,
  });
});
test("month totals cross year boundaries and count only elapsed days of the current month", () => {
  const buckets = stepBuckets(
    [
      { day: "2025-12-31", steps: 20 },
      { day: "2026-01-01", steps: 30 },
    ],
    "monthly",
    "2026-01-02",
  );
  expect(buckets.at(-1)).toEqual({
    start: "2026-01-01",
    end: "2026-01-02",
    steps: 30,
    recorded: 1,
    expected: 2,
  });
  expect(buckets.at(-2)).toMatchObject({
    start: "2025-12-01",
    end: "2025-12-31",
    steps: 20,
    expected: 31,
  });
});
