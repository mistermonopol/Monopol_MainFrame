# Everything · dein persönliches Life OS

Privater Workspace für PC und Pixel: Next.js, FastAPI, PostgreSQL und Kotlin/Compose. Eigene Aufgaben, Notizen und einmalige Termine teilen sich einen Server. Health Connect liefert ausschließlich Tageswerte. Die übrigen Integrationen sind sichtbar als **Nicht verbunden**.

**Coolify:** Verwende `compose.coolify.yaml`. Die vollständige Anleitung für Umgebungsvariablen, Google-Anmeldung, privaten Tailscale-Zugriff und die optionale öffentliche Domain steht in [docs/coolify.md](docs/coolify.md).

## Start auf einem privaten Linux-Server

Voraussetzungen: Docker Engine mit Compose v2, Tailscale mit aktiviertem HTTPS, verschlüsselter Serverdatenträger, Google-OAuth-Webclient. Keine Ports des Routers öffnen; Tailscale Funnel **nicht** aktivieren. Tailnet-ACLs müssen den Zugriff auf deine Geräte beschränken.

1. `.env.example` nach `.env` kopieren. Vier unabhängige Secrets mit `openssl rand -hex 32` erzeugen; nur URL-sichere hexadezimale Zeichen für die Datenbankpasswörter verwenden. `ALLOWED_EMAIL` auf dein Google-Konto setzen.
2. `PUBLIC_URL` auf `https://<server>.<tailnet>.ts.net` setzen, ohne abschließenden Slash. Im Google-Cloud-Projekt einen OAuth-Webclient mit Redirect-URI `<PUBLIC_URL>/api/v1/auth/callback` anlegen. OIDC verwendet nur `openid email`, keine Kalender- oder Gesundheitsfreigaben. Bei externer Testkonfiguration dein Konto als Testnutzer hinzufügen. Client-ID und Client-Secret in `.env` eintragen.
3. `docker compose up --build -d`. Die einmalige Datenbankinitialisierung legt getrennte Rollen und Schemas `core` und `health` an; der Migrationsdienst erstellt die initialen Tabellen. Passwörter nach der ersten Initialisierung erfordern zusätzlich eine Änderung der PostgreSQL-Rollen, nicht nur der `.env`.
4. Auf dem Host `tailscale serve --bg http://127.0.0.1:3000` ausführen. Den vorgeschlagenen HTTPS-Namen mit `PUBLIC_URL` abgleichen. HTTPS endet im privaten Tailscale-Proxy; Web und API teilen denselben Ursprung. Datenbank und API haben keine veröffentlichten Ports.
5. URL auf dem PC öffnen und mit Google anmelden. Dashboard beginnt leer. Es gibt keinen Demo-Login und keine Beispieldaten im produktiven Datenbestand.

Prüfen: `docker compose ps`, `curl https://<server>.<tailnet>.ts.net/api/v1/healthz`. Der Endpunkt prüft beide Datenbankverbindungen. `docker compose logs --tail 100 api` zeigt Betriebsfehler ohne absichtliche Protokollierung von Inhalten oder Tokens. Der Server muss korrektes NTP verwenden. HTTP-Access-Logs sind deaktiviert, damit OAuth- und Anmeldecodes nicht in URLs protokolliert werden.

## Android auf dem Pixel

Android 14+, Health Connect und Tailscale vorausgesetzt. Android Studio mit JDK 17 und SDK 36 verwenden. Der mitgelieferte Gradle-Wrapper lädt Version 8.11.1 mit SHA-256-Prüfung. Unter Windows: `android/gradlew.bat -p android testDebugUnitTest assembleDebug`; unter Linux/macOS: `sh android/gradlew -p android testDebugUnitTest assembleDebug`.

Für private Release-APKs einen eigenen Keystore erzeugen und die Umgebungsvariablen `ANDROID_KEYSTORE_PATH` (absolut), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` setzen. Dann `sh android/gradlew -p android assembleRelease`; APK unter `android/app/build/outputs/apk/release/`. Keystore separat sichern und niemals einchecken. Für spätere Updates denselben Signierschlüssel verwenden.

APK privat installieren. In **Einstellungen** die gleiche HTTPS-Basisadresse eintragen und **Mit Google anmelden** wählen. Der Systembrowser führt den Google-Login aus; ein kurzlebiger Einmalcode geht per `everything://auth` zurück zur App. Nur der zugehörige PKCE-Verifier kann ihn gegen eine siebentägige widerrufbare Sitzung tauschen. Google-Zugangstokens werden nicht als App-Sitzung verwendet.

