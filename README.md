# website-qa

`@mktcode/website-qa` vereinfacht die Qualitätssicherung von Websites auf zwei bewusst getrennten Wegen:

1. Eine sehr umfangreiche, modulare und versionierte [Website-QA-Checkliste](docs/checklisten/website/) dient Menschen als fachliche Arbeitsgrundlage.
2. Fünf unabhängige, ausschließlich lesende Prüfer sammeln technische Signale und identifizieren klar beobachtbare Defekte als erste Temperaturmessung.

Die Werkzeuge haken niemals Checklistenpunkte ab. Positive Signale bedeuten nur, dass ein bestimmter Defekt im dokumentierten, begrenzten Prüfumfang nicht beobachtet wurde. Die eigentliche QA-Bewertung bleibt bei der prüfenden Person.

## Voraussetzungen

- Node.js `>=22.19 <23` oder `>=24.11 <25`
- lokal installiertes Chromium oder Google Chrome für Browser- und Lighthouse-Check
- Netzwerkzugriff auf die ausdrücklich gewählte Ziel-URL

Private oder lokale Ziele sind standardmäßig gesperrt. Unverschlüsseltes HTTP benötigt ausdrücklich `--allow-http`; private oder lokale Zieladressen benötigen unabhängig vom Protokoll `--allow-private`. Für ein lokales HTTP-Ziel sind beide Schalter erforderlich.

## Installation

```bash
npm install --save-dev 'github:mktcode/website-qa#<TAG-ODER-COMMIT>'
```

## Die fünf unabhängigen Prüfer

```bash
website-qa-http https://example.com/ --strict
website-qa-crawl https://example.com/ --sitemap --max-pages=50 --strict
website-qa-browser https://example.com/ --sitemap --max-pages=10 --max-sitemaps=10 --strict
website-qa-social https://example.com/ --sitemap --max-pages=20 --strict
website-qa-lighthouse https://example.com/ --strict
```

Es gibt bewusst keinen Sammelbefehl. Projekte entscheiden selbst, welche Läufe wann ausgeführt werden. Lighthouse ist fester Bestandteil der empfohlenen Standardprüfserie, bleibt aber ein eigenständig aufrufbarer Prüfer.

Alle Befehle unterstützen:

- `--help`
- menschenlesbare Ausgabe
- `--json`
- atomare Ausgabe mit `--json-file=<Pfad>`
- `--strict`
- dokumentierte Paketversion

Beispiel:

```bash
website-qa-lighthouse https://example.com/ \
  --strict \
  --json-file=.website-qa/current/lighthouse.json
```

## Exitcodes

- `0`: Der begrenzte Lauf wurde ohne technischen Fehlerbefund und ohne strikte Warnung abgeschlossen.
- `1`: Ein gültiger statischer Bericht enthält Fehlerdefekte oder mit `--strict` relevante Warnungen. Ein sicherheitsbedingt nicht repräsentativer Lighthouse-Lauf liefert ebenfalls Exitcode 1.
- `2`: Aufruf, Laufzeit oder Berichtserzeugung sind technisch fehlgeschlagen.

Exitcode 0 ist keine Website-, Checklisten- oder Produktionsfreigabe.

## Technische Berichte

Die JSON-Berichte verwenden `schemaVersion: 2`. Sie enthalten:

- Werkzeug- und Paketversion;
- Ziel, Optionen und dokumentierten Prüfumfang;
- technische Beobachtungen und Issues;
- atomare Signale mit `positive`, `defect`, `inconclusive` oder `notApplicable`;
- Informationsreferenzen auf stabile Checklisten-IDs;
- Nur-Lese-Garantien und erreichte Limits.

Sie enthalten keine automatische Checklistenbewertung, Projektstatus, Evidence-Dateien, Freigaben, Workflows oder abgeleitete Zustände wie „vollständig“ und „teilweise“.

Veröffentlichte Schemata und Beispiele liegen unter [`catalog/`](catalog/). Das neutrale [`checklist-index.json`](catalog/checklist-index.json) spiegelt alle 215 stabilen Checklisten-IDs. [`signals.json`](catalog/signals.json) registriert ausschließlich technische Signale und deren Informationsreferenzen. Beide Dateien enthalten keine Ergebnisse.

