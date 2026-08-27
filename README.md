# website-qa

Wiederverwendbare, ausschließlich lesende Qualitätsprüfungen für öffentliche Websites. Die Werkzeuge sind nicht an ein bestimmtes Framework, Projekt oder eine feste Seitenstruktur gebunden.

## Voraussetzungen

- Node.js `>=22.19 <23`
- für den Browser-Check ein lokal installiertes Chromium oder Google Chrome
- Netzwerkzugriff auf die ausdrücklich gewählte öffentliche Ziel-URL

Ein Zielrepository oder lokaler Dev-Server ist für URL-Prüfungen nicht erforderlich. Lokale beziehungsweise private Ziele sind standardmäßig gesperrt und benötigen ausdrücklich `--allow-http` und `--allow-private`.

## Installation

Bis zu einer möglichen Veröffentlichung in der npm-Registry wird das Paket auf einen geprüften Git-Tag oder unveränderlichen Commit festgelegt:

```bash
npm install --save-dev 'github:mktcode/website-qa#<TAG-ODER-COMMIT>'
```

Die tatsächlich installierte Version lässt sich über jeden `--help`-Aufruf und in den JSON-Berichten nachvollziehen.

## Technischer Schnellstart

Jeder Prüfer ist unabhängig aufrufbar:

```bash
website-qa-http https://example.com/ --strict
website-qa-crawl https://example.com/ --sitemap --max-pages=50 --strict
website-qa-browser https://example.com/ --sitemap --max-pages=10 --strict
website-qa-social https://example.com/ --sitemap --max-pages=20 --strict
```

Es gibt bewusst keinen allgemeinen Sammelbefehl. Ein Projekt entscheidet selbst, welche Prüfungen zu seinem Umfang gehören.

Alle Befehle unterstützen `--help`, menschenlesbare Ausgabe und JSON:

```bash
website-qa-http https://example.com/ --strict --json
```

Für wiederkehrende lokale Berichte kann JSON direkt atomar in eine Datei geschrieben werden. Benötigte Elternverzeichnisse werden angelegt:

```bash
website-qa-http https://example.com/ \
  --strict \
  --json-file=.website-qa/current/http.json
```

`--json-file` impliziert `--json`. Die Datei wird auch bei fachlichen Befunden mit Exitcode 1 geschrieben. Exitcodes:

- `0`: Prüfung bestanden;
- `1`: technischer Befund beziehungsweise Warnung mit `--strict`;
- `2`: Aufruf- oder Laufzeitfehler; der erzeugte Fehleroutput ist kein vollständiger Checklistennachweis.

## Vorgesehener Arbeitsablauf

Die umfangreichen Netzwerk- und Browserprüfungen sind primär für bewusst gestartete lokale beziehungsweise operative Prüfserien gedacht, nicht als automatisch bei jedem Commit laufender CI-Schritt. Typische Zeitpunkte sind vor oder nach einem Deployment, nach wesentlichen Websiteänderungen oder bei einer periodischen Projektprüfung.

Die Werkzeuge erzeugen ausführliche technische Befunde und strukturierte Teilnachweise für die anschließende Bewertung durch kompetente Entwicklerinnen und Entwickler. Sie automatisieren belastbar beobachtbare Teile, treffen aber keine vollständige Qualitäts-, Rechts-, Datenschutz-, Sicherheits- oder Freigabeentscheidung.

Die Werkzeuge:

- laufen nicht bei Installation, Commit oder Push automatisch;
- setzen keine GitHub Actions voraus;
- verändern keine Zielwebsite und keine Projektcheckliste;
- führen ausschließlich die ausdrücklich gestarteten Prüfungen aus.

CI-Nutzung bleibt möglich, ist aber nicht der dokumentierte Hauptworkflow.

## Wiederkehrende npm-Skripte

Ein Zielprojekt kann beispielsweise diese Skripte übernehmen und URL sowie Limits bewusst anpassen:

```json
{
  "scripts": {
    "qa:http": "website-qa-http https://example.com/ --strict --json-file=.website-qa/current/http.json",
    "qa:crawl": "website-qa-crawl https://example.com/ --sitemap --max-pages=50 --max-resources=500 --strict --json-file=.website-qa/current/crawl.json",
    "qa:browser": "website-qa-browser https://example.com/ --sitemap --max-pages=10 --max-requests=300 --strict --json-file=.website-qa/current/browser.json",
    "qa:social": "website-qa-social https://example.com/ --sitemap --max-pages=20 --strict --json-file=.website-qa/current/social.json",
    "qa:report": "node scripts/website-qa-report.mjs"
  }
}
```

