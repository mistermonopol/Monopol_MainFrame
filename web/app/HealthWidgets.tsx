"use client";
import { useEffect, useRef, useState } from "react";
import { Language } from "./i18n";
export type Request = (path: string, init?: RequestInit) => Promise<any>;
export type HealthDay = {
  day: string;
  [key: string]: number | string | null | undefined;
};
export const metricInfo: Record<string, [string, string, string]> = {
  steps: ["Steps", "Schritte", ""],
  sleep_minutes: ["Sleep", "Schlaf", "min"],
  resting_pulse: ["Resting heart rate", "Ruhepuls", "bpm"],
  heart_rate: ["Heart rate", "Puls", "bpm"],
  weight_kg: ["Weight", "Gewicht", "kg"],
  hrv_ms: ["HRV", "HRV", "ms"],
  oxygen_pct: ["Oxygen saturation", "Sauerstoffsättigung", "%"],
  respiratory_rate: ["Respiratory rate", "Atemfrequenz", "/min"],
  distance_m: ["Distance", "Strecke", "m"],
  active_kcal: ["Active calories", "Aktive Kalorien", "kcal"],
  total_kcal: ["Total calories", "Gesamte Kalorien", "kcal"],
  exercise_minutes: ["Training", "Training", "min"],
};
export function metricName(id: string, language: Language) {
  return metricInfo[id]?.[language === "de" ? 1 : 0] || id;
}
export function berlinDay() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(
    new Date(),
  );
}
export function HealthValues({
  days,
  metrics,
  language,
}: {
  days: HealthDay[];
  metrics: string[];
  language: Language;
}) {
  const today = days.find((d) => d.day === berlinDay());
  return (
    <div className="widget-vitals">
      {metrics.map((metric) => {
        const row =
          metric === "weight_kg" ? days.find((d) => d[metric] != null) : today;
        const value =
          metric === "heart_rate"
            ? (row?.heart_rate_last ?? row?.[metric])
            : row?.[metric];
        return (
          <div key={metric}>
            <small>{metricName(metric, language)}</small>
            <strong>
              {typeof value === "number"
                ? new Intl.NumberFormat(language, {
                    maximumFractionDigits: 1,
                  }).format(value)
                : "—"}{" "}
              <em>{metricInfo[metric]?.[2]}</em>
            </strong>
            <span>
              {row?.[metric] != null
                ? metric === "heart_rate" &&
                  typeof row.heart_rate_at === "string"
                  ? new Date(row.heart_rate_at).toLocaleString(language)
                  : row.day
                : language === "de"
                  ? "Keine Messung"
                  : "No measurement"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
type Point = { at: string; value: number; label?: string };
export function HealthChart({
  metric,
  period,
  days,
  request,
  enabled,
  language,
}: {
  metric: string;
  period: string;
  days: HealthDay[];
  request: Request;
  enabled: boolean;
  language: Language;
}) {
  const de = language === "de",
    req = useRef(request);
  req.current = request;
  const [date, setDate] = useState(berlinDay()),
    [source, setSource] = useState(""),
    [series, setSeries] = useState<{
      samples: Point[];
      sources: string[];
      source: string | null;
      summary: any;
      truncated?: boolean;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    setSeries(null);
    if (period !== "day" || !enabled) return;
    req
      .current(
        `/health/series?metric=${encodeURIComponent(metric)}&start=${date}&end=${date}${source ? "&source=" + encodeURIComponent(source) : ""}`,
      )
      .then((r) => {
        if (active) setSeries(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [metric, period, date, source, enabled, days]);
  let points: Point[] =
    period === "day"
      ? series?.samples || []
      : days
          .filter(
            (d) =>
              d.day <= date &&
              d.day >=
                new Date(
                  new Date(date + "T12:00:00Z").getTime() -
                    (period === "week" ? 6 : 29) * 86400000,
                )
                  .toISOString()
                  .slice(0, 10) &&
              typeof d[metric] === "number",
          )
          .map((d) => ({ at: d.day, value: d[metric] as number }))
          .reverse();
  const min =
      period === "day" && series?.summary
        ? series.summary.min
        : Math.min(...points.map((p) => p.value)),
    max =
      period === "day" && series?.summary
        ? series.summary.max
        : Math.max(...points.map((p) => p.value)),
    range = Math.max(1, max - min);
  const mean =
    period === "day" && series?.summary
      ? series.summary.mean
      : points.reduce((s, p) => s + p.value, 0) / Math.max(1, points.length);
  const visible =
    points.length > 500
      ? points.filter(
          (_, i) =>
            i % Math.ceil(points.length / 500) === 0 || i === points.length - 1,
        )
      : points;
  const time = (point: Point) =>
    new Date(
      point.at.length === 10 ? point.at + "T12:00:00Z" : point.at,
    ).getTime();
  const first = points.length ? time(points[0]) : 0,
    last = points.length ? time(points[points.length - 1]) : 1;
  return (
    <div className="health-plot">
      <div className="widget-chart-tools">
        <input
          type="date"
          aria-label={de ? "Datum" : "Date"}
          value={date}
          max={berlinDay()}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
        />
        {period === "day" && (
          <select
            aria-label={de ? "Datenquelle" : "Data source"}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">
              {de ? "Automatische Quelle" : "Automatic source"}
            </option>
            {series?.sources.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {points.length > 0 ? (
        <>
          <svg
            viewBox="0 0 600 140"
            role="img"
            aria-label={metricName(metric, language)}
            preserveAspectRatio="none"
          >
            <line
              x1="0"
              x2="600"
              y1="130"
              y2="130"
              stroke="currentColor"
              opacity=".2"
            />
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              points={visible
                .map(
                  (p) =>
                    `${((time(p) - first) * 596) / Math.max(1, last - first) + 2},${125 - ((p.value - min) * 115) / range}`,
                )
                .join(" ")}
            />
          </svg>
          <div className="widget-stats">
            <span>Min {min.toFixed(1)}</span>
            <span>Ø {mean.toFixed(1)}</span>
            <span>
              Max {max.toFixed(1)} {metricInfo[metric]?.[2]}
            </span>
          </div>
          <p className="muted">
            {de ? "Letzte Messung" : "Last measurement"}:{" "}
            {points.at(-1)?.value.toFixed(1)} ·{" "}
            {new Date(
              (points.at(-1)?.at || date).length === 10
                ? date + "T12:00:00Z"
                : points.at(-1)!.at,
            ).toLocaleString(language)}
            {series?.source ? " · " + series.source : ""}
          </p>
          <details>
            <summary>
              {de ? "Messwerte" : "Measurements"} ({points.length})
            </summary>
            <div className="widget-measurements">
              {points.slice(-100).map((p, i) => (
                <div key={i}>
                  {p.at} · {p.value} {metricInfo[metric]?.[2]} {p.label}
                </div>
              ))}
            </div>
          </details>
          {series?.truncated && (
            <p>
              {de
                ? "Darstellung begrenzt; kürzeren Zeitraum wählen."
                : "Display limited; choose a shorter range."}
            </p>
          )}
        </>
      ) : (
        <p className="empty">
          {!enabled && period === "day"
            ? de
              ? "Zeitreihen benötigen eine Verbindung."
              : "Time series require a connection."
            : de
              ? "Keine Messungen für diesen Zeitraum."
              : "No measurements for this period."}
        </p>
      )}
    </div>
  );
}
export default function HealthWorkspace({
  request,
  enabled,
  language,
  days,
}: {
  request: Request;
  enabled: boolean;
  language: Language;
  days: HealthDay[];
}) {
  const [metrics, setMetrics] = useState<any[]>([]),
    [error, setError] = useState(""),
    [metric, setMetric] = useState("heart_rate"),
    [period, setPeriod] = useState("day");
  const req = useRef(request);
  req.current = request;
  const de = language === "de";
  useEffect(() => {
    let active = true;
    if (enabled)
      req
        .current("/health/metrics")
        .then((r) => {
          if (active) setMetrics(r.metrics);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [enabled, days]);
  return (
    <section className="card panel">
      <h2>{de ? "Gesundheitsdaten" : "Health data"}</h2>
      <p>
        {de
          ? "Messwerte aus Health Connect. Berechtigungen und Synchronisation verwaltest du in der Android-App."
          : "Measurements from Health Connect. Manage permissions and sync in the Android app."}
      </p>
      <HealthValues
        days={days}
        metrics={Object.keys(metricInfo)}
        language={language}
      />
      <div className="widget-chart-tools">
        <select
          aria-label={de ? "Messwert" : "Metric"}
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
        >
          {Object.keys(metricInfo).map((m) => (
            <option key={m} value={m}>
              {metricName(m, language)}
            </option>
          ))}
        </select>
        <select
          aria-label={de ? "Zeitraum" : "Period"}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          {["day", "week", "month"].map((p, i) => (
            <option key={p} value={p}>
              {(de ? ["Tag", "Woche", "Monat"] : ["Day", "Week", "Month"])[i]}
            </option>
          ))}
        </select>
      </div>
      <HealthChart {...{ request, enabled, language, days, metric, period }} />
      {error && <p role="alert">{error}</p>}
      <h3>
        {de ? "Datenquellen und Berechtigungen" : "Sources and permissions"}
      </h3>
      {metrics.map((m) => (
        <div key={m.id} className="health-source">
          <strong>{metricName(m.id, language)}</strong>
          <span>
            {m.state
              ? de
                ? {
                    ok: "Verfügbar",
                    no_data: "Keine Daten",
                    denied: "Nicht freigegeben",
                    error: "Abgleich fehlgeschlagen",
                  }[m.state as string]
                : m.state
              : de
                ? "Noch nicht synchronisiert"
                : "Not synced yet"}
          </span>
          <small>
            {m.sources?.join(", ") || "—"} ·{" "}
            {de ? "Letzter Abgleich" : "Last sync"}:{" "}
            {m.last_sync ? new Date(m.last_sync).toLocaleString(language) : "—"}{" "}
            · {de ? "Messung" : "Measurement"}:{" "}
            {m.last_measurement
              ? new Date(m.last_measurement).toLocaleString(language)
              : "—"}
          </small>
        </div>
      ))}
    </section>
  );
}
