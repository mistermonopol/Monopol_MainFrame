# Monopol_MainFrame your App for Everything

Privater Workspace für PC und Pixel: Next.js, FastAPI, PostgreSQL und Kotlin/Compose. Aufgaben, Musikprojekte, API-gestützter KI-Chat und Obsidian-Notizen teilen sich einen Server. Der Hauptscreen besteht aus frei konfigurierbaren Widgets; Auswahl und Einstellungen werden synchronisiert, Desktop und Handy besitzen getrennte Anordnungen. Health Connect liefert Tageswerte und Messreihen für Puls, HRV, Sauerstoffsättigung, Atemfrequenz, Aktivität, Schlaf und Gewicht. Kalender und bisherige Notizen sind aus der Navigation entfernt; bestehende Daten bleiben gespeichert.

**Version 0.9:** Widget-Baukasten und erweiterte Health-Berechtigungen sind in [docs/widgets-health.md](docs/widgets-health.md) beschrieben. Nach dem Server-Update Android 0.9.0 installieren und gewünschte zusätzliche Health-Connect-Leseberechtigungen freigeben.

Die Oberfläche startet auf Englisch. Unter **Settings → Appearance** lassen sich vier eigenständige Layouts (**Index, Studio, Control, Focus**) unabhängig von vier Farbwelten (**Violet, Paper, Amber, Cyan**) wählen. Deutsch und Englisch bleiben separat wählbar; die Auswahl wird je Browser bzw. Android-Gerät gespeichert. Alle Bedienelemente und Karten haben scharfe, rechteckige Ecken. Consolas mit Monospace-Fallbacks, die einklappbare Seitenleiste und der mobile Drawer bleiben erhalten. Android verwendet die lokale Monospace-Systemschrift. Aufbau, Navigation und Modulansichten unterscheiden sich pro Layout; Details und Designreferenzen stehen in [docs/layouts.md](docs/layouts.md).

Im Musik-Tab ist **https://vault.monopol-ai.de/spotify** direkt eingebettet, mit Neuladen, größerer Ansicht und externem Link. Android nutzt dafür eine HTTPS-WebView. Der externe Dienst verwaltet seine eigene Anmeldung und Darstellung; MainFrame gibt keine eigenen Zugangsdaten weiter.

Der Agent verwendet eine serverseitig konfigurierte Chat-Completions-API mit Tool Calling (`AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`). Er liest aktuelle App-Daten einschließlich Gesundheitswerten und kann Markdown-Notizen aus dem verbundenen Vault nachladen. Er kann auf deine Aufforderung Aufgaben, Musikprojekte, bisherige Notizen/Termine sowie Vault-Notizen anlegen und ändern. Erfolgreiche Aktionen werden angezeigt und Änderungen mit früherem Stand protokolliert. Gesundheitswerte bleiben schreibgeschützt. Beim Senden gehen diese Daten an den gewählten KI-Anbieter. Der Obsidian-Tab kann Notizen direkt erstellen und bearbeiten; der Vault liegt als Ordner/Volume auf dem Server. PC-Synchronisierung, API-Anbindung und Backups sind in [docs/coolify.md](docs/coolify.md) beschrieben. Finanzen bleiben unverbunden. Home Assistant wird über eine lokale Docker-Bridge angebunden.

Der persistente Obsidian-Vault **mono_frame_brain** unterstützt den Agenten als Wissensarchiv. `AI_Brain.md` und eine vorhandene `Memory.md` werden als Kontext gelesen; weitere Notizen kann der Agent gezielt nachladen. Der Obsidian-Tab zeigt einen Graphen aus Wiki- und Markdown-Links mit Suche, Auswahl und Zoom. Bestehende Dateien werden bei der Initialisierung nicht überschrieben.

