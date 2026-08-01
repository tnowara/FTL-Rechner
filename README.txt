FAI FTL Logbook PWA 1.9.3

Neu:
- Berechnung der Local Days Free im ausgewählten Kalendermonat.
- Sollwert: mindestens 7 Local Days Free pro Kalendermonat.
- Berechnung der Local Days Free im ausgewählten Kalenderjahr.
- Sollwert: mindestens 96 Local Days Free pro Kalenderjahr.
- Fortschrittsanzeigen und Warnfarben für beide Werte.
- Gezählt werden eindeutige Kalendertage, die ausdrücklich als
  „Local Day Free / OFF“ gespeichert sind.
- Der bisherige Hinweis, die Werte seien nicht berechenbar, wurde entfernt.
- Der ausgewählte Statistik-Stichtag bestimmt den ausgewerteten Monat und das Jahr.
- Doppelte OFF-Einträge am selben Datum zählen nur einmal.

Wichtige Abgrenzung:
Die App zählt deklarierte OFF-Tage. Ob ein Local Day Free tatsächlich zwei lokale
Nächte umfasst, kann ohne Beginn- und Endzeit des freien Zeitraums nicht automatisch
verifiziert werden. Urlaub und Krankheit werden nicht automatisch als OFF gezählt.

Grundlage:
FAI-FO-OMA Kapitel 7, Issue 5, Rev. 0, 08.11.2024:
mindestens 7 Local Days Free pro Kalendermonat und mindestens 96 pro Kalenderjahr.

Update:
- app-version.json: 1.9.3
- CURRENT_APP_VERSION: 1.9.3
- Service-Worker-Cache: ftl-logbook-v1.9.3

GitHub Pages:
Alle Dateien dieser Version hochladen und vorhandene Dateien ersetzen.
app-version.json und airports.json müssen im selben Ordner wie index.html liegen.
Danach in der App „Update prüfen“ auswählen.
