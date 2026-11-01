"use client";
import { useState } from "react";
import { Footprints } from "lucide-react";
import { Language, localeFor, translator } from "./i18n";
import { Period, StepDay, stepBuckets } from "./steps";
export default function StepChart({
  days,
  language,
}: {
  days: StepDay[];
  language: Language;
}) {
  const [period, setPeriod] = useState<Period>("daily");
  const [selected, setSelected] = useState<number | null>(null);
  const t = translator(language),
    locale = localeFor(language);
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(new Date());
  const buckets = stepBuckets(days, period, today);
  const maximum = Math.max(1, ...buckets.map((bucket) => bucket.steps ?? 0));
  const total = buckets.reduce((sum, bucket) => sum + (bucket.steps ?? 0), 0);
  const hasData = buckets.some((bucket) => bucket.steps !== null);
  const format = (value: number) => new Intl.NumberFormat(locale).format(value);
  const label = (date: string) =>
    new Date(date + "T12:00:00Z").toLocaleDateString(
      locale,
      period === "monthly"
        ? { month: "short", year: "2-digit", timeZone: "UTC" }
        : { day: "2-digit", month: "short", timeZone: "UTC" },
    );
  const describe = (index: number) => {
    const b = buckets[index];
    return `${label(b.start)}${period === "daily" ? "" : " – " + label(b.end)}: ${b.steps === null ? t("Keine Daten") : format(b.steps) + " " + t("Schritte")} · ${b.recorded}/${b.expected} ${t("erfasste Tage")}${b.recorded > 0 && b.recorded < b.expected ? " · " + t("Unvollständige Daten") : ""}`;
  };
  return (
    <section
      className="card panel step-chart"
      aria-label={t("Schrittediagramm")}
    >
      <div className="paneltitle">
        <h3>
          <Footprints size={18} />
          {t("Schritte im Zeitverlauf")}
        </h3>
        <div className="chart-periods" role="group" aria-label={t("Zeitraum")}>
          {(
            [
              ["daily", "Täglich"],
              ["weekly", "Wöchentlich"],
              ["monthly", "Monatlich"],
            ] as const
          ).map(([value, title]) => (
            <button
              key={value}
              aria-pressed={period === value}
              onClick={() => {
                setPeriod(value);
                setSelected(null);
              }}
            >
              {t(title)}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-summary">
        <strong>
          {hasData ? format(total) : "—"} <small>{t("Schritte")}</small>
        </strong>
        <span>
          {t(
            period === "daily"
              ? "Letzte 14 Tage"
              : period === "weekly"
                ? "Letzte 8 Wochen"
                : "Letzte 12 Monate",
          )}
        </span>
      </div>
      <div
        className="chart-bars"
        style={{
          gridTemplateColumns: `repeat(${buckets.length}, minmax(0,1fr))`,
        }}
      >
        {buckets.map((b, index) => (
          <button
            key={b.start}
            className={"chart-column" + (b.steps === null ? " missing" : "")}
            aria-label={describe(index)}
            title={describe(index)}
            onMouseEnter={() => setSelected(index)}
            onFocus={() => setSelected(index)}
            onClick={() => setSelected(index)}
          >
            <span className="bar-track">
              <span
                className="step-bar"
                data-steps={b.steps ?? ""}
                style={{ height: `${((b.steps ?? 0) / maximum) * 100}%` }}
              />
              {b.steps === null && <span className="missing-mark">—</span>}
            </span>
            <span className="bar-label">
              {period === "daily"
                ? new Date(b.start + "T12:00:00Z").getUTCDate()
                : label(b.start)}
            </span>
          </button>
        ))}
      </div>
      <p className="chart-readout" aria-live="polite">
        {selected !== null
          ? describe(selected)
          : hasData
            ? t(
                "Nur vorhandene Messwerte werden summiert. Fehlende Tage werden nicht als null Schritte gewertet.",
              )
            : t("Noch keine Schritte synchronisiert.")}
      </p>
      <details>
        <summary>{t("Daten anzeigen")}</summary>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>{t("Zeitraum")}</th>
                <th>{t("Schritte")}</th>
                <th>{t("erfasste Tage")}</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.start}>
                  <td>
                    {label(b.start)}
                    {period !== "daily" ? " – " + label(b.end) : ""}
                  </td>
                  <td>{b.steps === null ? "—" : format(b.steps)}</td>
                  <td>
                    {b.recorded}/{b.expected}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