Anschließend werden die gewählten Prüfungen bewusst gestartet:

```bash
npm run qa:http
npm run qa:crawl
npm run qa:browser
npm run qa:social
npm run qa:report
```

Ein Prüfer mit Exitcode 1 hat einen fachlich wichtigen JSON-Bericht erzeugt. Die übrigen ausgewählten Prüfer und der Berichtsschritt sollten deshalb trotzdem ausgeführt werden. Ein projektspezifisches Orchestrierungsskript kann dies abbilden; das Paket führt keinen universellen Netzwerk-Sammelbefehl ein.

Eine kopierbare Minimalintegration liegt unter [`examples/project-integration/`](examples/project-integration/).

## Strukturierter Projektnachweis

HTTP, Crawl, Browser und Social geben neben Befunden positive, negative, nicht anwendbare und unklare atomare Prüfaussagen aus. Der HTTP-Prüfer bildet die deklarierte Sicherheitsheaderbasis und ihre Beobachtungsabdeckung auf ausgewähltem HTML, 404, CSS und JavaScript ab. Der Crawl erfasst zusätzlich Sitemap-Dateien und -Einträge, robots.txt-Referenz, vollständige Sitemap-Abdeckung, interne Navigationen, Ressourcenstatus und MIME-Typen sowie erreichte Sicherheits- und Umfangsgrenzen atomar. Der Browser strukturiert außerdem die vollständige passive Beobachtung externer Requestversuche sowie des initialen Cookie- und Browser-Storage-Inventars, ohne daraus eine rechtliche oder fachliche Freigabe abzuleiten. Grundlage ist der mitgelieferte [Pilotkatalog](catalog/README.md). Er unterscheidet:

- automatisch belegbare Kriterien;
- manuell beziehungsweise redaktionell zu prüfende Kriterien;
- externe, kommunikative oder nur mit Infrastrukturzugang belegbare Kriterien.

Ein technisch erfolgreicher Lauf schließt einen zusammengesetzten Checklistenpunkt nicht ab, solange erforderliche manuelle oder externe Nachweise fehlen. Fehlende Befunde gelten niemals automatisch als `pass`.

### Projektdateien vorbereiten

Aus dem installierten Paket können die allgemeinen Beispiele kopiert werden:

```bash
mkdir -p scripts
cp node_modules/@mktcode/website-qa/examples/project-integration/website-qa.project.json ./website-qa.project.json
cp node_modules/@mktcode/website-qa/examples/project-integration/website-qa-report.mjs ./scripts/website-qa-report.mjs
```

Danach werden mindestens angepasst:

- öffentliche Ziel-URL;
- Auswertungsumgebung;
- ausgewählte Module;
- technische npm-Befehle und Berichtspfade;
- optional projektseitig deklarierter Quell- und Deploymentstand;
- optional eine Datei mit manuellen beziehungsweise externen Nachweisen.

Das Berichtsskript enthält ausschließlich:

```js
import { writePilotProjectReportBundle } from '@mktcode/website-qa/report'

const result = writePilotProjectReportBundle({
  configFile: './website-qa.project.json',
})

console.info(`Vollständiger lokaler Bericht: ${result.bundleDirectory}`)
console.info(`Versionierbare Zusammenfassung: ${result.summaryFile}`)
```

Der Berichtsgenerator liest nur lokale Dateien. Er startet keinen Netzwerkprüfer.

## Automatisch datiertes Berichtsbundle

`npm run qa:report` erzeugt standardmäßig:

```text
.website-qa/
└── reports/
    └── 2026-08-24T18-04-17Z/
        ├── manifest.json
        ├── report.json
        ├── report.md
        └── technical/
            ├── http.json
            ├── crawl.json
            ├── browser.json
            └── social.json
```

- `technical/*.json` sind bytegleiche Kopien der eingebundenen vollständigen Werkzeugberichte.
- `report.json` ist der selbstständige strukturierte Checklistennachweis.
- `report.md` ist die vollständige menschenlesbare Darstellung einschließlich Projektdetails.
- `manifest.json` ordnet Dateien, Werkzeugläufe, Größen und SHA-256-Prüfsummen zu.
- Ein vorhandener Zeitstempel wird niemals überschrieben.
- Die Bundle-Erzeugung erfolgt temporär und wird erst nach vollständiger Validierung veröffentlicht.

