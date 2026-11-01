# Lokale Lampensteuerung über die Docker-Bridge (0.8)

Monopol_MainFrame läuft auf dem externen Coolify-Server. Die zusätzliche Bridge läuft auf einem dauerhaft eingeschalteten Docker-Rechner **im Heimnetz**, der Home Assistant erreichen kann. Sie verbindet sich ausgehend per HTTPS mit MainFrame. Es werden keine Router-Ports geöffnet, kein Tailscale und keine zusätzliche öffentliche Home-Assistant-Domain benötigt.

## 1. MainFrame aktualisieren

`main` in Coolify redeployen und für die native App Android **0.8.0** installieren. Das bestehende Compose-Projekt und seine Volumes erhalten. Für den externen Server sind keine neuen Umgebungsvariablen erforderlich. Nach Anmeldung gibt es den Tab **Smart Home** und unter **Settings** die **Home Assistant bridge**.

## 2. Zwei verschiedene Tokens anlegen

- In Home Assistant im eigenen Profil unter **Security / Sicherheit** ein **Long-lived access token** erstellen. Das verwendete Konto benötigt Zugriff auf die Lampen. Dieses HA-Token bleibt ausschließlich auf dem lokalen Bridge-Rechner.
- In MainFrame unter **Settings → Home Assistant bridge → Generate / replace bridge token** ein Bridge-Token erzeugen und sofort kopieren. Der Server speichert nur dessen Hash; die Oberfläche zeigt es nur während dieser Settings-Sitzung an. Ein Ersetzen trennt die bisherige Bridge und verwirft noch nicht abgeholte Befehle. Bereits abgeholte oder laufende Aktionen lassen sich nicht zuverlässig zurückrufen und werden gegebenenfalls als unklar markiert. Nach dem Ersetzen auch die lokale Secret-Datei aktualisieren und den Bridge-Container neu starten.

Keine Tokens im Chat, in Git, als URL-Parameter oder in Screenshots veröffentlichen. Das Bridge-Token ersetzt weder das App-Passwort noch das Home-Assistant-Token.

## 3. Dateien auf dem Rechner im Heimnetz vorbereiten

Repository klonen bzw. aktualisieren. `.env.bridge.example` nach `.env.bridge` kopieren und dort eintragen:

```dotenv
MAINFRAME_URL=https://monopol-ai.de
HA_URL=http://192.168.178.10:8123
MAINFRAME_BRIDGE_TOKEN_PATH=./secrets/mainframe_bridge_token
HA_TOKEN_PATH=./secrets/ha_token
```

**Die IP ist ein Beispiel.** Für `HA_URL` die tatsächliche lokale IP und den konfigurierten Port von Home Assistant verwenden, ohne `/api`. `localhost` im Bridge-Container bezeichnet den Bridge-Container selbst. Der Default-Docker-Netzwerkzugang muss diese LAN-IP erreichen können. Eine nur an `127.0.0.1` eines anderen Rechners gebundene HA-Instanz ist so nicht erreichbar.

Die Dateien `secrets/ha_token` und `secrets/mainframe_bridge_token` anlegen, jeweils nur mit dem entsprechenden Token als Inhalt. `.env.bridge` und `secrets/` werden von Git ignoriert; Secrets sind außerdem aus dem Docker-Build-Kontext ausgeschlossen. Keine Tokens in die Compose-Datei schreiben.

Auf Linux laufen die Bridge-Prozesse als UID/GID **10001**. Die Secret-Dateien müssen für diese UID lesbar sein. Nach dem lokalen Erstellen beispielsweise:

```bash
sudo chown 10001:10001 secrets/ha_token secrets/mainframe_bridge_token
sudo chmod 0400 secrets/ha_token secrets/mainframe_bridge_token
```

Unter Docker Desktop die Dateien in einem freigegebenen Ordner ablegen und sicherstellen, dass Docker sie lesen kann. Falls die Dateiberechtigungen dort anders abgebildet werden, keine pauschalen öffentlichen Schreibrechte vergeben. Die Compose-Datei bindet beide Dateien nur lesbar ein.

## 4. Bridge lokal starten

Im Repository-Verzeichnis auf dem **Heimnetz-Rechner**:

```bash
docker compose --env-file .env.bridge -f compose.bridge.yaml up --build -d
docker compose --env-file .env.bridge -f compose.bridge.yaml logs --tail=50 home-bridge
```

Das Projekt heißt `mainframe-home-bridge` und öffnet keine eingehenden Ports. Die Bridge benötigt ausgehendes HTTPS zu MainFrame und lokalen HTTP-/HTTPS-Zugriff auf Home Assistant. Die lokale HA-Adresse darf HTTP verwenden; zur Cloud ist HTTPS mit normaler Zertifikatsprüfung Pflicht. Weiterleitungen werden nicht verfolgt. Der Container hat ein schreibgeschütztes Dateisystem, keine zusätzlichen Linux-Capabilities und keinen Zugriff auf den Docker-Socket.

