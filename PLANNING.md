# Planung

## Aktueller Produktschnitt

`@mktcode/website-qa` ist ein schlankes Hilfsmittel für menschliche Website-QA:

- Die zentrale, modulare Checkliste veröffentlicht 215 stabile, weitreichende Prüfpunkte.
- Fünf unabhängige, ausschließlich lesende CLIs liefern statische technische Signale und klar beobachtbare Defekte.
- Die Berichte sind eine erste Temperaturmessung, kein Projektstatus und keine Freigabe.
- Checklistenreferenzen sind informativ; Checkboxen werden ausschließlich in Projektkopien durch Menschen bearbeitet.

Nicht zum Produkt gehören Eingabewizards, manuelle Evidence-Verwaltung, Projektkonfiguration, Workflowzustände, Freigaben, Checklistenaggregation, Gesamtberichtsgeneratoren oder ein universeller Sammelbefehl.

## v2.0 – veröffentlicht am 2026-08-27

Der inkompatible Schnitt entfernt die in v1 zu weit ausgebaute Projektberichtsplattform. Technische Berichte verwenden Schema 2 und Signalstatus `positive`, `defect`, `inconclusive` oder `notApplicable`. Der neutrale Checklistenindex validiert ausschließlich stabile Referenzen.

Standardprüfer:

1. HTTP
2. Crawl
3. Browser
4. Social Preview und Robots
5. Lighthouse

Lighthouse führt einen festen mobilen Navigationstest mit Performance, Accessibility, Best Practices und SEO aus. Der Prüfer verwendet eine caller-owned Puppeteer-Seite mit vor Navigation installierten Nur-Lese-Grenzen. Sicherheitsblockierungen machen repräsentative Performanceaussagen unklar.

## Sicherheitsinvarianten

- ausschließlich GET;
- keine Formulare, Klicks, Uploads oder mutierenden API-Aufrufe;
- private Ziele standardmäßig gesperrt;
- DNS-, Redirect-, Origin-, Größen-, Request- und Zeitlimits;
- externe Browserrequests und Nebenwirkungskanäle blockiert;
- sensible Werte redigiert;
- bei Unsicherheit geschlossen abbrechen.

Diese Grenzen werden durch lokale Servertests und echte Chromium-Integrationstests abgesichert.

## Nächster Wartungsschritt: 2.0.1

Priorität P0 ist ein enger Sicherheitspatch ohne neue Produktoberfläche:

- IPv4-mapped-IPv6 wird vollständig durch die private Zielsperre erfasst;
- der Browser-Prüfer pinnt Chromium-DNS an die vorab geprüfte Adresse;
- Dekompression, Social-Sitemaps und Browserbeobachtungen besitzen ausdrückliche Grenzen;
- reale Exitcode-2-Ausgaben aller fünf CLIs entsprechen ihren veröffentlichten Schemata;
- Release- und Integrationsdokumentation bezeichnen denselben öffentlichen Stand.

**Akzeptanz:** Die jeweiligen Positiv-, Negativ-, Grenz- und Nebenwirkungstests bestehen. `npm run check` und `npm run test:chromium` laufen unter einem unterstützten Node-22- und Node-24-Stand; Browser- und Lighthouse-Integration werden nicht übersprungen. Das erzeugte Tarball wird in einem leeren Verbraucherprojekt installiert, alle fünf installierten Befehle werden ausgeführt und ihre JSON-Berichte gegen die Paketschemata validiert.

## Spätere fachliche Arbeit

Neue Automatisierungen werden nur aufgenommen, wenn sie frameworkunabhängig, passiv, begrenzt und als technisches Signal belastbar sind. Jeder Kandidat nennt Problembeleg, Priorität, betroffenen Prüfer, Aussage und Nichtaussage, GET-/SSRF-/Redirect-/Größen-/Zeitgrenzen, stabile Signalreferenzen sowie Positiv-, Negativ-, Grenz- und Nebenwirkungstests. Kandidaten ohne diese Angaben werden nicht umgesetzt.

Nicht automatisierbare Rechts-, Datenschutz-, Infrastruktur-, Plattform-, Geräte-, Screenreader-, Kommunikations- und Freigabefragen bleiben Bestandteil der menschlichen Checkliste. Das Paket modelliert ihren Projektstatus nicht.

## Veröffentlichung

Vor jedem neuen Paket-Tag sind erforderlich:

```bash
npm ci
npm run check
npm run test:chromium
npm pack --dry-run
```

Zusätzlich wird das erzeugte Tarball in einem temporären Verbraucher installiert, alle fünf Befehle werden ausgeführt und die JSON-Ausgaben gegen die mitgelieferten Schemata validiert. Die Releaseprüfung wird jeweils unter einem unterstützten Node-22- und Node-24-Stand mit Node-, npm- und Chromium-Version protokolliert. Veröffentlichung und Tagging bleiben bewusste getrennte Entscheidungen; veröffentlichte Tags werden nicht verschoben.

Historische Entscheidungen und veröffentlichte 0.x-/1.x-Stände bleiben im [`CHANGELOG.md`](CHANGELOG.md) und über Git-Tags nachvollziehbar.
