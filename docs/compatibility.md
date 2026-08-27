# Kompatibilitäts- und Deprecation-Regeln

Dieses Dokument bereitet den öffentlichen Vertrag einer späteren Version 1.0 vor. Bis dahin bleibt `@mktcode/website-qa` eine Beta: Die ausdrücklich als stabiler Kandidat bezeichneten Schnittstellen werden bereits nach den folgenden Regeln gepflegt, sind aber noch keine SemVer-1.0-Garantie.

## Getrennte Versionsachsen

Vier Versionen haben unterschiedliche Bedeutungen und dürfen nicht voneinander abgeleitet werden:

1. Die Paketversion bezeichnet den veröffentlichten Implementierungsstand.
2. `schemaVersion` bezeichnet die Struktur eines JSON-Dokuments.
3. `assertionVersion` bezeichnet die fachliche Bedeutung einer Assertion-ID.
4. Die Katalogversion bezeichnet Zusammenstellung und Bedeutung der Checklistenpunkte und Kriterien.

Ein Patch des Berichtsgenerators kann deshalb ältere technische Berichte unverändert verarbeiten. Umgekehrt belegt eine neue Paketversion weder einen neuen Katalog noch einen neuen Deploymentstand.

## CLI-Vertrag

Stabile Kandidaten für 1.0 sind die vier unabhängigen Befehle:

- `website-qa-http`
- `website-qa-crawl`
- `website-qa-browser`
- `website-qa-social`

Zu ihrem vorgesehenen Vertrag gehören direkte Ausführbarkeit, `--help`, menschenlesbare Ausgabe, `--json`, `--json-file`, `--strict`, Paketversionsausgabe und folgende Exitcodes:

- `0`: Der Lauf ist vollständig und nach den gewählten Regeln bestanden.
- `1`: Ein gültiger Bericht wurde erzeugt, enthält aber Fehler oder im strikten Modus relevante Warnungen.
- `2`: Aufruf, Umgebung oder Berichtserzeugung sind technisch fehlgeschlagen; der Fehler muss vor einer fachlichen Auswertung behoben werden.

Neue optionale Schalter oder zusätzliche Ausgabefelder sind grundsätzlich kompatible Erweiterungen. Bestehende Schalter, Exitcodebedeutungen oder Standardwerte werden nicht still umgedeutet. Sicherheitsgrenzen dürfen ohne Deprecation verschärft werden, wenn dadurch ein zuvor möglicherweise unsicherer Abruf geschlossen wird; der Befund muss dann sichtbar fehlschlagen oder unklar werden statt still zu bestehen.

Die Nur-Lese- und SSRF-Grenzen sind Teil des Vertrags, keine lockere Implementierungsentscheidung. Eine Lockerung ist keine kompatible Erweiterung.

## Technische JSON-Berichte

Die maschinenlesbaren Schemata liegen unter:

- [`../catalog/http-report.schema.json`](../catalog/http-report.schema.json)
- [`../catalog/crawl-report.schema.json`](../catalog/crawl-report.schema.json)
- [`../catalog/browser-report.schema.json`](../catalog/browser-report.schema.json)
- [`../catalog/social-report.schema.json`](../catalog/social-report.schema.json)
- [`../catalog/technical-report.common.schema.json`](../catalog/technical-report.common.schema.json)

Sie beschreiben sowohl vollständige fachliche Berichte der Exitcodes 0 und 1 als auch die redigierten Fehlerhüllen des Exitcodes 2. Der gemeinsame Kern umfasst Werkzeugkennung, Schema- und Paketversion, Erstellungszeit, Optionen, Nur-Lese-Garantien, Katalogbezug, Ergebnisse und Zusammenfassung. Werkzeugdetails innerhalb einzelner Resultate bleiben vor 1.0 erweiterbar.

Verbraucher müssen nach `tool` und `schemaVersion` auswählen, unbekannte additive Felder tolerieren und dürfen eine Schemaversion nicht aus der Paketversion erraten. Folgende Änderungen benötigen eine neue `schemaVersion`:

- Entfernen oder Umbenennen eines Felds;
- ein neues Pflichtfeld in einem bestehenden Dokumenttyp;
- Änderung eines Feldtyps oder einer Enum-Bedeutung;
- Änderung der fachlichen Semantik eines vorhandenen Felds;
- Wechsel zwischen eingebetteten Records und Referenzen.

Neue optionale Felder, zusätzliche Detailobjekte und neue Enumwerte in ausdrücklich erweiterbaren Detailbereichen können innerhalb derselben Schemaversion ergänzt werden. Ein alter Verbraucher muss unbekannte Felder ignorieren, aber unbekannte `schemaVersion`-Werte geschlossen ablehnen.

## Assertions und Katalog

Eine Assertion wird durch `assertionId` und `assertionVersion` identifiziert. Text von `message` und die genaue Form von `subject` sind erklärende, redigierte Befunddetails und keine stabilen Vergleichswerte. Ändert sich die fachliche Aussage oder Aggregationsbedeutung, wird die Assertionversion erhöht; eine bestehende ID wird nicht mit neuer Bedeutung wiederverwendet.