Nach wenigen Sekunden soll **Smart Home → Connected** erscheinen. Alle vom HA-Konto lesbaren `light.*`-Entitäten einschließlich neu hinzugefügter Lampen werden übernommen. Sensoren, Schlösser, Kameras und andere Zustände werden lokal herausgefiltert. Unterstützt werden An/Aus, Helligkeit, RGB-Farbe und Farbtemperatur innerhalb der von der Lampe gemeldeten Grenzen. Andere Home-Assistant-Domains, Szenen, Effekte und Automatisierungen sind keine Bridge-Aktionen.

## 5. Bedienung und Agent

Im Smart-Home-Tab eine Lampe suchen und bedienen. Gleiche Namen lassen sich über ihre Entity-ID unterscheiden. Dimmer und Farbtemperatur senden beim Loslassen des Reglers, nicht bei jedem Zwischenschritt. RGB-Farbe wird mit **Apply color** gesendet. Helligkeit null bedeutet aus; eine positive Helligkeit oder eine Farbe kann eine ausgeschaltete Lampe einschalten. Nicht unterstützte Regler werden nicht angeboten.

Beispiele für den Agenten:

- „Welche Lampen sind gerade an?“
- „Schalte die Studiolampe aus.“
- „Setze `light.studio` auf 40 Prozent.“
- „Stelle das Wohnzimmerlicht auf 3000 Kelvin.“

Der Agent listet zuerst tatsächliche Lampen und Fähigkeiten und soll bei mehrdeutigen Namen nachfragen. Die einzige physische Aktion ist die Steuerung bekannter `light.*`-IDs. Tokens gelangen weder in den Agentenkontext noch ins Brain. Die Aktionsliste meldet **Light command accepted**, sobald Home Assistant den Aufruf angenommen hat. Das ist kein unabhängiger Nachweis des physischen Lampenzustands: angezeigt wird der zuletzt von Home Assistant gemeldete Zustand.

## Verbindung und Fehlerfälle

- Die Bridge meldet Zustände ungefähr alle fünf Sekunden. Web und Android aktualisieren beim geöffneten Smart-Home-Tab ebenfalls alle fünf Sekunden; Android pausiert das Polling im Hintergrund.
- Nach 20 Sekunden ohne Bericht gilt die Bridge als offline. Bei bekannter Offline-Verbindung wird kein Befehl angelegt. Innerhalb des kurzen Erkennungsfensters kann ein Auftrag noch als ausstehend erscheinen, verfällt aber spätestens nach 15 Sekunden.
- Ein abgeholter Befehl wird nicht automatisch erneut zugestellt. Nicht abgeholte abgelaufene Aufträge werden verworfen. Bei verlorenem Ergebnis oder einem Timeout während des lokalen Schaltaufrufs erscheint **Result unknown**. Den aktuellen Zustand prüfen, bevor man manuell erneut schaltet.
- Home-Assistant-Fehler 401/403: lokales HA-Token und Kontoberechtigungen prüfen. Cloud-Verbindung nach Tokenwechsel: Secret-Datei aktualisieren und Bridge neu starten. DNS-/Netzwerkfehler: beide Basisadressen, LAN-Routing und ausgehendes HTTPS prüfen. Tokens oder Rohantworten werden nicht geloggt.
- Maximale Snapshotgröße: 2.000 Lampen; maximal 100 Ziele pro Befehl. Schaltbefehle bleiben sieben Tage in der Core-Datenbank. Die vorhandene Installation ist auf einen API-Prozess ausgelegt; vor mehreren API-Replikaten die Befehlsabholung auf einen gemeinsamen verteilten Lock/Queue umstellen.

## Nach Installation testen

Eine echte Lampe direkt an- und ausschalten, dimmen und unterstützte Farben/Temperaturen ändern. Dasselbe über den Agenten durchführen. Anschließend den Bridge-Container stoppen, auf Offline warten und prüfen, dass die App keine Befehle vormerkt. Nach Wiederstart darf kein alter Befehl ausgeführt werden. Eine Änderung in der Home-Assistant-Oberfläche soll nach wenigen Sekunden in MainFrame sichtbar sein. Die lokalen Tests simulieren HA und Cloud; dein echtes Heimnetz und die Hardware müssen so zusätzlich geprüft werden.

Referenzen: [Home Assistant REST API und Authentifizierung](https://contributors.home-assistant.io/core/internals/rest-api/), [Light-Funktionen](https://www.home-assistant.io/integrations/light/).
