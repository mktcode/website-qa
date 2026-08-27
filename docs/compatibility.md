# Öffentlicher v2-Vertrag

Version 2.0.0 ist ein bewusster inkompatibler Produktschnitt. Rückwärtskompatibilität zu Projektberichten, Evidence-Dateien, Checklistenauswertung und Berichts-Bundles aus 0.x/1.x wird nicht angeboten.

## Getrennte Versionsachsen

- Die Paketversion bezeichnet den Implementierungsstand.
- `schemaVersion: 2` bezeichnet den aktuellen technischen JSON-Bericht.
- `signalVersion` bezeichnet die fachliche Bedeutung einer technischen Signal-ID.
- Die Checklistenversion bezeichnet den Stand des neutralen 215-ID-Index.

Diese Achsen werden nicht auseinander abgeleitet.

## CLI-Vertrag

Die fünf unabhängigen Befehle sind:

- `website-qa-http`
- `website-qa-crawl`
- `website-qa-browser`
- `website-qa-social`
- `website-qa-lighthouse`

Jeder Befehl unterstützt direkte Ausführung, `--help`, Textausgabe, `--json`, atomare `--json-file`-Ausgabe, `--strict`, Paketversion und die Exitcodes 0, 1 und 2. Es gibt keinen Sammelbefehl.

Die GET-, SSRF-, Redirect-, Origin-, Browser- und Redaktionsgrenzen sind Teil des Vertrags. Sicherheitsgrenzen dürfen geschlossen verschärft, aber nicht still gelockert werden.

## Technische Berichte

Die Berichte verwenden `schemaVersion: 2` und die Status `positive`, `defect`, `inconclusive` und `notApplicable`. Checklistenreferenzen sind reine Informationsverweise. Berichte enthalten keine Checklistenpunktzustände und dürfen nicht als automatische Projektfreigabe ausgewertet werden.

Schemata:

- [`../catalog/technical-report.schema.json`](../catalog/technical-report.schema.json) als Dispatcher über alle fünf Berichtstypen
- [`../catalog/http-report.schema.json`](../catalog/http-report.schema.json)
- [`../catalog/crawl-report.schema.json`](../catalog/crawl-report.schema.json)
- [`../catalog/browser-report.schema.json`](../catalog/browser-report.schema.json)
- [`../catalog/social-report.schema.json`](../catalog/social-report.schema.json)
- [`../catalog/lighthouse-report.schema.json`](../catalog/lighthouse-report.schema.json)
- [`../catalog/technical-report.common.schema.json`](../catalog/technical-report.common.schema.json)

Verbraucher wählen nach `tool` und `schemaVersion`. Eine geänderte Signalbedeutung erhöht `signalVersion` oder erhält eine neue ID.

## Entfernte v1-Oberflächen

Ohne Alias oder Konverter entfernt wurden:

- `@mktcode/website-qa/report`
- `@mktcode/website-qa/checklist`
- Projektberichtskonfiguration und manuelle Evidence-Eingaben
- Projektstatus und Workflowzustände
- JSON-/Markdown-Gesamtberichte und Bundlemanifeste
- `checklistCoverage` und automatische Checklistenaggregation

Historische Artefakte bleiben über ihre veröffentlichten Git-Tags reproduzierbar. Sie werden nicht in v2 konvertiert, weil ein früher abgeleiteter Checklistenstatus kein technischer Defektbericht ist.

## Node.js

Unterstützt werden Node.js `>=22.19 <23` und `>=24.11 <25`. Browser- und Lighthouse-Check benötigen ein kompatibles lokal installiertes Chromium oder Google Chrome.
