# Technische Berichtskataloge

Dieses Verzeichnis enthält ausschließlich neutrale, statische Datenverträge für die fünf technischen Prüfer. Es enthält keine Checklistenbewertung, Projektkonfiguration, Evidence-Verwaltung oder Freigabelogik.

- [`checklist-index.json`](checklist-index.json) indexiert alle 215 stabilen IDs der modularen manuellen Website-QA-Checkliste. Er dient nur zur Referenzvalidierung.
- [`signals.json`](signals.json) registriert technische Signal-IDs, Versionen, erzeugende Werkzeuge, Beschreibungen und informative Checklistenreferenzen.
- [`technical-report.common.schema.json`](technical-report.common.schema.json) beschreibt den gemeinsamen Kern der technischen Berichte mit `schemaVersion: 2`.
- `http-report`, `crawl-report`, `browser-report`, `social-report` und `lighthouse-report` besitzen jeweils ein Schema und ein statisches Beispiel.

Signalstatus bedeuten ausschließlich:

- `positive`: Der konkrete Defekt wurde im dokumentierten Umfang nicht beobachtet.
- `defect`: Der konkrete technische Defekt wurde beobachtet.
- `inconclusive`: Fehler, Sicherheitsblockierung oder Limits verhindern eine eindeutige Beobachtung.
- `notApplicable`: Das technische Signal ist für diesen Lauf nicht anwendbar.

Kein Status hakt einen Checklistenpunkt ab. Eine Checklistenreferenz ist nur ein Hinweis für die anschließende manuelle QA-Arbeit. Änderungen an nicht betroffenen Checklistenformulierungen machen technische Berichte nicht automatisch ungültig; fachlich neu verwendete IDs oder Signalbedeutungen benötigen neue stabile Kennungen beziehungsweise Versionen.

Der Social-Bericht kennzeichnet Crawlerquellen zusätzlich mit `currentOfficial`, `officialContextOnly` oder `historicalRedirect`. Eine begrenzte Quellenbestätigung bleibt sichtbar und führt beim Matrixsignal zu `inconclusive`; der Token wird dadurch weder stillschweigend entfernt noch als aktuell offiziell bestätigt ausgegeben.

Die Beispiele enthalten bewusst keine Roh-Lighthouse-Berichte, Screenshots, Cookie-/Storagewerte oder unredigierte Querywerte.