Aufgaben können Erinnerungen haben: standardmäßig **09:00 Europe/Berlin am Fälligkeitstag**, optional eigene Uhrzeit oder deaktiviert. Browser-Web-Push und Android-Benachrichtigungen werden in den Einstellungen pro Gerät aktiviert. Android-Hintergrundprüfungen laufen ungefähr alle 15 Minuten; Energiesparen kann sie verzögern. Einrichtung und Grenzen: [docs/brain-reminders.md](docs/brain-reminders.md).

Die Übersicht enthält ein Schrittediagramm: **Daily** zeigt 14 Tageswerte, **Weekly** die Summen von acht Kalenderwochen ab Montag und **Monthly** zwölf Kalendermonate. Tagesgrenzen richten sich nach `Europe/Berlin`. Fehlende Messungen bleiben leer; gemessene Nullen bleiben Nullwerte. Wochen- und Monatssummen weisen die Zahl erfasster Tage aus, damit unvollständige Zeiträume erkennbar sind. Historie hängt von den tatsächlich synchronisierten und gespeicherten Tagen ab.

UI-Übersetzungen liegen in `web/app/messages.json`. Nach Änderungen mit `node ops/generate-locales.mjs` die native Übersetzungstabelle neu erzeugen. Eigene Aufgaben, Notizen und Termine werden bei einem Sprachwechsel nicht übersetzt oder verändert. API-Fehler verwenden standardmäßig Englisch und berücksichtigen `Accept-Language: de`.

**Coolify:** Verwende `compose.coolify.yaml`. Die Anleitung für `https://monopol-ai.de`, Umgebungsvariablen und Passwort-Anmeldung steht in [docs/coolify.md](docs/coolify.md).

## Lokaler Home Assistant

Der Tab **Smart Home** und der Agent können Lampen an-/ausschalten, dimmen und unterstützte Farben/Farbtemperaturen setzen. Bei externem Coolify läuft `compose.bridge.yaml` auf einem Docker-Rechner **im Heimnetz**. Die Bridge verbindet sich ausgehend per HTTPS; Home Assistant bleibt lokal. Alle `light.*`-Entitäten werden übernommen. Einrichtung mit zwei getrennten Tokens: [docs/home-assistant.md](docs/home-assistant.md).

## Docker Compose ohne Coolify

Voraussetzungen: Docker Engine mit Compose v2, HTTPS-Reverse-Proxy und verschlüsselter Serverdatenträger. Für Coolify stattdessen die verlinkte Anleitung und `compose.coolify.yaml` verwenden.

1. `.env.example` nach `.env` kopieren. Vier unabhängige Secrets mit `openssl rand -hex 32` erzeugen: `ADMIN_PASSWORD` für die Anmeldung und drei Datenbankpasswörter. Das Anmeldepasswort muss mindestens 16 Zeichen haben; für die Datenbankpasswörter nur URL-sichere hexadezimale Zeichen verwenden.
2. `PUBLIC_URL=https://monopol-ai.de` setzen, ohne abschließenden Slash. Es wird kein externes Konto und kein OAuth-Client benötigt.
3. `docker compose up --build -d`. Die einmalige Datenbankinitialisierung legt getrennte Rollen und Schemas `core` und `health` an; der Migrationsdienst erstellt die initialen Tabellen. Passwörter nach der ersten Initialisierung erfordern zusätzlich eine Änderung der PostgreSQL-Rollen, nicht nur der `.env`.
4. Den HTTPS-Reverse-Proxy für `monopol-ai.de` auf `127.0.0.1:3000` weiterleiten lassen. Web und API teilen denselben Ursprung; Datenbank und API haben keine veröffentlichten Ports. Bei Verwendung der separaten Coolify-Konfiguration übernimmt Coolify die HTTPS-Weiterleitung.
5. URL auf dem PC öffnen und mit deinem `ADMIN_PASSWORD` anmelden. Dashboard beginnt leer. Es gibt keinen Demo-Login und keine Beispieldaten im produktiven Datenbestand.

