# Deployment mit Coolify

Das Repository enthält dafür **`compose.coolify.yaml`**. Es baut Web, API und PostgreSQL gemeinsam. Die Datenbankinitialisierung liegt im PostgreSQL-Image; eine lokale `.env` oder ein zur Laufzeit gemounteter Git-Checkout wird nicht benötigt. Die API erstellt das initiale Schema beim Start, bevor sie Anfragen annimmt.

## 1. Zugriff festlegen

Der ursprüngliche private Betrieb bleibt der empfohlene Weg:

- Tailscale auf Coolify-Server, PC und Pixel einrichten und die Geräte im selben Tailnet freigeben.
- Auf dem Coolify-Server `tailscale status` ausführen und dessen vollständigen Gerätenamen ermitteln, z. B. `server.example-tailnet.ts.net`.
- HTTPS im Tailnet aktivieren. Die externe App-Adresse wird `https://server.example-tailnet.ts.net`.
- In Coolify **keine öffentliche Domain** für diese Anwendung eintragen. Automatisch erzeugte Domains entfernen. Tailscale Funnel bleibt aus.
- Die Coolify-Datei veröffentlicht nur `127.0.0.1:3080` auf dem Host; API und Datenbank haben keine Host-Ports.

Eine bewusst öffentlich erreichbare HTTPS-Domain ist ebenfalls möglich; siehe Abschnitt 7. Beide Varianten brauchen keine Codeänderungen.

## 2. Persönliches Passwort festlegen

Web und Android melden sich direkt mit deinem `ADMIN_PASSWORD` an. Es ist kein externes Konto, keine E-Mail-Adresse und kein OAuth-Client erforderlich. Ein Passwort mit mindestens 16 Zeichen wählen und ausschließlich in Coolify hinterlegen; beispielsweise mit `openssl rand -hex 32` erzeugen und im Passwortmanager speichern.

Bei einem Update von der vorherigen Anmeldung `ADMIN_PASSWORD` neu hinzufügen. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL` und `SESSION_SECRET` sind nicht mehr erforderlich und können aus Coolify entfernt werden. Vorhandene Datenbankpasswörter und das Datenvolume beibehalten. Nach dem Deployment erneut anmelden und die aktualisierte Android-App installieren.

## 3. Anwendung in Coolify anlegen

1. In deinem Projekt und der gewünschten Umgebung **New Resource / Application** wählen.
2. GitHub-App oder Deploy Key verwenden und das Repository `mistermonopol/Monopol_MainFrame` auswählen. Ein privates Repository benötigt die entsprechende Leseberechtigung.
3. Branch **`main`**, Build Pack / Build Strategy **Docker Compose**, Base Directory **`/`** setzen.
4. Docker Compose Location **`/compose.coolify.yaml`** einstellen; falls das Feld relative Pfade erwartet, `compose.coolify.yaml` verwenden.
5. Speichern und die Compose-Datei laden. Es müssen `db`, `api` und `web` erscheinen. Nicht auf Nixpacks/Railpack oder den einzelnen Web-Dockerfile wechseln.
6. Normale Compose-Verarbeitung verwenden, **Raw Compose aus** lassen. Keine eigenen Build- oder Startbefehle eintragen und keine Verbindung zu einem zusätzlichen vorgegebenen Netzwerk aktivieren.

## 4. Umgebungsvariablen setzen

Unter **Environment Variables → Production** die folgenden Werte eintragen. Geheimnisse gehören ausschließlich in Coolify. Für diese Compose-Anwendung muss jede referenzierte Variable **sowohl während des Builds als auch zur Laufzeit verfügbar** sein: **Build time = Available during build** und **Runtime = Available in the container** aktivieren. In älteren Oberflächen heißen die Optionen beispielsweise **Build Variable** und **Runtime Variable**.

Der Grund: Auch `docker compose build` löst die Variablen der gesamten Compose-Datei auf. Eine ausschließlich zur Laufzeit verfügbare Variable fehlt dann in Coolifys `build-time.env`, und der Build bricht bereits vor dem Bauen der Images ab. Dafür sind keine zusätzlichen `ARG`-Definitionen in den Dockerfiles und keine `NEXT_PUBLIC_`-Variablen nötig.

| Variable | Wert |
| --- | --- |
| `PUBLIC_URL` | `https://server.example-tailnet.ts.net` – kein Port, kein Pfad, kein abschließender Slash |
| `ADMIN_PASSWORD` | Persönliches Anmeldepasswort mit mindestens 16 Zeichen |
| `POSTGRES_PASSWORD` | Eigenständiges zufälliges Passwort für den Datenbankadministrator |
| `APP_DB_PASSWORD` | Eigenständiges zufälliges Passwort für Kerndaten |
| `HEALTH_DB_PASSWORD` | Eigenständiges zufälliges Passwort für Gesundheitsdaten |
| `PRIVATE_WEB_PORT` | Optional, Standard `3080`; bei einem Portkonflikt einen freien Host-Port wählen |
| `BACKUP_STACK_ID` | Optional, Standard `everything`; bei mehreren Instanzen je Anwendung einen eindeutigen Wert verwenden |