Die Rohberichte benötigen keinen manuellen Kompaktierungs- oder Kopierschritt.

## Versionierbare Markdown-Zusammenfassung

Getrennt vom vollständigen Bundle entsteht standardmäßig:

```text
docs/website-qa/berichte/2026-08-24T18-04-17Z.md
```

Diese Zusammenfassung besitzt einen eigenen Whitelist-Renderer. Standardmäßig enthält sie nur:

- Zeit, Pilotkatalog und Werkzeugversionen;
- aggregierte Status- und Kriterienzahlen;
- stabile Kennungen und allgemeine Katalogtexte nicht vollständig belegter Punkte;
- allgemeine Grenzen des Nachweises.

Sie übernimmt insbesondere keine freien Nachweisnotizen, Personen, Referenzen, Befundtexte, DOM-Selektoren, Befehle, Umgebungsnamen, Quell-/Deploymentkennungen oder lokalen Pfade. Projektname und URL fehlen standardmäßig. Eine ausdrücklich öffentliche Bezeichnung kann programmatisch freigegeben werden:

```js
writePilotProjectReportBundle({
  configFile: './website-qa.project.json',
  publicProject: {
    label: 'Öffentliche Projektbezeichnung',
    url: 'https://example.com/',
  },
})
```

Auch die datenarme Zusammenfassung wird vor Commit oder Veröffentlichung projektspezifisch geprüft. Sie ist eine Fortschrittsübersicht, kein vollständiger reproduzierbarer Nachweis.

## Empfohlene `.gitignore`-Regel

Vollständige lokale Läufe und Arbeitsdateien werden standardmäßig ignoriert:

```gitignore
# Vollständige lokale Website-QA-Läufe und Rohberichte
.website-qa/
```

Die getrennte Zusammenfassung unter `docs/website-qa/berichte/` bleibt dadurch versionierbar. Projektkonfiguration, npm-Skripte und bewusst gepflegte Nachweise sind Eingaben und keine generierten Rohartefakte; über ihre Versionierung entscheidet das Zielprojekt anhand ihres Inhalts.

## Programmatische Reporting-API

Der Pilot kann ohne Dateiausgabe ausgewertet und gerendert werden:

```js
import {
  createPilotProjectReportFromFiles,
  renderPilotProjectReportMarkdown,
  renderPilotProjectSummaryMarkdown,
} from '@mktcode/website-qa/report'

const report = createPilotProjectReportFromFiles('./website-qa.project.json')
const markdown = renderPilotProjectReportMarkdown(report)
const summary = renderPilotProjectSummaryMarkdown(report)
```

Oder als vollständiges Bundle:

```js
import { writePilotProjectReportBundle } from '@mktcode/website-qa/report'

const files = writePilotProjectReportBundle({
  configFile: './website-qa.project.json',
  bundleDirectory: './.website-qa/reports',
  summaryDirectory: './docs/website-qa/berichte',
})
```

Schemas und Beispiele liegen unter [`catalog/`](catalog/). `report.json` verwendet Ausgabeschema 2, weil berichtete Ziel-URLs ohne Querywerte gebunden werden; bei Queryzielen werden zusätzlich nur die Parameternamen verglichen. Der Pilot umfasst noch nicht die vollständige Website-Checkliste und verändert keine Projektcheckliste automatisch.

### Nachweis- und Statuspflege

Kriterien verwenden ausschließlich `pass`, `fail`, `inconclusive`, `notApplicable` oder `noEvidence`. `partial` und `open` sind daraus abgeleitete Ergebnisse zusammengesetzter Checklistenpunkte, keine Ergebnisse einzelner Kriterien. Davon getrennte Workflowzustände wie `external`, `deferred`, `acceptedDeviation` oder eine Nichtanwendbarkeit des gesamten Punkts verändern die zugrunde liegenden Kriterienergebnisse nicht. Im vollständigen Markdownbericht gilt deshalb nur ein Kriterium mit `pass` oder eigenem `notApplicable` als geklärt; eine Nichtanwendbarkeit auf Punktebene setzt fehlende oder negative Kriteriennachweise nicht nachträglich auf erledigt.

