# Releasehistorie

Dieses Changelog dokumentiert veröffentlichte Paketstände von `@mktcode/website-qa`. Planungs- und reine Dokumentationscommits ohne Paketveröffentlichung erscheinen nicht als eigene Version.

## Unveröffentlicht – 2.0.1

- SSRF-Sperre für IPv4-mapped-IPv6 und deprecated Site-Local-IPv6 geschlossen und Chromium-DNS im Browser-Prüfer an die geprüfte Zieladresse gepinnt.
- Dekompression, Social-Sitemap-Abrufe, Browser-Beobachtungslisten und DOM-Inventare mit sichtbaren Limits begrenzt; aktionsverdächtige Social-Sitemap- und Redirectziele werden nicht abgerufen.
- Browser-Sitemapindizes wieder korrekt traversiert und verspätet gestartete Lighthouse-Ressourcen nach Timeouts geschlossen.
- Reale Exitcode-2-Ausgaben aller fünf CLIs an die veröffentlichten JSON-Schemata angeglichen und durch CLI-Prozesstests abgesichert; der generische Schemaexport validiert alle fünf Berichtstypen.
- Lighthouse-Zahlenoptionen gegen stilles Kürzen gehärtet und einen zwingenden Chromium-Attestierungslauf ergänzt.
- Releasezustand, npm-Aliase, technische Validierungsmatrix und Interpretationshilfen vereinheitlicht.

## 2.0.0 – 2026-08-27

- Produktgrenze bewusst vereinfacht: zentrale manuelle 215-Punkte-Checkliste plus unabhängige technische Temperaturmessungen; keine automatische Checklistenbewertung.
- Projektbericht-, Evidence-, Workflow-, Bundle- und Checklistenaggregations-APIs ohne Alias entfernt.
- Technische Berichte auf `schemaVersion: 2` und neutrale Signale mit `positive`, `defect`, `inconclusive` und `notApplicable` umgestellt; Checklisten-IDs sind nur Informationsreferenzen. Auch konkrete Social-Befunde tragen schema-konforme informative Referenzen.
- Neutralen Checklistenindex und technisches Signalregister eingeführt; der Social-Prüfer dokumentiert Trainings-/Datennutzungstokens ohne Freigabeeingabe oder automatische Betreiberentscheidung. Aktuelle offizielle Quellen, offizieller Kontext ohne ausdrückliche Tokenbestätigung und historische Weiterleitungen werden getrennt ausgewiesen; begrenzte Quellenlagen bleiben konservativ `inconclusive`.
- `website-qa-lighthouse` als fünften unabhängigen Standardprüfer mit festem mobilen Lauf für Performance, Accessibility, Best Practices und SEO ergänzt.
- Lighthouse verwendet eine vor Navigation abgesicherte, isolierte Puppeteer-Seite; externe Requests, Nicht-GET, Formulare, Beacons, Popups und Workerfamilien bleiben blockiert. Sicherheitsblockierungen kennzeichnen Messwerte als nicht repräsentativ.
- Die sieben zuvor für 1.2 vorbereiteten passiven Signale bleiben als technische Beobachtungen erhalten, ohne zusammengesetzte Checklistenpunkte auszuwerten.

## 1.1.0 – 2026-08-27

- Basiskatalog 1.1.0 um `CORE-A11Y-03`, `CORE-A11Y-08` und `CORE-A11Y-09` mit neun getrennten automatischen und manuellen Kriterien erweitert.
- Vier passive Axe-Assertions für zugängliche Namen, farbunabhängige Linkerkennung, technische Bildalternativen und Textkontrast ergänzt.
- Uneindeutige Axe-Auswertungen der neuen Regelfamilien werden als `inconclusive` behandelt; GET-only-, Browserinteraktions- und Redaktionsgrenzen bleiben unverändert.

## 1.0.0 – 2026-08-27

