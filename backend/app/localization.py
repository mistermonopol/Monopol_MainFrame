MESSAGES = {
    "Bitte anmelden": "Please sign in",
    "Ungültiger Ursprung": "Invalid request origin",
    "Passwort ist falsch": "Incorrect password",
    "Zu viele Anmeldeversuche. Bitte in einer Minute erneut versuchen.": "Too many sign-in attempts. Please try again in one minute.",
    "Eintrag wurde geändert. Bitte neu laden.": "This item has changed. Please reload.",
    "Eintrag fehlt": "Item not found",
    "Unbekannter Bereich": "Unknown section",
    "Beginn und Ende fehlen": "Start and end are required",
    "Doppelte Tage": "Duplicate dates",
    "Nur die letzten 30 Tage sind zulässig": "Only the last 30 days are allowed",
}

MESSAGES.update({
    "OpenAI benötigt einen HTTPS-API-Endpunkt.": "OpenAI requires an HTTPS API endpoint.",
    "AI_API_KEY fehlt. Beim API-Dienst in Coolify setzen und neu deployen.": "AI_API_KEY is missing. Set it for the API service in Coolify and redeploy.",
    "Der KI-Anbieter lehnt den API-Schlüssel ab (HTTP 401). AI_API_KEY in Coolify prüfen und neu deployen.": "AI provider rejected the API key (HTTP 401). Check AI_API_KEY in Coolify and redeploy.",
    "Der KI-Anbieter verweigert den Zugriff (HTTP 403). Projektberechtigungen und Modellzugriff prüfen.": "AI provider denied access (HTTP 403). Check project permissions and model access.",
    "Das KI-Modell wurde nicht gefunden oder ist für diesen API-Schlüssel nicht verfügbar. AI_MODEL und Projektzugriff prüfen.": "AI model was not found or is unavailable to this API key. Check AI_MODEL and project access.",
    "KI-Endpunkt oder Modell nicht gefunden (HTTP 404). AI_BASE_URL und AI_MODEL prüfen.": "AI endpoint or model was not found (HTTP 404). Check AI_BASE_URL and AI_MODEL.",
    "API-Kontingent ausgeschöpft (HTTP 429). Abrechnung, Guthaben und Nutzungslimits des API-Projekts prüfen.": "AI API quota is exhausted (HTTP 429). Check the API project's billing, credits and usage limits.",
    "Anfragelimit des KI-Anbieters erreicht (HTTP 429). Kurz warten und erneut versuchen.": "AI provider rate limit reached (HTTP 429). Wait briefly and retry.",
    "Kontextlimit des KI-Modells überschritten. Neuen Chat starten oder ein Modell mit größerem Kontextfenster verwenden.": "AI model context limit exceeded. Start a new chat or use a model with a larger context window.",
    "Der KI-Anbieter lehnt Anfrageparameter ab (HTTP 400/422). Das Modell muss Chat Completions und für Vault-Zugriff Tool-Aufrufe unterstützen.": "AI provider rejected the request parameters (HTTP 400/422). The model must support Chat Completions and, for vault access, tool calling.",
    "Der KI-Anbieter ist vorübergehend nicht verfügbar (HTTP 5xx). Später erneut versuchen.": "AI provider is temporarily unavailable (HTTP 5xx). Please retry later.",
    "Unerwarteter HTTP-Status vom KI-Anbieter. Endpunkt und Anbieterdienst prüfen.": "AI provider returned an unexpected HTTP status. Check the endpoint and provider service.",
    "Das KI-Modell hat sein Ausgabelimit ohne sichtbare Antwort erreicht. Eine kürzere Frage oder ein Modell ohne Reasoning versuchen.": "AI model reached its output limit before producing an answer. Try a shorter question or a non-reasoning model.",
    "Der KI-Anbieter lieferte keine Antwort. Chat-Completions-Unterstützung des Modells prüfen.": "AI provider returned no answer. Check the model's Chat Completions support.",
    "Ungültige Chat-Completions-Antwort vom KI-Anbieter. Kompatibilität von Endpunkt und Modell prüfen.": "AI provider returned an invalid Chat Completions response. Check the endpoint and model compatibility.",
    "Zeitüberschreitung beim KI-Anbieter. Erneut versuchen oder ein schnelleres Modell verwenden.": "AI provider timed out. Please retry or use a faster model.",
    "KI-Anbieter nicht erreichbar. DNS, Internetverbindung des Servers und AI_BASE_URL prüfen.": "Cannot reach the AI provider. Check the server's DNS, internet connection and AI_BASE_URL.",
})
MESSAGES.update({
    'Die Home-Assistant-Bridge ist offline. Es wurde kein Befehl vorgemerkt.':'Home Assistant bridge is offline. No command was queued.',
    'Eine ausgewählte Lampe ist unbekannt oder nicht verfügbar.':'A selected light is unknown or unavailable.',
    'Eine ausgewählte Lampe unterstützt kein Dimmen.':'A selected light does not support dimming.',
    'Eine ausgewählte Lampe unterstützt keine Lichtfarbe.':'A selected light does not support color.',
    'Eine ausgewählte Lampe unterstützt keine Farbtemperatur.':'A selected light does not support color temperature.',
    'Die Farbtemperatur liegt außerhalb des unterstützten Bereichs.':'Color temperature is outside the supported range.',
    'Diese Anfrage-ID wurde bereits für einen anderen Lichtbefehl verwendet.':'Request ID already used for another light command.',
    'Lichtbefehl nicht gefunden.':'Light command not found.',
})
GERMAN_MESSAGES = {en: de for de, en in MESSAGES.items()}
