"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Language } from "./i18n";
import {
  HealthChart,
  HealthDay,
  HealthValues,
  metricInfo,
  metricName,
  Request,
} from "./HealthWidgets";
import SmartHome from "./SmartHome";
import StepChart from "./StepChart";
import WorkspaceModules from "./WorkspaceModules";
type Placement = { order: number; width: number; height: number };
type Widget = {
  id: string;
  type: string;
  title: string;
  options: Record<string, any>;
  desktop: Placement;
  mobile: Placement;
};
type Config = { version: number; widgets: Widget[] };
type Catalog = {
  type: string;
  title: string;
  sizes: number[];
  options: Record<string, any>;
};
const labels: Record<string, [string, string]> = {
  health: ["Health", "Gesundheit"],
  metric: ["Health metric", "Gesundheitswert"],
  chart: ["Health chart", "Gesundheitsdiagramm"],
  tasks: ["Tasks", "Aufgaben"],
  lights: ["Lights", "Lampen"],
  music: ["Music projects", "Musikprojekte"],
  obsidian: ["Obsidian", "Obsidian"],
  agent: ["AI chat", "KI-Chat"],
};
export const fallbackCatalog: Catalog[] = Object.keys(labels).map((type) => ({
  type,
  title: labels[type][0],
  sizes: [3, 6, 12],
  options: (
    {
      health: {
        metrics: [
          "steps",
          "sleep_minutes",
          "resting_pulse",
          "heart_rate",
          "weight_kg",
        ],
      },
      metric: { metric: "heart_rate" },
      chart: { metric: "steps", period: "week" },
      tasks: { filter: "open" },
      lights: { entity_ids: [] },
      music: { project_id: "" },
      obsidian: { path: "" },
      agent: {},
    } as Record<string, any>
  )[type],
}));
export function defaultBoard(): Config {
  return {
    version: 0,
    widgets: fallbackCatalog
      .filter((c) => c.type !== "metric")
      .map((c, i) => ({
        id: "default-" + c.type,
        type: c.type,
        title: "",
        options: structuredClone(c.options),
        desktop: { order: i, width: c.type === "health" ? 12 : 6, height: 1 },
        mobile: { order: i, width: 2, height: 1 },
      })),
  };
}
function ObsidianWidget({
  path,
  request,
  enabled,
  language,
}: {
  path: string;
  request: Request;
  enabled: boolean;
  language: Language;
}) {
  const [content, setContent] = useState(""),
    [notes, setNotes] = useState<any[]>([]),
    [selected, setSelected] = useState(path),
    [error, setError] = useState("");
  const req = useRef(request);
  req.current = request;
  useEffect(() => {
    setSelected(path);
  }, [path]);
  useEffect(() => {
    let active = true;
    setError("");
    setContent("");
    if (enabled) {
      const route = selected
        ? "/obsidian/note?path=" + encodeURIComponent(selected)
        : "/obsidian/notes";
      req
        .current(route)
        .then((r) => {
          if (active) {
            if (selected) setContent(r.content);
            else if (Array.isArray(r)) setNotes(r);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }
    return () => {
      active = false;
    };
  }, [selected, enabled]);
  return (
    <div>
      {error && <p role="alert">{error}</p>}
      {!enabled && (
        <p>
          {language === "de"
            ? "Notizen benötigen eine Verbindung."
            : "Notes require a connection."}
        </p>
      )}
      {selected ? (
        <>
          <button onClick={() => setSelected("")}>
            {language === "de" ? "Notizen" : "Notes"}
          </button>
          <strong>{selected}</strong>
          <pre className="widget-note">{content}</pre>
        </>
      ) : (
        notes.slice(0, 30).map((n) => (
          <button
            className="widget-note-link"
            key={n.path}
            onClick={() => setSelected(n.path)}
          >
            {n.title || n.path}
          </button>
        ))
      )}
    </div>
  );
}
export default function WidgetBoard({
  layout,
  language,
  enabled,
  request,
  days,
  tasks,
  projects,
  row,
  navigate,
  onChanged,
}: {
  layout: string;
  language: Language;
  enabled: boolean;
  request: Request;
  days: HealthDay[];
  tasks: any[];
  projects: any[];
  row: (task: any) => ReactNode;
  navigate: (page: string) => void;
  onChanged: () => void;
}) {
  const de = language === "de",
    req = useRef(request);
  req.current = request;
  const [config, setConfig] = useState<Config>(defaultBoard),
    [draft, setDraft] = useState<Config | null>(null),
    [catalog, setCatalog] = useState(fallbackCatalog),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [add, setAdd] = useState("health");
  const dragging = useRef<string | null>(null);
  const editing = useRef(false);
  editing.current = draft !== null;
  useEffect(() => {
    const q = matchMedia("(max-width: 700px)");
    const update = () => setMobile(q.matches);
    update();
    q.addEventListener("change", update);
    try {
      const cached = JSON.parse(
        localStorage.getItem("mainframe-widgets") || "null",
      );
      if (cached && Array.isArray(cached.widgets)) setConfig(cached);
    } catch {}
    return () => q.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    let active = true;
    if (enabled && !editing.current) {
      Promise.all([
        req.current("/dashboard/config"),
        req.current("/dashboard/catalog"),
      ])
        .then(([c, list]) => {
          if (active) {
            if (!Array.isArray(c.widgets) || !Array.isArray(list))
              throw Error(
                "Dashboard configuration unavailable. Update the server.",
              );
            setConfig(c);
            setCatalog(list);
            setLoaded(true);
            setError("");
            localStorage.setItem("mainframe-widgets", JSON.stringify(c));
          }
        })
        .catch((e) => {
          if (active) {
            setLoaded(false);
            setError(e.message);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [enabled, days]);
  const mode = mobile ? "mobile" : "desktop";
  const current = draft || config;
  const sorted = [...current.widgets].sort(
    (a, b) => a[mode].order - b[mode].order,
  );
  function change(id: string, patch: Partial<Widget>) {
    setDraft((d) =>
      d
        ? {
            ...d,
            widgets: d.widgets.map((w) =>
              w.id === id ? { ...w, ...patch } : w,
            ),
          }
        : d,
    );
  }
  function move(id: string, to: number) {
    if (!draft) return;
    const list = [...draft.widgets].sort(
      (a, b) => a[mode].order - b[mode].order,
    );
    const from = list.findIndex((w) => w.id === id);
    const [item] = list.splice(from, 1);
    list.splice(Math.max(0, Math.min(to, list.length)), 0, item);
    setDraft({
      ...draft,
      widgets: list.map((w, i) => ({ ...w, [mode]: { ...w[mode], order: i } })),
    });
  }
  async function save() {
    if (!draft || !enabled) return;
    setBusy(true);
    try {
      const c = await req.current("/dashboard/config", {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      setConfig(c);
      setDraft(null);
      localStorage.setItem("mainframe-widgets", JSON.stringify(c));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    try {
      const c = await req.current("/dashboard/config");
      setConfig(c);
      setDraft(null);
      setLoaded(true);
      setError("");
      localStorage.setItem("mainframe-widgets", JSON.stringify(c));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const title = (w: Widget) =>
    w.title || labels[w.type]?.[de ? 1 : 0] || w.type;
  return (
    <section
      className={`widget-board ${draft ? "editing" : ""}`}
      data-dashboard-layout={layout}
      aria-label={de ? "Mein Hauptscreen" : "My dashboard"}
    >
      <div className="widget-toolbar">
        <div>
          <span className="eyebrow">MAINFRAME / WORKSPACE</span>
          <h2>
            {de ? "Dein Raum. Deine Module." : "Your space. Your modules."}
          </h2>
        </div>
        {draft ? (
          <>
            <button disabled={busy || !enabled} onClick={() => void save()}>
              {de ? "Speichern" : "Save dashboard"}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setError("");
              }}
            >
              {de ? "Abbrechen" : "Cancel"}
            </button>
          </>
        ) : (
          <button
            disabled={!enabled || !loaded}
            onClick={() => setDraft(structuredClone(config))}
          >
            {de ? "Widgets bearbeiten" : "Edit widgets"}
          </button>
        )}
      </div>
      {error && (
        <div role="alert">
          {error}{" "}
          <button disabled={!enabled} onClick={() => void reload()}>
            {de ? "Neu laden" : "Reload dashboard"}
          </button>
        </div>
      )}
      {draft && (
        <div className="widget-catalog">
          <label>
            {de ? "Widget hinzufügen" : "Add widget"}
            <select
              aria-label={de ? "Widget hinzufügen" : "Add widget"}
              value={add}
              onChange={(e) => setAdd(e.target.value)}
            >
              {catalog.map((c) => (
                <option key={c.type} value={c.type}>
                  {labels[c.type]?.[de ? 1 : 0] || c.title}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={draft.widgets.length >= 40}
            onClick={() => {
              const c = catalog.find((c) => c.type === add)!;
              const order =
                Math.max(
                  -1,
                  ...draft.widgets.map((w) =>
                    Math.max(w.desktop.order, w.mobile.order),
                  ),
                ) + 1;
              setDraft({
                ...draft,
                widgets: [
                  ...draft.widgets,
                  {
                    id: crypto.randomUUID(),
                    type: c.type,
                    title: "",
                    options: structuredClone(c.options),
                    desktop: { order, width: 6, height: 1 },
                    mobile: { order, width: 2, height: 1 },
                  },
                ],
              });
            }}
          >
            + {de ? "Hinzufügen" : "Add"}
          </button>
          <button
            onClick={() =>
              setDraft({ ...defaultBoard(), version: config.version })
            }
          >
            {de ? "Standard wiederherstellen" : "Restore defaults"}
          </button>
          <small>
            {de ? "Anordnung" : "Arrangement"}:{" "}
            {mobile ? (de ? "Handy" : "Mobile") : "Desktop"}
          </small>
        </div>
      )}
      <div className="widget-grid">
        {sorted.map((w, index) => (
          <article
            key={w.id}
            className={`workspace-widget widget-${w.type}`}
            style={
              {
                "--widget-width": w.desktop.width,
                "--mobile-width": w.mobile.width,
                "--widget-height": w[mode].height,
              } as React.CSSProperties
            }
            onDragOver={(e) => {
              if (draft) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging.current) move(dragging.current, index);
              dragging.current = null;
            }}
          >
            <header className="widget-heading">
              <strong>{title(w)}</strong>
              {draft ? (
                <>
                  <button
                    draggable
                    onDragStart={(e) => {
                      dragging.current = w.id;
                      e.dataTransfer.setData("text/plain", w.id);
                    }}
                    aria-label={de ? "Widget ziehen" : "Drag widget"}
                  >
                    ⠿
                  </button>
                  <button
                    aria-label={de ? "Nach oben" : "Move up"}
                    disabled={index === 0}
                    onClick={() => move(w.id, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={de ? "Nach unten" : "Move down"}
                    disabled={index === sorted.length - 1}
                    onClick={() => move(w.id, index + 1)}
                  >
                    ↓
                  </button>
                  <button
                    aria-label={de ? "Widget entfernen" : "Remove widget"}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        widgets: draft.widgets.filter(
                          (item) => item.id !== w.id,
                        ),
                      })
                    }
                  >
                    ×
                  </button>
                </>
              ) : (
                <span>{String(index + 1).padStart(2, "0")}</span>
              )}
            </header>
            {draft ? (
              <div className="widget-editor">
                <label>
                  {de ? "Titel" : "Title"}
                  <input
                    value={w.title}
                    placeholder={title({ ...w, title: "" })}
                    maxLength={100}
                    onChange={(e) => change(w.id, { title: e.target.value })}
                  />
                </label>
                <div className="widget-chart-tools">
                  <label>
                    {de ? "Breite" : "Width"}
                    <select
                      aria-label={de ? "Breite" : "Width"}
                      value={w[mode].width}
                      onChange={(e) =>
                        change(w.id, {
                          [mode]: { ...w[mode], width: Number(e.target.value) },
                        })
                      }
                    >
                      {(mobile ? [1, 2] : [3, 6, 12]).map((size) => (
                        <option key={size} value={size}>
                          {size}/{mobile ? 2 : 12}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {de ? "Höhe" : "Height"}
                    <select
                      aria-label={de ? "Höhe" : "Height"}
                      value={w[mode].height}
                      onChange={(e) =>
                        change(w.id, {
                          [mode]: {
                            ...w[mode],
                            height: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {[1, 2, 3].map((size) => (
                        <option key={size}>{size}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {["metric", "chart"].includes(w.type) && (
                  <label>
                    {de ? "Messwert" : "Metric"}
                    <select
                      aria-label={de ? "Messwert" : "Metric"}
                      value={w.options.metric || "steps"}
                      onChange={(e) =>
                        change(w.id, {
                          options: { ...w.options, metric: e.target.value },
                        })
                      }
                    >
                      {Object.keys(metricInfo).map((m) => (
                        <option key={m} value={m}>
                          {metricName(m, language)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {w.type === "health" && (
                  <fieldset>
                    <legend>{de ? "Messwerte" : "Metrics"}</legend>
                    {Object.keys(metricInfo).map((m) => (
                      <label key={m} className="widget-checkbox">
                        <input
                          type="checkbox"
                          checked={(w.options.metrics || []).includes(m)}
                          onChange={(e) => {
                            const values = e.target.checked
                              ? [...(w.options.metrics || []), m]
                              : (w.options.metrics || []).filter(
                                  (v: string) => v !== m,
                                );
                            if (values.length)
                              change(w.id, { options: { metrics: values } });
                          }}
                        />
                        {metricName(m, language)}
                      </label>
                    ))}
                  </fieldset>
                )}
                {w.type === "chart" && (
                  <label>
                    {de ? "Zeitraum" : "Period"}
                    <select
                      aria-label={de ? "Zeitraum" : "Period"}
                      value={w.options.period}
                      onChange={(e) =>
                        change(w.id, {
                          options: { ...w.options, period: e.target.value },
                        })
                      }
                    >
                      {["day", "week", "month"].map((p, i) => (
                        <option key={p} value={p}>
                          {
                            (de
                              ? ["Tag", "Woche", "Monat"]
                              : ["Day", "Week", "Month"])[i]
                          }
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {w.type === "tasks" && (
                  <label>
                    {de ? "Aufgabenfilter" : "Task filter"}
                    <select
                      aria-label={de ? "Aufgabenfilter" : "Task filter"}
                      value={w.options.filter}
                      onChange={(e) =>
                        change(w.id, { options: { filter: e.target.value } })
                      }
                    >
                      {["open", "done", "all"].map((p, i) => (
                        <option key={p} value={p}>
                          {
                            (de
                              ? ["Offen", "Erledigt", "Alle"]
                              : ["Open", "Done", "All"])[i]
                          }
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {["obsidian", "music", "lights"].includes(w.type) && (
                  <label>
                    {w.type === "obsidian"
                      ? de
                        ? "Notizpfad (leer: Liste)"
                        : "Note path (empty: list)"
                      : w.type === "music"
                        ? de
                          ? "Projekt-ID (leer: alle)"
                          : "Project ID (empty: all)"
                        : de
                          ? "Lampen-IDs, durch Komma getrennt (leer: alle)"
                          : "Light IDs, comma separated (empty: all)"}
                    <input
                      value={
                        w.type === "lights"
                          ? (w.options.entity_ids || []).join(", ")
                          : w.options[
                              w.type === "music" ? "project_id" : "path"
                            ] || ""
                      }
                      onChange={(e) =>
                        change(w.id, {
                          options:
                            w.type === "lights"
                              ? {
                                  entity_ids: e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                }
                              : {
                                  [w.type === "music" ? "project_id" : "path"]:
                                    e.target.value,
                                },
                        })
                      }
                    />
                  </label>
                )}
                <div className="widget-preview">
                  <small>{de ? "Vorschau" : "Preview"}</small>
                  {w.type === "health" || w.type === "metric" ? (
                    <HealthValues
                      days={days}
                      metrics={
                        w.type === "metric"
                          ? [w.options.metric]
                          : w.options.metrics
                      }
                      language={language}
                    />
                  ) : (
                    <p>
                      {title(w)} · {w[mode].width}/{mobile ? 2 : 12}
                    </p>
                  )}
                </div>
                <button
                  className="widget-resize"
                  aria-label={de ? "Widget-Größe ändern" : "Resize widget"}
                  onPointerDown={(e) => {
                    const start = e.clientX,
                      initial = w[mode].width;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    e.currentTarget.dataset.start = String(start);
                    e.currentTarget.dataset.width = String(initial);
                  }}
                  onPointerUp={(e) => {
                    const start = Number(e.currentTarget.dataset.start);
                    if (!Number.isFinite(start)) return;
                    const values = mobile ? [1, 2] : [3, 6, 12];
                    const direction = Math.sign(e.clientX - start);
                    const next =
                      values[
                        Math.max(
                          0,
                          Math.min(
                            values.length - 1,
                            values.indexOf(
                              Number(e.currentTarget.dataset.width),
                            ) + direction,
                          ),
                        )
                      ];
                    change(w.id, { [mode]: { ...w[mode], width: next } });
                  }}
                >
                  ↔
                </button>
              </div>
            ) : !loaded && enabled ? (
              <p>{de ? "Widgets werden geladen …" : "Loading widgets…"}</p>
            ) : (
              <div className="widget-content">
                {w.type === "health" && (
                  <HealthValues
                    {...{ days, language }}
                    metrics={w.options.metrics || ["steps", "heart_rate"]}
                  />
                )}{" "}
                {w.type === "metric" && (
                  <HealthValues
                    {...{ days, language }}
                    metrics={[w.options.metric || "heart_rate"]}
                  />
                )}{" "}
                {w.type === "chart" &&
                  (w.options.metric === "steps" ? (
                    <StepChart days={days as any} language={language} />
                  ) : (
                    <HealthChart
                      {...{ days, language, request, enabled }}
                      metric={w.options.metric}
                      period={w.options.period || "week"}
                    />
                  ))}
                {w.type === "tasks" && (
                  <>
                    {tasks
                      .filter(
                        (task) =>
                          w.options.filter === "all" ||
                          (w.options.filter === "done"
                            ? task.completed
                            : !task.completed),
                      )
                      .map(row)}
                    <button onClick={() => navigate("tasks")}>
                      {de ? "Aufgaben öffnen" : "Open tasks"}
                    </button>
                  </>
                )}
                {w.type === "lights" && (
                  <SmartHome
                    {...{ language, enabled, request, onChanged }}
                    entityIds={w.options.entity_ids}
                    settings={() => navigate("settings")}
                  />
                )}{" "}
                {w.type === "music" && (
                  <>
                    {projects
                      .filter(
                        (p) =>
                          !w.options.project_id ||
                          p.id === w.options.project_id,
                      )
                      .map((p) => (
                        <div className="widget-project" key={p.id}>
                          <strong>{p.title}</strong>
                          <p>{p.description}</p>
                          <small>{p.due || "—"}</small>
                        </div>
                      ))}
                    <button onClick={() => navigate("music")}>
                      {de ? "Musik öffnen" : "Open music"}
                    </button>
                  </>
                )}
                {w.type === "obsidian" && (
                  <ObsidianWidget
                    {...{ request, enabled, language }}
                    path={w.options.path || ""}
                  />
                )}{" "}
                {w.type === "agent" && (
                  <WorkspaceModules
                    page="agent"
                    {...{ language, enabled, request, onChanged }}
                  />
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      {!sorted.length && (
        <p>
          {de
            ? "Dein Hauptscreen ist leer. Füge im Bearbeitungsmodus Widgets hinzu."
            : "Your dashboard is empty. Add widgets in edit mode."}
        </p>
      )}
    </section>
  );
}
