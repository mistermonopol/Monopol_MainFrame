# Prüfstand · 1. November 2026

Lokal erfolgreich ausgeführt:

- **15 API-Tests**, mit getrennten SQLite-Datenbanken: Passwort-Anmeldung, sichere Cookies, Logout, Begrenzung falscher Anmeldeversuche, frühere Sitzungen, Origin-Prüfung, CRUD, Versionskonflikte, Gesundheitsimporte und Fehlermeldungen auf Englisch bzw. Deutsch.
- **20 Playwright-Prüfungen**, Desktop und Pixel-Viewport: bisherige Abläufe, Navigation, Sprach- und Themewechsel mit gespeicherter Auswahl, eckige Bedienelemente, alle Diagrammansichten sowie Aggregationsfälle für fehlende Werte, gemessene Nullen, doppelte Tage und Wochen-/Jahresgrenzen. API-Antworten werden gezielt simuliert; sechs Prüfläufe testen die reine Aggregation.
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
