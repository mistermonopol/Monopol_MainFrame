"use client";
import { useState } from "react";
import { ArrowUpRight, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { Language, translator } from "./i18n";
export default function SpotifyFrame({ language }: { language: Language }) {
  const t = translator(language);
  const [expanded, setExpanded] = useState(false);
  const [revision, setRevision] = useState(0);
  return (
    <section
      className={"spotify-embed" + (expanded ? " embed-expanded" : "")}
      aria-label="Spotify Dashboard"
    >
      <div className="embed-toolbar">
        <div>
          <span className="embed-dot" />
          <strong>Spotify</strong>
          <small>vault.monopol-ai.de</small>
        </div>
        <div>
          <button
            aria-label={t("Dashboard neu laden")}
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw size={16} />
          </button>
          <button
            aria-label={t(
              expanded ? "Ansicht verkleinern" : "Ansicht vergrößern",
            )}
            aria-pressed={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <a
            href="https://vault.monopol-ai.de/spotify"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Extern öffnen")}
            <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
      <iframe
        key={revision}
        title="Spotify Dashboard"
        src="https://vault.monopol-ai.de/spotify"
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <p>
        {t(
          "Falls Anmeldung oder Einbettung blockiert wird, öffne das Dashboard direkt.",
        )}
      </p>
    </section>
  );
}