Prüfen: `docker compose ps`, `curl https://monopol-ai.de/api/v1/healthz`. Der Endpunkt prüft beide Datenbankverbindungen. `docker compose logs --tail 100 api` zeigt Betriebsfehler ohne absichtliche Protokollierung von Inhalten, Passwörtern oder Tokens. Der Server muss korrektes NTP verwenden. HTTP-Access-Logs sind deaktiviert.

## Android auf dem Pixel

Android 14+, Health Connect und Internetverbindung vorausgesetzt. Android Studio mit JDK 17 und SDK 36 verwenden. Der mitgelieferte Gradle-Wrapper lädt Version 8.11.1 mit SHA-256-Prüfung. Unter Windows: `android/gradlew.bat -p android testDebugUnitTest assembleDebug`; unter Linux/macOS: `sh android/gradlew -p android testDebugUnitTest assembleDebug`.

Für private Release-APKs einen eigenen Keystore erzeugen und die Umgebungsvariablen `ANDROID_KEYSTORE_PATH` (absolut), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` setzen. Dann `sh android/gradlew -p android assembleRelease`; APK unter `android/app/build/outputs/apk/release/`. Keystore separat sichern und niemals einchecken. Für spätere Updates denselben Signierschlüssel verwenden.

APK privat installieren. In **Einstellungen** die gleiche HTTPS-Basisadresse und dein persönliches `ADMIN_PASSWORD` eintragen und **Anmelden** wählen. Das Passwort wird nur zur Anmeldung über HTTPS übertragen und nicht auf dem Gerät gespeichert. Android speichert den widerrufbaren Sitzungstoken im durch Android Keystore verschlüsselten Speicher.

In **Gesundheit** Leseberechtigungen für Schritte, Schlaf, Ruhepuls und Gewicht einzeln freigeben. Die App fragt keine Schreibberechtigungen ab. Hintergrundzugriff ist optional und wird nur bei verfügbarer Gerätefunktion angeboten. Ohne diese Freigabe funktioniert die Synchronisation beim Öffnen und über **Aktualisieren**. WorkManager plant ungefähr stündlich; Android und Server-Erreichbarkeit bestimmen den tatsächlichen Zeitpunkt. Bei längeren Offline-Phasen werden beim nächsten erfolgreichen Abgleich die letzten 30 Tage neu berechnet.

Die App liest keine Daten älter als den verfügbaren Health-Connect-Zeitraum und fordert keine zusätzliche historische Berechtigung an. Berechtigungen können in Health Connect widerrufen werden. Synchronisation stoppen verhindert weitere Uploads; bereits importierte Daten bleiben bis zur separaten Löschung erhalten.

## Daten und Verhalten

- Aufgaben: Titel, Beschreibung, Fälligkeit und Erledigt-Status. Notizen: Titel und Klartext. Termine: Titel, Beschreibung, Beginn/Ende und Ort; keine Serien oder Erinnerungen.
- Alle Änderungen benötigen Verbindung. Beide Clients zeigen einen Cache mit Ladezeitpunkt. Der Webcache liegt im lokalen Browserspeicher und enthält auch Gesundheitswerte; nur auf vertrauenswürdigen Geräten verwenden und bei Bedarf in Einstellungen löschen. Android verschlüsselt Cache und Sitzung über Android Keystore und deaktiviert Systembackups.
- Zeitpunkte werden mit Zeitzonenoffset übertragen, Tagesgrenzen in `Europe/Berlin` berechnet. Android-Termine werden in Berliner Ortszeit eingegeben; das Web verwendet bei der Eingabe die Browserzeitzone. Anzeige im Web folgt der Browserzeitzone.
- Gesundheitswerte pro Datum: aggregierte Schritte, Schlafdauer in Minuten (dem Tag des Schlafendes zugeordnet), Mittel der Ruhepulsmessungen und letzter Gewichtswert inklusive Messzeitpunkt. Health-Connect-Aggregationen berücksichtigen Quellenprioritäten bei Schritten und Schlaf. Überlappende Schlafintervalle werden vor der Aggregation vereinigt. Fehlende oder nicht freigegebene Werte bleiben `null`, keine künstlichen Nullwerte. Bei eingeschränkten Berechtigungen ersetzt ein Abgleich die Tageszeile einschließlich fehlender Werte.
- Gesundheitsimporte ersetzen Datumsschlüssel idempotent. Gespeicherte Tage bleiben über den 30-Tage-Lesezeitraum hinaus erhalten, bis du sie löschst. Änderungen oder Löschungen in Health Connect werden im nachgelesenen Zeitraum übernommen.
- Jede Bearbeitung und Löschung prüft die Version. Bei paralleler Änderung meldet die API `409`; aktualisieren und Änderung erneut durchführen. Es gibt keine automatische Konfliktzusammenführung.
- Web verwendet HttpOnly-/Secure-/SameSite-Cookies und Ursprungsprüfung für Anmeldung und Änderungen. Android nutzt Bearer-Tokens. Sitzungen laufen nach sieben Tagen ab; Abmelden widerruft die aktuelle Sitzung. Beide Clients verwenden ein persönliches Passwort. Fünf falsche Anmeldeversuche innerhalb einer Minute sperren weitere Versuche vorübergehend; die Begrenzung gilt gemeinsam für Web und Android im einzelnen API-Prozess.
- `ADMIN_PASSWORD` ändern und die API neu starten widerruft alle bisherigen Sitzungen. Beim Wechsel von der früheren Anmeldung sind erneute Anmeldung und eine aktualisierte Android-App erforderlich. Bestehende Aufgaben und Gesundheitsdaten bleiben erhalten; eine gegebenenfalls vorhandene alte Tabelle `core.login_codes` wird nicht mehr verwendet.
- Gesundheits- und Kerndaten liegen in getrennten PostgreSQL-Schemas mit unabhängigen Rollen. Ein API-Prozess hat beide Verbindungen; dies ist keine Isolation gegenüber einem kompromittierten Backend. Datenträger und Sicherungen müssen zusätzlich verschlüsselt sein.

## API und Entwicklung

Das Backend stellt OpenAPI unter `/openapi.json` und interaktive Dokumentation unter `/docs` intern bereit. Der öffentliche Web-Proxy leitet `/api/...` an das Backend weiter.

| Schnittstelle | Verhalten |
| --- | --- |
| `GET /api/v1/dashboard` | Aufgaben, Notizen, Termine, Gesundheitswerte und letzter Sync |
| `GET/POST /api/v1/items/{tasks\|notes\|events}` | Liste und neuer Eintrag |
| `PUT /api/v1/items/{kind}/{id}` | Vollständiger Eintrag mit `version` |
| `DELETE /api/v1/items/{kind}/{id}?version=N` | Versionsgeprüfte Löschung |
| `GET/PUT/DELETE /api/v1/health/days` | Tageswerte lesen, Stapel `{days:[...]}` importieren, alles löschen |
| `GET /api/v1/session` | Aktuelles Konto |
| `POST /api/v1/auth/login` | `{password}` gegen HttpOnly-Websitzung tauschen; Origin muss `PUBLIC_URL` entsprechen |
| `POST /api/v1/auth/native/login` | `{password}` gegen Android-Bearer-Sitzung tauschen |
| `POST /api/v1/auth/logout` | Aktuelle Sitzung widerrufen |

Backend lokal mit Python 3.12: virtuelle Umgebung anlegen, `pip install -r backend/requirements.txt`. `ADMIN_PASSWORD` mit mindestens 16 Zeichen setzen und für lokale Entwicklung `PUBLIC_URL=http://localhost:3000`, `COOKIE_SECURE=false`. In `backend/` zuerst `python -m app.migrate`, dann `uvicorn app.main:app --reload --no-access-log`. Ohne Datenbank-URLs werden getrennte lokale SQLite-Dateien verwendet; Produktion verwendet PostgreSQL.

