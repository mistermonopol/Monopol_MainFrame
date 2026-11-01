# mono_frame_brain, Agent und Aufgaben-Erinnerungen (0.7)

## Nach dem Update

1. `main` in Coolify neu deployen. Das bestehende Datenbank- und Obsidian-Volume erhalten. Keine neue API oder externe Automatisierung ist erforderlich. Die bestehende KI-Konfiguration bleibt gültig; das Modell muss jetzt auch für Aufgabenänderungen Tool Calling unterstützen.
2. Der Vault bleibt am vorhandenen `OBSIDIAN_VAULT_PATH` (Compose: `/vault`). Sein angezeigter Name ist `mono_frame_brain`, konfigurierbar über `OBSIDIAN_VAULT_NAME`. Einen vorhandenen PC-Vault weiterhin über einen Serverordner/Dateisync einbinden, z. B. `/srv/mono_frame_brain:/vault`. Es wird kein lokaler PC-Vault automatisch hochgeladen oder ersetzt.
3. Android-Version **0.7.0** installieren. Im Web unter **Settings → Task reminders → Enable notifications** die Browserfreigabe erteilen. Auf Android die entsprechende Schaltfläche verwenden und die Systemberechtigung erlauben. Aktivierung erfolgt separat pro Gerät.

## Agent und Brain

Der Agent liest gespeicherte Aufgaben, Musikprojekte, bisherige Notizen/Termine, Gesundheitswerte und den angebundenen Vault. Werkzeuge können Aufgaben, Musikprojekte, bisherige Notizen/Termine und Markdown-Dateien **auf Aufforderung anlegen und ändern**. Geänderte Aufgaben werden auch im Dashboard neu geladen. Gesundheitsmessungen bleiben schreibgeschützt. Nicht verbundene Dienste, Spotify-iframe-Inhalte, Zahlungen, Server-Dateien außerhalb des Vaults, Shell und Zugangsschlüssel sind keine Agentenwerkzeuge. Es gibt keinen Lösch-Befehl für den Agenten.

Bei einem verfügbaren beschreibbaren Vault legt die API beim Start `AI_Brain.md`, `Inbox.md`, `Tasks.md` und `Music.md` an, sofern sie fehlen. Bestehende Dateien werden nicht überschrieben. Diese Notizen sind über Wiki-Links verbunden. `AI_Brain.md` und eine vorhandene `Memory.md` liefern zusätzliches Wissen im Agentenkontext; weitere Notizen kann er nachlesen. Zum dauerhaften Merken beispielsweise schreiben: „Merke dir in meinem Brain: …“. Der aktuelle Aufgabenstatus bleibt in der App-Datenbank; `Tasks.md` enthält ergänzendes Wissen und wird nicht als zweite Aufgabenliste automatisch synchronisiert.

App-Daten, Gehirnnotizen und gelesene Markdown-Inhalte werden beim Chat an den konfigurierten KI-Anbieter geschickt. Notizinhalt wird als Wissen behandelt, nicht als privilegierte Anweisung. Änderungen verwenden die vorhandenen Versionsprüfungen. Erfolgreiche Aktionen sind im Chat und unter **Saved agent actions** sichtbar, auch wenn die abschließende KI-Antwort fehlschlägt. Nicht blind erneut dieselbe Erstellungsanweisung senden, bevor der Aktionsstand geprüft wurde.

Ein Client sendet eine UUID als `request_id`. Ein identischer wiederholter Request derselben Sitzung wird aus dem gespeicherten Ergebnis beantwortet. Eine unterbrochene Anfrage wird mit derselben ID nicht erneut ausgeführt. Nur ein Agentenlauf arbeitet gleichzeitig. Teilweise erfolgreiche Änderungen bleiben gespeichert. Für jede erfolgreiche Schreiboperation wird ein früherer und neuer Stand gespeichert, 30 Tage lang abrufbar über den authentifizierten Endpunkt `/api/v1/agent/revisions/{revision_id}`; die ID steht in den Aktionsdaten. Die App bietet aktuell keinen automatischen Undo-Knopf. Request-Ergebnisse/Aktionsübersichten werden nach 24 Stunden bereinigt; normale Brain-Notizen bleiben dauerhaft erhalten. Diese technischen Verlaufsdaten liegen in der geschützten Core-Datenbank und damit auch in deren Backups.

## Graph

Im Obsidian-Tab zeigt der Graph echte Verbindungen aus `[[Wiki-Links]]`, Alias-/Abschnittslinks und Markdown-Links zu `.md`-Dateien. Relative Links werden aufgelöst; Codeblöcke, externe URLs und Bilder erzeugen keine falschen Notizkanten. Mehrdeutige oder fehlende Ziele werden als nicht aufgelöst gezählt. Der Graph enthält keine automatisch erfundenen Beziehungen.

