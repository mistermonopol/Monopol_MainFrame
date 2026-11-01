export type LayoutName = "index" | "studio" | "control" | "focus";
export const layouts = [
  {
    id: "index",
    name: "Index",
    number: "01",
    description: "Große Typografie, Kapitel und ein geteilter Überblick.",
  },
  {
    id: "studio",
    name: "Studio",
    number: "02",
    description: "Asymmetrische Arbeitsfläche für Projekte und Ideen.",
  },
  {
    id: "control",
    name: "Control",
    number: "03",
    description: "Kompakte Instrumente, Datenraster und Live-Inspektor.",
  },
  {
    id: "focus",
    name: "Focus",
    number: "04",
    description: "Ein Tagesablauf, eine Spalte, dein nächster Schritt.",
  },
] as const;
export function validLayout(value: string | null): LayoutName {
  return layouts.some((layout) => layout.id === value)
    ? (value as LayoutName)
    : "index";
}
