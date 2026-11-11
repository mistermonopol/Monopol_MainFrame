# Home-Editor · 0.10

Der Hauptscreen ist eine responsive Arbeitsfläche. Das **Zahnrad oben rechts** aktiviert den Bearbeitungsmodus. Auf Web bleibt der tatsächliche Inhalt sichtbar; ein Klick auf ein Element bzw. dessen Einstellungs-Symbol öffnet den Eigenschaftsbereich. Änderungen wirken direkt in der Vorschau, werden aber erst mit **Save dashboard / Speichern** übernommen. **Cancel / Abbrechen** verwirft den Entwurf.

## Elemente und Boxen

- **Text:** eigener mehrzeiliger Inhalt, Schriftgröße, Ausrichtung und Fettschrift. Auch der Begrüßungstext ist ein normales, entfernbares Text-Element.
- **Clock / Uhr:** laufende Uhrzeit, Datum oder beides, eigene IANA-Zeitzone und optionale Sekunden. Mehrere Uhren können verschiedene Zeitzonen anzeigen.
- **Box:** Container für Text, Uhren, Verknüpfungen und App-Module. Beim Hinzufügen unter **Add to / Hinzufügen zu** eine Box wählen oder ein vorhandenes Element in eine Box ziehen. Im Eigenschaftsbereich kann **Inside box / In Box** die Zuordnung ändern. Boxen werden in dieser Version nicht ineinander verschachtelt. Entfernen einer Box befördert ihre Inhalte auf Home; Abbrechen stellt den Entwurf zurück.
- **Shortcut / Verknüpfung:** frei beschrifteter Button für eine App-Seite oder eine neue Aufgabe. **Space / Abstand** schafft bewusst freie Fläche.
- Alle bisherigen App-Module bleiben verfügbar: Health, Messwert, Diagramm, Aufgaben, Lampen, Musikprojekte, Obsidian und KI-Chat.

Titelzeile, Rahmen, Hintergrund und Innenabstand lassen sich pro Element ändern. Text und Uhren können somit ohne Kartenrahmen direkt auf der Arbeitsfläche stehen. Theme-Farben und eckige Formen bleiben erhalten.

## Anordnung und Responsivität

Der Ziehgriff verschiebt Elemente im Raster, auch zwischen Home und Boxen. Auf Web verändert der **Eckgriff** Breite und Höhe direkt. Zusätzlich gibt es präzise Größenfelder sowie Pfeile zum Verschieben. Desktop bietet 1–12 Rasterspalten, Handy 1–2; sechs Höhenstufen stehen zur Verfügung. Elemente fließen ohne Überlappung in neue Zeilen. Die Schriftgröße ist unabhängig von der Boxgröße. Alle Layout-Themes respektieren die vom Nutzer gewählte Rasteraufteilung.

Web und Android synchronisieren Auswahl, Inhalte, Container-Zuordnung und Darstellung. Desktop und Handy behalten unterschiedliche Reihenfolgen und Größen. Android bietet Zahnrad, Ziehgriffe, Pfeile und Größen-/Darstellungsfelder am ausgewählten Element. Die mobile Website unterstützt Touch-Verschieben über den Ziehgriff. Systemnavigation und Verbindungsstatus gehören weiter zum App-Rahmen.

## Update und Kompatibilität

`main` in Coolify redeployen und Android **0.10.0** installieren. Keine neuen Umgebungsvariablen oder Datenbank-Volumes erforderlich. Bestehende Konfigurationen werden beim Lesen auf die Canvas-Version erweitert: vorhandene Module und ihre Einstellungen bleiben erhalten, die vorher fest dargestellte Begrüßung, Uhr/Datum und Aufgabenverknüpfung werden bearbeitbare Elemente. Erst Speichern übernimmt die erweiterte Konfiguration. Vor dem Update die vorhandenen Datenbanken sichern.

Die Konfigurationsschnittstelle ergänzt `editor_version: 2`, `parent_id` und `appearance` (`header`, `border`, `background`, `padding`). Es sind bis zu 80 Elemente erlaubt. Änderungen nutzen weiterhin Versionsprüfung und liefern bei Konflikten 409; der Entwurf bleibt bis zum expliziten Neuladen erhalten. Ungültige Zeitzonen, unbekannte Optionen und ungültige Container-Verweise werden abgelehnt. Inhalte werden als Text gerendert, nicht als ausführbares HTML oder Skript.

Health-Synchronisation und lokale Home-Assistant-Bridge bleiben unverändert. Deren Einrichtung steht in [widgets-health.md](widgets-health.md) und [home-assistant.md](home-assistant.md).
