"use client";
import { useEffect, useRef, useState } from "react";
import { Language, Theme, localeFor, translator, slogan } from "./i18n";
import WidgetBoard from "./WidgetBoard";
import HealthWorkspace from "./HealthWidgets";
import TaskWorkspace from "./TaskWorkspace";
import NotificationSettings from "./NotificationSettings";
import SmartHome, { BridgeSettings } from "./SmartHome";
import { LayoutName, layouts, validLayout } from "./appearance";
import WorkspaceModules from "./WorkspaceModules";
import {
  Lightbulb,
  Music,
  Bot,
  Gem,
  LayoutDashboard,
  CheckSquare,
  HeartPulse,
  Settings,
  ArrowUpRight,
  Plus,
  Square,
  CheckSquare2,
  RefreshCw,
  LogOut,
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
  reminders_enabled?: boolean;
  remind_at?: string | null;
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
  smart_home?: { status: string; light_count: number };
  music?: Item[];
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
  const [layout, setLayout] = useState<LayoutName>("index");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const t = translator(language);
  const locale = localeFor(language);
  const navigation = [
    ["dashboard", t("Übersicht"), LayoutDashboard],
    ["tasks", t("Aufgaben"), CheckSquare],
    ["music", t("Musik"), Music],
    ["agent", t("KI-Agent"), Bot],
    ["obsidian", "Obsidian", Gem],
    ["home", "Smart Home", Lightbulb],
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
      setLayout(validLayout(localStorage.getItem("monopol-layout")));
      setLanguage(
        localStorage.getItem("monopol-language") === "de" ? "de" : "en",
      );
      setTheme(
        (["dark", "light", "amber", "cyan"].includes(
          localStorage.getItem("monopol-theme") || "",
        )
          ? localStorage.getItem("monopol-theme")
          : "dark") as Theme,
      );
    } catch {}
    setPreferencesReady(true);
  }, []);
  useEffect(() => {
    if (!preferencesReady) return;
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.layout = layout;
    try {
      localStorage.setItem("monopol-language", language);
      localStorage.setItem("monopol-theme", theme);
      localStorage.setItem("monopol-layout", layout);
    } catch {}
  }, [language, theme, layout, preferencesReady]);
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
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "tasks")
      setPage("tasks");
  }, []);
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
      data-page={page}
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
          {navigation.map(([id, label, Icon], index) => (
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
              <span className="nav-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
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
      <div
        className="mobile-dock"
        role="navigation"
        aria-label={t("Schnellnavigation")}
      >
        {navigation.slice(0, 4).map(([id, label, Icon]) => (
          <button
            key={id}
            aria-label={label}
            aria-current={page === id ? "page" : undefined}
            onClick={() => setPage(id)}
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
        <button
          aria-label={t("Weitere Module")}
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu size={19} />
          <span>{t("Mehr")}</span>
        </button>
      </div>
      <div className="control-inspector" aria-label={t("Workspace-Inspektor")}>
        <span className="inspector-label">INSPECTOR / LIVE</span>
        <h2>{t("Im Blick")}</h2>
        <div>
          <small>{t("Offene Aufgaben")}</small>
          <strong>{data.tasks.filter((task) => !task.completed).length}</strong>
        </div>
        <div>
          <small>{t("Musikprojekte")}</small>
          <strong>{data.music?.length || 0}</strong>
        </div>
        <div>
          <small>{t("Erfasste Tage")}</small>
          <strong>{data.health.days.length}</strong>
        </div>
        <button onClick={() => setPage("agent")}>
          {t("KI-Agent öffnen")}
          <ArrowUpRight size={18} />
        </button>
        <button onClick={() => setPage("obsidian")}>
          Obsidian
          <ArrowUpRight size={18} />
        </button>
        <p>{t("Aktueller App-Bestand. Keine Beispieldaten.")}</p>
      </div>
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
            {(page === "dashboard" || page === "tasks") && (
              <button
                className="primary"
                disabled={!enabled}
                onClick={() => setEditor({ kind: "tasks" })}
              >
                <Plus size={17} />
                {t("Neue Aufgabe")}
              </button>
            )}
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
            <WidgetBoard
              layout={layout}
              language={language}
              enabled={enabled}
              request={request}
              days={data.health.days}
              tasks={data.tasks}
              projects={data.music || []}
              row={taskRow}
              navigate={setPage}
              onChanged={() => void load()}
            />
          )}
          {page === "tasks" && (
            <TaskWorkspace
              layout={layout}
              language={language}
              tasks={data.tasks}
              row={taskRow}
            />
          )}
          {page === "health" && (
            <HealthWorkspace
              request={request}
              enabled={enabled}
              language={language}
              days={data.health.days}
            />
          )}
          {["music", "agent", "obsidian"].includes(page) && (
            <WorkspaceModules
              key={page}
              page={page}
              language={language}
              enabled={enabled}
              request={request}
              onChanged={() => void load()}
            />
          )}
          {page === "home" && (
            <SmartHome
              language={language}
              enabled={enabled}
              request={request}
              settings={() => setPage("settings")}
              onChanged={() => void load()}
            />
          )}
          {page === "settings" && (
            <section className="card panel settings">
              <BridgeSettings
                language={language}
                enabled={enabled}
                request={request}
              />
              <NotificationSettings
                language={language}
                enabled={enabled}
                request={request}
              />
              <h3>{t("Darstellung")}</h3>
              <div className="appearance-heading">
                <span>01 / {t("Layout")}</span>
                <p>
                  {t("Vier Arbeitsweisen. Jede mit jeder Farbe kombinierbar.")}
                </p>
              </div>
              <div
                className="layout-picker"
                role="group"
                aria-label={t("Layout wählen")}
              >
                {layouts.map((option) => (
                  <button
                    key={option.id}
                    className={
                      "layout-option" +
                      (layout === option.id ? " selected" : "")
                    }
                    aria-pressed={layout === option.id}
                    onClick={() => setLayout(option.id)}
                  >
                    <div
                      className={"layout-mini mini-" + option.id}
                      aria-hidden="true"
                    >
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <span>
                      <b>{option.number}</b>
                      <strong>{option.name}</strong>
                      {layout === option.id && (
                        <span className="layout-check">↗</span>
                      )}
                    </span>
                    <p>{t(option.description)}</p>
                  </button>
                ))}
              </div>
              <div className="appearance-heading">
                <span>02 / {t("Farbwelt")}</span>
                <p>{t("Die Farbe verändert nicht das Layout.")}</p>
              </div>
              <div
                className="palette-picker"
                role="group"
                aria-label={t("Farbwelt wählen")}
              >
                {[
                  ["dark", "Violet", "#b69af7", "#11101d"],
                  ["light", "Paper", "#6940a6", "#f7f6fb"],
                  ["amber", "Amber", "#ffc14a", "#100e09"],
                  ["cyan", "Cyan", "#52e5ee", "#06151d"],
                ].map(([id, name, accent, bg]) => (
                  <button
                    key={id}
                    aria-pressed={theme === id}
                    className={theme === id ? "selected" : ""}
                    onClick={() => setTheme(id as Theme)}
                  >
                    <span style={{ background: bg, borderColor: accent }}>
                      <i style={{ background: accent }} />
                    </span>
                    {name}
                  </button>
                ))}
              </div>

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
                    <option value="dark">Violet</option>
                    <option value="light">Paper</option>
                    <option value="amber">Amber</option>
                    <option value="cyan">Cyan</option>
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
                  localStorage.removeItem("mainframe-widgets");
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
                    localStorage.removeItem("mainframe-widgets");
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
                reminders_enabled: f.get("reminders_enabled") === "on",
                remind_at: f.get("remind_at")
                  ? new Date(String(f.get("remind_at"))).toISOString()
                  : null,
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
            {editor.kind === "tasks" && (
              <>
                <label className="reminder-toggle">
                  <input
                    type="checkbox"
                    name="reminders_enabled"
                    defaultChecked={editor.item?.reminders_enabled !== false}
                  />
                  {t("Erinnerung aktiv")}
                </label>
                <label>
                  {t("Eigene Erinnerungszeit (lokale Gerätezeit)")}
                  <input
                    type="datetime-local"
                    name="remind_at"
                    defaultValue={
                      editor.item?.remind_at
                        ? new Date(
                            new Date(editor.item.remind_at).getTime() -
                              new Date(
                                editor.item.remind_at,
                              ).getTimezoneOffset() *
                                60000,
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                  />
                </label>
                <small>
                  {t(
                    "Ohne eigene Zeit: am Fälligkeitstag um 09:00 Uhr Europe/Berlin. Benachrichtigungen in den Einstellungen aktivieren.",
                  )}
                </small>
              </>
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
