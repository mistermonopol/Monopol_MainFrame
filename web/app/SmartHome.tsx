"use client";
import { useEffect, useRef, useState } from "react";
import { Lightbulb, Power, Radio, Copy } from "lucide-react";
import { Language, translator } from "./i18n";
type Request = (path: string, init?: RequestInit) => Promise<any>;
type Light = {
  entity_id: string;
  name: string;
  state: string;
  brightness_pct: number | null;
  rgb_color: number[] | null;
  color_temp_kelvin: number | null;
  min_kelvin: number | null;
  max_kelvin: number | null;
  supported_color_modes: string[];
};
type Home = {
  status: string;
  last_seen: string | null;
  last_state: string | null;
  error: string | null;
  lights: Light[];
};
const statusLabels: Record<string, string> = {
  online: "Verbunden",
  offline: "Bridge offline",
  not_configured: "Noch nicht eingerichtet",
  ha_unavailable: "Home Assistant nicht erreichbar",
};
const keyCommit = (key: string) =>
  [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
    "PageUp",
    "PageDown",
  ].includes(key);
function LightCard({
  light,
  online,
  busy,
  language,
  send,
}: {
  light: Light;
  online: boolean;
  busy: boolean;
  language: Language;
  send: (ids: string[], settings: Record<string, unknown>) => void;
}) {
  const t = translator(language),
    modes = light.supported_color_modes;
  const [brightness, setBrightness] = useState(light.brightness_pct ?? 100),
    [temperature, setTemperature] = useState(
      light.color_temp_kelvin ?? light.min_kelvin ?? 2700,
    ),
    [color, setColor] = useState("#ffffff");
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) setBrightness(light.brightness_pct ?? 100);
  }, [light.brightness_pct]);
  useEffect(() => {
    if (!dragging.current)
      setTemperature(light.color_temp_kelvin ?? light.min_kelvin ?? 2700);
  }, [light.color_temp_kelvin, light.min_kelvin]);
  useEffect(() => {
    if (light.rgb_color)
      setColor(
        "#" +
          light.rgb_color.map((v) => v.toString(16).padStart(2, "0")).join(""),
      );
  }, [light.rgb_color?.join(",")]);
  const enabled = online && !busy && ["on", "off"].includes(light.state),
    dim = modes.some((m) => !["onoff", "unknown"].includes(m)),
    rgb = modes.some((m) => ["rgb", "rgbw", "rgbww", "hs", "xy"].includes(m));
  return (
    <section
      className={"light-card card" + (light.state === "on" ? " light-on" : "")}
    >
      <div className="light-heading">
        <Lightbulb size={24} />
        <div>
          <h3>{light.name}</h3>
          <small>{light.entity_id}</small>
        </div>
        <span className="tag">
          {t(
            light.state === "on"
              ? "An"
              : light.state === "off"
                ? "Aus"
                : "Nicht verfügbar",
          )}
        </span>
      </div>
      <button
        className="light-power"
        disabled={!enabled}
        aria-label={
          t(light.state === "on" ? "Ausschalten" : "Einschalten") +
          ": " +
          light.name
        }
        onClick={() =>
          send([light.entity_id], {
            power: light.state === "on" ? "off" : "on",
          })
        }
      >
        <Power size={18} />
        {t(light.state === "on" ? "Ausschalten" : "Einschalten")}
      </button>
      {dim && (
        <label className="light-slider">
          {t("Helligkeit")}
          <span>{brightness}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={brightness}
            disabled={!enabled}
            aria-label={t("Helligkeit") + ": " + light.name}
            onPointerDown={() => {
              dragging.current = true;
            }}
            onChange={(e) => setBrightness(Number(e.target.value))}
            onPointerUp={(e) => {
              dragging.current = false;
              send([light.entity_id], {
                brightness_pct: Number(e.currentTarget.value),
              });
            }}
            onPointerCancel={() => {
              dragging.current = false;
              setBrightness(light.brightness_pct ?? 100);
            }}
            onKeyUp={(e) => {
              if (keyCommit(e.key))
                send([light.entity_id], {
                  brightness_pct: Number(e.currentTarget.value),
                });
            }}
          />
        </label>
      )}
      {rgb && (
        <div className="light-color">
          <label>
            {t("Lichtfarbe")}
            <input
              type="color"
              aria-label={t("Lichtfarbe") + ": " + light.name}
              value={color}
              disabled={!enabled}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          <button
            disabled={!enabled}
            onClick={() =>
              send([light.entity_id], {
                rgb_color: [1, 3, 5].map((i) =>
                  parseInt(color.slice(i, i + 2), 16),
                ),
              })
            }
          >
            {t("Farbe anwenden")}
          </button>
        </div>
      )}
      {modes.includes("color_temp") && light.min_kelvin && light.max_kelvin && (
        <label className="light-slider">
          {t("Farbtemperatur")}
          <span>{temperature} K</span>
          <input
            type="range"
            min={light.min_kelvin}
            max={light.max_kelvin}
            step={1}
            value={temperature}
            disabled={!enabled}
            aria-label={t("Farbtemperatur") + ": " + light.name}
            onPointerDown={() => {
              dragging.current = true;
            }}
            onChange={(e) => setTemperature(Number(e.target.value))}
            onPointerUp={(e) => {
              dragging.current = false;
              send([light.entity_id], {
                color_temp_kelvin: Number(e.currentTarget.value),
              });
            }}
            onPointerCancel={() => {
              dragging.current = false;
            }}
            onKeyUp={(e) => {
              if (keyCommit(e.key))
                send([light.entity_id], {
                  color_temp_kelvin: Number(e.currentTarget.value),
                });
            }}
          />
        </label>
      )}
    </section>
  );
}
export default function SmartHome({
  entityIds = [],
  language,
  enabled,
  request,
  settings,
  onChanged,
}: {
  language: Language;
  enabled: boolean;
  request: Request;
  entityIds?: string[];
  settings: () => void;
  onChanged: () => void;
}) {
  const t = translator(language),
    client = useRef(request);
  client.current = request;
  const [data, setData] = useState<Home | null>(null),
    [pollError, setPollError] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function update() {
      try {
        const result = await client.current("/smart-home/lights");
        if (active && Array.isArray(result.lights)) {
          setData(result);
          setPollError("");
        }
      } catch (e) {
        if (active) {
          setPollError((e as Error).message);
          setData((old) => (old ? { ...old, status: "offline" } : null));
        }
      } finally {
        if (active) timer = setTimeout(update, 5000);
      }
    }
    if (enabled) void update();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [enabled]);
  async function send(ids: string[], values: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage(t("Befehl wird gesendet…"));
    try {
      let command = await request("/smart-home/commands", {
        method: "POST",
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          entity_ids: ids,
          ...values,
        }),
      });
      for (
        let attempt = 0;
        ["pending", "dispatched"].includes(command.status) && attempt < 35;
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        command = await request(
          "/smart-home/commands/" + encodeURIComponent(command.id),
        );
      }
      if (command.status === "accepted")
        setMessage(
          t(
            "Home Assistant hat den Befehl angenommen. Angezeigt wird der zuletzt gemeldete Zustand.",
          ),
        );
      else
        throw Error(
          t(
            command.status === "unknown"
              ? "Ergebnis unklar. Aktuellen Lampenzustand prüfen."
              : "Befehl fehlgeschlagen oder abgelaufen.",
          ),
        );
      const current = await request("/smart-home/lights");
      setData(current);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
      setMessage("");
    } finally {
      setBusy(false);
    }
  }
  const online = data?.status === "online";
  return (
    <section className="smart-home">
      <div className="home-masthead">
        <span className="eyebrow">HOME ASSISTANT / LOCAL BRIDGE</span>
        <h2>{t("Licht in deiner Hand.")}</h2>
        <p>{t("Direkt verbunden mit deinem Zuhause.")}</p>
        <div className="home-connection">
          <Radio size={16} />
          <strong>
            {t(
              statusLabels[data?.status || "not_configured"] ||
                "Bridge offline",
            )}
          </strong>
          <span>
            {data?.lights.length || 0} {t("Lampen")}
          </span>
        </div>
      </div>
      {pollError && <p role="alert">{t(pollError)}</p>}
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {message && (
        <p className="home-message" role="status">
          {message}
        </p>
      )}
      {!online && (
        <div className="card panel">
          <p>
            {t(
              "Die lokale Docker-Bridge muss laufen. Offline werden keine Schaltbefehle vorgemerkt.",
            )}
          </p>
          {data?.error === "auth" && (
            <p>{t("Home Assistant lehnt das lokale Zugriffstoken ab.")}</p>
          )}
          <button onClick={settings}>{t("Bridge einrichten")}</button>
        </div>
      )}
      <div className="home-toolbar">
        <input
          aria-label={t("Lampen suchen")}
          placeholder={t("Lampen suchen")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="lights-grid">
        {(data?.lights || [])
          .filter(
            (light) => !entityIds.length || entityIds.includes(light.entity_id),
          )
          .filter((light) =>
            (light.name + " " + light.entity_id)
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((light) => (
            <LightCard
              key={light.entity_id}
              light={light}
              online={online}
              busy={busy}
              language={language}
              send={(ids, values) => void send(ids, values)}
            />
          ))}
      </div>
      {online && !data?.lights.length && (
        <p>{t("Keine light-Entitäten in Home Assistant gefunden.")}</p>
      )}
    </section>
  );
}

export function BridgeSettings({
  language,
  enabled,
  request,
}: {
  language: Language;
  enabled: boolean;
  request: Request;
}) {
  const t = translator(language),
    [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <section className="bridge-settings">
      <h3>{t("Home-Assistant-Bridge")}</h3>
      <p>
        {t(
          "Starte die Docker-Bridge in deinem Heimnetz. Home Assistant bleibt lokal; die Bridge verbindet sich ausgehend mit dieser App.",
        )}
      </p>
      <p>
        {t(
          "Ein neues Bridge-Token ersetzt das bisherige und trennt eine vorhandene Bridge. Das Home-Assistant-Token bleibt nur im Heimnetz.",
        )}
      </p>
      <button
        disabled={!enabled || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          setCopied(false);
          try {
            const result = await request("/smart-home/bridge-token", {
              method: "POST",
            });
            setToken(result.token);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("Bridge-Token erzeugen / ersetzen")}
      </button>
      {token && (
        <div className="bridge-secret">
          <label>
            {t("Einmaliges Bridge-Token")}
            <input type="password" autoComplete="off" readOnly value={token} />
          </label>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(token);
                setCopied(true);
              } catch {
                setError(
                  t("Kopieren nicht möglich. Token im Feld manuell kopieren."),
                );
              }
            }}
          >
            <Copy size={16} />
            {t(copied ? "Kopiert" : "Token kopieren")}
          </button>
          <button onClick={() => setToken("")}>{t("Ausblenden")}</button>
          <small>
            {t(
              "Jetzt sicher in der lokalen Secret-Datei speichern. Das Token wird nicht im Browser gespeichert.",
            )}
          </small>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <p>
        {t(
          "Einrichtung: compose.bridge.yaml und docs/home-assistant.md im Repository.",
        )}
      </p>
    </section>
  );
}