Web: Suche, Beschriftungen, Zoom, Auswahl von Knoten und Öffnen der zugehörigen Notiz. Android: quadratische Knoten mit Verbindungen, Zoom und Antippen zum Öffnen. Der vorhandene Notizeditor bleibt darunter verfügbar. Grenzen: 2.000 indexierte Dateien, 300 sichtbare Graphknoten, 1.500 Kanten und 5 Millionen gelesene Zeichen je Graphanfrage. Begrenzungen und nicht lesbare Notizen werden angezeigt. Die Verbindungszahlen beziehen sich auf den sichtbaren Ausschnitt.

## Aufgaben-Erinnerungen

Aufgaben speichern `reminders_enabled` und optional `remind_at` als ISO-Zeitstempel mit Zeitzone. Ohne eigenen Zeitpunkt wird das Fälligkeitsdatum um **09:00 Uhr Europe/Berlin** verwendet, einschließlich Sommer-/Winterzeit. Im Web wird eine selbst gewählte Uhrzeit in der lokalen Gerätezeitzone eingegeben und als absoluter Zeitstempel gespeichert; Android beschriftet die Eingabe ausdrücklich mit Europe/Berlin. Aufgaben ohne Datum/Erinnerungszeit, deaktivierte Erinnerungen und erledigte Aufgaben lösen keine Erinnerung aus. Es gibt kein KI-Modell im Zustellweg: Benachrichtigungen funktionieren auch ohne KI-API.

**Web:** Ein Serverjob prüft etwa jede Minute. Browser-Push verwendet einen Service Worker und verschlüsselte Web-Push-Payloads. VAPID-Schlüssel werden einmalig serverseitig erzeugt und in der Core-Datenbank gespeichert; nur der öffentliche Schlüssel gelangt zum Browser. Keine zusätzlichen Coolify-Secrets erforderlich. HTTPS und Browserfreigabe sind notwendig. Chrome/Chromium, Firefox, Apple-Web-Push und Windows-Push-Endpunkte werden unterstützt. Browser/OS müssen Hintergrund-Push erlauben; ein vollständig beendeter oder eingeschränkter Browser kann die Zustellung verzögern. Titel fälliger Aufgaben sind Bestandteil der Benachrichtigung und können auf dem Desktop erscheinen. Push-Endpunkte und Schlüssel werden nicht an die KI gegeben.

**Android:** WorkManager ruft die fälligen Erinnerungen bei Aktivierung und danach ungefähr alle 15 Minuten ab. Der API-Aufruf prüft den aktuellen Aufgabenstatus, sodass zwischenzeitlich erledigte Aufgaben nicht aus einem alten lokalen Cache erinnert werden. Die Systemberechtigung und der Benachrichtigungskanal müssen aktiv sein. Doze/Energiesparen, fehlendes Netz, Force Stop oder eine abgelaufene siebentägige Anmeldung können die Zustellung verzögern/verhindern. Dies ist keine minutengenaue Alarmfunktion. Nach erneuter Anmeldung wird der Abruf fortgesetzt.

Erinnerungen der letzten 24 Stunden können nach Verbindungsunterbrechung nachgeholt werden. Pro Aufgabe und Erinnerungszeit wird je Browser-Abonnement bzw. Android-Gerät dedupliziert; eine verschobene Erinnerungszeit kann eine neue Nachricht erzeugen. Web-Zustellmarker bleiben sieben Tage gespeichert. Ungültige/abgelaufene Browser-Abonnements (404/410) werden entfernt. Der Serverbetrieb ist auf den vorhandenen einzelnen API-Prozess ausgelegt; vor horizontaler Skalierung einen gemeinsamen Job-/Ausführungsspeicher ergänzen.

## Prüfen nach Deployment

Eine Aufgabe mit einer Erinnerungszeit wenige Minuten in der Zukunft erstellen, Benachrichtigungen aktivieren und die tatsächliche Zustellung am PC und Pixel kontrollieren. Danach die Aufgabe erledigen und prüfen, dass keine neue Erinnerung entsteht. Im Agenten eine Testaufgabe und eine Testnotiz anlegen lassen, Aktionsliste sowie gespeicherte Inhalte kontrollieren. Im Obsidian-Tab eine Notiz mit `[[Music]]` verlinken und die neue Graphkante nach dem Speichern prüfen. Echte Geräte-Zustellung und persönliche Anbieterzugriffe sind durch lokale Tests nicht vollständig nachgewiesen.

Technische Referenzen: [OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling), [Web Push](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe), [pywebpush](https://github.com/web-push-libs/pywebpush), [Android-Benachrichtigungsfreigabe](https://developer.android.com/develop/ui/compose/notifications/notification-permission).