## Social- und Robots-Quellen

`website-qa-social` prüft standardmäßig höchstens 20 Seiten. Größere Inventare benötigen einen ausdrücklich gewählten `--max-pages`-Wert; ein erreichtes Limit bleibt im Bericht sichtbar.

`website-qa-social` dokumentiert für jede Crawlerkennung einen Quellenstatus: `currentOfficial` für eine aktuelle offizielle Quelle mit ausdrücklicher Tokenbestätigung, `officialContextOnly` für einen aktuellen offiziellen Sachkontext ohne ausdrückliche Tokenbestätigung und `historicalRedirect` für eine frühere offizielle Detailquelle, die heute nur noch allgemein weiterleitet. Technisch weiterhin relevante Social-Crawler werden bei begrenzter Quellenlage nicht stillschweigend entfernt; stattdessen wird `social.robots.policy-matrix-recorded` konservativ `inconclusive`. Daraus wird weder eine Freigabe noch eine Betreiberentscheidung abgeleitet.

## Lighthouse

`website-qa-lighthouse` führt genau einen festen mobilen Navigationstest mit den Lighthouse-Kategorien Performance, Accessibility, Best Practices und SEO aus. Es gibt keine projektspezifischen Scorebudgets.

Der Prüfer verwendet die Lighthouse-User-Flow-API mit einer vom Paket kontrollierten, isolierten Puppeteer-Seite. Bereits vor der Navigation werden Request- und DOM-Grenzen installiert:

- nur GET und nur der Zielorigin;
- DNS-/SSRF-Prüfung vor erlaubten Requests;
- keine Formularübermittlung, Beacons oder Popups;
- keine Worker, SharedWorker, EventSource, WebSockets, WebTransport oder WebRTC;
- Request- und Zeitlimits;
- kein persistentes Browserprofil.

Blockierte Requests oder Aktionen können Lighthouse-Messwerte verändern. Der Bericht kennzeichnet den Lauf dann ausdrücklich als nicht repräsentativ und die betroffenen Signale als unklar. Der kompakte Bericht übernimmt weder Roh-LHR noch Screenshots, HTML oder ungebundene Auditdetails.

Lighthouse und Axe liefern wertvolle technische Signale, aber keine vollständige WCAG-, BFSG-, BITV-, Rechts-, Datenschutz-, Sicherheits- oder Produktionsbewertung. Reale Geräte, Safari, Screenreader, Interaktionszustände und fachliche Erwartungen bleiben manuell zu prüfen.

## Empfohlene npm-Skripte

```json
{
  "scripts": {
    "ops:http:check": "website-qa-http --strict --json-file=.website-qa/current/http.json",
    "ops:crawl:check": "website-qa-crawl --sitemap --max-pages=50 --max-resources=500 --strict --json-file=.website-qa/current/crawl.json",
    "ops:browser:check": "website-qa-browser --sitemap --max-pages=10 --max-requests=300 --max-sitemaps=10 --strict --json-file=.website-qa/current/browser.json",
    "ops:social:check": "website-qa-social --sitemap --max-pages=20 --max-sitemaps=20 --strict --json-file=.website-qa/current/social.json",
    "ops:lighthouse:check": "website-qa-lighthouse --strict --json-file=.website-qa/current/lighthouse.json"
  }
}
```

Die Ziel-URL wird einheitlich nach dem npm-Trenner übergeben, zum Beispiel `npm run ops:http:check -- https://example.com/`. Die Berichte werden anschließend einzeln durch die QA-Prüferin oder den QA-Prüfer ausgewertet. Das Paket erzeugt keinen projektübergreifenden Gesamtstatus.

Eine kopierbare Minimalintegration liegt unter [`examples/project-integration/`](examples/project-integration/).

## Checkliste

Die zentrale Checkliste liegt unter [`docs/checklisten/website/`](docs/checklisten/website/). Sie umfasst einen verpflichtenden Kern, bedingte Fachmodule, Abschlussfragen und ein ausführliches Prüfverfahren. Die 215 stabilen IDs reichen bewusst weit über übliche Agentur- und Freelancerabläufe hinaus.

