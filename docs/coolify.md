# Deployment auf monopol-ai.de mit Coolify

`compose.coolify.yaml` baut Web, API und PostgreSQL gemeinsam. Web und Android verwenden **https://monopol-ai.de** und deine persönliche Passwort-Anmeldung. Eine zusätzliche Netzwerk-App wird nicht benötigt.

## 1. DNS und Domain

Beim DNS-Anbieter einen **A-Record** mit Host `@` auf die öffentliche IPv4 des Coolify-Servers setzen. DNS enthält keinen Port. Optional einen CNAME für `www` auf `monopol-ai.de` setzen und diesen Host zusätzlich in Coolify konfigurieren. Ein vorhandener AAAA-Record muss auf die passende erreichbare IPv6 desselben Servers zeigen.

In Coolify die Domain ausschließlich dem Dienst **`web`** zuordnen:

| Einstellung | Wert |
| --- | --- |
| Protokoll | HTTPS |
| Domain | `monopol-ai.de` |
| Interner Port | `3000` |
| Pfad | leer |

Bei einem gemeinsamen URL-Feld lautet der Wert `https://monopol-ai.de:3000`. Besucher verwenden **https://monopol-ai.de** ohne Portangabe. TCP 80 und 443 müssen den Coolify-Proxy erreichen. Die Compose-Datei veröffentlicht keine Host-Ports; der Proxy erreicht `web` über das interne Docker-Netz. API und Datenbank erhalten keine eigene öffentliche Domain.

## 2. Anwendung anlegen

1. **New Resource / Application** wählen und das Repository `mistermonopol/Monopol_MainFrame` über GitHub-App, Deploy Key oder als öffentliches Repository auswählen.
2. Branch **`main`**, Build Pack / Strategy **Docker Compose**, Base Directory **`/`** setzen.
3. Docker Compose Location **`/compose.coolify.yaml`** einstellen; bei einem relativen Eingabefeld `compose.coolify.yaml` verwenden.
4. **Custom Build Command und Custom Start Command vollständig leeren**. Der Dateiname gehört ausschließlich in Docker Compose Location. **Raw Compose aus** lassen. Keine zusätzliche vorgegebene Netzwerkverbindung aktivieren.
5. Speichern, Compose-Datei laden und prüfen, dass `db`, `api` und `web` erscheinen. Die Domain gemäß Abschnitt 1 bei `web` eintragen.

## 3. Umgebungsvariablen

Unter **Environment Variables → Production** diese Werte eintragen und jeweils **Build time und Runtime aktivieren**. Auch `docker compose build` löst die Variablen der gesamten Datei auf; Runtime-only-Werte fehlen in Coolifys `build-time.env`.

| Variable | Wert |
| --- | --- |
| `PUBLIC_URL` | `https://monopol-ai.de` – ohne Port, Pfad oder abschließenden Slash |
| `ADMIN_PASSWORD` | Eigenes Anmeldepasswort mit mindestens 16 Zeichen |
| `POSTGRES_PASSWORD` | Eigenständiges zufälliges Datenbankadministrator-Passwort |
| `APP_DB_PASSWORD` | Eigenständiges zufälliges Passwort für Kerndaten |
| `HEALTH_DB_PASSWORD` | Eigenständiges zufälliges Passwort für Gesundheitsdaten |
| `BACKUP_STACK_ID` | Optional, Standard `everything`; bei mehreren Instanzen eindeutigen Wert je Anwendung setzen |

Für jedes der vier Secrets separat `openssl rand -hex 32` ausführen und die Werte im Passwortmanager speichern. Hexadezimale Datenbankpasswörter benötigen keine zusätzliche URL-Kodierung. `DATABASE_URL`, `HEALTH_DATABASE_URL` und `COOKIE_SECURE` setzt die Compose-Datei selbst. Geheimnisse ausschließlich in Coolify hinterlegen.

Bei vorhandenen Variablen die Build-/Runtime-Einstellungen ausdrücklich speichern. In Coolify-Versionen mit Developer-View-Flags setzt `# coolify: buildtime=true runtime=true` direkt oberhalb einer Variablen beide Optionen. Werte ohne Flags einzufügen kann bestehende Scope-Einstellungen beibehalten. Danach **Deploy/Redeploy**, nicht nur Restart wählen.

Bestehende Datenbankpasswörter und das Datenvolume beim Update beibehalten: Eine Änderung der Umgebungswerte ändert PostgreSQL-Rollenpasswörter nicht automatisch. Alte Anmeldeanbieter-Variablen und `PRIVATE_WEB_PORT` werden nicht mehr benötigt und können aus Coolify entfernt werden.

