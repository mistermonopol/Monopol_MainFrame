# Widgets und Health – Version 0.9

Nach dem Coolify-Redeploy Android **0.9.0** installieren. Datenbank-Volumes und bestehende Konfiguration behalten; beim Start werden die zusätzlichen Health-Tabellen angelegt. Neue Server-Umgebungsvariablen sind nicht erforderlich. Vor dem Update beide Datenbanken sichern.

## Hauptscreen bearbeiten

**Edit widgets / Widgets bearbeiten** öffnet den Baukasten. Widgets hinzufügen, mehrfach verwenden, umbenennen, entfernen und mit Pfeilen oder Ziehgriff verschieben. Breite und Höhe lassen sich auswählen; im Web verändert auch der seitliche Größen-Griff die Breite. Titel und Optionen werden für jedes Widget gespeichert. Änderungen erst mit **Save dashboard / Speichern** übernehmen. **Cancel / Abbrechen** verwirft den Entwurf. **Restore defaults / Standard wiederherstellen** erzeugt eine neue Standardanordnung im Entwurf und wird ebenfalls erst durch Speichern wirksam.

Desktop hat zwölf Rasterspalten, Handy zwei. Beide Anordnungen werden unabhängig gespeichert, während Widget-Auswahl und fachliche Einstellungen gemeinsam sind. Mobile Website und Android-Handy teilen sich dieselbe Anordnung. Der Focus-Stil zeigt Widgets grundsätzlich untereinander. Alle Farbthemen und vier App-Layouts bleiben nutzbar; der Baukasten ersetzt die vorher fest vorgegebene Übersicht.

Verfügbar sind Health-Übersicht, einzelner Health-Wert, Diagramm, Aufgaben, Lampen, Musikprojekte, Obsidian und KI-Chat. Aufgaben besitzen einen Filter, Lampen eine optionale Liste von `light.*`-IDs, Musik eine optionale Projekt-ID und Obsidian einen optionalen vault-relativen Notizpfad. Leere Auswahl bedeutet alle verfügbaren Elemente bzw. die Notizliste. Zugangsdaten bleiben in den bisherigen Integrations-Einstellungen.

Bei parallelen Änderungen auf zwei Geräten verhindert eine Versionsprüfung stilles Überschreiben. Bei einem Konflikt bleibt der Entwurf sichtbar; **Reload dashboard / Neu laden** verwirft ihn ausdrücklich und lädt die gespeicherte Version. Offline kann die letzte Anordnung gelesen werden, Änderungen benötigen eine Verbindung. Rohmessreihen und Notizinhalte werden nicht zusätzlich im Browser-Widget-Cache gespeichert. Cache-Löschen und Abmelden entfernen die lokal gespeicherte Konfiguration.

## Health Connect

Auf Android die Health-Seite öffnen, **Leseberechtigungen verwalten** wählen und die gewünschten neuen Datentypen freigeben. Die bestehende Uhr-/Fitness-App muss diese Werte tatsächlich in Health Connect schreiben. Danach Synchronisation aktivieren und aktualisieren. Ein verweigerter Datentyp blockiert die anderen nicht. Die erste Übertragung kann wegen des 30-Tage-Imports länger dauern; die stündliche Hintergrundarbeit benötigt die separate Hintergrundberechtigung und ist nicht minutengenau.

Unterstützt: Schritte, Schlafdauer, Ruhepuls, Gewicht mit Messzeitpunkt, Puls samt Tagesmittel/Minimum/Maximum und letztem Messwert, HRV (RMSSD), Sauerstoffsättigung, Atemfrequenz, Strecke, aktive/gesamte Kalorien und Trainingsdauer. Trainingsarten werden in den Zeitreihen als Zusatzinformationen übertragen. Die Datenquellen-Ansicht zeigt Freigaben, letzte Messung und letzten erfolgreichen Abgleich je Messwert. Fehlende Daten sind keine Nullmessung.

Puls und andere Vitalwerte werden je Quelle getrennt gespeichert. Bei mehreren Quellen verwendet die automatische Auswahl eine stabile alphabetische Quelle; im Tagesdiagramm kann die Quelle gewechselt werden. Tageszusammenfassungen verwenden die erste vorhandene Quelle je Tag. Kumulative Werte verwenden die Health-Connect-Aggregation und damit dessen Prioritäten. Schlaf bleibt dem Berliner Tag des Schlafendes zugeordnet. Alle Zeitpunkte werden in UTC übertragen, Tagesgrenzen verwenden Europe/Berlin einschließlich Zeitumstellung.