In **Gesundheit** Leseberechtigungen für Schritte, Schlaf, Ruhepuls und Gewicht einzeln freigeben. Die App fragt keine Schreibberechtigungen ab. Hintergrundzugriff ist optional und wird nur bei verfügbarer Gerätefunktion angeboten. Ohne diese Freigabe funktioniert die Synchronisation beim Öffnen und über **Aktualisieren**. WorkManager plant ungefähr stündlich; Android und VPN-Erreichbarkeit bestimmen den tatsächlichen Zeitpunkt. Bei längeren Offline-Phasen werden beim nächsten erfolgreichen Abgleich die letzten 30 Tage neu berechnet.

Die App liest keine Daten älter als den verfügbaren Health-Connect-Zeitraum und fordert keine zusätzliche historische Berechtigung an. Berechtigungen können in Health Connect widerrufen werden. Synchronisation stoppen verhindert weitere Uploads; bereits importierte Daten bleiben bis zur separaten Löschung erhalten.

## Daten und Verhalten

- Aufgaben: Titel, Beschreibung, Fälligkeit und Erledigt-Status. Notizen: Titel und Klartext. Termine: Titel, Beschreibung, Beginn/Ende und Ort; keine Serien oder Erinnerungen.
- Alle Änderungen benötigen Verbindung. Beide Clients zeigen einen Cache mit Ladezeitpunkt. Der Webcache liegt im lokalen Browserspeicher und enthält auch Gesundheitswerte; nur auf vertrauenswürdigen Geräten verwenden und bei Bedarf in Einstellungen löschen. Android verschlüsselt Cache und Sitzung über Android Keystore und deaktiviert Systembackups.
- Zeitpunkte werden mit Zeitzonenoffset übertragen, Tagesgrenzen in `Europe/Berlin` berechnet. Android-Termine werden in Berliner Ortszeit eingegeben; das Web verwendet bei der Eingabe die Browserzeitzone. Anzeige im Web folgt der Browserzeitzone.
- Gesundheitswerte pro Datum: aggregierte Schritte, Schlafdauer in Minuten (dem Tag des Schlafendes zugeordnet), Mittel der Ruhepulsmessungen und letzter Gewichtswert inklusive Messzeitpunkt. Health-Connect-Aggregationen berücksichtigen Quellenprioritäten bei Schritten und Schlaf. Überlappende Schlafintervalle werden vor der Aggregation vereinigt. Fehlende oder nicht freigegebene Werte bleiben `null`, keine künstlichen Nullwerte. Bei eingeschränkten Berechtigungen ersetzt ein Abgleich die Tageszeile einschließlich fehlender Werte.
- Gesundheitsimporte ersetzen Datumsschlüssel idempotent. Gespeicherte Tage bleiben über den 30-Tage-Lesezeitraum hinaus erhalten, bis du sie löschst. Änderungen oder Löschungen in Health Connect werden im nachgelesenen Zeitraum übernommen.
- Jede Bearbeitung und Löschung prüft die Version. Bei paralleler Änderung meldet die API `409`; aktualisieren und Änderung erneut durchführen. Es gibt keine automatische Konfliktzusammenführung.
- Web verwendet HttpOnly-/Secure-/SameSite-Cookies und Ursprungsprüfung für Änderungen. Android nutzt Bearer-Tokens. Sitzungen laufen nach sieben Tagen ab; Abmelden widerruft die aktuelle Sitzung. Der Zugang ist auf eine verifizierte Google-E-Mail beschränkt.
- Gesundheits- und Kerndaten liegen in getrennten PostgreSQL-Schemas mit unabhängigen Rollen. Ein API-Prozess hat beide Verbindungen; dies ist keine Isolation gegenüber einem kompromittierten Backend. Datenträger und Sicherungen müssen zusätzlich verschlüsselt sein.

## API und Entwicklung

OpenAPI: `/openapi.json`, interaktive Dokumentation: `/docs` (nur im Tailnet bereitstellen).

| Schnittstelle | Verhalten |
| --- | --- |
| `GET /api/v1/dashboard` | Aufgaben, Notizen, Termine, Gesundheitswerte und letzter Sync |
| `GET/POST /api/v1/items/{tasks\|notes\|events}` | Liste und neuer Eintrag |
| `PUT /api/v1/items/{kind}/{id}` | Vollständiger Eintrag mit `version` |
| `DELETE /api/v1/items/{kind}/{id}?version=N` | Versionsgeprüfte Löschung |
| `GET/PUT/DELETE /api/v1/health/days` | Tageswerte lesen, Stapel `{days:[...]}` importieren, alles löschen |
| `GET /api/v1/session` | Aktuelles Konto |
| `GET /api/v1/auth/login` | Browser-OIDC-Anmeldung, optional native PKCE-Challenge |
| `POST /api/v1/auth/native/exchange` | Einmalcode und PKCE-Verifier gegen Sitzung tauschen |
| `POST /api/v1/auth/logout` | Aktuelle Sitzung widerrufen |