Alle Records in einer Evidence-Datei gelten als gleichzeitig aktive Nachweise; es gibt kein stilles „neuester Eintrag gewinnt“ und keinen automatischen Ablauf allein aufgrund des Datums. Mehrere Records für dasselbe Kriterium werden konservativ zusammengeführt: Ein aktives `fail` hat Vorrang, ein aktives `inconclusive` verhindert ein eindeutiges Ergebnis, und eine Mischung aus `pass` und `notApplicable` bleibt `pass`. Ersetzte oder fachlich nicht mehr geltende Records müssen deshalb bewusst aus der aktiven Projektkopie entfernt und bei Bedarf über deren Versionshistorie beziehungsweise Projektakte erhalten werden. Freie Notizen und Referenzen werden nur als Nachweisdaten übernommen; das Werkzeug öffnet oder bestätigt referenzierte Unterlagen nicht. Vertrauliche Unterlagen werden weiterhin ausschließlich außerhalb empfohlener Berichte verwahrt und nur redigiert referenziert.

### Migration von 0.6.1

- Eine ausdrücklich dokumentierte Nichtanwendbarkeit des gesamten Checklistenpunkts verändert weiterhin nur dessen Projektstatus. Sie markiert fehlende, unklare oder negative Kriterien im vollständigen Markdownbericht nicht mehr fälschlich als abgehakt.
- Kriteriencheckboxen folgen damit wie die Kriterienzähler ausschließlich dem jeweiligen Kriterienergebnis: `pass` und `notApplicable` gelten als geklärt; `fail`, `inconclusive` und `noEvidence` bleiben sichtbar offen.
- JSON-Schemas, Auswertung, Pilotkatalog, Assertions und technische Prüfergebnisse ändern sich nicht. Vorhandene technische 0.6.x-Berichte und Evidence-Dateien können ohne neue Netzwerkprüfung verarbeitet werden.

### Migration von 0.6.0

- Die vollständige und die datenarme Markdowndarstellung nennen für automatische und nicht automatische Kriterien nun jeweils Gesamtzahl, bestandene beziehungsweise belegte, fehlgeschlagene, unklare, nicht zutreffende und nicht belegte Kriterien. Die Kurzzeilen sind damit summengleich.
- In der Kriterienübersicht des vollständigen Markdownberichts zählen `pass` und `notApplicable` als geklärt. Ein fachlich nicht zutreffendes Kriterium wird dadurch nicht länger wie ein fehlender Nachweis dargestellt.
- JSON-Schemas, Pilotkatalog, Assertions und technische Prüfergebnisse ändern sich nicht. Bereits mit `0.6.0` erzeugte technische Berichte können deshalb ohne erneute Netzwerkprüfung mit dem korrigierten Berichtsgenerator verarbeitet werden.

### Migration von 0.5.x

- Der Browser-Prüfer liefert zwei zusätzliche atomare Assertions für die vollständige passive Beobachtung externer Requestversuche sowie des initialen Cookie-, Local-/Session-Storage- und IndexedDB-Inventars.
- Der Pilotkatalog `1.0.0-pilot.7` ergänzt `CORE-PRIV-02` und `CORE-PRIV-04`. Projektkonfigurationen und Evidence-Dateien müssen diese Katalogversion ausdrücklich übernehmen.
- Technische Berichte aller vier Werkzeuge weisen die aktuelle Katalogversion aus. Für einen gemeinsamen Projektbericht müssen deshalb alle eingebundenen Berichte mit einem einheitlichen `0.6.x`-Werkzeugstand neu erzeugt werden.
- Ein automatisches `pass` bestätigt nur, dass die Beobachtung innerhalb der deklarierten passiven, isolierten Seiten-/Profilumgebung vollständig war. Quell- und Konfigurationsabgleich, Zulässigkeit externer Dienste, Dokumentation, Einwilligungslogik sowie die Angemessenheit von `Secure`, `HttpOnly` und `SameSite` bleiben manuell.
- Externe Requests bleiben blockiert. Es werden keine Consent-Auswahl, Klicks, Formulare oder zusätzlichen Netzwerkpfade eingeführt. Blockierte Versuche bleiben als Befund sichtbar und werden nicht als tatsächlich ausgeführte Drittanbieteranfrage dargestellt.
- Cookie- und Storagewerte werden nie in den Bericht übernommen. Bezeichner sind auf 100 Einträge je Art und Seiten-/Profil-Lauf begrenzt; eine Überschreitung führt beim abhängigen Nachweis zu `inconclusive`. Die Beobachtungszeit nach `DOMContentLoaded` wird im Bericht dokumentiert.

### Migration von 0.4.x

