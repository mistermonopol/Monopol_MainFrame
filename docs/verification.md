# Prüfstand · 11. November 2026

## Version 0.10: Vollständiger Home-Editor

68 Backend-Tests erfolgreich, einschließlich Migration bestehender Widget-Konfigurationen auf bearbeitbare Begrüßung/Uhr/Verknüpfung, Container-Zuordnung und Validierung von Zeitzonen und Darstellung. 42 Browserprüfungen auf Desktop und Handy erfolgreich: neue Tests bearbeiten Text und Uhren in Boxen, entfernen den bisherigen Begrüßungstext, prüfen Größen, Persistenz und Responsive-Verhalten sowie tatsächliches Drag-and-drop in Boxen und Größenänderung mit dem Eckgriff. Vorhandene App-Abläufe bleiben geprüft. Der Eigenschaftsbereich lässt die Arbeitsfläche sichtbar und verdeckt die Speichern-Schaltfläche nicht.

Android 0.10.0 als Debug-APK gebaut; neun Unit-Tests erfolgreich. Desktop-/Handyansicht und der Bearbeitungsmodus wurden zusätzlich mit simulierten Inhalten visuell geprüft; keine horizontalen Überläufe oder Browserfehler. Web-Produktionsbuild erfolgreich. Reales Touch-Verhalten und native Bedienung auf dem Pixel benötigen weiterhin den Gerätetest. Bedienung und Aktualisierung: [home-editor.md](home-editor.md).

## Version 0.9: Widget-Baukasten und Health-Zeitreihen

67 Backend-Tests erfolgreich: einschließlich versionierter Widget-Konfiguration, Mehrfachinstanzen, unabhängiger Anordnungen, Speicherkonflikten, erlaubter Optionen, quellengetrennter Messreihen, idempotenter Fensterkorrekturen und Löschungen, Berliner Zeitumstellung, 90-Tage-Aufbewahrung sowie Kompatibilität älterer Tagesimporte. Das Löschen der Health-Daten invalidiert laufende neue Synchronisationspakete über eine Generation.

38 Browserprüfungen auf Desktop und Handy erfolgreich, einschließlich Widget-Hinzufügen, Umbenennen, Größenwahl, Verschieben, Speichern, Wiederherstellen nach Neuladen, Abbrechen, Speicherkonflikt und Pulsdiagramm mit Berechtigungsstatus. Alle vorhandenen Navigations-, Aufgaben-, Integrations-, Theme- und Layout-Abläufe bleiben geprüft. Web-Produktionsbuild erfolgreich. Desktop-/Handyansicht zusätzlich mit simulierten vollständigen Widget-Inhalten visuell geprüft: keine horizontalen Überläufe oder Browserfehler.

Android 0.9.0 als Debug-APK gebaut; neun Unit-Tests einschließlich Rasteraufteilung erfolgreich. Die native Health-Connect-Anbindung ist gegen SDK 1.1.0 kompiliert. Reale Health-Connect-Datensätze, Uhrenhersteller, Freigaben und Hintergrundzustellung wurden ohne angeschlossenes Pixel nicht praktisch geprüft. Lokale Backend-Tests verwenden SQLite; PostgreSQL und vollständiger Docker-Start bleiben Teil der vorhandenen CI-Prüfung. Bedienung und Update: [widgets-health.md](widgets-health.md).

Lokal erfolgreich ausgeführt:

- **19 API-Tests**, mit getrennten SQLite-Datenbanken: Passwort-Anmeldung, sichere Cookies, Logout, Begrenzung falscher Anmeldeversuche, frühere Sitzungen, Origin-Prüfung, CRUD, Versionskonflikte, Gesundheitsimporte und Fehlermeldungen auf Englisch bzw. Deutsch.
- **22 Playwright-Prüfungen**, Desktop und Pixel-Viewport: bisherige Abläufe, Navigation, Sprach- und Themewechsel mit gespeicherter Auswahl, eckige Bedienelemente, alle Diagrammansichten sowie Aggregationsfälle für fehlende Werte, gemessene Nullen, doppelte Tage und Wochen-/Jahresgrenzen. API-Antworten werden gezielt simuliert; sechs Prüfläufe testen die reine Aggregation.
- **Next.js-Produktionsbuild** mit TypeScript-Prüfung.
- **Android Debug-APK** erfolgreich kompiliert und paketiert; **6 Kotlin-Unit-Tests** für Schlafintervalle, Sommerzeit, Schritt-Aggregation und Übersetzungen erfolgreich.
- **Docker-Compose-Konfiguration** gegen `.env.example` validiert.
- **Coolify-Konfiguration**: explizite Umgebungsvariablen, eingebautes PostgreSQL-Init, Migration vor API-Start und HTTPS-Zugriff über Coolifys Proxy auf den internen Web-Port 3000. CI prüft Web → API → PostgreSQL ohne veröffentlichte Host-Ports; Ausführungsstatus siehe GitHub Actions.
- **npm audit** und **pip-audit** ohne bekannte Sicherheitslücken im geprüften Paketbestand.
- Dark und Light Mode mit Consolas/Monospace und rechteckigen Ecken: englische Desktop-Ansichten, Settings und deutsche Mobilansicht einschließlich Diagramm anhand von Web-Screenshots visuell geprüft. Keine externen Webfonts erforderlich. Die native Darstellung beider Themes muss zusätzlich auf dem Pixel geprüft werden.

Die Test-APK liegt nach dem Build unter `android/app/build/outputs/apk/debug/app-debug.apk`. Sie ist mit einem Entwicklungsschlüssel signiert und dient Gerätetests; für dauerhaften privaten Betrieb einen eigenen gesicherten Release-Keystore verwenden.

Noch nicht lokal nachgewiesen:

- PostgreSQL-Betrieb lokal: Docker Engine war auf diesem Rechner nicht gestartet. PostgreSQL 17 einschließlich Rollenprüfung und der vollständige Docker-Stack wurden bereits in GitHub Actions erfolgreich geprüft; aktuelle Ergebnisse siehe Workflow des jeweiligen Commits.
- Anmeldung auf dem persönlichen Server: benötigt `ADMIN_PASSWORD` und die korrekte HTTPS-Basisadresse.
- Health Connect auf dem echten Pixel, Berechtigungswiderruf, Hintergrundarbeit und Verbindungsunterbrechungen: benötigen Gerät und persönlichen Server.
- Verschlüsseltes Backup und erfolgreiche Wiederherstellung: Skript, Systemd-Timer und Anleitung sind vorhanden; der Wiederherstellungstest muss vor Betriebsfreigabe auf einem separaten System erfolgen.

Eine Warnung des Python-Testclients weist auf die künftige Migration von `httpx` zu `httpx2` hin; sie beeinträchtigt die erfolgreichen API-Tests nicht.

## Version 0.5: Themes und neue Module

19 Backend-Tests einschließlich Musik-CRUD, Versionskonflikten, Vault-Pfadgrenzen, extern geänderten Markdown-Dateien, geschützten Integrationsrouten und einem zweistufigen Agentenaufruf mit echtem App-Kontext und simuliertem KI-Anbieter. 22 Playwright-Prüfungen einschließlich aller vier Theme-Auswahlen, gespeicherter Auswahl, Musikprojekt, Agentenchat und Vault-Bearbeitung auf Desktop und Mobilgerät erfolgreich. Android-APK und sechs bestehende Unit-Tests erfolgreich gebaut. Die vier Web-Themes und mobile Agentenansicht wurden mit klaren Vorschaudaten visuell geprüft. Compose-Konfigurationen validiert; Docker-Stack lokal weiterhin nicht gestartet.

Eine echte Anbieterantwort und der Zugriff auf den persönlichen Obsidian-Vault sind noch nicht nachgewiesen: API-Konfiguration und Server-Vault werden vom Besitzer eingerichtet. Der Agent liest Daten; Änderungen erfolgen über die direkten Moduloberflächen. Kein automatischer PC-Vault-Sync und keine Spotify-/DistroKid-Verbindung. Native Oberfläche zusätzlich am echten Pixel prüfen.

## Version 0.6: Layouts unabhängig von Farben und Spotify-Einbettung

