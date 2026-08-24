# website-qa

Wiederverwendbare, ausschließlich lesende Qualitätsprüfungen für öffentliche Websites. Die Werkzeuge sind nicht an ein bestimmtes Framework, Projekt oder eine feste Seitenstruktur gebunden.

## Voraussetzungen

- Node.js `>=22.19 <23`
- für den Browser-Check ein lokal installiertes Chromium oder Google Chrome

## Installation aus GitHub

Bis zu einer möglichen Veröffentlichung in der npm-Registry kann das Paket auf einen Git-Tag oder Commit festgelegt werden:

```bash
npm install --save-dev github:mktcode/website-qa#v0.1.0
```

Projektbezogene Aliase bleiben optional:

```json
{
  "scripts": {
    "ops:http:check": "website-qa-http",
    "ops:crawl:check": "website-qa-crawl",
    "ops:browser:check": "website-qa-browser",
    "ops:social:check": "website-qa-social"
  }
}
```

## Einzelne Prüfungen

```bash
website-qa-http https://example.com/ --strict
website-qa-crawl https://example.com/ --sitemap --max-pages=50 --strict
website-qa-browser https://example.com/ --sitemap --max-pages=10 --strict
website-qa-social https://example.com/ --sitemap --max-pages=20
```

Jeder Befehl ist unabhängig. Es gibt bewusst keinen Sammelbefehl und keine Annahme über projektspezifische Build-, Test- oder CI-Kommandos. Alle Befehle unterstützen `--help`; die Website-Prüfer bieten zudem eine maschinenlesbare Ausgabe über `--json`.

## Strukturierter Checklistennachweis (Pilot)

Der HTTP-, Crawl- und Browser-Prüfer geben zusätzlich zu Befunden positive, negative und unklare atomare Prüfaussagen sowie eine erste Auswertung ausgewählter Checklistenpunkte aus. Grundlage ist der mit dem Paket ausgelieferte [Pilotkatalog](catalog/README.md). Er unterscheidet ausdrücklich:

- automatisch belegbare Kriterien,
- manuell beziehungsweise redaktionell zu prüfende Kriterien,
- externe, kommunikative oder nur mit Infrastrukturzugang belegbare Kriterien.

Ein technisch erfolgreicher Lauf schließt einen zusammengesetzten Checklistenpunkt nicht ab, solange erforderliche manuelle oder externe Nachweise fehlen. Die Berichtszahlen weisen deshalb vollständig belegte, teilweise belegte, fehlgeschlagene und offene Punkte getrennt aus.

Für eine projektspezifische Berichtserzeugung kann der Pilot programmatisch verwendet werden:

```js
import { evaluatePilotChecklist } from '@mktcode/website-qa/checklist'
```

Der Pilot umfasst noch nicht die vollständige Website-Checkliste und verändert keine Projektcheckliste automatisch. Die vier Netzwerkprüfer bleiben unabhängige Befehle; ein Zielprojekt entscheidet selbst, welche JSON-Berichte und manuellen Nachweise es zusammenführt.

Ein projektlokales Skript kann dafür die Reporting-Bibliothek verwenden, ohne einen weiteren Netzwerk- oder Sammelbefehl einzuführen:

```js
import { writeFileSync } from 'node:fs'
import {
  createPilotProjectReportFromFiles,
  renderPilotProjectReportMarkdown,
} from '@mktcode/website-qa/report'

const report = createPilotProjectReportFromFiles('./website-qa.project.json')
writeFileSync('./website-qa-report.json', `${JSON.stringify(report, null, 2)}\n`)
writeFileSync('./website-qa-report.md', renderPilotProjectReportMarkdown(report))
```

Die zugehörigen allgemeinen Schemas und Beispiele liegen unter [`catalog/`](catalog/); ein vollständig gerendertes Beispiel ist [`catalog/project-report.example.md`](catalog/project-report.example.md). Die Projektkonfiguration wählt Module und Auswertungsumgebung aus, bindet technische JSON-Läufe und manuelle beziehungsweise externe Nachweise ein und kann `Nicht zutreffend`, `Extern`, `Zurückgestellt` und `Akzeptierte Abweichung` mit Begründung abbilden. Die Ziel-URL wird gegen den technischen Bericht geprüft; Quell- und Deploymentstand bleiben ausdrücklich projektseitig deklarierte Zuordnungen.

## Sicherheitsgrenzen

- HTTP-Abrufe verwenden ausschließlich GET.
- Private, lokale und anderweitig nicht öffentliche Ziele sind standardmäßig gesperrt.
- DNS-Auflösung und Weiterleitungen werden gegen SSRF und Originwechsel geprüft.
- Der Crawler ruft keine Formular-Actions auf und betätigt keine Bedienelemente.
- Der Browser-Check klickt nie und verwendet isolierte, nicht persistente Browserkontexte.
- Nicht-GET-Anfragen, externe Seitenrequests, Formulare, Uploads, Popups und aktive Hintergrundkanäle werden im Browser blockiert und protokolliert.
- Limits für Zeit, Antwortgröße, Seiten, Ressourcen, Sitemaps und Browserrequests begrenzen die Läufe.

Die Prüfberichte sind technische Teilnachweise. Sie haken keine Checklistenpunkte ab und ersetzen insbesondere keine vollständige WCAG-, Tastatur-, Screenreader-, Safari-, reale Mobilgeräte- oder fachliche Datenschutzprüfung.

## Wiederverwendbare Prüfdokumentation

Unter [`docs/`](docs/) liegen eine modulare allgemeine [Website-Checkliste](docs/checklisten/website/) und ein zugehöriger [Agenten-Prompt](docs/prompts/website-checkliste.md). Diese Dateien sind ausschließlich Vorlagen. Für jedes Zielprojekt wird daraus eine eigenständige Projektkopie mit festgehaltenem Vorlagencommit erstellt; ausgefüllte Nachweise gehören nicht in dieses Repository.

## Entwicklung

```bash
npm ci
npm run check
npm pack --dry-run
```

Die Tests verwenden überwiegend lokale Testserver mit unterschiedlichen HTML-Strukturen. Der Browser-Integrationstest weist mit echtem Chromium nach, dass POST-Anfragen, Formulare, externe Requests und Popups keine Servernebenwirkungen auslösen.

## Lizenz

[MIT](LICENSE)
