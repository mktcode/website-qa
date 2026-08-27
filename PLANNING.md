# Website-QA: abgeschlossene Umsetzung und nächste Konsolidierungsphase

> **Status:** Der Workflow wurde mit Paketversion `0.2.0` eingeführt, mit `0.3.0` um strukturierte Social-Nachweise, mit `0.4.0` um vorhandene Sitemap-, Crawl- und Ressourcenbeobachtungen, mit `0.5.0` um öffentlich beobachtbare Sicherheitsheadernachweise und mit `0.6.0` um passive technische Datenschutzbeobachtungen ergänzt und mit `0.6.1` um eine summengleiche Kriterien- und `notApplicable`-Darstellung sowie mit `0.6.2` um die strikte Trennung von Nichtanwendbarkeit auf Punkt- und Kriterienebene korrigiert. Die Funktionsstände werden jeweils lokal und in installierten Verbraucherprojekten geprüft. Die reale Pilotmigration auf `0.6.0` wurde abgeschlossen; anschließend folgt bewusst ein Stabilisierungsfenster. Neue Assertions werden erst aus den dabei belegten Lücken priorisiert.
>
> Dieses Dokument bewahrt Planung, Entscheidungen, Sicherheitsanforderungen und Abnahmekriterien des frameworkunabhängigen Refactorings von `@mktcode/website-qa`. Es enthält keine ausgefüllten Nachweise oder Vorgaben für eine bestimmte Website. Zukunftsformulierungen in den historischen Planungsabschnitten beschreiben den damaligen Implementierungsweg und keine noch offene Zusage.
>
> Implementiert sind die gemeinsame Berichtsredaktion, `--json-file`, automatisch datierte lokale Bundles, bytegleiche technische Rohberichte für alle vier Prüfer, das Prüfsummenmanifest, der getrennte Whitelist-Markdownrenderer, kopierbare Projektvorlagen und die programmatische Reporting-API. Praxisumstellung, Social-Integration, installierter Verbrauchertest und beide Release-Tags wurden erfolgreich abgeschlossen.

## 1. Ausgangslage

Das Paket stellt vier unabhängige, ausschließlich lesende URL-Prüfer bereit:

- `website-qa-http`
- `website-qa-crawl`
- `website-qa-browser`
- `website-qa-social`

HTTP, Crawl, Browser und ab Paketversion 0.3.0 auch Social erzeugen strukturierte Assertions. Die Bibliothek `@mktcode/website-qa/report` kann gespeicherte technische JSON-Berichte mit manuellen beziehungsweise externen Projektnachweisen verbinden und daraus einen vollständigen JSON- und Markdown-Bericht ableiten.

Der erste Praxispilot hat die fachliche Trennung erfolgreich bestätigt:

- technische Assertions schließen fehlende manuelle oder externe Kriterien nicht automatisch;
- nur die festgelegte Auswertungsumgebung wird berücksichtigt;
- Ziel-URLs werden gegen technische Berichte geprüft;
- Quell- und Deploymentzuordnungen werden nicht als technisch bestätigt ausgegeben;
- der Berichtsgenerator führt selbst keine Netzwerkprüfung aus.

Vor dem Refactoring war die Projektintegration noch zu aufwendig:

- das Beispielskript schreibt Ausgaben in einen vorher manuell festgelegten Ordner;
- technische Rohberichte, Projektkonfiguration und Berichtsausgaben sind nicht als klarer Lebenszyklus beschrieben;
- im Praxispilot wurden technische Berichte einmalig außerhalb einer öffentlichen API verkleinert;
- das README zeigt APIs, aber noch keinen vollständigen Weg von Installation bis archiviertem Projektbericht;
- die URL-Redaktion ist zwischen HTTP, Crawl und Browser noch nicht einheitlich;
- die README-Installation verwies vor dem Refactoring noch auf `v0.1.0`, obwohl der Berichtspilot erst danach entstanden war.

## 2. Geänderte Nutzungsannahme

Der vorgesehene Hauptanwendungsfall ist **kein automatisch bei jedem Commit laufender CI-Job**.

Die Prüfungen sind bewusst umfangreich, erzeugen viele begrenzte Netzwerkabrufe und benötigen beim Browser-Check ein lokales Chromium. Sie werden deshalb typischerweise zu ausgewählten Zeitpunkten gestartet, beispielsweise:

- vor einer Veröffentlichung;
- nach einem Deployment;
- nach wesentlichen Inhalts-, Routing-, Header- oder Browseränderungen;
- bei einer periodischen Qualitätsprüfung;
- zur Erstellung oder Aktualisierung einer Projektakte.

Daraus folgen diese Leitlinien:

1. Kein GitHub-Actions- oder CI-Workflow wird vorausgesetzt oder automatisch ergänzt.
2. Kein Prüfer läuft bei `npm install`, `postinstall`, Commit oder Push automatisch.
3. Jeder Netzwerkprüfer bleibt einzeln und ausdrücklich aufrufbar.
4. Zielprojekte dürfen einen eigenen npm-Alias für ihre ausgewählten Prüfer anlegen.
5. Lokale JSON-Artefakte und vollständige Berichte werden standardmäßig nicht versioniert.
6. Für Git wird eine gesonderte, restriktiv erzeugte Markdown-Zusammenfassung angeboten.

CI bleibt technisch möglich, ist aber nicht der primär dokumentierte Einstieg.

## 3. Ziele des Refactorings

### 3.1 Hauptziele

- Installation und erster technischer Lauf sind im Haupt-README ohne Vorwissen nachvollziehbar.
- Wiederkehrende Prüfungen lassen sich mit wenigen projektspezifischen npm-Skripten ausführen.
- Ein Bericht wird ohne manuell benannten Datumsordner erzeugt.
- Jeder Berichtslauf erhält automatisch einen eindeutigen UTC-Zeitstempel.
- Das vollständige lokale Bundle enthält die unveränderten JSON-Ausgaben der verwendeten Prüfer.
- `report.json` enthält weiterhin die normalisierten, für die Auswertung verwendeten Assertions und Projektnachweise.
- `report.md` bleibt die vollständige menschenlesbare Sicht und gehört standardmäßig zum ignorierten Bundle.
- Eine getrennte Markdown-Zusammenfassung ist nach einem Whitelist-Prinzip für die Versionierung geeignet.
- Es gibt keinen manuellen Kompaktierungs- oder Kopierschritt für technische Assertions.
- Fehler, Warnungen, Limits und unklare Ergebnisse bleiben sichtbar und führen nicht zu positiven Nachweisen.

### 3.2 Nebenziele

- Alte programmatische APIs bleiben nach Möglichkeit nutzbar.
- Der Praxispilot kann später ohne Umschreiben seiner historischen Akte auf den neuen Ablauf verweisen.
- Die Integration ist für neue und bestehende npm-Projekte gleich verständlich.
- Die Paketdokumentation macht deutlich, welche Teile meinungsstarker Pilot und welche Teile allgemeine technische Werkzeuge sind.

## 4. Nichtziele

Dieses Refactoring führt ausdrücklich nicht ein:

- keinen fünften allgemeinen Netzwerk- oder Sammelprüfer;
- keinen verpflichtenden universellen `qa:local`-Befehl;
- keine automatische Änderung einer Projektcheckliste;
- keine automatische Produktionsfreigabe;
- keine vollständige WCAG-, Rechts-, Datenschutz- oder Sicherheitsbewertung;
- keine GitHub Actions, Registry-Tokens oder automatische Release-Infrastruktur;
- im ursprünglichen `0.2.0`-Refactoring keine Social-Assertions im strukturierten Projektbericht; diese gesonderte Integration wurde mit `0.3.0` abgeschlossen;
- keine Formulareingaben, Klicks oder andere mutierende Websiteinteraktionen;
- keine automatische Ermittlung eines ausgelieferten Quellcommits aus einer URL-Prüfung.

## 5. Zielbild der Artefakte

### 5.1 Ignoriertes vollständiges Bundle

Ein Berichtslauf erzeugt standardmäßig einen neuen, nicht überschriebenen Ordner:

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

Der Ordnername verwendet UTC und ein dateisystemtaugliches ISO-Format. Falls derselbe Name bereits existiert, wird geschlossen abgebrochen oder ein eindeutig dokumentierter Suffix vergeben; ein vorhandener Bericht wird niemals überschrieben.

Bedeutung der Dateien:

| Datei | Inhalt | Standardmäßig versionieren? |
|---|---|---:|
| `technical/http.json` | vollständige JSON-Ausgabe des HTTP-Prüfers | nein |
| `technical/crawl.json` | vollständige JSON-Ausgabe des Crawl-Prüfers | nein |
| `technical/browser.json` | vollständige JSON-Ausgabe des Browser-Prüfers | nein |
| `technical/social.json` | vollständige JSON-Ausgabe des Social-Prüfers | nein |
| `report.json` | strukturierte Gesamtauswertung mit atomaren Nachweisen | nein |
| `report.md` | vollständige menschenlesbare Gesamtauswertung | nein |
| `manifest.json` | Laufzeiten, Werkzeugstände, relative Dateipfade, Größen und Prüfsummen | nein |

„Vollständig“ und „unverändert“ bedeuten: Die Dateien entsprechen exakt der JSON-Ausgabe des jeweiligen Werkzeugstands. Notwendige Redaktionen müssen deshalb bereits im jeweiligen Prüfer beziehungsweise in gemeinsamer Berichtslogik stattfinden und dürfen nicht erst beim Bundling improvisiert werden.

### 5.2 Versionierbare Zusammenfassung

Zusätzlich wird eine getrennte Markdown-Datei erzeugt, beispielsweise:

```text
docs/website-qa/berichte/
└── 2026-08-24T18-04-17Z.md
```

Diese Datei wird **nicht** durch Kürzen des vollständigen Markdown-Berichts erzeugt. Sie erhält einen eigenen Renderer mit einer engen Positivliste erlaubter Felder.

Vorgesehener Inhalt:

- Erstellungszeit;
- Pilotkatalog und Version;
- verwendete Werkzeugnamen und Paketversionen;
- Anzahl technischer Läufe und deren Auswertungsstatus;
- zusammengefasste Anzahl bestandener, fehlgeschlagener, teilweiser, offener und unklarer Punkte;
- stabile Checklistenkennungen und allgemeine Katalogtexte offener beziehungsweise fehlgeschlagener Punkte;
- Anzahl fehlender manueller und externer Nachweise;
- allgemeine Grenzen des Berichts.

Standardmäßig ausgeschlossen:

- vollständige Roh- oder Assertion-Subjects;
- Querywerte und URL-Fragmente;
- Ressourcen-, Link-, Formular- und DOM-Inventare;
- Headerwerte;
- Browserkonsole und JavaScript-Fehlertexte;
- Cookie-, Storage- und IndexedDB-Inventare;
- Axe-Selektoren und konkrete DOM-Pfade;
- freie Notizen aus manuellen Nachweisen;
- Namen prüfender oder freigebender Personen;
- Referenzen auf vertrauliche Projektakten;
- interne Umgebungs-, Infrastruktur-, Quell- oder Deploymentkennungen;
- exakte Befehle und lokale Dateipfade.

Projektname und öffentliche Ziel-URL werden nur aufgenommen, wenn die Projektkonfiguration sie ausdrücklich als für die versionierte Zusammenfassung freigegeben kennzeichnet. Die Zusammenfassung darf nicht allein aufgrund ihres Dateinamens oder Zielordners als garantiert öffentlich geeignet bezeichnet werden; vor Veröffentlichung bleibt eine kurze Projektprüfung erforderlich.

## 6. Empfohlene `.gitignore`-Strategie

Generierte Vollberichte und Arbeitsdateien werden standardmäßig ignoriert:

```gitignore
# Vollständige lokale Website-QA-Läufe und Rohberichte
.website-qa/
```

Die versionierbaren Zusammenfassungen liegen bewusst außerhalb dieses Ordners:

```text
docs/website-qa/berichte/
```

Dadurch sind keine komplexen Negationsregeln in `.gitignore` erforderlich.

Projektkonfiguration, npm-Skripte und bewusst gepflegte allgemeine Nachweise sind keine generierten Rohartefakte. Ob eine manuelle Nachweisdatei versioniert werden darf, entscheidet das Zielprojekt anhand ihres Inhalts. Vertrauliche Unterlagen werden weiterhin nur referenziert und nicht kopiert.

## 7. Trennung von Prüfung und Bericht

Die Reporting-Bibliothek bleibt rein dateibasiert und führt keine Netzwerkprüfung aus.

Ein transparenter Ablauf lautet:

```bash
npm run qa:http
npm run qa:crawl
npm run qa:browser
npm run qa:social
npm run qa:report
```

- `qa:http`, `qa:crawl`, `qa:browser` und `qa:social` starten die jeweiligen Netzwerkprüfer.
- `qa:report` liest bereits erzeugte technische JSON-Dateien und Projektnachweise.
- `qa:report` erzeugt das automatisch datierte Bundle und die getrennte Zusammenfassung.

Ein Zielprojekt kann zusätzlich einen eigenen Befehl anbieten:

```bash
npm run qa:website
```

Dieser Alias darf die vom Projekt ausgewählten Einzelprüfer und anschließend die Berichtserzeugung nacheinander starten. Er bleibt projektspezifisch und wird nicht als universeller fünfter Paketbefehl eingeführt.

Die öffentliche Dokumentation muss bei einem kombinierten Projektskript klar sichtbar machen, dass der Aufruf Netzwerkprüfungen startet. Der Berichtsschritt allein bleibt garantiert ohne Netzwerkzugriff.

## 8. Projektkonfiguration und Eingaben

### 8.1 Stabil versionierbare Projektkonfiguration

Die bestehende Konfiguration kann grundsätzlich weiterverwendet werden. Für eine einfache Integration sollten technische Eingabepfade auf einen ignorierten Arbeitsbereich zeigen, beispielsweise:

```text
.website-qa/current/http.json
.website-qa/current/crawl.json
.website-qa/current/browser.json
.website-qa/current/social.json
```

