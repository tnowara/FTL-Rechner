FAI FTL Logbook PWA 1.9.6

Neu:
- Kalendertyp „Layover“ ergänzt.
- Layover wird als eigener Kalendereintrag dargestellt und zählt nicht als Duty.
- Bei jeder Duty-Eingabe prüft die App automatisch den unmittelbar vorherigen
  gespeicherten Flugdienst.
- Direkte Überschneidung: Reporting liegt vor dem Dienstende des vorherigen
  Dienstes -> rote Warnung „DIENSTE ÜBERSCHNEIDEN SICH“.
- Ruhezeitkonflikt: Reporting liegt zwar nach Dienstende, aber vor dem aus dem
  vorherigen Datensatz berechneten frühesten Reporting -> rote Warnung
  „MINDESTRUHE UNTERSCHRITTEN“.
- Bei ausreichender Ruhezeit wird die Reserve bis zum neuen Reporting angezeigt.
- Beim Bearbeiten eines bestehenden Datensatzes wird dieser selbst aus der
  Suche nach dem vorherigen Dienst ausgeschlossen.

OM-A Bezug:
7.5.1.1: Mindestruhe vor einer FDP an Home Base mindestens so lang wie die
vorherige Duty oder 12 h, je nachdem was größer ist.
7.5.1.2: Away from Home Base mindestens so lang wie die vorherige Duty oder
10 h, je nachdem was größer ist.
Die App verwendet für die Kollisionsprüfung den bereits für den vorherigen
Datensatz berechneten Wert „earliestNextReport“, sodass auch dort angewandte
Zeitzonen- und Sonderregeln berücksichtigt bleiben.

Update:
app-version.json 1.9.6
CURRENT_APP_VERSION 1.9.6
Service Worker Cache ftl-logbook-v1.9.6
