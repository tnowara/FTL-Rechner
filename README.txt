FAI FTL Logbook PWA 1.9.4

Fehlerbehebung Offline-Modus:
- Alle Cache-Adressen werden jetzt aus dem tatsächlichen GitHub-Pages-Scope
  gebildet. Dadurch funktionieren Repository-Unterordner zuverlässig.
- index.html wird mit vollständigem Scope-Pfad als Offline-Fallback verwendet.
- Die große airports.json und app-version.json werden einzeln gecacht.
  Ein einzelner Downloadfehler verhindert nicht mehr die Installation des
  gesamten Service Workers.
- Die App-Shell wird zwingend vorinstalliert:
  index.html, app.js, styles.css, Manifest und Icon.
- Navigation verwendet online „network first“ und offline automatisch den Cache.
- Statische Dateien verwenden „cache first“.
- Der neue Service Worker übernimmt sofort mit skipWaiting und clients.claim.
- Eine Statusmeldung zeigt an, wenn die App offline arbeitet.

Erster Offline-Test:
1. Version 1.9.4 vollständig bei GitHub hochladen.
2. App online öffnen.
3. Auf „Update prüfen“ und anschließend „Update installieren“ tippen.
4. Die App danach einmal online vollständig öffnen und etwa 10 Sekunden warten.
5. App schließen.
6. Flugmodus aktivieren und die installierte App erneut öffnen.

Wichtig:
airports.json und app-version.json müssen im gleichen Verzeichnis wie index.html
liegen. Bereits gespeicherte Datensätze bleiben erhalten.