Kriterien- und Checklisten-IDs bleiben innerhalb einer Kataloglinie stabil. Eine neue oder fachlich geänderte Anforderung benötigt eine neue Katalogversion. Alte Berichte werden nicht automatisch als Nachweis für neue Kriterien behandelt.

Der aktuelle Katalog `website-qa-pilot` bleibt ausdrücklich experimentell. Sein Name wird nicht allein durch eine Paketversion stabil. Eine spätere stabile Kataloglinie wird erst nach der vollständigen Klassifikation und einem zweiten unabhängigen Verbraucher festgelegt.

## Reporting-API und Recordmodell

Die Exporte `validateChecklistCatalog`, `evaluateChecklist`, `loadAssertionRegistry` und `loadPilotCatalog` sowie alle Namen mit `Pilot` bleiben bis zur Vertragsbereinigung experimentell. Die vorhandenen `createPilot*`-, `renderPilot*`- und `writePilot*`-Funktionen werden in 0.6.x nicht umbenannt.

Für den stabilen Projektbericht wird das experimentelle Ausgabeschema 3 als opt-in Vertragsvorschau erprobt. Ausgabe 2 bleibt Standard für bestehende Erzeuger, Renderer und Bundles:

- Assertion- und Evidence-Records werden einmalig auf Berichtsebene gespeichert und von Kriterien über eindeutige berichtslokale IDs referenziert. IDs sind deterministisch nach dem ersten Auftreten vergeben, besitzen aber ausdrücklich keine berichtsübergreifende Identität. Inhaltlich gleiche Records werden nur einmal gespeichert; alle fachlichen Zuordnungen bleiben als Referenzen erhalten. Das heutige Ausgabeschema 2 mit eingebetteten Records bleibt unverändert lesbar.
- Kriterienzähler enthalten nur die fünf tatsächlich möglichen atomaren Ergebnisse. Die stets null bleibenden Felder `partial` und `open` werden nicht in den neuen Kriterienzähler übernommen.
- Der vollständige lokale Markdownbericht darf für fehlgeschlagene oder unklare automatische Kriterien kurze bereits redigierte Meldungen und Recordreferenzen zeigen. Freie Evidence-Notizen, Subjects und vertrauliche Unterlagen werden nicht zusätzlich vervielfältigt.
- Die opt-in Funktionen `convertPilotProjectReportToV3`, `createPilotProjectReportV3`, `createPilotProjectReportV3FromFiles` und `validatePilotProjectReportV3` bleiben vorerst experimentell. Stabile allgemeine API-Namen werden erst nach Praxisvalidierung dieses Schemas eingeführt. Die bisherigen Pilotnamen bleiben für einen dokumentierten Übergang als Aliase erhalten.

Referenzintegrität, Recordtyp, erforderliche Assertion-IDs, Kriterienergebnisse, Punktzustände und alle Summen werden semantisch validiert. Der Konverter erkennt außerdem die in historischen 0.6.x-Projektberichten durch eine zu breite URL-Redaktion entstandene Provenienzdarstellung `(ungültige URL)` und stellt dafür ausschließlich den fest definierten Provenienzwert wieder her. Damit ist die Normalisierung eine bewusste neue Vertragsversion und keine rückwirkende Änderung bestehender 0.6.x-Berichte.

## Deprecation und Entfernung

Nach 1.0 gilt für öffentliche CLIs, Exporte und Schemata:

1. Eine Deprecation wird in README und [`../CHANGELOG.md`](../CHANGELOG.md) mit Ersatz und frühestem Entfernungszeitpunkt dokumentiert.
2. Eine kompatible Alias- oder Übergangslösung bleibt mindestens über die nächste Minor-Version erhalten.
3. Eine Entfernung oder inkompatible Bedeutungsänderung erfolgt regulär erst in einer neuen Major-Version.
4. Kritische Sicherheitskorrekturen dürfen den Übergang verkürzen. Sie werden ausdrücklich als Sicherheitsausnahme dokumentiert und brechen geschlossen statt einen möglicherweise mutierenden oder privaten Pfad weiter abzurufen.

## Node.js

Der Bereich `engines.node` in `package.json` ist für jede Veröffentlichung verbindlich. Unterstützt werden die geraden LTS-Linien Node 22 ab 22.19 und Node 24 ab 24.11; der ungerade Zwischenmajor Node 23 bleibt ausgeschlossen. Node 24 wurde vor der Aufnahme mit installiertem Tarball und echtem Chromium-Nebenwirkungstest validiert. Weitere LTS-Majors werden erst nach derselben vollständigen Prüfung aufgenommen. Ein unterstützter Node-Major wird regulär nur mit einer Major-Version oder nach seinem Upstream-Supportende entfernt; zwingende Sicherheits- oder Abhängigkeitsgründe werden dokumentiert.
