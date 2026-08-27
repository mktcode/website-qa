# Planung

## Aktueller Produktschnitt

`@mktcode/website-qa` ist ein schlankes Hilfsmittel für menschliche Website-QA:

- Die zentrale, modulare Checkliste veröffentlicht 215 stabile, weitreichende Prüfpunkte.
- Fünf unabhängige, ausschließlich lesende CLIs liefern statische technische Signale und klar beobachtbare Defekte.
- Die Berichte sind eine erste Temperaturmessung, kein Projektstatus und keine Freigabe.
- Checklistenreferenzen sind informativ; Checkboxen werden ausschließlich in Projektkopien durch Menschen bearbeitet.

Nicht zum Produkt gehören Eingabewizards, manuelle Evidence-Verwaltung, Projektkonfiguration, Workflowzustände, Freigaben, Checklistenaggregation, Gesamtberichtsgeneratoren oder ein universeller Sammelbefehl.

## v2.0 – unveröffentlicht

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

## Nächste fachliche Arbeit

Neue Automatisierungen werden nur aufgenommen, wenn sie frameworkunabhängig, passiv, begrenzt und als technisches Signal belastbar sind. Priorität haben klare Defekte und Beobachtungen, die einer QA-Prüferin oder einem QA-Prüfer repetitive Startarbeit abnehmen.

Nicht automatisierbare Rechts-, Datenschutz-, Infrastruktur-, Plattform-, Geräte-, Screenreader-, Kommunikations- und Freigabefragen bleiben Bestandteil der menschlichen Checkliste. Das Paket modelliert ihren Projektstatus nicht.

## Veröffentlichung

Vor einem v2-Tag sind erforderlich:

```bash
npm ci
npm run check
npm pack --dry-run
```

Zusätzlich werden das erzeugte Tarball in einem temporären Verbraucher installiert, alle fünf Befehle ausgeführt und die Chromium-Sicherheitsintegration für Browser und Lighthouse bestätigt. Veröffentlichung und Tagging bleiben bewusste getrennte Entscheidungen.

Historische Entscheidungen und veröffentlichte 0.x-/1.x-Stände bleiben im [`CHANGELOG.md`](CHANGELOG.md) und über Git-Tags nachvollziehbar.
