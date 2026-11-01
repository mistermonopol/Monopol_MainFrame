# Layouts und Farbwelten (0.6)

Layout und Palette sind voneinander unabhängige Einstellungen: vier Seitenarchitekturen × vier Farbwelten = 16 Kombinationen. Unter **Settings → Appearance** zuerst eine Layout-Karte und danach die Palette wählen. Die Auswahl bleibt pro Browser bzw. Android-Gerät gespeichert. Ein Layoutwechsel verändert keine App-Daten. Bestehende Farbpräferenzen bleiben erhalten; das erste Layout ist **Index**.

| Layout | Aufbau und Arbeitsschwerpunkt |
| --- | --- |
| Index | Nummerierte Seitennavigation, große Typografie, Aufgabenanzahl als Titelmotiv, geteilte Kapitel für Tagesplan und Release. Aufgaben als Register, Musik als zweispaltiger Katalog. |
| Studio | Schmale Werkzeugleiste, großes aktives Musikprojekt, versetzte Projektflächen und eine separate Fläche für den Agenten. Aufgaben in Offen-/Erledigt-Spalten. Mobil Schnellnavigation am unteren Rand. |
| Control | Kompakte Navigation und Kennzahlen, mehrere Datenbereiche im Raster, auf breiten Displays ein zusätzlicher Inspektor mit tatsächlichen App-Zahlen. Musik als kompakte Liste, dichtes Aufgabenregister. |
| Focus | Zentrierter Arbeitsbereich mit Tagesdatum, Aufgabenfortschritt und vertikalem Tagesablauf. Musik als schmale Liste, Agent als Gesprächsansicht und Vault in einer Spalte. Mobil Schnellnavigation am unteren Rand. |

Alle Layouts verwenden dieselben Daten, CRUD-Aktionen, Schritte-Diagramme und Integrationen. Der Inspektor zeigt den zuletzt geladenen App-Bestand und aktualisiert sich beim Neuladen; kein Hintergrund-Livestream. Fehlende Gesundheitsmessungen bleiben fehlende Werte. Release-Monogramme stammen aus dem Projekttitel; sie sind keine importierten Cover.

Die Paletten **Violet**, **Paper**, **Amber** und **Cyan** verändern Farben, nicht Navigation oder Seitenaufbau. Scharfe Ecken, Monospace-Schrift und Englisch/Deutsch bleiben erhalten. Die native Android-App verwendet auf großen Displays entsprechende Aufteilungen; Gerätestests auf dem Pixel sind zusätzlich sinnvoll.

## Gestaltung

Die vom Besitzer genannte [Dribbble-Sammlung für Mobile Apps](https://dribbble.com/search/mobile-app) wurde als visuelle Referenz genutzt. Besonders die klare Zahlenhierarchie im [Banking-Entwurf von Conceptzilla](https://dribbble.com/shots/26558717-Banking-Mobile-App-Design) und die kompakte inhaltsbezogene Navigation in [The Cafe von Swanis](https://dribbble.com/shots/26362578-MobileApp-The-Cafe) waren Ausgangspunkte für eigene Kompositionen. Keine Referenzbilder, Fremdlogos oder UI-Assets wurden in die Anwendung übernommen. Alle Oberflächen werden direkt mit CSS/React bzw. Compose dargestellt.

## Spotify

Im Tab **Music** steht `https://vault.monopol-ai.de/spotify` als eingebettetes Dashboard vor den eigenen Projekten. Die Web-Version verwendet einen iframe mit Neuladen, vergrößerter Ansicht und direktem Link. Android verwendet eine eingebettete HTTPS-WebView ohne JavaScript-Brücke oder Zugriff auf lokale App-Dateien. Zugangsdaten der MainFrame-App werden nicht an den Vault weitergereicht. Eine gegebenenfalls erforderliche Vault-Anmeldung erfolgt im externen Dienst.

Der fremde Seiteninhalt behält sein eigenes Layout und seine eigene Farbwahl; MainFrame kann ihn aufgrund der getrennten Herkunft nicht umgestalten. Das Dashboard wurde ohne persönliche Anmeldung auf Einbettungsfehler geprüft. Falls der Dienst später das Einbetten oder der Browser Cookies blockiert, den Link **Open externally** verwenden. Dafür ist keine zusätzliche MainFrame-Umgebungsvariable erforderlich.