Für jedes der vier Secrets separat `openssl rand -hex 32` auf einem vertrauenswürdigen Rechner ausführen. Hexadezimale Passwörter können ohne zusätzliche URL-Kodierung in den internen Datenbank-URLs verwendet werden. `DATABASE_URL`, `HEALTH_DATABASE_URL` und `COOKIE_SECURE` setzt die Compose-Datei selbst.

Die drei Datenbankpasswörter müssen vor dem **ersten** Deployment endgültig gesetzt sein. Bei einem bestehenden Volume ändern neue Umgebungswerte die PostgreSQL-Rollenpasswörter nicht automatisch. Ein Passwortwechsel muss in PostgreSQL und anschließend in Coolify erfolgen. Bei einem Fehler kein Volume mit persönlichen Daten löschen.

Bei bereits angelegten Variablen die Build-/Runtime-Einstellungen für jede Variable ausdrücklich bearbeiten und speichern. Das erneute Einfügen derselben Werte ohne Flags im Developer View behält vorhandene Scope-Einstellungen bei. In Coolify-Versionen mit Flag-Unterstützung setzt eine Zeile `# coolify: buildtime=true runtime=true` direkt oberhalb der jeweiligen Variablen beide Optionen. Nach einer Änderung der Build-Verfügbarkeit **Deploy/Redeploy** verwenden, nicht nur Restart.

## 5. Deployen und privat erreichbar machen

1. **Deploy** wählen. Deployment Logs prüfen: erst Datenbankinitialisierung, dann API-Schema und API-Start, dann Web. Alle drei Dienste sollen gesund sein.
2. Auf dem Coolify-Host prüfen:

   ```sh
   curl --fail http://127.0.0.1:3080/api/v1/healthz
   ```

   Erwartet: `{"status":"ok"}`. Bei verändertem `PRIVATE_WEB_PORT` diesen Port verwenden.
3. Auf demselben Host die private HTTPS-Weiterleitung aktivieren:

   ```sh
   tailscale serve --bg http://127.0.0.1:3080
   tailscale serve status
   ```

   Falls auf diesem Tailscale-Gerätenamen bereits ein anderer Dienst auf HTTPS-Port 443 liegt, ihn nicht überschreiben. Einen separaten Tailscale-Knoten für Everything verwenden oder die bestehende Zuordnung gezielt anpassen. Die App erwartet eine eigene Basis-URL ohne Pfad.
4. Die von Tailscale angezeigte HTTPS-Adresse muss exakt mit `PUBLIC_URL` übereinstimmen. Bei einer Korrektur den Wert ändern und in Coolify erneut deployen.
5. Auf PC und Pixel Tailscale aktivieren, die HTTPS-Adresse öffnen und mit deinem persönlichen Passwort anmelden.
6. In Android unter Einstellungen dieselbe Basisadresse eintragen. Danach Health-Connect-Leseberechtigungen erteilen und Synchronisation aktivieren.

Tailscale Serve benötigt den **Host-Port 3080**, nicht den internen Container-Port 3000. Bereits eingerichtete Coolify-Domains für andere Apps bleiben davon unberührt.

## 6. Daten, Backups und Updates

