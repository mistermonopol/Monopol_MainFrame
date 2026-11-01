"use client";
import { useEffect, useState } from "react";
import { Language, translator } from "./i18n";
export default function NotificationSettings({
  language,
  enabled,
  request,
}: {
  language: Language;
  enabled: boolean;
  request: (path: string, init?: RequestInit) => Promise<any>;
}) {
  const t = translator(language),
    [active, setActive] = useState(false),
    [supported, setSupported] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setSupported(
      "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window &&
        isSecureContext,
    );
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .getRegistration("/")
        .then((reg) => reg?.pushManager?.getSubscription())
        .then((sub) => setActive(!!sub))
        .catch(() => {});
  }, []);
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      if (active) {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await request("/notifications/unsubscribe", {
            method: "POST",
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setActive(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted")
          throw Error(
            t(
              "Benachrichtigungen wurden nicht erlaubt. Browser-Einstellungen prüfen.",
            ),
          );
        const config = await request("/notifications/config");
        const key = Uint8Array.from(
          atob(
            config.public_key.replace(/-/g, "+").replace(/_/g, "/") +
              "=".repeat((4 - (config.public_key.length % 4)) % 4),
          ),
          (c) => c.charCodeAt(0),
        );
        await navigator.serviceWorker.register("/sw.js");
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub)
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
          });
        await request("/notifications/subscriptions", {
          method: "POST",
          body: JSON.stringify({ ...sub.toJSON(), language }),
        });
        setActive(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="notification-settings">
      <h3>{t("Aufgaben-Erinnerungen")}</h3>
      <p>
        {t(
          "Push-Mitteilungen für fällige Aufgaben auf diesem Gerät. Standard: 09:00 Uhr Europe/Berlin; eine eigene Erinnerungszeit hat Vorrang.",
        )}
      </p>
      <p>
        {supported
          ? t(
              active
                ? "Benachrichtigungen aktiviert"
                : "Benachrichtigungen deaktiviert",
            )
          : t("Dieser Browser unterstützt Web-Push hier nicht.")}
      </p>
      <button
        disabled={!enabled || !supported || busy}
        onClick={() => void toggle()}
      >
        {t(
          active
            ? "Benachrichtigungen deaktivieren"
            : "Benachrichtigungen aktivieren",
        )}
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