Web: in `web/` `npm ci`, `npm run dev`. Der Next.js-Proxy leitet `/api` an `http://localhost:8000` weiter. Kein Health Connect direkt im Browser.

Checks: `python -m pytest backend/tests -q`, `npm --prefix web run build`, `sh android/gradlew -p android testDebugUnitTest assembleDebug`. CI definiert diese drei Prüfläufe. API-Tests prüfen CRUD, Konflikte, Passwort-Anmeldung, Begrenzung falscher Anmeldeversuche, Sitzungsschutz, Origin-Prüfung und idempotente Gesundheitsimporte. Android-Tests prüfen überlappende Schlafintervalle und Berliner Sommerzeitgrenzen.

## Backups und Wiederherstellung

Auf dem Host `age` installieren. Ein `age`-Schlüsselpaar **auf einem separaten vertrauenswürdigen Rechner** erzeugen; privaten Schlüssel außerhalb des Servers aufbewahren. `AGE_RECIPIENT` als öffentlichen Empfänger setzen und täglich `sh ops/backup.sh` aus dem Repository starten, z. B. über einen Systemd-Timer. Es bleiben ungefähr sieben tägliche verschlüsselte Sicherungen. Backupverzeichnis auf einen zweiten Datenträger oder zweiten Host kopieren und Fehlermeldungen des Timers überwachen. Der temporäre Dump liegt kurzzeitig auf dem verschlüsselten Serverdatenträger.

