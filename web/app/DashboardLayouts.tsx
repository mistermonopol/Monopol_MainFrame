"use client";
import { ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowDown,
  Music,
  Footprints,
  Moon,
  Activity,
  Weight,
  Plus,
} from "lucide-react";
import { LayoutName } from "./appearance";
import { Language, localeFor, slogan, translator } from "./i18n";
import StepChart from "./StepChart";

type Task = { id: string; title: string; completed?: boolean };
type Project = {
  id: string;
  title: string;
  description: string;
  completed?: boolean;
  due?: string;
};
type Day = {
  day: string;
  steps: number | null;
  sleep_minutes: number | null;
  resting_pulse: number | null;
  weight_kg: number | null;
};
export default function DashboardLayouts({
  layout,
  language,
  tasks,
  projects,
  days,
  taskRows,
  enabled,
  navigate,
  newTask,
}: {
  layout: LayoutName;
  language: Language;
  tasks: Task[];
  projects: Project[];
  days: Day[];
  taskRows: ReactNode;
  enabled: boolean;
  navigate: (page: string) => void;
  newTask: () => void;
}) {
  const t = translator(language),
    locale = localeFor(language);
  const todayKey = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(new Date());
  const today = days.find((d) => d.day === todayKey);
  const open = tasks.filter((task) => !task.completed).length;
  const completed = tasks.length - open;
  const active = projects.filter((p) => !p.completed);
  const format = (value: number | null | undefined) =>
    value == null
      ? "—"
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
          value,
        );
  const chapter = (number: string, title: string, action?: () => void) => (
    <div className="chapter-heading">
      <span>{number}</span>
      <h2>{t(title)}</h2>
      {action && (
        <button onClick={action} aria-label={t(title)}>
          <ArrowUpRight size={18} />
        </button>
      )}
    </div>
  );
  const health = (
    <section className="vital-strip" aria-label={t("Heute auf einen Blick")}>
      {[
        [Footprints, "Schritte", today?.steps, "Heute"],
        [
          Moon,
          "Schlaf",
          today?.sleep_minutes == null ? null : today.sleep_minutes / 60,
          "h · letzte Nacht",
        ],
        [Activity, "Ruhepuls", today?.resting_pulse, "bpm · Tagesmittel"],
        [
          Weight,
          "Gewicht",
          days.find((d) => d.weight_kg != null)?.weight_kg,
          "kg · letzter Tageswert",
        ],
      ].map(([Icon, label, value, unit]) => {
        const I = Icon as typeof Footprints;
        return (
          <button
            className="stat"
            key={String(label)}
            onClick={() => navigate("health")}
          >
            <I size={18} />
            <span>{t(String(label))}</span>
            <strong>{format(value as number | null)}</strong>
            <small>{t(String(unit))}</small>
          </button>
        );
      })}
    </section>
  );
  const taskBlock = (
    <section className="desk-section task-desk">
      {chapter("01", "Meine Aufgaben", () => navigate("tasks"))}
      {tasks.length ? (
        taskRows
      ) : (
        <div className="desk-empty">
          <span>↳</span>
          <p>{t("Noch keine Aufgaben. Platz für deinen nächsten Schritt.")}</p>
          <button disabled={!enabled} onClick={newTask}>
            <Plus size={16} />
            {t("Erste Aufgabe anlegen")}
          </button>
        </div>
      )}
    </section>
  );
  const musicBlock = (
    <section className="desk-section music-desk">
      {chapter("02", "Musikprojekte", () => navigate("music"))}
      <button className="release-feature" onClick={() => navigate("music")}>
        <span className="release-symbol" aria-hidden="true">
          {(active[0]?.title || "Main Frame")
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join("")
            .toUpperCase()}
        </span>
        <small>
          {active.length ? t("In Arbeit") : t("Dein nächster Release")}
        </small>
        <h3>{active[0]?.title || t("Noch ungeschrieben.")}</h3>
        <p>
          {active[0]?.description ||
            t("Ein Track beginnt mit einer Idee. Gib ihr einen Platz.")}
        </p>
        <span className="release-bottom">
          {active[0]?.due || t("Musik öffnen")}
          <ArrowUpRight size={22} />
        </span>
      </button>
      {active.slice(1, 3).map((p, index) => (
        <button
          className="project-line"
          key={p.id}
          onClick={() => navigate("music")}
        >
          <span>{String(index + 2).padStart(2, "0")}</span>
          {p.title}
          <ArrowUpRight size={16} />
        </button>
      ))}
    </section>
  );
  const chart = (
    <div className="chart-desk">
      <StepChart days={days} language={language} />
    </div>
  );
  const connect = (
    <section className="connection-ledger" aria-label={t("Verbindungen")}>
      {[
        ["Finanzen", false],
        ["Smart Home", false],
        ["Health Connect", days.length > 0],
      ].map(([name, connected]) => (
        <div key={String(name)}>
          <span>{t(String(name))}</span>
          <small>{connected ? t("Verbunden") : t("Nicht verbunden")}</small>
        </div>
      ))}
    </section>
  );
  const agent = (
    <button className="agent-entry" onClick={() => navigate("agent")}>
      <span className="agent-mark">*</span>
      <div>
        <small>MAINFRAME AGENT</small>
        <strong>{t("Denk es laut.")}</strong>
        <p>{t("Fragen, Ideen und dein ganzer Workspace.")}</p>
      </div>
      <ArrowUpRight size={24} />
    </button>
  );
  return (
    <div
      className={"dashboard-layout dashboard-" + layout}
      data-dashboard-layout={layout}
    >
      {layout === "index" && (
        <>
          <section className="index-cover">
            <div className="cover-caption">
              <span>{slogan}</span>
              <span>INDEX / {String(new Date().getFullYear())}</span>
            </div>
            <div className="cover-headline">
              <h2>
                {t("Alles,")}
                <br />
                <em>{t("was zählt.")}</em>
              </h2>
              <div className="cover-count">
                <strong>{String(open).padStart(2, "0")}</strong>
                <span>{t("offene Aufgaben")}</span>
                <button onClick={() => navigate("tasks")}>
                  {t("Zum Tagesplan")}
                  <ArrowUpRight size={17} />
                </button>
              </div>
            </div>
            <div className="cover-rule">
              <span>{t("Dein Tag, auf einer Seite.")}</span>
              <ArrowDown size={18} />
            </div>
          </section>
          <div className="index-columns">
            <div>
              {taskBlock}
              {chart}
            </div>
            <div>
              {musicBlock}
              {agent}
            </div>
          </div>
          {health}
          {connect}
        </>
      )}
      {layout === "studio" && (
        <>
          <div className="studio-masthead">
            <div>
              <span>{slogan}</span>
              <h2>
                {t("In Arbeit")}
                <sup>{String(active.length + open).padStart(2, "0")}</sup>
              </h2>
            </div>
            <span className="studio-stamp">
              MF
              <br />
              STUDIO
            </span>
          </div>
          <div className="studio-workbench">
            {musicBlock}
            <div className="studio-side">
              {agent}
              {taskBlock}
            </div>
            {chart}
            {health}
          </div>
          {connect}
        </>
      )}
      {layout === "control" && (
        <>
          <div className="control-ribbon">
            <span>{slogan}</span>
            <strong>CONTROL / 03</strong>
          </div>
          <section className="control-counters">
            <div>
              <small>{t("Offen")}</small>
              <strong>{format(open)}</strong>
            </div>
            <div>
              <small>{t("Erledigt")}</small>
              <strong>{format(completed)}</strong>
            </div>
            <div>
              <small>{t("Musikprojekte")}</small>
              <strong>{format(projects.length)}</strong>
            </div>
            <div>
              <small>{t("Erfasste Tage")}</small>
              <strong>{format(days.length)}</strong>
            </div>
          </section>
          {health}
          <div className="control-grid">
            {chart}
            {taskBlock}
            {musicBlock}
            {agent}
          </div>
          {connect}
        </>
      )}
      {layout === "focus" && (
        <>
          <section className="focus-intro">
            <span>{slogan}</span>
            <div className="focus-day">
              {String(Number(todayKey.slice(8, 10))).padStart(2, "0")}
              <small>
                {new Date().toLocaleDateString(locale, {
                  month: "long",
                  timeZone: "Europe/Berlin",
                })}
              </small>
            </div>
            <h2>
              {t("Eins nach")}
              <br />
              <em>{t("dem anderen.")}</em>
            </h2>
            <p>{t("Du musst nicht alles auf einmal tun.")}</p>
            <span className="focus-progress">
              {completed} / {tasks.length} {t("Aufgaben erledigt")}
              <span
                style={{
                  width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%`,
                }}
              />
            </span>
          </section>
          <div className="focus-timeline">
            {taskBlock}
            {agent}
            {musicBlock}
            {chart}
            {health}
          </div>
          {connect}
        </>
      )}
    </div>
  );
}
