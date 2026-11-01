"use client";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  NotebookPen,
  CalendarDays,
  HeartPulse,
  Settings,
  ArrowUpRight,
  Plus,
  Circle,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Layers3,
  Activity,
  Moon,
  Footprints,
  Weight,
  X,
  Trash2,
} from "lucide-react";

type Item = {
  id: string;
  version: number;
  title: string;
  description: string;
  due?: string;
  completed?: boolean;
  start?: string;
  end?: string;
  location?: string;
};
type Day = {
  day: string;
  steps: number | null;
  sleep_minutes: number | null;
  resting_pulse: number | null;
  weight_kg: number | null;
};
type Data = {
  tasks: Item[];
  notes: Item[];
  events: Item[];
  health: { days: Day[]; last_sync: string | null };
};
type Kind = "tasks" | "notes" | "events";
const empty: Data = {
  tasks: [],
  notes: [],
  events: [],
  health: { days: [], last_sync: null },
};
const navigation = [
  ["dashboard", "Übersicht", LayoutDashboard],
  ["tasks", "Aufgaben", CheckSquare],
  ["notes", "Notizen", NotebookPen],
  ["events", "Kalender", CalendarDays],
  ["health", "Gesundheit", HeartPulse],
  ["settings", "Einstellungen", Settings],
] as const;
const labels: Record<Kind, string> = {
  tasks: "Aufgabe",
  notes: "Notiz",
  events: "Termin",
};
const fmt = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(
        value,
      );