Eine Projektkonfiguration legt weiterhin fest:

- Projektbezeichnung;
- optional freigegebene öffentliche Bezeichnung und URL für die Zusammenfassung;
- Auswertungsumgebung;
- ausgewählte Katalogmodule;
- technische Ziel-URLs und Werkzeuge;
- Pfad zu manuellen beziehungsweise externen Nachweisen;
- optional deklarierte Quell- und Deploymentzuordnung;
- Ausgabegrundverzeichnisse für Bundle und Zusammenfassung.

Run-spezifische Daten wie tatsächliche Werkzeugzeitpunkte stammen aus den technischen Berichten und werden nicht von einem Verzeichnisnamen abgeleitet.

### 8.2 Manuelle und externe Nachweise

Die Nachweisdatei bleibt eine bewusste Projekteingabe. Sie wird nicht automatisch aus Markdown-Checkboxen erzeugt und nicht aus einem erfolgreichen technischen Lauf abgeleitet.

Der vollständige `report.json` übernimmt die tatsächlich für die Auswertung verwendeten Nachweise. Die versionierbare Zusammenfassung enthält nur Zählwerte und allgemeine Kriterien, keine freien Nachweisnotizen.

Relative Nachweisreferenzen benötigen eine eindeutig dokumentierte Basis. Beim Bundling dürfen sie nicht durch blindes Kopieren in einen anderen Ordner semantisch verändert werden. Für die erste Bundle-Version werden Eingabedateien daher nicht automatisch an einen neuen Ort umgeschrieben. Der vollständige Bericht enthält die ausgewerteten Records; das Manifest kann Quellpfad und Prüfsumme der Eingabedatei dokumentieren, ohne ihren vertraulichen Inhalt zusätzlich zu kopieren.

## 9. Öffentliche Reporting-API

Die vorhandenen Funktionen sind erhalten geblieben:

- `createPilotProjectReport`
- `createPilotProjectReportFromFiles`
- `renderPilotProjectReportMarkdown`

Ergänzend wurde die Bundle-Funktion unter dem festgelegten Namen `writePilotProjectReportBundle` implementiert:

```js
import { writePilotProjectReportBundle } from '@mktcode/website-qa/report'

const result = writePilotProjectReportBundle({
  configFile: './website-qa.project.json',
  bundleDirectory: './.website-qa/reports',
  summaryDirectory: './docs/website-qa/berichte',
})

console.info(result.bundleDirectory)
console.info(result.summaryFile)
```

Anforderungen:

- genau ein Zeitobjekt pro Bundle-Erzeugung verwenden;
- Zeit für Tests injizierbar machen;
- Verzeichnisse sicher und ohne Überschreiben erzeugen;
- technische Eingabedateien bytegenau nach `technical/` kopieren;
- den Projektbericht aus genau diesen archivierten Dateien ableiten;
- relative technische Berichtspfade im erzeugten Bericht auf das Bundle beziehen;
- vollständiges JSON und Markdown schreiben;
- separate sichere Zusammenfassung rendern;
- Dateigrößen und SHA-256-Prüfsummen im Manifest festhalten;
- bei unvollständigen oder widersprüchlichen Eingaben geschlossen abbrechen;
- keine Netzwerkfunktion importieren oder aufrufen;
- keine Projektcheckliste bearbeiten.

Dateischreibende Schritte sollten zunächst in einem temporären Nachbarordner erfolgen. Erst nach erfolgreicher Validierung wird der vollständige Ordner atomar auf seinen finalen Zeitstempelnamen verschoben. Fehlgeschlagene Erzeugungen dürfen keinen scheinbar vollständigen Bericht hinterlassen.

## 10. Projektlokales Berichtsskript

Das implementierte kopierbare Beispielskript bleibt bewusst klein:

```js
#!/usr/bin/env node

import { writePilotProjectReportBundle } from '@mktcode/website-qa/report'

const configFile = process.argv[2] || './website-qa.project.json'
const result = writePilotProjectReportBundle({ configFile })

console.info(`Vollständiger Bericht: ${result.bundleDirectory}`)
console.info(`Versionierbare Zusammenfassung: ${result.summaryFile}`)
```

Beispiel für `package.json`:

```json
{
  "scripts": {
    "qa:http": "website-qa-http https://example.com/ --strict --json",
    "qa:crawl": "website-qa-crawl https://example.com/ --sitemap --max-pages=50 --max-resources=500 --strict --json",
    "qa:browser": "website-qa-browser https://example.com/ --sitemap --max-pages=10 --max-requests=300 --strict --json",
    "qa:social": "website-qa-social https://example.com/ --sitemap --max-pages=20 --strict --json",
    "qa:report": "node scripts/website-qa-report.mjs"
  }
}
```

Die Beispiele für das Schreiben der technischen JSON-Dateien müssen plattformunabhängig und fehlertolerant ausgearbeitet werden. Einfache Shell-Weiterleitungen sind als Erklärung geeignet, aber für eine allgemein kopierbare Integration problematisch, weil:

- das Zielverzeichnis vorher existieren muss;
- Windows-Shells abweichen;
- ein Prüfer mit Exitcode 1 dennoch einen fachlich wichtigen JSON-Bericht erzeugt;
- mehrere Prüfer trotz eines Einzelbefunds vollständig ausgeführt werden sollen.

Vor Implementierung ist deshalb zu entscheiden, ob die vorhandenen CLIs eine sichere JSON-Dateiausgabe erhalten oder ob ein kleines projektlokales Node-Skript stdout und Exitcodes verwaltet. Ein allgemeiner Netzwerk-Sammelbefehl im Paket bleibt ausgeschlossen.

## 11. Sicherheits- und Redaktionsarbeiten als Voraussetzung

Vollständige Rohberichte dürfen erst als regulärer Bundlebestandteil empfohlen werden, wenn die gemeinsame Redaktionsgrenze nachweisbar ist.

### 11.1 Bekannter aktueller Stand

- Browser-URLs werden bereits ohne Querywerte protokolliert; Queryparameternamen können getrennt erfasst werden.
- Browsercookies werden ohne Werte protokolliert.
- Local- und Session-Storage werden nur über Schlüsselnamen inventarisiert.
- IndexedDB wird nur über Datenbanknamen inventarisiert.
- Konsolen- und JavaScript-Fehlertexte werden begrenzt und teilweise redigiert.
- HTTP- und Crawl-Berichte können noch vollständige URLs aus Eingaben, Redirects, Links, Formular-Actions und Ressourceninventaren enthalten.
- Freie Konsolentexte oder öffentlich ausgelieferte DOM-Daten können trotz technischer Redaktion projektspezifisch unerwünscht sein.

### 11.2 Erforderliche Maßnahmen