## 4. Deployen und nutzen

1. **Deploy** wählen. Die Datenbank initialisiert Rollen und Schemas; danach erstellt die API Tabellen und startet. Alle drei Dienste sollen gesund sein.
2. `https://monopol-ai.de/api/v1/healthz` aufrufen. Erwartet: `{"status":"ok"}`.
3. **https://monopol-ai.de** öffnen und mit `ADMIN_PASSWORD` anmelden.
4. In der aktualisierten Android-App unter Einstellungen **https://monopol-ai.de** und dasselbe Passwort verwenden. Eine früher gespeicherte andere Serveradresse einmal ändern. Danach Health-Connect-Leseberechtigungen erteilen und die Synchronisation aktivieren.

Die Anmeldung benötigt kein externes Konto. Passwortänderungen mit anschließendem API-Neustart widerrufen bestehende Sitzungen; danach erneut anmelden.

## 5. Daten, Backups und Updates

- Das benannte Volume `postgres` bleibt bei Redeployments erhalten. Coolify kann dem tatsächlichen Namen eine Ressourcenkennung hinzufügen. Dieselbe Anwendung und dasselbe Volume weiterverwenden.
- `ops/backup.sh` findet den Datenbankcontainer anhand des Labels `BACKUP_STACK_ID`. Bei keinem oder mehreren Treffern bricht das Skript ab.
- Für den Backuptimer die Skripte wie im README unter `/opt/everything` auf dem Host bereitstellen und `age` installieren. In `/etc/everything-backup.env` `AGE_RECIPIENT=age1...` und `BACKUP_STACK_ID=everything` bzw. den abweichenden Coolify-Wert setzen. Die mitgelieferten Systemd-Units aktivieren, einmal manuell prüfen und verschlüsselte Sicherungen zusätzlich auf einen zweiten Host kopieren.
- Eine Wiederherstellung zunächst auf einem separaten Testsystem prüfen: Dump entschlüsseln, in den ausgewählten Datenbankcontainer kopieren und `pg_restore -U postgres -d life --clean --if-exists /tmp/life.dump` ausführen. Währenddessen Web und API stoppen. Danach Dumpdateien entfernen, Sitzungen mit `TRUNCATE core.sessions` widerrufen und die Anwendung starten. Weitere Details stehen im README.
- GitHub Actions prüft API, Web, Android und den vollständigen Docker-Stack. Die Test-APK steht im Android-Job als Artifact bereit. Für dauerhafte App-Updates einen eigenen gesicherten Release-Keystore verwenden.
- Nach Updates Health-Endpunkt, Anmeldung und Datenanzeige prüfen. Die aktuelle Initialmigration erstellt Tabellen idempotent; zukünftige Schemaänderungen benötigen explizite Migrationen.

## Häufige Fehler

| Fehler | Prüfung |
| --- | --- |
| `compose: command not found` | Custom Build Command und Custom Start Command vollständig leeren; Docker Compose als Build Pack wählen |
| `required variable ... is missing` | Alle fünf Pflichtwerte unter Production mit Build time und Runtime setzen, speichern und neu deployen |
| Compose-Datei nicht gefunden | Branch `main`, Base Directory `/`, Compose Location `/compose.coolify.yaml` |
| Datenbank-Passwortauthentifizierung fehlgeschlagen | Coolify-Werte und bereits initialisierte PostgreSQL-Rollen müssen übereinstimmen |
| „Ungültiger Ursprung“ | Browseradresse und `PUBLIC_URL` müssen exakt übereinstimmen: `https://monopol-ai.de` |
| „No available server“ | Domain an `web`, interner Port 3000; Web, API und Datenbank müssen gesund sein |
| Zertifikat oder DNS falsch | A-/AAAA-Records, TCP 80/443 und konfigurierte HTTPS-Domain prüfen |
| „Passwort ist falsch“ | Exakt den Wert von `ADMIN_PASSWORD` verwenden; nach Änderungen neu deployen |
| Zu viele Anmeldeversuche | Eine Minute warten; Web und Android teilen sich die Begrenzung |

Grundlage: [Docker Compose](https://coolify.io/docs/applications/builds/docker-compose), [Umgebungsvariablen](https://coolify.io/docs/applications/configuration/environment-variables) und [Domains](https://coolify.io/docs/core/networking/domains).
