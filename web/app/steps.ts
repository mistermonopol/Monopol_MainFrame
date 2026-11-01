export type StepDay = { day: string; steps: number | null };
export type Period = "daily" | "weekly" | "monthly";
export type StepBucket = {
  start: string;
  end: string;
  steps: number | null;
  recorded: number;
  expected: number;
};
const DAY = 86400000;
const key = (date: Date) => date.toISOString().slice(0, 10);
export function stepBuckets(
  days: StepDay[],
  period: Period,
  today: string,
): StepBucket[] {
  const current = new Date(today + "T00:00:00Z");
  const count = period === "daily" ? 14 : period === "weekly" ? 8 : 12;
  const unique = new Map(days.map((day) => [day.day, day]));
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index;
    let start: Date, end: Date;
    if (period === "daily") {
      start = new Date(+current - offset * DAY);
      end = new Date(+start);
    } else if (period === "weekly") {
      const monday = (current.getUTCDay() + 6) % 7;
      start = new Date(+current - (monday + offset * 7) * DAY);
      end = new Date(+start + 6 * DAY);
    } else {
      start = new Date(
        Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - offset, 1),
      );
      end = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
      );
    }
    if (end > current) end = new Date(+current);
    const first = key(start),
      last = key(end);
    const values = [...unique.values()].filter(
      (day) =>
        day.day >= first &&
        day.day <= last &&
        day.steps != null &&
        Number.isFinite(day.steps) &&
        day.steps >= 0,
    );
    return {
      start: first,
      end: last,
      steps: values.length
        ? values.reduce((total, day) => total + day.steps!, 0)
        : null,
      recorded: values.length,
      expected: Math.round((+end - +start) / DAY) + 1,
    };
  });
}