- Das benannte Volume `postgres` ist dauerhaft. Coolify kann seinen tatsächlichen Namen mit einer Ressourcenkennung versehen. Bei Redeployments dieselbe Anwendung und dasselbe Volume weiterverwenden.
- Vor Nutzung mit echten Daten eine verschlüsselte Sicherung und Wiederherstellung auf einem separaten Testsystem prüfen. `ops/backup.sh` unterstützt Coolify über `BACKUP_STACK_ID`: Es findet genau den laufenden Datenbankcontainer mit dem entsprechenden Label, unabhängig von dessen wechselndem Coolify-Namen. Bei keinem oder mehreren Treffern bricht es ab.
- Für den Backuptimer die Skripte wie im README unter `/opt/everything` auf dem Host bereitstellen und `age` installieren. In `/etc/everything-backup.env` **beide** Werte setzen: `AGE_RECIPIENT=age1...` und `BACKUP_STACK_ID=everything` (bzw. deinen in Coolify gesetzten Wert). Dann die mitgelieferten Systemd-Units aktivieren und einmal manuell ausführen. Ohne `BACKUP_STACK_ID` verwendet das Skript weiterhin die lokale `compose.yaml`. Verschlüsselte Sicherungen zusätzlich auf einen zweiten Host kopieren.
- Zur Wiederherstellung den über das Label identifizierten `db`-Container verwenden: Dump mit `age` entschlüsseln, per `docker cp` als `/tmp/life.dump` hineinkopieren und `docker exec <db-container> pg_restore -U postgres -d life --clean --if-exists /tmp/life.dump` ausführen. Währenddessen Web und API in Coolify stoppen; zuerst in einer separaten Testinstanz prüfen. Anschließend Dumpdateien entfernen, Sitzungen mit `TRUNCATE core.sessions` widerrufen und die Anwendung starten. Ein Volume-Snapshot ohne geprüfte Wiederherstellung ersetzt diesen Test nicht.
- Unter GitHub Actions zeigen die Prüfungen für API, Web, Android und das vollständige Docker-Deployment den Stand des gepushten Commits. Eine Debug-APK wird im Android-Job als Artifact bereitgestellt.
- Nach Updates in Coolify deployen und `/api/v1/healthz`, Anmeldung und Datenanzeige prüfen. Die aktuelle Initialmigration legt Tabellen idempotent an; zukünftige Schemaänderungen benötigen explizite Migrationen. Alte Anwendungsversionen nicht ungeprüft gegen ein später geändertes Schema starten.

## 7. Optional: öffentliche Coolify-Domain

Nur wählen, wenn du die App absichtlich außerhalb des VPN erreichbar machen möchtest:

1. Einen eigenen Namen, z. B. `life.example.com`, per DNS auf den Coolify-Server zeigen lassen.
2. In Coolify unter **Domains** ausschließlich den Dienst **`web`** wählen. HTTPS, Host `life.example.com` und internen Port **`3000`** einstellen. In Oberflächen mit einem gemeinsamen URL-Feld entspricht das `https://life.example.com:3000`.
3. `PUBLIC_URL=https://life.example.com` setzen, **ohne `:3000`**. Neu deployen und TLS prüfen.
4. Für `api` und `db` keine Domains oder Host-Ports hinzufügen. `/api/...` läuft über den Web-Proxy zur API. Der private Loopback-Port kann bestehen bleiben; er wird dadurch nicht öffentlich.
5. In Android die neue Basisadresse verwenden. Eine vorher eingerichtete Tailscale-Serve-Zuordnung zu dieser App wird für diesen Weg nicht benötigt.

## Häufige Fehler

| Fehler | Prüfung |
| --- | --- |
| `required variable ... is missing` oder `Defaulting to a blank string` beim Build | Alle fünf Pflichtwerte unter Production gesetzt? Für jede Variable Build time **und** Runtime aktivieren, speichern und neu deployen. Runtime-only-Werte fehlen in `build-time.env`. |
| Coolify findet Compose nicht | Branch `main`, Base Directory `/`, Compose Location `/compose.coolify.yaml` |
| Passwortauthentifizierung fehlgeschlagen | Stimmen Coolify-Werte und bereits initialisierte PostgreSQL-Rollen überein? |
| „Passwort ist falsch“ | Passwort exakt wie `ADMIN_PASSWORD` eingeben; nach Änderungen neu deployen |
| Zu viele Anmeldeversuche | Eine Minute warten; die Begrenzung gilt gemeinsam für Web und Android |
| „Ungültiger Ursprung“ beim Speichern | Browseradresse und `PUBLIC_URL` müssen identisch sein; nach Änderung erneut deployen |
| Öffentlich „No available server“ | Domain an `web`, interner Port 3000, Web gesund, API und Datenbank gesund |
| Private URL nicht erreichbar | Tailscale auf beiden Geräten aktiv, ACL erlaubt Zugriff, Serve zeigt auf Host-Port 3080 |
| `port is already allocated` | `PRIVATE_WEB_PORT` ändern und Tailscale Serve auf denselben neuen Port setzen |

Grundlage: [Coolify: Docker Compose aus Git](https://coolify.io/docs/applications/builds/docker-compose), [Umgebungsvariablen und Build-/Runtime-Scope](https://coolify.io/docs/applications/configuration/environment-variables) und [Anwendungs- und Domainkonfiguration](https://coolify.io/docs/applications/configuration/general).
