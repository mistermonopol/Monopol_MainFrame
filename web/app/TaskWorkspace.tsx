"use client";
import { ReactNode } from "react";
import { LayoutName } from "./appearance";
import { Language, translator } from "./i18n";
type Task = { id: string; completed?: boolean };
export default function TaskWorkspace<T extends Task>({
  layout,
  language,
  tasks,
  row,
}: {
  layout: LayoutName;
  language: Language;
  tasks: T[];
  row: (task: T) => ReactNode;
}) {
  const t = translator(language),
    open = tasks.filter((task) => !task.completed),
    done = tasks.filter((task) => task.completed);
  const group = (title: string, items: T[]) => (
    <section className="task-lane">
      <div className="task-lane-heading">
        <h2>{t(title)}</h2>
        <span>{items.length}</span>
      </div>
      {items.length ? (
        items.map(row)
      ) : (
        <p className="desk-empty">{t("Noch keine Einträge.")}</p>
      )}
    </section>
  );
  return (
    <div className={"task-workspace task-workspace-" + layout}>
      {layout === "studio" ? (
        <div className="task-board">
          {group("Offen", open)}
          {group("Erledigt", done)}
        </div>
      ) : layout === "focus" ? (
        <div className="task-daybook">
          <span className="eyebrow">01 / {t("Dein nächster Schritt")}</span>
          {group("Offen", open)}
          {group("Erledigt", done)}
        </div>
      ) : (
        <>
          <div className="task-register-heading">
            <span>
              {layout === "control"
                ? "REGISTER / TASKS"
                : "01 / " + t("Meine Aufgaben")}
            </span>
            <strong>
              {open.length} {t("Offen")} / {done.length} {t("Erledigt")}
            </strong>
          </div>
          {tasks.length ? (
            tasks.map(row)
          ) : (
            <p className="desk-empty">{t("Noch keine Einträge.")}</p>
          )}
        </>
      )}
    </div>
  );
}
