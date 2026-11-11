FTL Logbook PWA 1.9.7

- Blockzeiten für jeden operativen Sektor separat als HH:MM-Textfeld.
- Automatische Summe; Speicherung in blockLegs und blockMinutes.
- Bestehende Datensätze mit nur einer Gesamtsumme werden beim Bearbeiten
  mit der bisherigen Summe im ersten Leg vorbelegt; bitte Leg-Aufteilung prüfen.
- Commander's Discretion: künstliche Duty-Grenze FDP + 15 Minuten entfernt.
  FDP bleibt limitierend für die Discretion-Prüfung; Duty weiterhin für Ruhezeit.
  Andere eigenständige Duty-Limits müssen gesondert geprüft werden.
- Discretion darf nicht als vorab planbare FDP-Verlängerung benutzt werden.
- Versions- und Offline-Cache auf 1.9.7 erhöht.

Version 1.9.8: Blockzeiten je Leg werden dauerhaft sichtbar außerhalb „Weitere Angaben“ dargestellt.
\nVersion 1.9.9: Blockzeitfelder verwenden auf Mobilgeräten den Nummernblock. 130 wird bei Verlassen des Felds zu 1:30, 45 zu 0:45. Die Summierung erfolgt sofort.\n
Version 1.9.10: Wiederholte falsche Update-Hinweise behoben. Wartender Service Worker wird nicht mehr ohne höhere Versionsnummer als neues Update angezeigt. Offline-Cache-Erkennung aktualisiert.

Version 1.9.11: Fehlerhafte Regex-Escapes bei Blockzeiten korrigiert; 130 → 1:30 funktioniert. Während der Eingabe keine Fehlermeldung. iPad-Tastatur via inputmode=decimal angefordert (OS bestimmt tatsächliches Layout).\n
Version 1.9.12: Positioning vor operativem Flug entfernt. Positioning nach ON-Block als unabhängige Checkbox mit Minutenfeld (nicht mehr im Sonderregelungs-Dropdown). Alte Datensätze mit post_positioning werden beim Bearbeiten in die neuen Felder übernommen.

Version 1.9.13: Fix für wiederkehrende Update-Anzeige. HTML referenziert versionierte JS/CSS URLs; SW lädt Programmdateien network-first; Update-Knopf führt erzwungene Navigation aus. Lokale Daten bleiben unverändert.

1.9.14: Eigener Nummernblock für Leg-Blockzeiten (Ziffern, Löschen, Nächstes Leg, Fertig); Systemtastatur deaktiviert.

Version 1.9.15: Positioning nach ON-Block (Checkbox + Minuten) entfernt. Duty-Ende wird ausschließlich aus separat eingegebenem Datum/Uhrzeit bestimmt; keine zusätzliche Addition. Bestehende Datensätze behalten ihre eingegebenen Duty-Ende-Felder.

1.9.16: Weitere Angaben (Abwesenheit Home-Base-Zeitzone und Notiz) dauerhaft sichtbar statt aufklappbarem Menü.