24 Browserprüfungen auf Desktop und Pixel-Viewport: vier strukturelle Layouts mit allen vier Paletten, getrennt gespeicherte Präferenzen, erhaltene Aufgaben und Bearbeitungsdialoge, scharfe Ecken, Diagramm und iframe-Quelladresse. Die externe Seite wurde zusätzlich in einem isolierten echten Browser ohne persönliche Anmeldung geladen; keine Einbettungsfehler gemeldet. Vorhandene CRUD-, Offline-, Sprach- und Navigationsprüfungen bleiben enthalten. Vier Layouts mit identischer Farbe auf 1512, 412 und 320 Pixeln als Web-Screenshots geprüft; keine horizontalen Überläufe. Ein bei der visuellen Kontrolle entdecktes Überlappen der Diagrammbeschreibung in Control wurde korrigiert und durch eine Layoutprüfung abgesichert.

Android-Version 0.6.0: andere Dashboard-Kompositionen und Navigation je Layout, unabhängige Palette und eingebettete HTTPS-WebView im Musik-Tab. Debug-APK und bestehende Unit-Tests gebaut. Web-Produktionsbuild geprüft. Persönliche Spotify-/Vault-Anmeldung und native Bedienung müssen weiterhin auf dem echten Gerät geprüft werden. Kein automatischer Zugriff des KI-Agenten auf iframe-Inhalte.

## Version 0.7: Agenten-Schreibzugriff, Brain-Graph und Erinnerungen

47 Backend-Tests einschließlich tatsächlicher Agenten-Schreiboperationen mit simuliertem Anbieter, idempotenter Wiederholung, Versionskonflikten, Brain-Initialisierung ohne Überschreiben, echter Wiki-/Markdown-Linkauflösung, Sommer-/Winterzeit sowie Benachrichtigungs-Deduplizierung. Web-Push-Verschlüsselung und VAPID-Signatur mit echten Bibliotheksfunktionen geprüft; Transport wird simuliert, keine Testnachrichten an echte Geräte gesendet. 28 Browserprüfungen einschließlich Graph-Knotenauswahl/Notizöffnung, Dashboard-Aktualisierung nach Agentenaktionen, Erinnerungsfelder und Browser-Push-Aktivierung mit simulierten Browser-APIs erfolgreich. Native Debug-APK und bestehende Unit-Tests gebaut. Der installierte Backend-Paketbestand einschließlich pywebpush wurde ohne bekannte Sicherheitslücken auditiert.

Reale OS-Zustellung nach Browser-/Android-Freigabe, Doze-Verhalten, Push-Dienste und persönlicher Modellzugriff müssen am eigenen Deployment geprüft werden. Android-Erinnerungen verwenden WorkManager und sind keine exakten Alarme. Brain-Vault und technische Aktionshistorie benötigen die in der Betriebsanleitung beschriebenen Backups.

## Version 0.8: Lokale Home-Assistant-Lampensteuerung

60 Backend-/Bridge-Prüfungen: getrennte Authentifizierung, Token-Hash statt Klartextspeicherung, gefilterte Lampenzustände, Gerätefähigkeiten, idempotente Befehle, Ablauf ohne spätere Zustellung, unklare Ergebnisse bei Transport-Timeouts und asynchroner Agentenadapter. Home Assistant und Cloud-HTTP werden simuliert; keine echten Lampen während der Tests geschaltet. 32 Browserprüfungen einschließlich Schalter, Dimmer, Farb-/Temperaturregler, Offline-Sperre, einmaligem Bridge-Token und bisheriger App-Abläufe auf Desktop und Mobilgerät erfolgreich. Die zusätzliche Navigation bleibt auch eingeklappt erreichbar. Android-Debug-APK und bestehende Unit-Tests gebaut.

Bridge-Compose statisch validiert; Docker-Bridge-Image-Build zusätzlich im Deployment-CI-Job vorgesehen. Lokale Docker Engine war nicht gestartet; tatsächliches LAN-Routing, Container-Secret-Berechtigungen, persönliche HA-Kontorechte und Gerätewirkung benötigen den manuellen Test aus docs/home-assistant.md. Akzeptierter Service-Aufruf wird nicht als unabhängige physische Zustandsbestätigung ausgegeben.