Backend lokal mit Python 3.12: virtuelle Umgebung anlegen, `pip install -r backend/requirements.txt`. `SESSION_SECRET` setzen und für lokale Entwicklung `PUBLIC_URL=http://localhost:3000`, `COOKIE_SECURE=false`. In `backend/` zuerst `python -m app.migrate`, dann `uvicorn app.main:app --reload --no-access-log`. Ohne Datenbank-URLs werden getrennte lokale SQLite-Dateien verwendet; Produktion verwendet PostgreSQL. `ALLOWED_EMAIL` und OAuth-Werte müssen ebenfalls gesetzt sein, bevor echte Anmeldung möglich ist.

Web: in `web/` `npm ci`, `npm run dev`. Der Next.js-Proxy leitet `/api` an `http://localhost:8000` weiter. Kein Health Connect direkt im Browser.

Checks: `python -m pytest backend/tests -q`, `npm --prefix web run build`, `sh android/gradlew -p android testDebugUnitTest assembleDebug`. CI definiert diese drei Prüfläufe. API-Tests prüfen CRUD, Konflikte, Sitzungsschutz, PKCE-Einmaligkeit, Origin-Prüfung und idempotente Gesundheitsimporte. Android-Tests prüfen überlappende Schlafintervalle und Berliner Sommerzeitgrenzen.

## Backups und Wiederherstellung

Auf dem Host `age` installieren. Ein `age`-Schlüsselpaar **auf einem separaten vertrauenswürdigen Rechner** erzeugen; privaten Schlüssel außerhalb des Servers aufbewahren. `AGE_RECIPIENT` als öffentlichen Empfänger setzen und täglich `sh ops/backup.sh` aus dem Repository starten, z. B. über einen Systemd-Timer. Es bleiben ungefähr sieben tägliche verschlüsselte Sicherungen. Backupverzeichnis auf einen zweiten Datenträger oder zweiten Host kopieren und Fehlermeldungen des Timers überwachen. Der temporäre Dump liegt kurzzeitig auf dem verschlüsselten Serverdatenträger.

Die mitgelieferten Units `ops/everything-backup.service` und `ops/everything-backup.timer` nach `/etc/systemd/system/` kopieren. Sie erwarten das Repository unter `/opt/everything`; bei anderem Installationspfad `WorkingDirectory` und `ExecStart` anpassen. `/etc/everything-backup.env` mit `AGE_RECIPIENT=age1...` anlegen, dann `systemctl daemon-reload` und `systemctl enable --now everything-backup.timer`. Einmal manuell mit `systemctl start everything-backup.service` prüfen; Fehler über `journalctl -u everything-backup.service` und `systemctl --failed` überwachen. Der Timer läuft täglich um etwa 03:15 Uhr Serverzeit und holt ausgefallene Läufe nach.

Wiederherstellung zunächst in einem separaten Testsystem durchführen:

1. `docker compose stop web api` und Datenbank vor Änderungen separat sichern.
2. Sicherung mit `age -d -i /sicherer/pfad/key.txt -o /sicherer/pfad/life.dump backups/<datei>.dump.age` auf einem verschlüsselten Datenträger entschlüsseln.
3. `docker compose cp /sicherer/pfad/life.dump db:/tmp/life.dump` und `docker compose exec db pg_restore -U postgres -d life --clean --if-exists /tmp/life.dump` ausführen. Rollen müssen zuvor durch die Erstinitialisierung existieren.
4. Dump im Container und auf dem Host entfernen; `docker compose up -d api web`. Health-Endpunkt, Anmeldung, Aufgaben und Gesundheitswerte prüfen. Wiederhergestellte Sitzungen widerrufen, indem ein Administrator `TRUNCATE core.sessions, core.login_codes` ausführt.

Eine erfolgreiche Wiederherstellung und ein Test auf dem echten Pixel sind Voraussetzungen für die persönliche Betriebsfreigabe. Sie können ohne deinen Server, Google-Konfiguration und Gerät nicht vorweggenommen werden.

Den lokalen Prüfstand und verbleibende Gerätetests beschreibt [docs/verification.md](docs/verification.md).

## Noch außerhalb dieses Meilensteins

Google Calendar/Tasks, Banken, Home Assistant, Musikdienste, KI, n8n, Push und Sprache sind noch nicht angebunden. Keine medizinischen Auswertungen, keine Überweisungen und keine öffentliche Mehrbenutzerplattform.