Die mitgelieferten Units `ops/everything-backup.service` und `ops/everything-backup.timer` nach `/etc/systemd/system/` kopieren. Sie erwarten das Repository unter `/opt/everything`; bei anderem Installationspfad `WorkingDirectory` und `ExecStart` anpassen. `/etc/everything-backup.env` mit `AGE_RECIPIENT=age1...` anlegen, dann `systemctl daemon-reload` und `systemctl enable --now everything-backup.timer`. Einmal manuell mit `systemctl start everything-backup.service` prüfen; Fehler über `journalctl -u everything-backup.service` und `systemctl --failed` überwachen. Der Timer läuft täglich um etwa 03:15 Uhr Serverzeit und holt ausgefallene Läufe nach.

Wiederherstellung zunächst in einem separaten Testsystem durchführen:

1. `docker compose stop web api` und Datenbank vor Änderungen separat sichern.
2. Sicherung mit `age -d -i /sicherer/pfad/key.txt -o /sicherer/pfad/life.dump backups/<datei>.dump.age` auf einem verschlüsselten Datenträger entschlüsseln.
3. `docker compose cp /sicherer/pfad/life.dump db:/tmp/life.dump` und `docker compose exec db pg_restore -U postgres -d life --clean --if-exists /tmp/life.dump` ausführen. Rollen müssen zuvor durch die Erstinitialisierung existieren.
4. Dump im Container und auf dem Host entfernen; `docker compose up -d api web`. Health-Endpunkt, Anmeldung, Aufgaben und Gesundheitswerte prüfen. Wiederhergestellte Sitzungen widerrufen, indem ein Administrator `TRUNCATE core.sessions` ausführt.

Eine erfolgreiche Wiederherstellung und ein Test auf dem echten Pixel sind Voraussetzungen für die persönliche Betriebsfreigabe. Sie können ohne deinen Server und dein Gerät nicht vorweggenommen werden.

Den lokalen Prüfstand und verbleibende Gerätetests beschreibt [docs/verification.md](docs/verification.md).

## Noch außerhalb dieses Meilensteins

Google Calendar/Tasks, Banken, Künstler-Daten-APIs, n8n und Sprache sind noch nicht angebunden. KI, Aufgaben-Benachrichtigungen, Obsidian und die Home-Assistant-Lampensteuerung sind vorhanden; persönliche Anbindungen benötigen die beschriebene Einrichtung. Keine medizinischen Auswertungen, keine Überweisungen und keine öffentliche Mehrbenutzerplattform.
