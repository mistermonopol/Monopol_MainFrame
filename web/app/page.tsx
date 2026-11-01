"use client";
import { useEffect, useRef, useState } from "react";
import { Language, Theme, localeFor, translator, slogan } from "./i18n";
import StepChart from "./StepChart";
import {
  LayoutDashboard,
  CheckSquare,
  NotebookPen,
  CalendarDays,
  HeartPulse,
  Settings,
  ArrowUpRight,
  Plus,
  Square,
  CheckSquare2,
  RefreshCw,
  LogOut,
  Layers3,
  Activity,
  Moon,
  Footprints,
  Weight,
  X,
  Trash2,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  SquareTerminal,
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
export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<Theme>("dark");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const t = translator(language);
  const locale = localeFor(language);
  const navigation = [
    ["dashboard", t("Übersicht"), LayoutDashboard],
    ["tasks", t("Aufgaben"), CheckSquare],
    ["notes", t("Notizen"), NotebookPen],
    ["events", t("Kalender"), CalendarDays],
    ["health", t("Gesundheit"), HeartPulse],
    ["settings", t("Einstellungen"), Settings],
  ] as const;
  const labels: Record<Kind, string> = {
    tasks: t("Aufgabe"),
    notes: t("Notiz"),
    events: t("Termin"),
  };
  const fmt = (value: number | null | undefined) =>
    value == null
      ? "—"
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
          value,
        );
  const dateText = (s: string) =>
    new Date(s).toLocaleString(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  useEffect(() => {
    try {
      setLanguage(
        localStorage.getItem("monopol-language") === "de" ? "de" : "en",
      );
      setTheme(
        localStorage.getItem("monopol-theme") === "light" ? "light" : "dark",
      );
    } catch {}
    setPreferencesReady(true);
  }, []);
  useEffect(() => {
    if (!preferencesReady) return;
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("monopol-language", language);
      localStorage.setItem("monopol-theme", theme);
    } catch {}
  }, [language, theme, preferencesReady]);
  const [page, setPage] = useState("dashboard"),
    [data, setData] = useState<Data>(empty),
    [online, setOnline] = useState(true),
    [auth, setAuth] = useState(false),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(""),
    [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    try {
      setSidebarCollapsed(
        localStorage.getItem("monopol-sidebar-collapsed") === "true",
      );
    } catch {}
    const desktop = window.matchMedia("(min-width: 801px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const sidebar = sidebarRef.current;
    const focusClose = () =>
      sidebar
        ?.querySelector<HTMLButtonElement>(".mobile-nav-close")
        ?.focus({ preventScroll: true });
    const afterTransition = (event: TransitionEvent) => {
      if (event.target === sidebar && event.propertyName === "transform")
        focusClose();
    };
    sidebar?.addEventListener("transitionend", afterTransition);
    const focusFrame = window.requestAnimationFrame(focusClose);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
      if (event.key !== "Tab") return;
      const controls = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      sidebar?.removeEventListener("transitionend", afterTransition);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      menuButtonRef.current?.focus();
    };
  }, [mobileMenuOpen]);
  function toggleSidebar() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try {
      localStorage.setItem("monopol-sidebar-collapsed", String(next));
    } catch {}
  }
  const [editor, setEditor] = useState<{ kind: Kind; item?: Item } | null>(
    null,
  );
  async function request(path: string, init?: RequestInit) {
    const r = await fetch("/api/v1" + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": language,
        ...init?.headers,
      },
    });
    if (r.status === 401) {
      setAuth(false);
      const body = await r.json().catch(() => ({}));
      throw Error(
        typeof body.detail === "string" ? t(body.detail) : t("Bitte anmelden."),
      );
    }
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw Error(
        typeof body.detail === "string"
          ? t(body.detail)
          : t("Die Anfrage konnte nicht gespeichert werden."),
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
  function taskRow(task: Item) {
    return (
      <div className="task" key={task.id}>
        <button
          aria-label={
            task.completed ? t("Als offen markieren") : t("Erledigen")
          }
          disabled={!enabled}
          className="check"
          onClick={() =>
            void mutate("/items/tasks/" + task.id, "PUT", {
              ...task,
              completed: !task.completed,
            })
          }
        >
          {task.completed ? <CheckSquare2 size={21} /> : <Square size={21} />}
        </button>
        <button
          className={"tasktext " + (task.completed ? "done" : "")}
          onClick={() => setEditor({ kind: "tasks", item: task })}
        >
          {task.title}
          <small>
            {task.due
              ? new Date(task.due + "T12:00:00").toLocaleDateString(locale)
              : t("Ohne Fälligkeit")}
          </small>
        </button>
        <span className="tag">
          {task.completed ? t("Erledigt") : t("Offen")}
        </span>
      </div>
    );
  }
  return (
    <div
      className={`shell${sidebarCollapsed ? " sidebar-collapsed" : ""}${mobileMenuOpen ? " menu-open" : ""}`}
    >
      {mobileMenuOpen && (
        <button
          className="sidebar-scrim"
          aria-label={t("Menü schließen")}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside
        id="sidebar"
        ref={sidebarRef}
        aria-label={t("Seitennavigation")}
        role={mobileMenuOpen ? "dialog" : undefined}
        aria-modal={mobileMenuOpen || undefined}
      >
        <div className="sidebar-head">
          <a
            className="brand"
            href="/"
            aria-label={t("Monopol_MainFrame Startseite")}
            title="Monopol_MainFrame"
          >
            <span className="brandicon">
              <SquareTerminal size={22} />
            </span>
            <span className="brand-name">
              Monopol_<span>MainFrame</span>
            </span>
          </a>
          <button
            className="sidebar-toggle"
            aria-label={
              sidebarCollapsed
                ? t("Seitenleiste ausklappen")
                : t("Seitenleiste einklappen")
            }
            aria-expanded={!sidebarCollapsed}
            aria-controls="sidebar"
            onClick={toggleSidebar}
            title={
              sidebarCollapsed
                ? t("Seitenleiste ausklappen")
                : t("Seitenleiste einklappen")
            }
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
          <button
            className="mobile-nav-close"
            aria-label={t("Navigation schließen")}
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace">{t("PERSÖNLICHER WORKSPACE")}</div>
        <nav aria-label={t("Hauptnavigation")}>
          {navigation.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              aria-label={label}
              aria-current={page === id ? "page" : undefined}
              title={label}
              onClick={() => {
                setPage(id);
                setMobileMenuOpen(false);
              }}
            >
              <Icon size={19} />
              <span className="nav-label">{label}</span>
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
            {t("Dein privater Raum")}
            <small>{t("Alles an einem Ort. Unter deiner Kontrolle.")}</small>
          </div>
          <div className="profile">
            <div className="avatar">M</div>
            <div>
              <span className="profile-label">
                Monopol<small>{t("Persönlicher Workspace")}</small>
              </span>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div className="header-location">
            <button
              ref={menuButtonRef}
              className="mobile-menu"
              aria-label={t("Navigation öffnen")}
              aria-expanded={mobileMenuOpen}
              aria-controls="sidebar"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div className="breadcrumb">
              <span className="header-brand">Monopol_MainFrame</span>
              <span className="breadcrumb-divider">/</span>
              <strong>{navigation.find((n) => n[0] === page)?.[1]}</strong>
            </div>
          </div>
          <div className="headeractions">
            <span className="connection">
              <i className={online ? "statusdot" : "statusdot amber"} />
              {online ? t("Server verbunden") : t("Offline / Anmeldung nötig")}
            </span>
            <button
              aria-label={t("Aktualisieren")}
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
              <div className="eyebrow">{t("DEIN PERSÖNLICHER WORKSPACE")}</div>
              <h1>
                {page === "dashboard"
                  ? t("Willkommen im MainFrame.")
                  : navigation.find((n) => n[0] === page)?.[1]}
              </h1>
              <p>
                {new Date().toLocaleDateString(locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "Europe/Berlin",
                })}{" "}
                <span className="divider">·</span>
                {t("Mach Platz für das, was zählt.")}
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
                ? t("Neue Notiz")
                : page === "events"
                  ? t("Neuer Termin")
                  : t("Neue Aufgabe")}
            </button>
          </div>
          {error && (
            <div className="notice" role="alert">
              {t(error)}
            </div>
          )}
          {!auth && (
            <form
              className="card loginform"
              onSubmit={async (event) => {
                event.preventDefault();
                setSigningIn(true);
                try {
                  await request("/auth/login", {
                    method: "POST",
                    body: JSON.stringify({ password }),
                  });
                  setPassword("");
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setSigningIn(false);
                }
              }}
            >
              <div>
                <strong>{t("Dein privater Workspace")}</strong>
                <small>
                  {t("Melde dich mit deinem persönlichen Passwort an.")}
                </small>
              </div>
              <label htmlFor="login-password">{t("Passwort")}</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                minLength={16}
                maxLength={1024}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button className="primary" disabled={signingIn}>
                {signingIn ? t("Anmelden …") : t("Anmelden")}
              </button>
            </form>
          )}
          {loaded && (
            <div className="sync">
              {t("Letzter geladener Stand:")} {dateText(loaded)}
            </div>
          )}
          {page === "dashboard" && (
            <>
              <section className="hero">
                <div>
                  <span className="pill">
                    <span className="statusdot" /> {slogan}
                  </span>
                  <h2>
                    {t("Weniger Tabs.")}
                    <br />
                    <span>{t("Mehr Überblick.")}</span>
                  </h2>
                  <p>
                    {t("Deine Aufgaben, Termine und Gesundheit.")}
                    <br />
                    {t("Ein ruhiger Ort für alles, was dich bewegt.")}
                  </p>
                  <button onClick={() => setPage("tasks")}>
                    {t("Meinen Tag planen")}
                    <ArrowUpRight size={16} />
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
              <StepChart days={data.health.days} language={language} />
              <div className="sectionlabel">
                {t("Heute auf einen Blick")}{" "}
                <span>{t("DEIN TÄGLICHER PULS")}</span>
              </div>
              <section className="stats">
                {[
                  [
                    Footprints,
                    t("Schritte"),
                    fmt(today?.steps),
                    t("Heute"),
                    "mint",
                  ],
                  [
                    Moon,
                    t("Schlaf"),
                    today?.sleep_minutes == null
                      ? "—"
                      : fmt(today.sleep_minutes / 60) + " h",
                    t("Letzte Nacht"),
                    "purple",
                  ],
                  [
                    Activity,
                    t("Ruhepuls"),
                    fmt(today?.resting_pulse),
                    t("bpm · Tagesmittel"),
                    "peach",
                  ],
                  [
                    Weight,
                    t("Gewicht"),
                    fmt(
                      data.health.days.find((d) => d.weight_kg != null)
                        ?.weight_kg,
                    ),
                    t("kg · letzter Tageswert"),
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
                      <CheckSquare size={18} /> {t("Meine Aufgaben")}{" "}
                      <span className="count">
                        {data.tasks.filter((t) => !t.completed).length}
                      </span>
                    </h3>
                    <button onClick={() => setPage("tasks")}>
                      {t("Alle ansehen")}
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {data.tasks.length ? (
                    data.tasks.slice(0, 4).map(taskRow)
                  ) : (
                    <div className="empty">
                      <CheckSquare />
                      <p>{t("Ein klarer Kopf beginnt mit einer Liste.")}</p>
                      <button
                        disabled={!enabled}
                        onClick={() => setEditor({ kind: "tasks" })}
                      >
                        {t("Erste Aufgabe anlegen")}
                      </button>
                    </div>
                  )}
                </div>
                <div className="card panel">
                  <div className="paneltitle">
                    <h3>
                      <CalendarDays size={18} />
                      {t("Als Nächstes")}
                    </h3>
                    <button onClick={() => setPage("events")}>
                      {t("Kalender")}
                      <ArrowUpRight size={14} />
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
                            {new Date(e.start!).toLocaleDateString(locale, {
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
                      <p>{t("Raum für neue Pläne.")}</p>
                      <span>{t("Du hast keine anstehenden Termine.")}</span>
                    </div>
                  )}
                </div>
              </section>
              <div className="sectionlabel">
                {t("Dein vernetztes Leben")}
                <span>{t("WÄCHST MIT DIR")}</span>
              </div>
              <section className="integrations">
                {[
                  ["€", t("Finanzen"), t("Budget & Ausgaben")],
                  ["⌂", "Smart Home", t("Dein Zuhause im Blick")],
                  ["♫", t("Musik"), t("Releases & Projekte")],
                ].map(([icon, title, sub]) => (
                  <div className="card integration" key={title}>
                    <span className="integrationicon">{icon}</span>
                    <h3>{title}</h3>
                    <p>{sub}</p>
                    <span className="tag">{t("Nicht verbunden")}</span>
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
                  {data[page as Kind].length}
                  {t("Einträge")}
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
                          : i.description || t("Keine Beschreibung")}
                      </p>
                    </button>
                  ),
                )
              ) : (
                <div className="empty">
                  <NotebookPen />
                  <p>{t("Noch keine Einträge.")}</p>
                  <span>{t("Lege oben deinen ersten Eintrag an.")}</span>
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
                  {data.health.last_sync
                    ? t("Synchronisiert")
                    : t("Nicht verbunden")}
                </span>
              </div>
              <p className="muted">
                {t(
                  "Leseberechtigungen und Synchronisation verwaltest du in der Android-App. Letzte Übertragung:",
                )}{" "}
                {data.health.last_sync
                  ? dateText(data.health.last_sync)
                  : t("Noch keine")}
              </p>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Tag")}</th>
                      <th>{t("Schritte")}</th>
                      <th>{t("Schlaf (h)")}</th>
                      <th>{t("Ruhepuls")}</th>
                      <th>{t("Gewicht (kg)")}</th>
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
                  <p>{t("Noch keine Gesundheitsdaten.")}</p>
                  <span>{t("Verbinde Health Connect auf deinem Pixel.")}</span>
                </div>
              )}
            </section>
          )}
          {page === "settings" && (
            <section className="card panel settings">
              <h3>{t("Darstellung")}</h3>
              <div className="preference-fields">
                <label>
                  {t("Sprache")}
                  <select
                    aria-label={t("Sprache")}
                    value={language}
                    onChange={(event) =>
                      setLanguage(event.target.value as Language)
                    }
                  >
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                  </select>
                </label>
                <label>
                  {t("Design")}
                  <select
                    aria-label={t("Design")}
                    value={theme}
                    onChange={(event) => setTheme(event.target.value as Theme)}
                  >
                    <option value="dark">{t("Dunkel")}</option>
                    <option value="light">{t("Hell")}</option>
                  </select>
                </label>
              </div>
              <p>{t("Einstellungen werden auf diesem Gerät gespeichert.")}</p>
              <h3>{t("Dein privater Workspace")}</h3>
              <p>
                {t(
                  "Zugriff über HTTPS mit deinem persönlichen Passwort. Gesundheitsdaten bleiben von deinen übrigen Daten getrennt.",
                )}
              </p>
              <h4>{t("Lokaler Cache")}</h4>
              <p>
                {t(
                  "Dieser Browser speichert den letzten Dashboard-Stand inklusive Gesundheitswerten für die Offline-Anzeige.",
                )}
              </p>
              <button
                onClick={() => {
                  localStorage.removeItem("life-cache");
                  setData(empty);
                  setLoaded("");
                }}
              >
                {t("Lokalen Cache löschen")}
              </button>
              <h4>{t("Gesundheitsdaten")}</h4>
              <p>
                {t(
                  "Löscht alle importierten Tageswerte auf dem Server. Deaktiviere vorher die Synchronisation in Android, damit sie nicht erneut übertragen werden.",
                )}
              </p>
              <button
                className="danger"
                disabled={!enabled}
                onClick={() => {
                  if (
                    confirm(t("Alle Gesundheitsdaten auf dem Server löschen?"))
                  )
                    void mutate("/health/days", "DELETE");
                }}
              >
                <Trash2 size={16} />
                {t("Gesundheitsdaten löschen")}
              </button>
              <h4>{t("Sitzung")}</h4>
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
                <LogOut size={16} />
                {t("Abmelden")}
              </button>
            </section>
          )}
          <footer>
            <span>
              <SquareTerminal size={14} /> {slogan}
            </span>
            <span>{t("Privat. Verbunden. Bei dir.")}</span>
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
                {language === "en"
                  ? `${editor.item ? t("Bearbeiten") : t("Anlegen")} ${labels[editor.kind]}`
                  : `${labels[editor.kind]} ${editor.item ? t("bearbeiten") : t("anlegen")}`}
              </h3>
              <button
                type="button"
                aria-label={t("Schließen")}
                onClick={() => setEditor(null)}
              >
                <X size={19} />
              </button>
            </div>
            <label>
              {t("Titel")}
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={editor.item?.title}
              />
            </label>
            <label>
              {t("Beschreibung")}
              <textarea
                name="description"
                rows={5}
                maxLength={50000}
                defaultValue={editor.item?.description}
              />
            </label>
            {editor.kind === "tasks" && (
              <label>
                {t("Fällig am")}
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
                    {k === "start" ? t("Beginn") : t("Ende")}
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
                  {t("Ort")}
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
                      confirm(t("Eintrag löschen?")) &&
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
                  <Trash2 size={16} />
                  {t("Löschen")}
                </button>
              )}
              <button className="primary" disabled={!enabled}>
                {t("Speichern")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
