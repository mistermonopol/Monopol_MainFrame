"use client";
import { useEffect, useState } from "react";
import { Language, translator } from "./i18n";
import {
  ArrowUpRight,
  Music,
  Bot,
  Gem,
  Send,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

type Request = (path: string, init?: RequestInit) => Promise<any>;
type Project = {
  id: string;
  version: number;
  title: string;
  description: string;
  due: string | null;
  completed: boolean;
  location: string;
};
type Note = { path: string; content: string; version: string };
export default function WorkspaceModules({
  page,
  language,
  enabled,
  request,
}: {
  page: string;
  language: Language;
  enabled: boolean;
  request: Request;
}) {
  const t = translator(language);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    ai: boolean;
    obsidian: boolean;
    model: string;
  } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Partial<Project> | null>(null);
  const [notes, setNotes] = useState<{ path: string; title: string }[]>([]);
  const [note, setNote] = useState<Note | null>(null);
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [prompt, setPrompt] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      try {
        const s = await request("/integrations");
        if (!active) return;
        setStatus(s);
        if (page === "music") {
          const rows = await request("/items/music");
          if (active) setProjects(rows);
        }
        if (page === "obsidian" && s.obsidian) {
          const rows = await request("/obsidian/notes");
          if (active) setNotes(rows);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, enabled]); // request uses current language; no persistent subscription
  async function saveProject() {
    if (!project) return;
    await run(async () => {
      await request("/items/music" + (project.id ? "/" + project.id : ""), {
        method: project.id ? "PUT" : "POST",
        body: JSON.stringify({
          title: project.title || "",
          description: project.description || "",
          due: project.due || null,
          completed: project.completed || false,
          location: project.location || "",
          version: project.version || 1,
        }),
      });
      setProject(null);
      setProjects(await request("/items/music"));
    });
  }
  async function openNote(path: string) {
    if (dirty && !confirm(t("Ungespeicherte Änderungen verwerfen?"))) return;
    await run(async () => {
      setNote(await request("/obsidian/note?path=" + encodeURIComponent(path)));
      setDirty(false);
    });
  }
  return (
    <section className="module-workspace">
      <div className="module-banner">
        <span className="module-number">
          {page === "music" ? "01" : page === "agent" ? "02" : "03"} / MAINFRAME
        </span>
        <div>
          {page === "music" ? (
            <Music size={36} />
          ) : page === "agent" ? (
            <Bot size={36} />
          ) : (
            <Gem size={36} />
          )}
          <h2>
            {page === "music"
              ? t("Dein Sound. Dein nächster Release.")
              : page === "agent"
                ? t("Ein Chat. Dein ganzer Workspace.")
                : t("Dein Wissen, verbunden.")}
          </h2>
        </div>
        <p>
          {page === "music"
            ? t("Ideen, Sessions und Releases an einem Ort.")
            : page === "agent"
              ? t(
                  "Frage nach Aufgaben, Musik und Gesundheitswerten. Dein Agent kann auch deinen Obsidian-Vault lesen.",
                )
              : t(
                  "Öffne und bearbeite die Markdown-Dateien deines Obsidian-Vaults.",
                )}
        </p>
      </div>
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      {!enabled && <p>{t("Bitte anmelden.")}</p>}
      {page === "music" && (
        <>
          <div className="paneltitle">
            <h3>
              {t("Musikprojekte")}{" "}
              <span className="count">{projects.length}</span>
            </h3>
            <button
              disabled={!enabled || busy}
              onClick={() =>
                setProject({
                  title: "",
                  description: "",
                  location: "",
                  completed: false,
                })
              }
            >
              <Plus size={16} />
              {t("Neues Projekt")}
            </button>
          </div>
          {project && (
            <form
              className="card panel module-form"
              onSubmit={(e) => {
                e.preventDefault();
                void saveProject();
              }}
            >
              <label>
                {t("Titel")}
                <input
                  required
                  maxLength={200}
                  value={project.title || ""}
                  onChange={(e) =>
                    setProject({ ...project, title: e.target.value })
                  }
                />
              </label>
              <label>
                {t("Beschreibung")}
                <textarea
                  maxLength={50000}
                  rows={5}
                  value={project.description || ""}
                  onChange={(e) =>
                    setProject({ ...project, description: e.target.value })
                  }
                />
              </label>
              <label>
                {t("Release-Datum")}
                <input
                  type="date"
                  value={project.due || ""}
                  onChange={(e) =>
                    setProject({ ...project, due: e.target.value })
                  }
                />
              </label>
              <label>
                {t("Projekt-Link oder Dateipfad")}
                <input
                  maxLength={500}
                  value={project.location || ""}
                  onChange={(e) =>
                    setProject({ ...project, location: e.target.value })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={project.completed || false}
                  onChange={(e) =>
                    setProject({ ...project, completed: e.target.checked })
                  }
                />
                {t("Veröffentlicht")}
              </label>
              <div className="module-actions">
                <button disabled={busy || !enabled} type="submit">
                  <Save size={16} />
                  {t("Speichern")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setProject(null)}
                >
                  {t("Abbrechen")}
                </button>
                {project.id && (
                  <button
                    type="button"
                    disabled={busy || !enabled}
                    onClick={() => {
                      if (confirm(t("Projekt löschen?")))
                        void run(async () => {
                          await request(
                            `/items/music/${project.id}?version=${project.version}`,
                            { method: "DELETE" },
                          );
                          setProject(null);
                          setProjects(await request("/items/music"));
                        });
                    }}
                  >
                    <Trash2 size={16} />
                    {t("Löschen")}
                  </button>
                )}
              </div>
            </form>
          )}
          <div className="music-grid">
            {projects.map((p, i) => (
              <button
                className="card music-project"
                key={p.id}
                onClick={() => setProject(p)}
              >
                <div className="track-art">
                  <Music size={42} />
                  <span>MF / {String(i + 1).padStart(2, "0")}</span>
                  <div className="waveform">
                    {Array.from({ length: 24 }, (_, n) => (
                      <i
                        key={n}
                        style={{ height: 8 + ((n * 17 + i * 11) % 48) }}
                      />
                    ))}
                  </div>
                </div>
                <span className="tag">
                  {p.completed ? t("Veröffentlicht") : t("In Arbeit")}
                </span>
                <h3>{p.title}</h3>
                <p>{p.description || t("Platz für deinen nächsten Sound.")}</p>
                <small>{p.due || t("Kein Release-Datum")}</small>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
          {!projects.length && !project && (
            <div className="card empty">
              <Music size={32} />
              <h3>{t("Platz für deinen nächsten Sound.")}</h3>
              <p>{t("Lege dein erstes Musikprojekt an.")}</p>
            </div>
          )}
        </>
      )}
      {page === "agent" && (
        <div className="card agent-console">
          <div className="console-status">
            <span className="statusdot" />
            {status?.ai
              ? `${t("Verbunden")} // ${status.model}`
              : t("API nicht verbunden")}
            <span>{t("App-Daten + Vault")}</span>
          </div>
          <p className="agent-disclosure">
            {t(
              "Beim Senden werden App-Daten inklusive Gesundheitswerten an deinen konfigurierten KI-Anbieter übermittelt. Keine API-Schlüssel im Browser.",
            )}
          </p>
          <div className="chat-history" role="log" aria-live="polite">
            {!messages.length && (
              <div className="chat-welcome">
                <Bot size={44} />
                <h3>{t("Was möchtest du wissen?")}</h3>
                <div className="prompt-grid">
                  {[
                    "Welche Aufgaben sind noch offen?",
                    "Wie haben sich meine Schritte entwickelt?",
                    "Was steht für meinen nächsten Release an?",
                  ].map((q) => (
                    <button key={q} onClick={() => setPrompt(t(q))}>
                      {t(q)}
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div className={"chat-message " + m.role} key={i}>
                <small>{m.role === "user" ? "YOU" : "MAINFRAME AGENT"}</small>
                <p>{m.content}</p>
              </div>
            ))}
            {busy && <p role="status">{t("Agent denkt nach…")}</p>}
          </div>
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              if (!prompt.trim() || busy) return;
              const next = [
                ...messages,
                { role: "user" as const, content: prompt.trim() },
              ];
              setMessages(next);
              setPrompt("");
              void run(async () => {
                const result = await request("/agent/chat", {
                  method: "POST",
                  body: JSON.stringify({ messages: next.slice(-29) }),
                });
                setMessages([
                  ...next,
                  { role: "assistant", content: result.reply },
                ]);
              });
            }}
          >
            <textarea
              aria-label={t("Nachricht an den Agenten")}
              maxLength={12000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("Frag deinen Mainframe…")}
              rows={2}
            />
            <button
              disabled={!enabled || !status?.ai || busy || !prompt.trim()}
              type="submit"
            >
              <Send size={18} />
              {t("Senden")}
            </button>
          </form>
          {!status?.ai && (
            <p>
              {t(
                "In Coolify AI_BASE_URL, AI_MODEL und AI_API_KEY konfigurieren. Details in docs/coolify.md.",
              )}
            </p>
          )}
        </div>
      )}
      {page === "obsidian" &&
        (!status?.obsidian ? (
          <div className="card panel">
            <Gem size={32} />
            <h3>{t("Verbinde deinen Vault")}</h3>
            <p>
              {t(
                "Binde deinen Obsidian-Ordner auf dem Server ein und setze OBSIDIAN_VAULT_PATH. Deine Markdown-Dateien bleiben in deinem Vault.",
              )}
            </p>
          </div>
        ) : (
          <div className="vault-layout">
            <div className="card vault-index">
              <h3>VAULT // .md</h3>
              <input
                aria-label={t("Notizen suchen")}
                placeholder={t("Notizen suchen")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                disabled={busy || !enabled}
                onClick={() => {
                  if (
                    dirty &&
                    !confirm(t("Ungespeicherte Änderungen verwerfen?"))
                  )
                    return;
                  setNote({ path: "", content: "", version: "" });
                  setDirty(true);
                }}
              >
                <Plus size={16} />
                {t("Neue Vault-Notiz")}
              </button>
              {notes
                .filter((n) =>
                  n.path.toLowerCase().includes(search.toLowerCase()),
                )
                .map((n) => (
                  <button
                    disabled={busy}
                    className={note?.path === n.path ? "active" : ""}
                    key={n.path}
                    onClick={() => void openNote(n.path)}
                  >
                    <Gem size={14} />
                    {n.path}
                  </button>
                ))}
              {!notes.length && <p>{t("Noch keine Einträge.")}</p>}
            </div>
            <div className="card panel vault-editor">
              {note ? (
                <form
                  className="module-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      setNote(
                        await request("/obsidian/note", {
                          method: "PUT",
                          body: JSON.stringify(note),
                        }),
                      );
                      setDirty(false);
                      setNotes(await request("/obsidian/notes"));
                    });
                  }}
                >
                  <label>
                    {t("Dateipfad im Vault")}
                    <input
                      required
                      readOnly={!!note.version}
                      placeholder="Music/Release.md"
                      value={note.path}
                      onChange={(e) => {
                        setNote({ ...note, path: e.target.value });
                        setDirty(true);
                      }}
                    />
                  </label>
                  <textarea
                    aria-label={t("Markdown-Inhalt")}
                    rows={22}
                    maxLength={200000}
                    value={note.content}
                    onChange={(e) => {
                      setNote({ ...note, content: e.target.value });
                      setDirty(true);
                    }}
                  />
                  <button disabled={busy || !enabled || !dirty} type="submit">
                    <Save size={16} />
                    {t("Speichern")}
                    {dirty ? " *" : ""}
                  </button>
                </form>
              ) : (
                <div className="empty">
                  <Gem size={40} />
                  <p>{t("Wähle eine Notiz aus deinem Vault.")}</p>
                </div>
              )}
            </div>
          </div>
        ))}
    </section>
  );
}
