"use client";
import { useEffect, useState } from "react";
import { Language } from "./i18n";
export function CanvasClock({
  options,
  language,
}: {
  options: Record<string, any>;
  language: Language;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  let zone = options.timezone || "Europe/Berlin";
  const format = options.format || "both";
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
  } catch {
    zone = "UTC";
  }
  return (
    <div
      className="canvas-clock"
      style={{ fontSize: options.size || 32 }}
      aria-label={language === "de" ? "Uhr" : "Clock"}
    >
      {format !== "date" && (
        <time dateTime={now?.toISOString()}>
          {now
            ? now.toLocaleTimeString(language, {
                timeZone: zone,
                hour: "2-digit",
                minute: "2-digit",
                ...(options.seconds ? { second: "2-digit" } : {}),
              })
            : "—:—"}
        </time>
      )}
      {format !== "digital" && (
        <small>
          {now
            ? now.toLocaleDateString(language, {
                timeZone: zone,
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "—"}
        </small>
      )}
      <span className="canvas-timezone">{zone}</span>
    </div>
  );
}
export function CanvasText({
  options,
  language,
}: {
  options: Record<string, any>;
  language: Language;
}) {
  const text =
    options.text === "Welcome to MainFrame." && language === "de"
      ? "Willkommen im MainFrame."
      : options.text;
  const Tag = options.text === "Welcome to MainFrame." ? "h1" : "div";
  return (
    <Tag
      className="canvas-text"
      style={{
        margin: 0,
        fontSize: options.size || 28,
        textAlign: options.align || "left",
        fontWeight: options.bold ? 700 : 400,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      {text}
    </Tag>
  );
}
