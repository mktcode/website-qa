# Kompatibilitäts- und Deprecation-Regeln

Dieses Dokument beschreibt den öffentlichen Vertrag von `@mktcode/website-qa` ab Version 1.0.0.

## Getrennte Versionsachsen

Vier Versionen haben unterschiedliche Bedeutungen:

1. Die Paketversion bezeichnet den Implementierungsstand.
2. `schemaVersion` bezeichnet die Struktur eines JSON-Dokuments.
3. `assertionVersion` bezeichnet die fachliche Bedeutung einer Assertion-ID.
4. Die Katalogversion bezeichnet Zusammenstellung und Bedeutung der Checklistenpunkte und Kriterien.

Projektberichte verwenden ausschließlich das normalisierte `schemaVersion: 3`. Projektkonfiguration, Evidence, technische Berichte und Bundlemanifest besitzen davon unabhängig jeweils `schemaVersion: 1`.

## CLI-Vertrag

Die vier unabhängigen Befehle sind stabil:

- `website-qa-http`
- `website-qa-crawl`
- `website-qa-browser`
- `website-qa-social`

Zum Vertrag gehören direkte Ausführbarkeit, `--help`, menschenlesbare Ausgabe, `--json`, `--json-file`, `--strict`, Paketversionsausgabe und die Exitcodes:

- `0`: Lauf vollständig und nach den gewählten Regeln bestanden;
- `1`: gültiger Bericht mit Fehlern oder im strikten Modus relevanten Warnungen;
- `2`: Aufruf, Umgebung oder Berichtserzeugung technisch fehlgeschlagen.

Die GET-only-, Browser- und SSRF-Grenzen sind Teil des Vertrags. Eine Lockerung ist keine kompatible Erweiterung. Sicherheitsgrenzen dürfen geschlossen verschärft werden, wenn ein Abruf sonst möglicherweise unsicher wäre; das Ergebnis muss sichtbar fehlschlagen oder unklar werden.

## Technische JSON-Berichte

Die technischen Berichte behalten `schemaVersion: 1` und werden durch folgende Schemata beschrieben:

- [`../catalog/http-report.schema.json`](../catalog/http-report.schema.json)
- [`../catalog/crawl-report.schema.json`](../catalog/crawl-report.schema.json)
- [`../catalog/browser-report.schema.json`](../catalog/browser-report.schema.json)
- [`../catalog/social-report.schema.json`](../catalog/social-report.schema.json)
- [`../catalog/technical-report.common.schema.json`](../catalog/technical-report.common.schema.json)

Verbraucher wählen nach `tool` und `schemaVersion` und erraten keine Schemaversion aus der Paketversion. Entfernte Pflichtfelder, geänderte Typen oder Bedeutungen benötigen eine neue Schemaversion. Additive Detailfelder bleiben nur in ausdrücklich erweiterbaren Bereichen kompatibel.

## Assertions und stabiler Basiskatalog

Eine Assertion wird durch `assertionId` und `assertionVersion` identifiziert. `message` und `subject` sind redigierte Befunddetails und keine stabilen Vergleichswerte. Eine fachlich geänderte Aussage erhöht die Assertionversion; eine bestehende ID wird nicht mit neuer Bedeutung wiederverwendet.

Der ausgelieferte Katalog heißt `website-qa-baseline`, besitzt Version `1.1.0` und Status `stable`. Stabil sind seine IDs, Bedeutungen und Versionsregeln, nicht eine vollständige Abdeckung der allgemeinen Markdowncheckliste. Der Basiskatalog ist weder vollständige Website-Checkliste noch WCAG-, Rechts-, Datenschutz-, Sicherheits- oder Produktionsfreigabe. Technische Berichte mit einer anderen Katalogversion werden nicht automatisch zugerechnet; für 1.1 müssen alle in der Projektkonfiguration verwendeten technischen Berichte neu erzeugt werden.

Die stabile Checklist-API unter `@mktcode/website-qa/checklist` exportiert:

- `loadWebsiteCatalog()`
- `loadAssertionRegistry()`
- `validateChecklistCatalog(catalog?, registry?)`
- `evaluateChecklist(options?)`
- `checklistItemIdsForTool(tool, catalog?, registry?)`

`evaluateChecklist` verwendet den ausgelieferten Basiskatalog. Assertion-Versionierung und Katalog-Versionierung bleiben getrennte Achsen.

## Reporting-API und Recordmodell

Die stabile API unter `@mktcode/website-qa/report` exportiert:

- `createProjectReport(options)`
- `createProjectReportFromFiles(configFile)`
- `validateProjectReport(report)`
- `renderProjectReportMarkdown(report)`
- `renderProjectSummaryMarkdown(report, options?)`
- `writeProjectReportBundle(options)`

[`../catalog/project-report.config.schema.json`](../catalog/project-report.config.schema.json) beschreibt ausschließlich die Konfiguration. [`../catalog/project-report.schema.json`](../catalog/project-report.schema.json) bezeichnet den einzigen normalisierten Projektbericht mit `schemaVersion: 3`.

Assertion- und Evidence-Records werden einmalig auf Berichtsebene gespeichert. Kriterien referenzieren sie über deterministische berichtslokale IDs; diese IDs besitzen keine berichtsübergreifende Identität. Inhaltlich gleiche Records werden dedupliziert. Automatische Kriterien nennen ihre erforderlichen Assertion-IDs und das erzeugende Werkzeug. Konfiguration, Evidence, technische Berichte und Projektbericht werden vor ihrer semantischen Auswertung mit den veröffentlichten JSON-Schemas validiert. Unbekannte Werkzeuge, Fehlerhüllen, geschwächte Nur-Lese-Garantien und Cross-tool-Assertions werden geschlossen abgelehnt. Katalogbindung, Scope, Registryversion, Werkzeug, Workflow, Recordtypen, Referenzen, Ergebnisse, Punktzustände und Summen werden anschließend semantisch validiert.

Der vollständige Renderer zeigt bei fehlgeschlagenen oder unklaren automatischen Kriterien kurze bereits redigierte Meldungen mit Recordreferenzen. Er vervielfältigt keine Subjects, Evidence-Freitexte, Cookie-/Storagewerte oder vertraulichen Referenzen. Der getrennte Zusammenfassungsrenderer verwendet eine enge Feld-Whitelist und ist trotzdem vor Veröffentlichung projektspezifisch zu prüfen.

Der Bundlewriter verarbeitet nur lokale Dateien, archiviert technische Eingaben bytegleich und schreibt `report.json`, `report.md`, `manifest.json` sowie `technical/*.json` atomar. Die optionale Whitelist-Zusammenfassung liegt getrennt außerhalb des vollständigen Bundles.

## Inkompatibler 1.0-Schnitt

Die vor 1.0 veröffentlichten Projektberichtsnamen, die frühere Katalogdatei und frühere Projektberichtsausgaben gehören nicht zum 1.0-Vertrag. Es gibt keine Laufzeitaliasse, Deprecation-Hüllen oder automatische Konvertierung. Historische Artefakte bleiben über veröffentlichte Git-Tags verfügbar.

## Deprecation und Entfernung nach 1.0

1. Eine Deprecation wird in README und [`../CHANGELOG.md`](../CHANGELOG.md) mit Ersatz und frühestem Entfernungszeitpunkt dokumentiert.
2. Eine kompatible Übergangslösung bleibt mindestens über die nächste Minor-Version erhalten.
3. Eine Entfernung oder inkompatible Bedeutungsänderung erfolgt regulär erst in einer neuen Major-Version.
4. Kritische Sicherheitskorrekturen dürfen den Übergang verkürzen und brechen geschlossen.

## Node.js

Der Bereich `engines.node` in `package.json` ist verbindlich: Node 22 ab 22.19 bis vor 23 und Node 24 ab 24.11 bis vor 25. Ein unterstützter Node-Major wird regulär nur mit einer Major-Version oder nach seinem Upstream-Supportende entfernt; zwingende Sicherheits- oder Abhängigkeitsgründe werden dokumentiert.