1. Eine gemeinsame URL-Berichtsfunktion in `src/lib/http-client.mjs` einführen.
2. URL-Zugangsdaten vollständig ablehnen und niemals in Fehlermeldungen wiederholen.
3. Querywerte in allen Berichten entfernen; nur ausdrücklich benötigte Parameternamen dokumentieren.
4. Fragmente standardmäßig entfernen.
5. HTTP-, Crawl-, Browser- und Social-Ausgaben auf dieselbe Redaktionslogik umstellen.
6. Fehlermeldungen aus URL-Validierung, DNS, Redirects und Timeouts ebenfalls redigieren.
7. Konsolen- und Laufzeittexte weiterhin begrenzen und bekannte Secretmuster redigieren.
8. Tests mit Token-, Auth-, Code-, E-Mail- und frei benannten Queryparametern ergänzen; Werte dürfen weder in Text- noch JSON-Ausgaben erscheinen.
9. Browserberichte müssen weiterhin nachweisen, dass Cookiewerte, Storagewerte und persistente Profile fehlen.
10. README und Zusammenfassung müssen darauf hinweisen, dass vollständige Rohberichte vor Veröffentlichung projektspezifisch zu prüfen sind.

Die Redaktion darf Befunde nicht verfälschen. Für Redirectprüfungen kann intern weiterhin der vollständige Wert verglichen werden; im Bericht erscheinen nur redigierte URLs und das fachliche Vergleichsergebnis.

## 12. Umgang mit Exitcodes und fehlgeschlagenen Läufen

Die vorhandenen Exitcodes bleiben fachlich wichtig:

- `0`: Prüfung bestanden;
- `1`: technischer Befund beziehungsweise Warnung im strikten Modus;
- `2`: Aufruf- oder Laufzeitfehler.

Ein Exitcode 1 erzeugt weiterhin einen gültigen JSON-Bericht und muss in ein Bundle aufgenommen werden können. Ein Projektskript darf den Bericht nicht verlieren, nur weil die Prüfung fachlich fehlschlägt.

Ein Exitcode 2 kann lediglich einen Fehlerbericht ohne vollständige Assertions erzeugen. Dafür ist festzulegen:

- der technische Fehleroutput wird zur Diagnose lokal aufbewahrt;
- er darf nicht als erfolgreicher technischer Lauf ausgewertet werden;
- die Bundle-Erzeugung bricht entweder geschlossen ab oder erzeugt einen klar als unvollständig markierten Laufdatensatz ohne Checklistenfortschritt;
- ein unvollständiger Lauf darf niemals zu `pass` aggregiert werden.

Die bevorzugte erste Implementierung ist ein geschlossener Abbruch des vollständigen Projektberichts bei strukturell ungültigen Eingaben. Diagnosedateien bleiben im ignorierten Arbeitsverzeichnis. Eine spätere explizite Darstellung abgebrochener Läufe kann mit eigenem Schema ergänzt werden.

## 13. Manifest und Nachvollziehbarkeit

`manifest.json` beschreibt das lokale Bundle, ohne die fachliche Auswertung zu duplizieren. Vorgesehene Felder:

- Manifestschema;
- Start- und Abschlusszeit der Bundle-Erzeugung;
- Paketname und -version;
- Katalogkennung und -version;
- relative Pfade aller Bundledateien;
- Dateigrößen und SHA-256-Prüfsummen der technischen Rohberichte;
- Werkzeugkennung und `generatedAt` je technischem Bericht;
- deklarierte Auswertungsumgebung;
- Information, ob der jeweilige Lauf ausgewertet wurde.

Exakte Befehle werden bereits im vollständigen Projektbericht dokumentiert. Falls sie zusätzlich im Manifest stehen, müssen sie dieselbe Redaktionsregel erfüllen und dürfen keine Zugangsdaten, internen Pfade oder sensitiven Querywerte enthalten.

Das Manifest ist kein kryptografisch signierter Nachweis. Prüfsummen belegen nur die interne Zuordnung der Dateien innerhalb des Bundles.

## 14. README- und Vorlagenkonzept

Das Haupt-README soll folgende Reihenfolge erhalten:

1. Zweck, Grenzen und unterstützte Node-Version;
2. Installation von einem unveränderlichen Tag oder Commit;
3. technischer Schnellstart ohne Projektbericht;
4. wiederkehrende npm-Skripte;
5. JSON-Ausgaben und Exitcodes;
6. vollständiger lokaler Projektbericht;
7. versionierbare sichere Zusammenfassung;
8. empfohlene `.gitignore`-Einträge;
9. manuelle und externe Nachweise;
10. lokale/private Ziele und Chromium-Voraussetzung;
11. Sicherheitsgrenzen;
12. Entwicklung des Pakets.

Zusätzlich werden kopierbare allgemeine Beispiele benötigt:

- `website-qa.project.json`;
- optionale leere beziehungsweise minimale Nachweisdatei;
- `scripts/website-qa-report.mjs`;
- `package.json`-Ausschnitt;
- `.gitignore`-Ausschnitt;
- erwartete Ausgabestruktur.

Die Beispiele dürfen keine reale Domain, projektspezifische Route, Seitenzahl, Frameworkannahme oder organisationsspezifische Freigabe enthalten.

## 15. Kompatibilität und Schemas

- Die vier bestehenden Binärnamen bleiben unverändert.
- Bestehende Text- und JSON-Ausgaben bleiben soweit möglich kompatibel.
- `createPilotProjectReportFromFiles` bleibt verfügbar.
- Die Bundle-API ist eine additive öffentliche Schnittstelle.
- Ein neues Manifestschema wird separat versioniert.
- Die versionierbare Markdown-Zusammenfassung erhält keinen Anspruch auf vollständige Reproduzierbarkeit; dafür dient das lokale Bundle.
- Änderungen an `project-report.schema.json` und `project-report.output.schema.json` werden nur vorgenommen, wenn die Bundlepfade oder Freigaben für die öffentliche Zusammenfassung nicht außerhalb der bestehenden Projektkonfiguration abbildbar sind.
- Neue optionale Felder dürfen alte Konfigurationen nicht stillschweigend inhaltlich umdeuten.
- Eine Katalogversion wird nur geändert, wenn Kriterien oder fachliche Bedeutungen geändert werden; reine Bundle- und Rendererfunktionen erhalten keine neue fachliche Checklistenbedeutung.

## 16. Umgesetzte Implementierungsphasen

### Phase A – Verträge und Redaktion

1. Gemeinsames redigiertes URL-Berichtsformat festlegen.
2. HTTP-, Crawl-, Browser- und Social-Berichte auf vollständige Querywertredaktion prüfen.
3. Gemeinsame Implementierung in `src/lib/http-client.mjs` ergänzen.
4. Positiv-, Negativ- und Regressionstests für Text- und JSON-Ausgaben ergänzen.
5. Auswirkungen auf bestehende Beispielberichte dokumentieren.

**Abnahmekriterium:** Kein kontrollierter sensitiver Testwert erscheint in einem technischen Bericht oder einer Fehlermeldung.

### Phase B – Sicherer Zusammenfassungsrenderer

1. Eigenes Datenmodell für die versionierbare Zusammenfassung festlegen.
2. Whitelist-Renderer implementieren; nicht vom vollständigen Markdown ableiten.
3. Tests mit vertraulich wirkenden Projekt-, Deployment-, Befehls-, Nachweis- und URLwerten ergänzen.
4. Sicherstellen, dass nur freigegebene beziehungsweise allgemeine Felder erscheinen.

