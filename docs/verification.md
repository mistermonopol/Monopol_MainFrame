# Prüfstand · 1. November 2026

Lokal erfolgreich ausgeführt:

- **14 API-Tests**, mit getrennten SQLite-Datenbanken: Passwort-Anmeldung für Web und Android, sichere Cookies, Logout, gemeinsame Begrenzung falscher Anmeldeversuche, ungültige frühere Sitzungen, entfernte Login-Endpunkte, Origin-Prüfung, CRUD für alle drei Module, Versionskonflikte, Gesundheitsimporte und Gewichtsmesszeitpunkt.
- **10 Playwright-Browserprüfungen**, Desktop und Pixel-Viewport: Passwort-Anmeldung, Aufgaben, Offline-Cache, leere Gesundheitswerte, unverbundene Dienste sowie einklappbare Navigation mit gespeicherter Einstellung und mobiles Seitenmenü einschließlich Escape und Fokus-Rückgabe. API-Antworten werden gezielt simuliert.
- **Next.js-Produktionsbuild** mit TypeScript-Prüfung.
- **Android Debug-APK** erfolgreich kompiliert und paketiert; **2 Kotlin-Unit-Tests** für Schlafintervallüberschneidungen und Berliner Sommerzeitgrenze erfolgreich.
- **Docker-Compose-Konfiguration** gegen `.env.example` validiert.
- **Coolify-Konfiguration**: explizite Umgebungsvariablen, eingebautes PostgreSQL-Init, Migration vor API-Start und HTTPS-Zugriff über Coolifys Proxy auf den internen Web-Port 3000. CI prüft Web → API → PostgreSQL ohne veröffentlichte Host-Ports; Ausführungsstatus siehe GitHub Actions.
- **npm audit** und **pip-audit** ohne bekannte Sicherheitslücken im geprüften Paketbestand.
- Dunkle Lila-Oberfläche mit Consolas/Monospace: Desktop, eingeklappte Seitenleiste, Mobilansicht und geöffnetes mobiles Menü anhand erzeugter Web-Screenshots visuell geprüft. Keine externen Webfonts erforderlich. Android verwendet Monospace-Typografie und adaptive seitliche Navigation; die native Darstellung muss zusätzlich auf dem Pixel geprüft werden.

Die Test-APK liegt nach dem Build unter `android/app/build/outputs/apk/debug/app-debug.apk`. Sie ist mit einem Entwicklungsschlüssel signiert und dient Gerätetests; für dauerhaften privaten Betrieb einen eigenen gesicherten Release-Keystore verwenden.

Noch nicht lokal nachgewiesen:

- PostgreSQL-Betrieb lokal: Docker Engine war auf diesem Rechner nicht gestartet. PostgreSQL 17 einschließlich Rollenprüfung und der vollständige Docker-Stack wurden bereits in GitHub Actions erfolgreich geprüft; aktuelle Ergebnisse siehe Workflow des jeweiligen Commits.
- Anmeldung auf dem persönlichen Server: benötigt `ADMIN_PASSWORD` und die korrekte HTTPS-Basisadresse.
- Health Connect auf dem echten Pixel, Berechtigungswiderruf, Hintergrundarbeit und Verbindungsunterbrechungen: benötigen Gerät und persönlichen Server.
- Verschlüsseltes Backup und erfolgreiche Wiederherstellung: Skript, Systemd-Timer und Anleitung sind vorhanden; der Wiederherstellungstest muss vor Betriebsfreigabe auf einem separaten System erfolgen.

Eine Warnung des Python-Testclients weist auf die künftige Migration von `httpx` zu `httpx2` hin; sie beeinträchtigt die erfolgreichen API-Tests nicht.