- Bewussten inkompatiblen 1.0-Vertragsschnitt umgesetzt.
- Den begrenzten Bestand ohne neue Assertions als `website-qa-baseline` 1.0.0 stabilisiert. Stabilität bezeichnet IDs und Versionsregeln, nicht vollständige Checklistenabdeckung oder Freigabe.
- Projektkonfiguration und Berichtsschema eindeutig als `project-report.config.schema.json` beziehungsweise `project-report.schema.json` benannt.
- Genau ein normalisiertes Projektberichtsausgabeformat beibehalten: `schemaVersion: 3` mit deterministischen berichtslokalen Referenzen, Deduplizierung und semantischer Katalog-, Scope-, Referenz- und Aggregationsvalidierung.
- Frühere Projektberichtserzeugung, Konvertierung, Schemata und API-Namen ohne Alias oder Deprecation-Hülle entfernt.
- Stabile Checklist- und Reporting-APIs, einen vollständigen Renderer, eine sichere Whitelist-Zusammenfassung und ausschließlich normalisierte Bundles eingeführt.
- Konfiguration, Evidence, technische Eingaben und Projektberichte vor der Auswertung mit den veröffentlichten JSON-Schemas validiert; Werkzeug-, Assertion- und Nur-Lese-Bindung geschlossen geprüft und alle variablen Markdownfelder kontextgerecht escaped.
- Paket- und Lockfileversion auf 1.0.0 vorbereitet; vier CLI-Namen, technische Berichtsschemata 1 sowie GET-, SSRF-, Redirect-, Browser-, Ressourcen- und Redaktionsgrenzen unverändert erhalten.

## 0.6.2 – 2026-08-27

- Punktstatus und Kriteriennachweise in der vollständigen Markdowndarstellung strikt getrennt.
- Eine Nichtanwendbarkeit des Gesamtpunkts hakt fehlende oder negative Einzelkriterien nicht mehr ab.
- Katalog, Assertions, JSON-Schemas und technische Prüfergebnisse blieben gegenüber 0.6.1 unverändert.

## 0.6.1 – 2026-08-26

- Kriterienzusammenfassungen in beiden Markdownrenderern summengleich dargestellt.
- `notApplicable` auf Kriterienebene als geklärter Nachweis sichtbar gemacht.
- Technische 0.6.0-Berichte blieben ohne neue Netzwerkprüfung verwendbar.

## 0.6.0 – 2026-08-26

- Passive, isolierte Browserbeobachtungen für externe Requestversuche sowie initiale Cookies, Local Storage, Session Storage und IndexedDB ergänzt.
- Werte und Inhalte aus Cookies und Storage weiterhin vollständig aus Berichten ausgeschlossen.
- Datenschutzbeobachtungen konservativ mit Abdeckungs- und Inventarlimits verbunden.

## 0.5.0 – 2026-08-26

- Strukturierte HTTP-Assertions für öffentlich beobachtbare Sicherheitsheader eingeführt.
- HTML, CSS, JavaScript und 404-Antworten ohne zusätzliche Requests getrennt bewertet.

## 0.4.0 – 2026-08-26

- Sitemap-, Crawl-, Navigations- und Ressourcenbeobachtungen als atomare Assertions strukturiert.
- Unvollständige Seiten-, Ressourcen- und Sitemapläufe differenziert als unklar behandelt.

## 0.3.0 – 2026-08-24

- Social-Preview- und Robots-Nachweise in Katalog, Projektbericht und Vier-Berichte-Bundle integriert.
- Redaktionelle Eignung und echte Plattformvorschauen ausdrücklich als nicht automatische Nachweise erhalten.

## 0.2.0 – 2026-08-24

- Strukturierten Pilotkatalog, atomare Assertions und manuelle beziehungsweise externe Evidence-Records eingeführt.
- Netzwerkfreien Projektberichtsgenerator, sichere Markdownzusammenfassung und atomare lokale Berichtsbundles ergänzt.
- Gemeinsame Redaktion für URLs, Querywerte, Zugangsdaten, Secrets, E-Mails und private Ziele eingeführt.

## 0.1.0 – 2026-08-24

- Vier unabhängige, ausschließlich lesende CLI-Prüfer für HTTP, Crawl, Browser und Social Preview veröffentlicht.
- Gemeinsame SSRF-, DNS-, Redirect-, Größen- und Antwortgrenzen etabliert.