- Der HTTP-Prüfer liefert sieben zusätzliche atomare Assertions für deklarierte CSP, Framing-Schutz, `X-Content-Type-Options: nosniff`, Referrer Policy sowie Permissions Policy und unterscheidet vollständige Dokument- von vollständiger Gesamtbeobachtung der ausgewählten Antwortklassen. Bereits vorhandene HSTS-Assertions umfassen nun auch die ohnehin abgerufene CSS-/JavaScript-Stichprobe.
- Der Pilotkatalog `1.0.0-pilot.6` ergänzt `CORE-ERR-04`, `CORE-SEC-04` und `CORE-SEC-05`. Projektkonfigurationen und Evidence-Dateien müssen diese Katalogversion ausdrücklich übernehmen.
- Technische Berichte aller vier Werkzeuge weisen die aktuelle Katalogversion aus. Für einen gemeinsamen Projektbericht müssen deshalb alle eingebundenen Berichte mit einem einheitlichen `0.5.x`-Werkzeugstand neu erzeugt werden.
- Es entstehen keine zusätzlichen HTTP-Anfragen: ausgewertet werden reguläres HTML, die bestehende 404-Probe sowie die bereits für MIME-, Cache- und Kompressionsprüfungen ausgewählten CSS-/JavaScript-Antworten.
- Deklarierte Header und ein syntaktisch erkennbarer Framing-Schutz belegen weder die inhaltliche Stärke einer CSP noch widerspruchsfreie Anwendung-/Proxykonfiguration oder risikogerechte Projekteignung. APIs, weitere Antwortklassen, alternative Hosts sowie app- und proxyseitige Redirectheader bleiben manuell zu prüfen.
- Fehlt eine ausgewählte Antwort wegen eines Abruffehlers, wird die Headerabdeckung `inconclusive`. HSTS ist bei ausdrücklich zugelassenen HTTP-Zielen `notApplicable` statt ein positiver HTTPS-Nachweis.

### Migration von 0.3.x

- Der Crawl liefert neun zusätzliche atomare Assertions für Sitemap, interne Navigationen, Ressourcen und Laufabdeckung. Es werden dafür keine neuen Netzwerkpfade geöffnet; ausgewertet werden bereits vorhandene GET-Beobachtungen.
- Der Pilotkatalog `1.0.0-pilot.5` ergänzt `CORE-ERR-03`, `CORE-MAP-01`, `CORE-MAP-02`, `CORE-SEO-04`, `CORE-QA-05` und `CORE-QA-08`. Projektkonfigurationen und Evidence-Dateien müssen die neue Katalogversion ausdrücklich übernehmen.
- Technische Berichte aller vier Werkzeuge weisen die aktuelle Katalogversion aus. Für einen gemeinsamen Projektbericht müssen deshalb alle eingebundenen Berichte mit einem einheitlichen `0.4.x`-Werkzeugstand neu erzeugt werden.
- API-/Content-Negotiation-Fehler, projektspezifischer Routen- und Indexierungsumfang, optionale Sitemap-Metadaten und XSL, externe Links sowie dynamische oder interaktionsabhängige Ressourcen bleiben nicht automatische Kriterien.
- Abruffehler, Sicherheitsauslassungen und erreichte Seiten-, Ressourcen- oder Sitemaplimits führen bei abhängigen Assertions weiterhin zu `inconclusive` statt zu einem stillschweigenden Erfolg.

### Migration von 0.2.x

- Social-Berichte verwenden nun `schemaVersion: 1`, zehn atomare Assertions, Nur-Lese-Garantien und `checklistCoverage`.
- Der Pilotkatalog `1.0.0-pilot.4` ergänzt `CORE-SOC-01` bis `CORE-SOC-03` sowie ausgewählte Robots-Punkte. Projektkonfigurationen und Evidence-Dateien müssen diese Katalogversion ausdrücklich übernehmen.
- Social-Berichte werden als vierter technischer Lauf in Projektbericht und Bundle eingebunden.
- Echte Plattformvorschau, redaktionelle Eignung, Policy-Aktualität und Betreiberentscheidung bleiben manuelle Kriterien; ein technisch grüner Social-Lauf schließt sie nicht automatisch ab.

### Migration von 0.1.x

- Technische JSON-Berichte entfernen nun Querywerte, URL-Zugangsdaten, private Zielhosts sowie weitere bekannte sensible Textwerte.
- Bei Queryzielen enthalten Berichte nur `requestedUrlParameterNames`; die Werte können nicht mehr zur Berichtsbindung verwendet werden.
- Der abgeleitete Projektbericht verwendet deshalb `schemaVersion: 2` und kennzeichnet die Bindung als `matchedAgainstRedactedTechnicalReport`.
- Bestehende Funktionen zum Erzeugen und Rendern eines Projektberichts bleiben verfügbar.
- Die neue Bundle-Funktion verarbeitet vollständige Werkzeugberichte direkt; alte manuell kompaktierte Zwischenberichte sind nicht mehr erforderlich.