const dateText = (s: string) =>
  new Date(s).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function Home() {
  const [page, setPage] = useState("dashboard"),
    [data, setData] = useState<Data>(empty),
    [online, setOnline] = useState(true),
    [auth, setAuth] = useState(false),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(""),
    [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{ kind: Kind; item?: Item } | null>(
    null,
  );
  async function request(path: string, init?: RequestInit) {
    const r = await fetch("/api/v1" + path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (r.status === 401) {
      setAuth(false);
      throw Error("Bitte mit deinem Google-Konto anmelden.");
    }
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw Error(
        typeof body.detail === "string"
          ? body.detail
          : "Die Anfrage konnte nicht gespeichert werden.",
      );
    }
    return r.json();
  }
  async function load() {
    setBusy(true);
    try {
      const d = await request("/dashboard");
      setData(d);
      setAuth(true);
      setOnline(true);
      const stamp = new Date().toISOString();
      setLoaded(stamp);
      localStorage.setItem(
        "life-cache",
        JSON.stringify({ data: d, loaded: stamp }),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setOnline(false);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem("life-cache") || "null");
      if (cached) {
        setData(cached.data);
        setLoaded(cached.loaded);
      }
    } catch {}
    void load();
    const on = () => void load();
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  async function mutate(path: string, method: string, body?: unknown) {
    try {
      await request(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  const today = data.health.days.find(
    (d) =>
      d.day ===
      new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(
        new Date(),
      ),
  );
  const upcoming = data.events
    .filter((e) => e.end && new Date(e.end) > new Date())
    .sort(
      (a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime(),
    );
  const enabled = online && auth;
  function taskRow(t: Item) {
    return (
      <div className="task" key={t.id}>
        <button
          aria-label={t.completed ? "Als offen markieren" : "Erledigen"}
          disabled={!enabled}
          className="check"
          onClick={() =>
            void mutate("/items/tasks/" + t.id, "PUT", {
              ...t,
              completed: !t.completed,
            })
          }
        >
          {t.completed ? <CheckCircle2 size={21} /> : <Circle size={21} />}
        </button>
        <button
          className={"tasktext " + (t.completed ? "done" : "")}
          onClick={() => setEditor({ kind: "tasks", item: t })}
        >
          {t.title}
          <small>
            {t.due
              ? new Date(t.due + "T12:00:00").toLocaleDateString("de-DE")
              : "Ohne Fälligkeit"}
          </small>
        </button>
        <span className="tag">{t.completed ? "Erledigt" : "Offen"}</span>
      </div>
    );
  }
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="/">
          <span className="brandicon">
            <Layers3 size={23} />
          </span>
          everything<span className="branddot">.</span>
        </a>
        <div className="workspace">PERSÖNLICHER WORKSPACE</div>
        <nav>
          {navigation.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
            >
              <Icon size={19} />
              {label}
              {id === "tasks" && (
                <span className="count">
                  {data.tasks.filter((t) => !t.completed).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="private">
            <span className="statusdot" />
            Dein privater Raum
            <small>Alles an einem Ort. Unter deiner Kontrolle.</small>
          </div>
          <div className="profile">
            <div className="avatar">M</div>
            <div>
              Mein Life OS<small>Persönlicher Workspace</small>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            Mein Workspace <span>/</span>{" "}
            {navigation.find((n) => n[0] === page)?.[1]}
          </div>
          <div className="headeractions">
            <span className="connection">
              <i className={online ? "statusdot" : "statusdot amber"} />
              {online ? "Server verbunden" : "Offline / Anmeldung nötig"}
            </span>
            <button
              aria-label="Aktualisieren"
              onClick={() => void load()}
              disabled={busy}
            >
              <RefreshCw size={17} className={busy ? "spin" : ""} />
            </button>
          </div>
        </header>
        <div className="content">
          <div className="pageheading">
            <div>
              <div className="eyebrow">DEIN LEBEN, IM ÜBERBLICK</div>
              <h1>
                {page === "dashboard"
                  ? "Ein guter Tag beginnt hier."
                  : navigation.find((n) => n[0] === page)?.[1]}
              </h1>
              <p>
                {new Date().toLocaleDateString("de-DE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "Europe/Berlin",
                })}{" "}
                <span className="divider">·</span> Mach Platz für das, was
                zählt.
              </p>
            </div>
            <button
              className="primary"
              disabled={!enabled}
              onClick={() =>
                setEditor({
                  kind:
                    page === "notes"
                      ? "notes"
                      : page === "events"
                        ? "events"
                        : "tasks",
                })
              }
            >
              <Plus size={17} />{" "}
              {page === "notes"
                ? "Neue Notiz"
                : page === "events"
                  ? "Neuer Termin"
                  : "Neue Aufgabe"}
            </button>
          </div>
          {error && (
            <div className="notice">
              {error}{" "}
              {!auth && (
                <a href="/api/v1/auth/login">
                  Mit Google anmelden <ArrowUpRight size={14} />
                </a>
              )}
            </div>
          )}
          {loaded && (
            <div className="sync">
              Letzter geladener Stand: {dateText(loaded)}
            </div>
          )}
          {page === "dashboard" && (
            <>
              <section className="hero">
                <div>
                  <span className="pill">
                    <span className="statusdot" /> DEIN PERSÖNLICHES LIFE OS
                  </span>
                  <h2>
                    Weniger Tabs.
                    <br />
                    <span>Mehr Überblick.</span>
                  </h2>
                  <p>
                    Deine Aufgaben, Termine und Gesundheit.
                    <br />
                    Ein ruhiger Ort für alles, was dich bewegt.
                  </p>
                  <button onClick={() => setPage("tasks")}>
                    Meinen Tag planen <ArrowUpRight size={16} />
                  </button>
                </div>
                <div className="orbit">
                  <div className="orbitline one" />
                  <div className="orbitline two" />
                  <div className="orbitcenter">
                    <Layers3 size={42} />
                  </div>
                  <span className="orbitnode n1">
                    <HeartPulse />
                  </span>
                  <span className="orbitnode n2">
                    <CheckSquare />
                  </span>
                  <span className="orbitnode n3">
                    <CalendarDays />
                  </span>
                  <span className="orbitnode n4">
                    <NotebookPen />
                  </span>
                </div>
              </section>
              <div className="sectionlabel">
                Heute auf einen Blick <span>DEIN TÄGLICHER PULS</span>
              </div>
              <section className="stats">
                {[
                  [Footprints, "Schritte", fmt(today?.steps), "Heute", "mint"],
                  [
                    Moon,
                    "Schlaf",
                    today?.sleep_minutes == null
                      ? "—"
                      : fmt(today.sleep_minutes / 60) + " h",
                    "Letzte Nacht",
                    "purple",
                  ],
                  [
                    Activity,
                    "Ruhepuls",
                    fmt(today?.resting_pulse),
                    "bpm · Tagesmittel",
                    "peach",
                  ],
                  [
                    Weight,
                    "Gewicht",
                    fmt(
                      data.health.days.find((d) => d.weight_kg != null)
                        ?.weight_kg,
                    ),
                    "kg · letzter Tageswert",
                    "blue",
                  ],
                ].map(([Icon, label, value, sub, color]) => {
                  const I = Icon as typeof Footprints;
                  return (
                    <button
                      className="stat card"
                      key={String(label)}
                      onClick={() => setPage("health")}
                    >
                      <div className={"staticon " + color}>
                        <I size={20} />
                      </div>
                      <span>{String(label)}</span>
                      <strong>{String(value)}</strong>
                      <small>{String(sub)}</small>
                    </button>
                  );
                })}
              </section>
              <section className="twocol">
                <div className="card panel">
                  <div className="paneltitle">
                    <h3>
                      <CheckSquare size={18} /> Meine Aufgaben{" "}
                      <span className="count">
                        {data.tasks.filter((t) => !t.completed).length}
                      </span>
                    </h3>
                    <button onClick={() => setPage("tasks")}>
                      Alle ansehen <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {data.tasks.length ? (
                    data.tasks.slice(0, 4).map(taskRow)
                  ) : (
                    <div className="empty">
                      <CheckSquare />
                      <p>Ein klarer Kopf beginnt mit einer Liste.</p>
                      <button
                        disabled={!enabled}
                        onClick={() => setEditor({ kind: "tasks" })}
                      >
                        Erste Aufgabe anlegen
                      </button>
                    </div>
                  )}
                </div>
                <div className="card panel">
                  <div className="paneltitle">
                    <h3>
                      <CalendarDays size={18} /> Als Nächstes
                    </h3>
                    <button onClick={() => setPage("events")}>
                      Kalender <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {upcoming.length ? (
                    upcoming.slice(0, 3).map((e) => (
                      <button
                        className="event"
                        key={e.id}
                        onClick={() => setEditor({ kind: "events", item: e })}
                      >
                        <span className="eventdate">
                          {new Date(e.start!).getDate()}
                          <small>
                            {new Date(e.start!).toLocaleDateString("de-DE", {
                              month: "short",
                            })}
                          </small>
                        </span>
                        <div>
                          {e.title}
                          <small>
                            {dateText(e.start!)}{" "}
                            {e.location && " · " + e.location}
                          </small>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="empty">
                      <CalendarDays />
                      <p>Raum für neue Pläne.</p>
                      <span>Du hast keine anstehenden Termine.</span>
                    </div>
                  )}
                </div>
              </section>
              <div className="sectionlabel">
                Dein vernetztes Leben <span>WÄCHST MIT DIR</span>
              </div>
              <section className="integrations">
                {[
                  ["€", "Finanzen", "Budget & Ausgaben"],
                  ["⌂", "Smart Home", "Dein Zuhause im Blick"],
                  ["♫", "Musik", "Releases & Projekte"],
                ].map(([icon, title, sub]) => (
                  <div className="card integration" key={title}>
                    <span className="integrationicon">{icon}</span>
                    <h3>{title}</h3>
                    <p>{sub}</p>
                    <span className="tag">Nicht verbunden</span>
                  </div>
                ))}
              </section>
            </>
          )}
          {(page === "tasks" || page === "notes" || page === "events") && (
            <section className="card panel">
              <div className="paneltitle">
                <h3>{navigation.find((n) => n[0] === page)?.[1]}</h3>
                <span className="tag">
                  {data[page as Kind].length} Einträge
                </span>
              </div>
              {data[page as Kind].length ? (
                data[page as Kind].map((i) =>
                  page === "tasks" ? (
                    taskRow(i)
                  ) : (
                    <button
                      className="listitem"
                      key={i.id}
                      onClick={() => setEditor({ kind: page as Kind, item: i })}
                    >
                      <strong>{i.title}</strong>
                      <p>
                        {page === "events"
                          ? dateText(i.start!) + " · " + i.location
                          : i.description || "Keine Beschreibung"}
                      </p>
                    </button>
                  ),
                )
              ) : (
                <div className="empty">
                  <NotebookPen />
                  <p>Noch keine Einträge.</p>
                  <span>Lege oben deinen ersten Eintrag an.</span>
                </div>
              )}
            </section>
          )}
          {page === "health" && (
            <section className="card panel">
              <div className="paneltitle">
                <h3>
                  <HeartPulse size={18} /> Health Connect
                </h3>
                <span className="tag">
                  {data.health.last_sync ? "Synchronisiert" : "Nicht verbunden"}
                </span>
              </div>
              <p className="muted">
                Leseberechtigungen und Synchronisation verwaltest du in der
                Android-App. Letzte Übertragung:{" "}
                {data.health.last_sync
                  ? dateText(data.health.last_sync)
                  : "Noch keine"}
              </p>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>Schritte</th>
                      <th>Schlaf (h)</th>
                      <th>Ruhepuls</th>
                      <th>Gewicht (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.health.days.map((d) => (
                      <tr key={d.day}>
                        <td>{d.day}</td>
                        <td>{fmt(d.steps)}</td>
                        <td>
                          {fmt(
                            d.sleep_minutes == null
                              ? null
                              : d.sleep_minutes / 60,
                          )}
                        </td>
                        <td>{fmt(d.resting_pulse)}</td>
                        <td>{fmt(d.weight_kg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.health.days.length && (
                <div className="empty">
                  <HeartPulse />
                  <p>Noch keine Gesundheitsdaten.</p>
                  <span>Verbinde Health Connect auf deinem Pixel.</span>
                </div>
              )}
            </section>
          )}
          {page === "settings" && (
            <section className="card panel settings">
              <h3>Dein privater Workspace</h3>
              <p>
                Zugriff über dein privates VPN. Gesundheitsdaten bleiben von
                deinen übrigen Daten getrennt.
              </p>
              <h4>Lokaler Cache</h4>
              <p>
                Dieser Browser speichert den letzten Dashboard-Stand inklusive
                Gesundheitswerten für die Offline-Anzeige.
              </p>
              <button
                onClick={() => {
                  localStorage.removeItem("life-cache");
                  setData(empty);
                  setLoaded("");
                }}
              >
                Lokalen Cache löschen
              </button>
              <h4>Gesundheitsdaten</h4>
              <p>
                Löscht alle importierten Tageswerte auf dem Server. Deaktiviere
                vorher die Synchronisation in Android, damit sie nicht erneut
                übertragen werden.
              </p>
              <button
                className="danger"
                disabled={!enabled}
                onClick={() => {
                  if (confirm("Alle Gesundheitsdaten auf dem Server löschen?"))
                    void mutate("/health/days", "DELETE");
                }}
              >
                <Trash2 size={16} /> Gesundheitsdaten löschen
              </button>
              <h4>Sitzung</h4>
              <button
                disabled={!enabled}
                onClick={async () => {
                  if (await mutate("/auth/logout", "POST")) {
                    localStorage.removeItem("life-cache");
                    setData(empty);
                    setLoaded("");
                    setAuth(false);
                  }
                }}
              >
                <LogOut size={16} /> Abmelden
              </button>
            </section>
          )}
          <footer>
            <span>
              <Layers3 size={13} /> everything · Dein persönliches Life OS
            </span>
            <span>Privat. Verbunden. Bei dir.</span>
          </footer>
        </div>
      </main>
      {editor && (
        <div className="modalback">
          <form
            className="modal card"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const body = {
                title: f.get("title"),
                description: f.get("description"),
                due: f.get("due") || null,
                completed: editor.item?.completed || false,
                start: f.get("start")
                  ? new Date(String(f.get("start"))).toISOString()
                  : null,
                end: f.get("end")
                  ? new Date(String(f.get("end"))).toISOString()
                  : null,
                location: f.get("location") || "",
                version: editor.item?.version || 1,
              };
              if (
                await mutate(
                  "/items/" +
                    editor.kind +
                    (editor.item ? "/" + editor.item.id : ""),
                  editor.item ? "PUT" : "POST",
                  body,
                )
              )
                setEditor(null);
            }}
          >
            <div className="paneltitle">
              <h3>
                {labels[editor.kind]} {editor.item ? "bearbeiten" : "anlegen"}
              </h3>
              <button
                type="button"
                aria-label="Schließen"
                onClick={() => setEditor(null)}
              >
                <X size={19} />
              </button>
            </div>
            <label>
              Titel
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={editor.item?.title}
              />
            </label>
            <label>
              Beschreibung
              <textarea
                name="description"
                rows={5}
                maxLength={50000}
                defaultValue={editor.item?.description}
              />
            </label>
            {editor.kind === "tasks" && (
              <label>
                Fällig am
                <input
                  type="date"
                  name="due"
                  defaultValue={editor.item?.due || ""}
                />
              </label>
            )}
            {editor.kind === "events" && (
              <>
                {(["start", "end"] as const).map((k) => (
                  <label key={k}>
                    {k === "start" ? "Beginn" : "Ende"}
                    <input
                      required
                      type="datetime-local"
                      name={k}
                      defaultValue={
                        editor.item?.[k]
                          ? new Date(
                              new Date(editor.item[k]!).getTime() -
                                new Date(editor.item[k]!).getTimezoneOffset() *
                                  60000,
                            )
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                    />
                  </label>
                ))}
                <label>
                  Ort
                  <input
                    name="location"
                    maxLength={500}
                    defaultValue={editor.item?.location}
                  />
                </label>
              </>
            )}
            <div className="modalactions">
              {editor.item && (
                <button
                  type="button"
                  className="danger"
                  disabled={!enabled}
                  onClick={async () => {
                    if (
                      confirm("Eintrag löschen?") &&
                      (await mutate(
                        "/items/" +
                          editor.kind +
                          "/" +
                          editor.item!.id +
                          "?version=" +
                          editor.item!.version,
                        "DELETE",
                      ))
                    )
                      setEditor(null);
                  }}
                >
                  <Trash2 size={16} /> Löschen
                </button>
              )}
              <button className="primary" disabled={!enabled}>
                Speichern
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
