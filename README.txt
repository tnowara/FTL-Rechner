FAI FTL Logbook PWA 1.9.0

Neu:
- Update-Button im Kopfbereich der App.
- Online-Prüfung über app-version.json.
- Anzeige, ob die installierte Version aktuell ist.
- Neue Versionen werden über den Service Worker heruntergeladen.
- Ein geladenes Update kann mit „Update installieren“ aktiviert werden.
- Die App lädt nach Aktivierung des neuen Service Workers automatisch neu.
- app-version.json wird bewusst ohne Browser-Cache abgefragt.
- Bestehende Daten und Backups bleiben unverändert erhalten.

Wichtig für zukünftige Updates:
1. In app-version.json die appVersion erhöhen.
2. In index.html die sichtbare Versionsnummer anpassen.
3. In app.js CURRENT_APP_VERSION anpassen.
4. In service-worker.js den CACHE-Namen erhöhen.
5. Alle geänderten Dateien auf GitHub hochladen.

GitHub Pages:
Alle Dateien dieser Version hochladen und vorhandene Dateien ersetzen.
app-version.json und airports.json müssen im selben Ordner wie index.html liegen.
Danach die Seite einmal vollständig neu laden.