**Abnahmekriterium:** Testgeheimnisse aus allen vollständigen Eingaben fehlen vollständig in der Zusammenfassung.

### Phase C – Automatisch datiertes Bundle

1. Zeitstempel- und Kollisionslogik implementieren.
2. Rohberichte bytegenau in einen temporären Bundleordner kopieren.
3. Bericht aus den kopierten Dateien erzeugen.
4. `report.json`, `report.md`, `manifest.json` und Zusammenfassung schreiben.
5. Prüfsummen, Größen und relative Pfade prüfen.
6. Bundle erst nach vollständiger Validierung atomar veröffentlichen.

**Abnahmekriterium:** Ein Funktionsaufruf erzeugt ohne manuelle Pfad- oder Datumswahl ein vollständiges, intern konsistentes Bundle und genau eine getrennte Zusammenfassung.

### Phase D – Projektintegration und npm-Skripte

1. Plattformunabhängige Erzeugung technischer Eingabedateien festlegen.
2. Kopierbares Projektskript und Konfiguration bereitstellen.
3. npm-Script-Beispiele für Einzelprüfer und Bericht ergänzen.
4. `.gitignore`-Empfehlung dokumentieren.
5. Beispiele in einem temporären Verbraucherprojekt installieren und ausführen.

**Abnahmekriterium:** Ein neues npm-Projekt kann nach Installation und Kopieren der dokumentierten Minimaldateien einen technischen Lauf und ein Bundle erzeugen, ohne Paketquellcode zu kopieren oder zu verändern.

### Phase E – Praxispilot migrieren

1. Historischen Bericht unverändert als historischen Nachweis behandeln.
2. Für einen neuen Prüfstand den neuen Ablauf im echten Websiteprojekt verwenden.
3. Nur die sichere Zusammenfassung versionieren; vollständiges Bundle gemäß Projektentscheidung ignorieren.
4. Verständlichkeit, Dateigrößen, Wiederholbarkeit und Fehlerfälle bewerten.

**Abnahmekriterium:** Der neue Pilot benötigt keinen einmaligen Kompaktierungs- oder manuellen Datumsordnerschritt.

### Phase F – Dokumentation, Version und Veröffentlichung

1. Haupt-README und Katalogdokumentation aktualisieren.
2. Relative Markdown-Links prüfen.
3. `npm ci`, `npm run check` und `npm pack --dry-run` mit Node 22 ausführen.
4. Tarball in einem temporären Verbraucherprojekt installieren.
5. Betroffene installierte CLIs, Exporte und Beispielintegration prüfen.
6. Paketversion bewusst anheben und Migrationshinweis verfassen.
7. Erst danach einen neuen geprüften Tag erstellen.

## 17. Testplan

### 17.1 Redaktion

- beliebige Querywerte, nicht nur bekannte Parameternamen;
- Benutzername und Passwort in URL-Eingaben;
- Redirect-Location mit Tokenwert;
- interne und externe Links mit sensitiven Parametern;
- Formular-Action mit Querywert;
- Sitemap-URL und Sitemap-Eintrag mit Querywert;
- Browserkonsole mit URL, Token und freiem Secretmuster;
- Fehlertexte aus DNS, Timeout und URL-Validierung;
- Nachweis, dass Parameternamen bei Bedarf erhalten bleiben, Werte aber nicht.

### 17.2 Bundle

- fest injizierter Zeitpunkt erzeugt deterministischen Namen;
- vorhandener Zielordner wird nicht überschrieben;
- mehrere technische Läufe desselben Werkzeugs erhalten eindeutige Namen;
- bytegleiche Kopie und passende SHA-256-Prüfsumme;
- vollständige und singuläre Berichtsform (`results[]` beziehungsweise `result`);
- technische Läufe außerhalb der Auswertungsumgebung bleiben sichtbar, aber unberücksichtigt;
- abweichende Ziel-URL sowie Quell-/Deploymentwiderspruch brechen geschlossen ab;
- Schreibfehler hinterlassen keinen finalen scheinbar vollständigen Ordner;
- fehlende optionale Nachweisdatei funktioniert;
- fehlerhafte JSON-Datei bricht verständlich ab.

### 17.3 Sichere Zusammenfassung

- enthält erwartete Zählwerte, IDs, allgemeine Aussagen und Grenzen;
- enthält keine Rohassertionen, Befundtexte oder DOM-Selektoren;
- enthält keine Nachweisnotizen, Personen oder Referenzen;
- enthält keine Quell-/Deploymentkennung;
- enthält keine lokalen Pfade oder exakten Befehle;
- enthält keine nicht ausdrücklich freigegebene Projektbezeichnung oder URL;
- kann nicht durch Markdownzeichen in freigegebenen Labels strukturell manipuliert werden.

### 17.4 Installierter Verbraucher

- Installation von Tarball beziehungsweise unveränderlichem Commit;
- symlink-sichere Binärdateien;
- alle vier `--help`-Aufrufe;
- HTTP-, Crawl-, Browser- und Social-JSON gegen lokale kurzlebige Testserver;
- echter Chromium-Nebenwirkungstest;
- Bundle-Erzeugung aus installierter Reporting-Bibliothek;
- Berichtserzeugung ohne Netzwerkzugriff;
- `.gitignore` lässt nur die vorgesehene Markdown-Zusammenfassung sichtbar.

## 18. Entschiedene Detailfragen

1. **Zusammenfassungsverlauf:** Jeder Lauf erzeugt eine datierte Markdown-Datei; eine automatisch gepflegte `latest.md` gibt es zunächst nicht.
2. **Zeitformat:** Der Dateiname verwendet UTC mit Sekundenauflösung. Eine Kollision bricht geschlossen ab und überschreibt keine vorhandene Datei.
3. **Öffentliche Bezeichnung:** Projektbezeichnung und URL fehlen standardmäßig. Sie werden ausschließlich über `publicProject` ausdrücklich für die Zusammenfassung freigegeben.
4. **Technische Dateierzeugung:** Alle vier CLIs unterstützen `--json-file=<Pfad>`. Die Option impliziert JSON, legt Elternverzeichnisse an und ersetzt die lokale Arbeitsdatei atomar.
5. **Abgebrochene Läufe:** Diagnoseoutput bleibt im Arbeitsbereich; strukturell unvollständige Berichte erzeugen kein scheinbar vollständiges Bundle.
6. **Manifestbefehle:** Das Manifest dupliziert keine exakten Befehle. Diese stehen nur im vollständigen, ignorierten Bericht.
7. **Eingabesnapshots:** Projektkonfiguration und manuelle Nachweisdatei werden nicht blind in das Bundle kopiert. Der ausgewertete Bericht enthält die relevanten Records; relative Referenzen werden dadurch nicht stillschweigend umgedeutet.

## 19. Definition of Done

Die folgende Definition of Done wurde mit `v0.2.0` für den Bundle-Workflow und abschließend mit `v0.3.0` für die strukturierte Social-Integration erfüllt:

- ein klarer README-Schnellstart für technische Einzelprüfungen existiert;
- eine wiederkehrende Projektintegration mit wenigen npm-Skripten dokumentiert ist;
- Berichtsbundles automatisch datiert und niemals überschrieben werden;
- vollständige redigierte Rohberichte automatisch im Bundle enthalten sind;
- kein manueller Kompaktierungsschritt existiert;
- vollständiger JSON- und Markdown-Bericht automatisch entstehen;
- eine getrennte Whitelist-Zusammenfassung für Git erzeugt wird;
- `.website-qa/` standardmäßig ignoriert werden kann;
- automatische, manuelle und externe Nachweise weiterhin fachlich getrennt bleiben;
- der Berichtsgenerator nachweislich keine Netzwerkprüfung ausführt;
- keine neuen Browserinteraktionen oder schreibenden Websiteaufrufe eingeführt wurden;
- Sicherheits-, Schema-, Bundle-, Renderer- und Installationsprüfungen bestanden sind;
- ein neuer echter Projektpilot den Ablauf ohne Sonderbehandlung bestätigt hat;
- README, Paketversion und geprüfter Release-Tag konsistent sind.

## 20. Sitemap-, Crawl- und Ressourcenausbau mit 0.4.0

Die nächste Funktionsrunde ergänzt atomare Assertions für bereits vorhandene Beobachtungen zu:

- `CORE-MAP-01` und `CORE-MAP-02` für Sitemapabruf, XML-Struktur, robots.txt-Referenz, Einträge und vollständige Abdeckung innerhalb der Limits;
- `CORE-SEO-04` für interne Seiten- und Fragmentziele sowie den begrenzten allgemeinen GET-Crawl;
- `CORE-QA-05`, `CORE-QA-08` und `CORE-ERR-03` für interne Ressourcenstatus und MIME-Typen.

Dieser Ausbau öffnet keine neuen Netzwerkpfade. Externe Links bleiben ausschließlich inventarisiert, Formulare und Bedienelemente bleiben unangetastet und limitierte beziehungsweise sicherheitsbedingt ausgelassene Beobachtungen führen weiterhin zu `inconclusive`. Projektinventar, API- und Content-Negotiation-Fehler, optionale Sitemap-Metadaten und XSL, externe Links sowie dynamische oder interaktionsabhängige Ressourcen bleiben nicht automatisch belegbar.

Der unmittelbar anschließende Sicherheitsheaderausbau ist in Abschnitt 21 getrennt abgegrenzt. Technische Datenschutzbeobachtungen bleiben eine erst später zu entscheidende Ausbaustufe; manuelle, rechtliche, administrative und projektspezifische Kriterien bleiben davon unabhängig.

## 21. Sicherheitsheadernachweise mit 0.5.0

Die folgende Funktionsrunde strukturiert bereits vorhandene Beobachtungen des HTTP-Prüfers für `CORE-ERR-04`, `CORE-SEC-04` und `CORE-SEC-05`. Atomare Assertions unterscheiden:

- deklarierte Content-Security-Policy;
- syntaktisch erkennbaren Framing-Schutz über CSP `frame-ancestors` oder `X-Frame-Options`;
- wirksames `X-Content-Type-Options: nosniff`;
- deklarierte Referrer Policy und Permissions Policy;
- HSTS-Präsenz und Mindestlaufzeit;
- vollständige Beobachtung aller automatisch ausgewählten Antwortklassen.

Der Prüfer verwendet dafür ausschließlich die ohnehin abgerufenen Antworten für reguläres HTML, die nebenwirkungsfreie 404-Probe und je eine bereits ausgewählte CSS-/JavaScript-Ressource. Abruffehler führen bei der Abdeckung zu `inconclusive`, ausdrücklich zugelassene HTTP-Antworten bei HSTS zu `notApplicable`. Es werden keine weiteren Hosts, Redirectziele, APIs oder Ressourcenklassen angefordert.

Bloße Headerpräsenz ist kein Vollschutz. Inhalt und Widerspruchsfreiheit von Richtlinien, projektspezifische Risiken, weitere öffentliche Antwortklassen, alternative Hosts, app- und proxyseitige Redirectheader sowie die tatsächliche Anwendung-/Proxygrenze bleiben manuelle oder infrastrukturelle Nachweise. Der anschließende passive Datenschutzbeobachtungsausbau ist in Abschnitt 22 eigenständig abgegrenzt.

## 22. Passive technische Datenschutzbeobachtungen mit 0.6.0

Die folgende Funktionsrunde strukturiert bereits vorhandene Browserbeobachtungen für `CORE-PRIV-02` und `CORE-PRIV-04`. Das Ziel ist ein ausführlicher technischer Befundbericht für die anschließende Bewertung durch kompetente Entwicklerinnen und Entwickler, keine automatische Datenschutz-, Einwilligungs- oder Rechtsfreigabe.

Zwei atomare Assertions belegen ausschließlich:

- dass externe Requestversuche innerhalb der deklarierten passiven, isolierten Seiten-/Profilumgebung vollständig inventarisiert und weiterhin blockiert wurden;
- dass Cookies, Local Storage, Session Storage und IndexedDB im Initialzustand frischer Browserkontexte vollständig und ohne ihre Werte inventarisiert wurden.

Die normalisierte Beobachtung dokumentiert Seiten, Profile, Chromium-Kontext, Beobachtungszeit, blockierte Netzwerk- und Browseraktionsversuche sowie aggregierte Cookie- und Storagezahlen. Vollständige lokale Browserberichte behalten redigierte technische Bezeichner und Cookieattribute für die manuelle Zuordnung; Werte werden nie in den Bericht übernommen. Ein festes Limit von 100 Bezeichnern je Art und Seiten-/Profil-Lauf begrenzt die Ausgabe. Überschreitungen, unvollständige Seiten-/Profilläufe, Seiten- oder Requestlimits und relevante Sicherheitsauslassungen führen beim abhängigen Nachweis zu `inconclusive`.

Ein blockierter externer Versuch ist ein sichtbarer Befund und zugleich eine vollständig beobachtete, aber nicht ausgeführte Anfrage. Seine Existenz macht die Beobachtungsassertion deshalb nicht automatisch negativ; Zulässigkeit, Zweck, Quell- und Konfigurationszuordnung sowie mögliche Einwilligung werden manuell bewertet. Ebenso ist das Fehlen von Cookies oder Storage im isolierten Lauf kein Beweis für interaktionsabhängige Zustände. Blockierte Drittanbieter können in dieser Umgebung keine eigenen Speicherwerte setzen.

`CORE-PRIV-02` verbindet den automatischen Beobachtungsnachweis mit einem manuellen Abgleich gegen Quellcode, Build-/Laufzeitkonfiguration und dokumentierte Dienste. `CORE-PRIV-04` verbindet das technische Initialinventar mit manueller Dokumentations-/Einwilligungsprüfung und der fachlichen Bewertung von `Secure`, `HttpOnly` und `SameSite` für sicherheitsrelevante Cookies.

Es werden keine neuen Requests, externen Freigaben, Klicks, Consent-Interaktionen, Formulare oder persistenten Browserprofile eingeführt. Automatische Retries transienter Browserfehler gehören nicht zu dieser Runde; unvollständige Läufe bleiben sichtbar.

