FAI FTL Logbook PWA 1.9.5

Neu / korrigiert:
- Split Duty ≥3 h: Die App behandelt die zusammenhängende Dienstzeit jetzt bis
  maximal 18:00 h gemäß OM-A 7.4.9.2. Die bisherige normale FDP-Grenze führte
  fälschlich zu einer unmittelbaren Überschreitungsanzeige.
- Split Duty ≥2 h bleibt gemäß OM-A 7.4.9.1 auf 14:00 h Duty begrenzt und
  verlängert ausdrücklich nicht die zulässige FDP.
- Proceeding / Positioning kann als eigener Kalendereintrag gewählt werden.
  Die eingetragene Dauer wird als Duty berücksichtigt.
- Kalender besitzt UTC/LT-Umschaltung.
- Dienste, die über Mitternacht laufen, erscheinen auf allen betroffenen
  Kalendertagen. Folgetage sind mit ↳ gekennzeichnet.
- LT verwendet am Beginn die Zeitzone des Startflughafens und am Ende die
  Zeitzone des Zielflughafens.
- Die bisher manuelle Checkbox „mehr als 48 Stunden außerhalb Home Base“
  wurde durch eine automatische Bestimmung ersetzt.
- Die automatische Bestimmung nutzt Home-Base-Zeitzone, Flughafenzeitzonen
  und die gespeicherte Duty-Historie. Wenn die Historie nicht ausreicht,
  zeigt die App „nicht sicher bestimmbar“ und verwendet für WOCL vorsorglich
  weiterhin Home-Base-Zeit.

OM-A Grundlage:
7.2 No. 15: WOCL innerhalb von drei Zeitzonen Home-Base-Zeit; außerhalb davon
für die ersten 48 h nach Verlassen der Home-Base-Zeitzone Home-Base-Zeit,
danach lokale Zeit.
7.4.8: Positioning zählt als Duty; Positioning nach Reporting vor Operating
ist Teil der FDP und kein Sektor.
7.4.9.1: Break ≥2 h kann Duty auf 14 h erweitern, nicht die FDP.
7.4.9.2: Break ≥3 h mit Schlafmöglichkeit erlaubt zusammenhängende Duty bis
18 h; Zusatzbedingungen sind zu beachten.

Update:
app-version.json 1.9.5
CURRENT_APP_VERSION 1.9.5
Service Worker Cache ftl-logbook-v1.9.5