Für ein Zielprojekt entsteht daraus eine eigenständige Projektkopie. Nur dort werden Punkte manuell bearbeitet, begründet als nicht anwendbar markiert oder mit Projektnachweisen verbunden. Das Paket liest und verändert diesen Status niemals.

Eine technische Referenz wie `CORE-A11Y-06` bedeutet nur: Das Signal kann bei der manuellen Bearbeitung dieses Punkts hilfreich sein. Sie bedeutet nicht, dass der Punkt geprüft oder erledigt ist.

## Datenschutz und Redaktion

Berichtete URLs werden zentral redigiert:

- Zugangsdaten in URLs werden abgelehnt;
- Querywerte und Fragmente werden nicht ausgegeben;
- private Hosts werden bei ausdrücklich erlaubten lokalen Läufen maskiert;
- bekannte Secrets, Bearerwerte und E-Mail-Adressen werden redigiert;
- Cookie- und Storagewerte werden niemals protokolliert.

Rohberichte können dennoch öffentliche Pfade, DOM-Selektoren, Seitentitel, Ressourcen, Formular-Actions, Konsolenmeldungen sowie Cookie- und Storage-Schlüsselnamen enthalten. Sie gehören standardmäßig nach `.website-qa/` und müssen vor Veröffentlichung gesichtet werden.

```gitignore
.website-qa/
```

## Sicherheitsgrenzen

- ausschließlich HTTP-GET;
- keine Klicks, Formulare, Uploads oder mutierenden APIs;
- private und lokale Ziele standardmäßig gesperrt;
- DNS-, Redirect-, Origin-, Größen- und Zeitgrenzen;
- externe Crawlziele nur inventarisiert;
- externe Browserrequests und Nicht-GET-Methoden blockiert;
- verdächtige automatisch entdeckte GET-Seiten, Ressourcen und Redirectziele vorsorglich ausgelassen;
- Begrenzungen werden sichtbar und führen abhängigkeitsbezogen zu unklaren Signalen.

Nur das exakt ausdrücklich angegebene erste Ziel kann die konservative Namensheuristik der zentralen HTTP-Schicht umgehen. Automatisch erzeugte oder entdeckte Ziele und jeder Redirecthop werden vor dem Request geprüft. Bei Unsicherheit brechen die Werkzeuge geschlossen ab, statt einen möglicherweise schreibenden Pfad aufzurufen.

## Öffentliche Paketoberfläche

Es gibt keine JavaScript-API für Checklistenbewertung oder Projektberichte. Datenartefakte und Schemata werden über genaue Paketexporte bereitgestellt:

- `@mktcode/website-qa/checklist-index.json`
- `@mktcode/website-qa/signals.json`
- `@mktcode/website-qa/technical-report.schema.json` als Dispatcher über alle fünf Berichtstypen
- `@mktcode/website-qa/technical-report.common.schema.json` für gemeinsame `$defs`
- die fünf werkzeugspezifischen `*-report.schema.json`-Exporte

## Entwicklung

```bash
npm ci
npm run check
npm run test:chromium
npm run test:package
npm pack --dry-run
```

Die Tests verwenden lokale kurzlebige Server. Echte Chromium-Integrationstests weisen für Browser und Lighthouse nach, dass automatische POSTs, Formulare, externe Requests und weitere Nebenwirkungspfade keine Zielservereffekte auslösen. `npm run test:chromium` darf für Releaseprüfungen nicht übersprungen werden und schlägt fehl, wenn kein unterstütztes Browser-Binary gefunden wird.

`npm run test:package` erzeugt das tatsächliche Tarball, installiert es in einem leeren temporären Verbraucherprojekt und ruft alle fünf installierten Binärdateien gegen einen lokalen Nur-GET-Server auf. Die erzeugten Berichte werden über die exportierten Paketschemata validiert. Der Lauf protokolliert Node-, npm-, Chromium- und Paketversion sowie den SHA-256-Hash des Tarballs; Exitcode 1 einzelner Prüfer ist als schemafähiger technischer Befund zulässig, Exitcode 2 nicht.

## Lizenz

[MIT](LICENSE)
