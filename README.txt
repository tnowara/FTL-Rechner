FAI FTL Logbook PWA 1.9.2

Änderung gegenüber Version 1.9.1:
- Die fünf Hauptschaltflächen bleiben dauerhaft sichtbar.
- Auf iPhone und iPad wird die Navigation als feste Leiste am unteren Bildschirmrand angezeigt.
- Safe-Area-Abstände für Geräte mit Home-Indikator werden berücksichtigt.
- Auf größeren Displays bleibt die Navigation oben angeheftet.
- Der Seiteninhalt erhält zusätzlichen Abstand, damit keine Inhalte von der Navigation verdeckt werden.
- Bestehende Daten bleiben unverändert erhalten.

Geräteübergreifende Synchronisation:
Die aktuelle App speichert Daten lokal im Browser (localStorage). Diese Daten werden
nicht automatisch zwischen iPhone und iPad synchronisiert. Für eine echte Synchronisation
ist ein Cloud-Speicher oder Backend erforderlich, z. B. Supabase, Firebase oder ein eigener
kleiner Server mit Benutzeranmeldung.

Update:
- app-version.json: 1.9.2
- CURRENT_APP_VERSION: 1.9.2
- Service-Worker-Cache: ftl-logbook-v1.9.2

GitHub Pages:
Alle Dateien dieser Version hochladen und vorhandene Dateien ersetzen.
app-version.json und airports.json müssen im selben Ordner wie index.html liegen.
Danach in der App „Update prüfen“ auswählen.