## 23. Nächste Konsolidierungs- und Reifephase nach 0.6.0

`0.6.0` ist für den erklärten Umfang technisch belastbar und lokal, als installierter Tarball sowie gegen ein öffentliches Regressionstestziel geprüft. Der Katalog bleibt dennoch ein Pilot: Die vollständige Website-QS enthält zahlreiche manuelle, externe, administrative, rechtliche, betriebliche und projektspezifische Punkte, die nicht durch zusätzliche URL-Assertions ersetzt werden dürfen. Die nächste Phase optimiert deshalb nicht auf eine möglichst hohe Checkzahl.

### Phase G – Bestehenden Praxispiloten kontrolliert migrieren

**Status 26. August 2026: abgeschlossen.** Der reale Verbraucher wurde vom strukturierten Stand `0.3.0` auf den unveränderlichen Releasecommit von `0.6.0` und Katalog `1.0.0-pilot.7` migriert. Alle vier neuen technischen Läufe bestanden mit insgesamt 136 Assertions; das Bundle enthält bytegleiche Eingaben und sechs verifizierte Manifestdateien. 29 von 34 Punkten sind vollständig, vier teilweise und einer offen. Alle 57 automatischen Kriterien bestanden; sechs nicht automatische Kriterien blieben ohne Nachweis und wurden weder simuliert noch automatisch geschlossen. Die Migration veränderte keine Websiteauslieferung und führte ausschließlich GET-basierte öffentliche Prüfungen aus.

1. Das bestehende Verbraucherprojekt auf den unveränderlichen Werkzeugstand `0.6.0` aktualisieren.
2. Projektkonfiguration und Evidence-Datei ausdrücklich auf Katalog `1.0.0-pilot.7` umstellen.
3. Alle vier technischen Läufe mit demselben Werkzeug- und Katalogstand neu erzeugen; alte Berichte werden nicht mit neuen Katalogen vermischt.
4. Bestehende manuelle oder externe Nachweise nur anhand unveränderter Kriterienkennungen und tatsächlich passender Aussagen übernehmen.
5. Seit `0.3.0` neu hinzugekommene Sitemap-, Ressourcen-, Sicherheitsheader- und Datenschutzkriterien fachlich bewerten; fehlende Nachweise bleiben offen.
6. Ein neues ignoriertes Vollbundle und eine getrennte Whitelist-Zusammenfassung erzeugen und auf Redaktion, Bytegleichheit und Manifestkonsistenz prüfen.
7. Projektcheckliste und Prüfprotokoll nur aufgrund der tatsächlich ausgeführten technischen und manuellen Prüfung fortschreiben; die Berichtserzeugung selbst hakt nichts ab.

**Abnahmekriterium:** Der vollständige Upgradepfad von `0.3.0` auf `0.6.0` ist in einem realen Verbraucherprojekt ohne Sonderformat, Nachweissimulation oder Lockerung der Nur-Lese-Grenzen nachvollzogen.

### Phase H – Stabilisierungsfenster

Nach der Pilotmigration werden zunächst Praxisbefunde gesammelt:

- Verständlichkeit der neuen `pass`-, `fail`- und `inconclusive`-Aussagen;
- Größe, Redundanz und Redaktionsgrenzen vollständiger Berichte;
- praktische Pflege manueller und externer Kriterien;
- Aussagekraft von Abdeckungs-, Limit- und Umgebungsangaben;
- Upgradeaufwand für Konfiguration, Evidence-Datei und sichere Zusammenfassung.

Korrekturen an Fehlern, Redaktion oder Dokumentation sind in dieser Phase gegenüber neuen fachlichen Assertions vorrangig. Ein reiner Dokumentationsabschluss oder eine fehlerkompatible Wartung erzwingt nicht automatisch eine neue Funktionsversion.

Erste Beobachtungen aus der abgeschlossenen Migration:

- Die Versions- und Katalogumstellung sowie die kontrollierte Übernahme stabiler Evidence-IDs funktionierten ohne Sonderformat.
- Das mit `0.6.1` neu gerenderte vollständige Bundle umfasst 858.885 Byte (rund 839 KiB): 608.041 Byte technische Eingaben sowie 250.844 Byte abgeleitete JSON-, Markdown- und Manifestdaten. Die getrennte versionierbare Zusammenfassung umfasst 3.179 Byte und blieb frei von Projektname, Ziel-URL, Befundtexten und lokalen Pfaden. Der Umfang ist lokal weiterhin handhabbar, wird aber vor dem stabilen Berichtsvertrag bewusst beobachtet.
- Die Pilotmigration zeigte eine redaktionelle Lücke: Die Kriterienkurzzeilen nannten nicht alle im JSON korrekt gezählten Kategorien, und ein nicht anwendbares Kriterium erschien in der Detailübersicht wie ungeklärt. Die Patchkorrektur `0.6.1` weist Gesamtzahl, fehlgeschlagene, unklare, nicht zutreffende und nicht belegte Kriterien summengleich aus; `pass` und `notApplicable` zählen in der Detailübersicht als geklärt. Schemas, Katalog, Assertions und technische Netzwerkprüfer bleiben unverändert.
- `0.6.1` wurde anschließend im realen Verbraucher installiert. Der korrigierte Generator verarbeitete die vier bytegleichen technischen 0.6.0-Berichte ohne neue Netzwerkprüfung, wies Generator- und Technikversionen getrennt im Manifest aus und bestand dort frische Installation, Lint, Typecheck, 22 Unit-Tests und Produktionsbuild.
- Die bewusst offenen API-/Content-Negotiation-, External-Link-, Textzoom-, Mobilgerät-, Screenreader- und Plattformkriterien blieben trotz vollständig grüner technischer Läufe sichtbar.

Systematischer Renderer- und Praxisreview vom 27. August 2026:

- Eine aus echten Auswertungen erzeugte Testmatrix deckt alle fünf Kriterienergebnisse (`pass`, `fail`, `inconclusive`, `notApplicable`, `noEvidence`), alle sechs abgeleiteten Punktzustände und alle vier expliziten Workflowzustände ab. Punkt- und Kriteriensummen werden gegen ihre Gesamtzahl geprüft; vollständiger und datenreduzierter Renderer weisen alle Punktzustände konsistent aus.
- Dabei wurde eine zweite eng begrenzte Darstellungslücke gefunden: Eine Nichtanwendbarkeit auf Punktebene markierte bisher auch fachlich fehlende oder negative Kriteriennachweise als abgehakt, obwohl die Kriterienübersicht sie korrekt nicht als geklärt zählte. Der Renderer trennt nun beide Ebenen; nur ein eigenes Kriterienergebnis `pass` oder `notApplicable` setzt die Kriteriencheckbox. Die Korrektur wurde als Wartungsveröffentlichung `0.6.2` gebündelt und ändert weder JSON-Auswertung noch Katalog, Assertions, Netzwerkprüfer oder Sicherheitsgrenzen. Der bestehende Praxisbericht verwendet ausschließlich eine Nichtanwendbarkeit auf Kriterienebene und bleibt mit der korrigierten Implementierung bytegleich renderbar.
- `0.6.2` wurde anschließend im realen Verbraucher über den unveränderlichen Releasecommit installiert. Der Generator verarbeitete erneut ausschließlich die vier bytegleichen technischen 0.6.0-Berichte ohne Produktionsrequests; bis auf den Erstellungszeitpunkt blieb die fachliche Ausgabe identisch. Frische Installation, vier installierte Hilfeaufrufe, Lint, Typecheck, 22 Unit-Tests und Produktionsbuild bestanden.
- Im Praxisbericht werden 136 technische Assertionrecords aufgrund ihrer Zuordnung zu mehreren Kriterien als 209 automatische Kriterienrecords referenziert; zusammen mit 30 nicht automatischen Records enthält `report.json` 239 Recordeinbettungen. Diese Redundanz ist derzeit nachvollziehbare Rückverfolgbarkeit und kein Laufzeitproblem. Vor 1.0 ist zu entscheiden, ob ein stabiler Bericht Records weiterhin einbettet oder über eindeutige Referenzen normalisiert, ohne die lokale Reproduzierbarkeit zu verlieren.
- Die aktive Evidence-Datei des Piloten enthält genau einen Record je belegtem beziehungsweise nicht anwendbarem nicht automatischem Kriterium. Die Bibliothek behandelt alle Records als aktiv, lässt kein stilles „neuester Eintrag gewinnt“ zu und aggregiert mehrere Records konservativ. Diese bisher nur implizite Pflegeannahme ist nun dokumentiert; automatische Verfalls-, Ersatz- oder Dokumentabruflogik wird nicht eingeführt.
- Die Statusursache ist in `report.json` und den technischen Berichten über die zugeordneten Records nachvollziehbar. `report.md` bleibt dagegen eine menschenlesbare Kriterien- und Workflowübersicht und wiederholt Assertionmessages oder Subjects nicht. Vor dem stabilen Vertrag ist bewusst zu entscheiden, ob ausgewählte redigierte Fehl-/Unklarheitsdetails ergänzt werden oder die Dokumentation diese Detailgrenze noch deutlicher benennt.
- Das aktuelle Ausgabeschema führt bei Kriterienzählungen zusätzlich die Felder `partial` und `open`, obwohl einzelne Kriterien laut demselben Schema nur fünf atomare Ergebnisse besitzen und beide Zähler deshalb stets null sind. Dies wird nicht rückwirkend in 0.6.x entfernt, sondern als Vertragsbereinigung für Phase I behandelt.

### Phase I – Verträge für eine spätere 1.0 stabilisieren

**Status 27. August 2026: begonnen.** Der erste Vertragsschnitt dokumentiert den gemeinsamen Kern und werkzeugspezifische JSON-Schemas aller vier technischen Berichte einschließlich der Fehlerhüllen für Exitcode 2. Kompatibilitäts-, Deprecation-, Assertion-, Katalog-, Node- und CLI-Regeln sind erstmals zusammenhängend festgehalten; eine versionierte Releasehistorie wurde begonnen. Diese Vorbereitungsartefakte stabilisieren noch nicht den Pilotkatalog oder die bisherigen `Pilot`-APIs.

Node.js 24.19.0 wurde zusätzlich mit frischer Installation, Lint, Typecheck, allen 60 Tests einschließlich echtem Chromium-Nebenwirkungstest, Packprüfung, installiertem Tarball und allen vier Binärbefehlen validiert. Der vorbereitete unterstützte Bereich umfasst deshalb Node 22 ab 22.19 und Node 24 ab dessen LTS-Linie 24.11, jeweils nur bis vor den nächsten Major. Node 23 bleibt als ungerader, nicht unterstützter Zwischenmajor ausgeschlossen.

Für den späteren stabilen Projektbericht ist als Vertragsrichtung entschieden: Das heutige Ausgabeschema 2 bleibt unverändert, während ein neues Schema Records einmalig auf Berichtsebene speichert und über eindeutige Referenzen zuordnet. Die stets null bleibenden Kriterienzähler `partial` und `open` entfallen erst dort. Der vollständige lokale Markdownbericht soll kurze redigierte Ursachen fehlgeschlagener oder unklarer automatischer Kriterien zeigen, ohne Evidence-Freitexte, Subjects oder vertrauliche Referenzen zusätzlich zu vervielfältigen. Allgemeine API-Namen werden erst gemeinsam mit diesem neuen Schema eingeführt; bestehende Pilotnamen bleiben während eines dokumentierten Übergangs erhalten.

Vor einer möglichen `1.0.0` werden mindestens folgende Entscheidungen vorbereitet:

1. Maschinenlesbare JSON-Schemas für die technischen HTTP-, Crawl-, Browser- und Social-Berichte.
2. Dokumentierte Kompatibilitäts- und Deprecation-Regeln für CLIs, Exitcodes, Assertions, Schemas und Reporting-API.
3. Entscheidung, welche bislang mit `Pilot` bezeichneten Katalog- und API-Verträge einen stabilen allgemeinen Namen erhalten und welche experimentell bleiben.
4. Nachweis in mindestens einem weiteren unabhängigen Verbraucherprojekt mit anderer Seiten- und Auslieferungsstruktur.
5. Prüfung eines künftigen Node-LTS-Bereichs zusätzlich zum derzeit festgelegten Node-22-Bereich.
6. Kompakte, versionierte Releasehistorie und weiterhin reproduzierbare manuelle Releaseabnahme ohne automatische Registry-, Token- oder CI-Infrastruktur.

Eine `1.0.0` setzt weder die Automatisierung aller Checklistenpunkte noch eine vollständige Qualitätsfreigabe voraus. Sie setzt einen klar abgegrenzten, stabilen und praktisch mehrfach bestätigten öffentlichen Vertrag voraus.

### Phase J – Nächste fachliche Automatisierung erst nach einer Abdeckungsmatrix

Vor einer weiteren Funktionsrunde werden die Punkte der vollständigen modularen Checkliste klassifiziert als:

- sicher und frameworkunabhängig automatisch prüfbar;
- nur als technische Beobachtung ohne normative Bewertung modellierbar;
- manuell, extern oder administrativ nachzuweisen;
- nur bei bestimmten Modulen oder Projektmanifesten einschlägig;
- grundsätzlich ungeeignet für die allgemeinen Nur-Lese-Werkzeuge.

Neue Assertions werden danach anhand von fachlichem Nutzen, Wiederverwendung vorhandener GET-Beobachtungen, Sicherheitsgrenzen, Fehlinterpretationsrisiko und lokal testbaren Nebenwirkungsnachweisen priorisiert. Denkbare Themen wie strukturierte Daten, weitere Indexierungsbeobachtungen oder atomarere Accessibility-Befunde sind Kandidaten, aber noch keine Zusage für eine bestimmte Version.

### Unveränderte Grenzen

Auch in den nächsten Phasen gibt es keinen allgemeinen Sammelprüfer, keine automatische Checklistenänderung, keine Consent-Simulation, keine Formular- oder Produktionsmutation, keine stillen Browser-Retries und keine Behauptung einer vollständigen WCAG-, Rechts-, Datenschutz-, Sicherheits- oder Produktionsfreigabe.