## Berichtsdaten und Redaktion

Berichtete URLs werden zentral aufbereitet:

- URL-Zugangsdaten werden abgelehnt;
- bei ausdrücklich erlaubten privaten beziehungsweise lokalen Prüfungen werden Zielhosts in Berichten nicht offengelegt und die Berichte mit `privateTargetsRedacted` gekennzeichnet;
- Querywerte und Fragmente werden nicht in Werkzeugberichte übernommen;
- benötigte Queryparameternamen können getrennt dokumentiert werden;
- bekannte Secret-Zuweisungen, Bearer-Werte und E-Mail-Adressen in berichteten Texten werden redigiert;
- Cookie- und Browserstoragewerte werden nicht protokolliert.

Vollständige Rohberichte enthalten dennoch umfangreiche Beobachtungen der öffentlich ausgelieferten Website, beispielsweise Pfade, Seitentitel, Überschriften, Ressourcen, Formular-Actions ohne Abruf, Browserkonsolentexte, DOM-Selektoren sowie Cookie- und Storage-Schlüsselnamen. Sie werden deshalb standardmäßig ignoriert und vor einer abweichenden Archivierung oder Veröffentlichung geprüft.

Vertrauliche Unterlagen, Zugangsdaten, interne Infrastruktur und personenbezogene Projektdaten gehören nicht in technische Berichte. Manuelle Nachweise referenzieren vertrauliche Projektakten nur, statt sie zu kopieren.

## Sicherheitsgrenzen

- HTTP-Abrufe verwenden ausschließlich GET.
- Private, lokale und anderweitig nicht öffentliche Ziele sind standardmäßig gesperrt.
- DNS-Auflösung und Weiterleitungen werden gegen SSRF und Originwechsel geprüft.
- Der Crawler ruft keine Formular-Actions auf und betätigt keine Bedienelemente.
- Externe Links werden im Crawl nur inventarisiert und nicht abgerufen.
- Der Browser-Check klickt nie und verwendet isolierte, nicht persistente Browserkontexte.
- Nicht-GET-Anfragen, externe Seitenrequests, Formulare, Uploads, Popups, Beacons, Worker, WebSockets, WebTransport und WebRTC werden im Browser blockiert und protokolliert.
- Limits für Zeit, Antwortgröße, Seiten, Ressourcen, Sitemaps und Browserrequests begrenzen die Läufe.
- Sicherheits- oder Umfangsbegrenzungen führen bei abhängigen Assertions zu `inconclusive`, nicht zu einem stillschweigenden Erfolg.

Die Prüfberichte sind technische Teilnachweise. Sie ersetzen insbesondere keine vollständige WCAG-, Tastatur-, Screenreader-, Safari-, reale Mobilgeräte-, Rechts-, Datenschutz-, Sicherheits- oder Produktionsfreigabeprüfung.

## Wiederverwendbare Prüfdokumentation

Unter [`docs/`](docs/) liegen eine modulare allgemeine [Website-Checkliste](docs/checklisten/website/) und ein zugehöriger [Agenten-Prompt](docs/prompts/website-checkliste.md). Diese Dateien sind ausschließlich Vorlagen. Für jedes Zielprojekt wird daraus eine eigenständige Projektkopie mit festgehaltenem Vorlagencommit erstellt; ausgefüllte Nachweise gehören nicht in dieses Repository.

## Entwicklung

```bash
npm ci
npm run check
npm pack --dry-run
```

Die Tests verwenden überwiegend lokale kurzlebige Testserver mit unterschiedlichen HTML-Strukturen. Der Browser-Integrationstest weist mit echtem Chromium nach, dass POST-Anfragen, Formulare, externe Requests und Popups keine Servernebenwirkungen auslösen. Diese Testserver und Chromium sind Voraussetzungen für die Paketentwicklung, nicht für die Prüfung einer entfernten Zielwebsite abgesehen vom Browser-Check selbst.

Der detaillierte Refactoring- und Entscheidungsstand ist in [`PLANNING.md`](PLANNING.md) dokumentiert.

## Lizenz

[MIT](LICENSE)