Jeder Datentyp hat einen separaten Changes-Cursor. Neue oder gelöschte Datensätze lösen einen erneuten Abgleich des zugänglichen Zeitfensters aus; ohne Änderungen wird der laufende Tag aktualisiert. Cursor werden erst nach erfolgreicher Übertragung gespeichert. Bei Fehlern oder abgelaufenen Cursorn erfolgt erneut ein Abgleich. Der erste Import beginnt 29 Tage vor der ersten lokalen Synchronisation; mit fortlaufender Nutzung wächst das Fenster bis maximal 90 Tage. Es wird keine zusätzliche Berechtigung für weiter zurückliegende Daten angefragt.

Zeitreihen werden maximal 90 Tage gespeichert und regelmäßig bereinigt, Tageszusammenfassungen dauerhaft. Die normale Tagesübersicht liefert höchstens die letzten 90 erfassten Tage. Diagramme zeigen Tag/Woche/Monat; das Schrittediagramm behält zusätzlich seine bisherigen Tages-, Wochen- und Monatsgruppen. Große Tagesmessreihen werden für die Chart-Antwort auf Minuten-Minima/-Maxima reduziert; die Statistik wird aus allen gespeicherten Werten berechnet. Es handelt sich um synchronisierte Messungen, keine Live-Sensoranzeige.

**Gesundheitsdaten löschen** entfernt Tageswerte, Messreihen und Statusinformationen. Ein Generationswechsel verhindert, dass ein bereits laufender neuer Import alte Daten nachträglich wieder einspielt. Bei später erneut aktivierter Synchronisation werden die freigegebenen Daten wieder eingelesen. Die native Löschfunktion stoppt den lokalen Synchronisationsauftrag; beim Löschen über Web gegebenenfalls auch andere synchronisierende Geräte stoppen. Ältere Android-Versionen können ihre bisherigen Tageswerte weiterhin übertragen, ohne neue Felder zu überschreiben.

## Schnittstellen und Betrieb

- `GET /api/v1/dashboard/catalog` liefert den gemeinsamen Widget-Katalog für Web und Android.
- `GET/PUT /api/v1/dashboard/config` liest/speichert `{version, widgets}`. Jedes Widget hat eine stabile ID, Typ, Titel, Optionen sowie Desktop-/Handy-Platzierung mit Reihenfolge, Breite und Höhe. Veraltete Versionen liefern 409.
- `GET /api/v1/health/metrics` liefert Messwert-Metadaten, Quellen, Berechtigungsstatus und Synchronisationsgeneration.
- `PUT /api/v1/health/sync` gleicht Tages-/Messwert-/Quellenfenster vollständig ab, einschließlich leerer Fenster für Löschungen. Separate Tageszusammenfassungen und Status können im selben Protokoll übertragen werden. Bis 100.000 Samples je Paket; der Android-Client sendet Quellenfenster einzeln.
- `GET /api/v1/health/series?metric=heart_rate&start=YYYY-MM-DD&end=YYYY-MM-DD&source=...` liefert begrenzte Zeitreihen und Statistiken. Der Agent verwendet dieselbe begrenzte Leseschnittstelle über `read_health_series`.

Alle Schnittstellen verwenden die bestehende Anmeldung und CSRF-Prüfung. Widget-Konfiguration liegt in der Kerndatenbank, Messreihen und Health-Metadaten in der getrennten Health-Datenbank. Beide Datenbanken sichern. Die Home-Assistant-Bridge benötigt für dieses Update keine Änderung ihrer lokalen Tokens.

Nach dem Deployment einmal auf Web und Android dieselbe Widget-Auswahl prüfen, beide Anordnungen getrennt ändern und den nächsten Health-Abgleich kontrollieren. Reale Uhrenmesswerte, Herstellerfreigaben und Android-Hintergrundzustellung müssen auf dem eigenen Pixel geprüft werden; automatisierte Tests verwenden simulierte Datenquellen.

Grundlagen: [Health-Connect-Datentypen](https://developer.android.com/health-and-fitness/health-connect/data-types), [Lesen](https://developer.android.com/health-and-fitness/health-connect/read-data), [Synchronisieren](https://developer.android.com/health-and-fitness/health-connect/sync-data).
