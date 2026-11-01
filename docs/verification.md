# Prüfstand · 1. November 2026

Lokal erfolgreich ausgeführt:

- **14 API-Tests**, mit getrennten SQLite-Datenbanken: Anmeldungsschutz, Freigabe des Google-Kontos (simulierte Google-Antwort), sichere Cookies, Logout, PKCE-Einmaligkeit und Ablauf, Origin-Prüfung, CRUD für alle drei Module, Versionskonflikte, Gesundheitsimporte und Gewichtsmesszeitpunkt.
- **6 Playwright-Browserprüfungen**, Desktop und Pixel-Viewport: Aufgaben anlegen/erledigen/bearbeiten, Offline-Cache mit deaktivierten Änderungen, leere Gesundheitswerte und unverbundene Dienste. API-Antworten werden hierbei gezielt simuliert.
- **Next.js-Produktionsbuild** mit TypeScript-Prüfung.
- **Android Debug-APK** erfolgreich kompiliert und paketiert; **2 Kotlin-Unit-Tests** für Schlafintervallüberschneidungen und Berliner Sommerzeitgrenze erfolgreich.
- **Docker-Compose-Konfiguration** gegen `.env.example` validiert.
- **Coolify-Konfiguration** ergänzt: explizite Laufzeitvariablen, eingebautes PostgreSQL-Init, Migration vor API-Start, Gesundheitsprüfungen und privater Loopback-Zugriff. Eine CI-Prüfung startet den vollständigen Docker-Stack und prüft Web → API → PostgreSQL; Ausführungsstatus siehe GitHub Actions.
- **npm audit** und **pip-audit** ohne bekannte Sicherheitslücken im geprüften Paketbestand.
- Desktop- und Mobilansicht anhand erzeugter Screenshots visuell geprüft. Keine externen Webfonts erforderlich.

Die Test-APK liegt nach dem Build unter `android/app/build/outputs/apk/debug/app-debug.apk`. Sie ist mit einem Entwicklungsschlüssel signiert und dient Gerätetests; für dauerhaften privaten Betrieb einen eigenen gesicherten Release-Keystore verwenden.

Noch nicht lokal nachgewiesen:

- PostgreSQL-Betrieb und Rollenberechtigungen: Docker Engine war auf diesem Rechner nicht gestartet. CI ist für PostgreSQL 17 einschließlich Rollenprüfung eingerichtet; dieser Workflow wurde noch nicht auf einem CI-Server ausgeführt.
- Echte Google-Anmeldung: benötigt die persönliche OAuth-Konfiguration und HTTPS-Adresse.
- Health Connect auf dem echten Pixel, Berechtigungswiderruf, Hintergrundarbeit und VPN-Unterbrechungen: benötigen Gerät und privaten Server.
- Verschlüsseltes Backup und erfolgreiche Wiederherstellung: Skript, Systemd-Timer und Anleitung sind vorhanden; der Wiederherstellungstest muss vor Betriebsfreigabe auf einem separaten System erfolgen.

Zwei Warnungen der Python-Abhängigkeiten weisen auf die künftige Migration von `httpx` zu `httpx2` hin; sie beeinträchtigen die erfolgreichen API-Tests nicht.
