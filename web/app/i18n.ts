import messages from "./messages.json";
export type Language = "en" | "de";
export type Theme = "dark" | "light" | "amber" | "cyan";
export const slogan = "Monopol_MainFrame your App for Everything";
export const localeFor = (language: Language) =>
  language === "de" ? "de-DE" : "en-GB";
const german = Object.fromEntries(
  Object.entries(messages).map(([de, en]) => [en, de]),
);
export function translator(language: Language) {
  return (source: string) => {
    const key = source.trim().replace(/\s+/g, " ");
    return language === "de"
      ? (german[key] ?? key)
      : ((messages as Record<string, string>)[key] ?? key);
  };
}

export function actionLabel(
  action: { type: string; kind?: string },
  language: Language,
) {
  const t = translator(language);
  const updated = action.type.startsWith("update");
  if (action.type === "control_lights") return t("Lichtbefehl angenommen");
  if (action.type.endsWith("note"))
    return t(updated ? "Notiz aktualisiert" : "Notiz erstellt");
  if (action.kind === "tasks")
    return t(updated ? "Aufgabe aktualisiert" : "Aufgabe erstellt");
  if (action.kind === "music")
    return t(updated ? "Musikprojekt aktualisiert" : "Musikprojekt erstellt");
  return t(updated ? "Eintrag aktualisiert" : "Eintrag erstellt");
}
