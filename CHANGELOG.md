# Releasehistorie

Dieses Changelog dokumentiert veröffentlichte Paketstände von `@mktcode/website-qa`. Planungs- und reine Dokumentationscommits ohne Paketveröffentlichung erscheinen nicht als eigene Version.

## Unveröffentlicht

- Phase I bereitet technische Berichtsschemas sowie Kompatibilitäts-, Deprecation- und API-Verträge für eine spätere 1.0 vor.
- Experimentelles Projektberichtsschema 3 als opt-in Vorschau ergänzt: Records werden einmalig gespeichert und von Kriterien über semantisch validierte berichtslokale IDs referenziert.
- Schema-2-Erzeuger, Renderer und Bundles unverändert gelassen; Kriterienzähler in Schema 3 auf die fünf tatsächlich möglichen atomaren Ergebnisse bereinigt.
- Katalog-ID-Muster für Kennungen mit zusätzlichen oder alphanumerischen Segmenten korrigiert, Evidence-Klassen und deklarierte `$schema`-Felder mit den Beispielen synchronisiert und die Zielbindungsprovenienz vor URL-Redaktion geschützt.

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
