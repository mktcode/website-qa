# Website-QA-Prüfbericht: Beispielwebsite

> Strukturierter Pilotbericht. Er umfasst noch nicht die vollständige Website-Checkliste und ist kein vollständiger WCAG-, Rechts-, Datenschutz-, Sicherheits- oder Produktionsfreigabenachweis.

## Berichtsstand

| Feld | Wert |
|---|---|
| Erstellt | 2026-08-24T12:30:00.000Z |
| Katalog | website-qa-pilot 1.0.0-pilot.3 (pilot) |
| Auswertungsumgebung | production |
| Bevorzugte URL | https://example.com/ |
| Quellstand | PROJEKT-COMMIT |
| Deployment | DEPLOYMENT-ARTEFAKT |
| Herkunft Quell-/Deploymentstand | projektseitig deklariert |

## Zusammenfassung

| Projektstatus | Anzahl |
|---|---:|
| Vollständig nachgewiesen | 2 |
| Fehlgeschlagen | 0 |
| Teilweise nachgewiesen | 8 |
| Offen | 6 |
| Unklar | 0 |
| Nicht zutreffend | 0 |
| Externer Nachweis offen | 1 |
| Zurückgestellt | 0 |
| Akzeptierte Abweichung (offen) | 0 |
| **Ausgewählte Pilotpunkte** | **17** |

Automatische Kriterien: 14 bestanden, 0 fehlgeschlagen, 0 unklar, 14 ohne Nachweis.

Nicht automatische Kriterien: 1 belegt, 0 fehlgeschlagen, 18 ohne Nachweis.

## Technische Läufe

| Werkzeug | Ziel | Umgebung | Verwendet | Assertions | Befehl |
|---|---|---|---:|---:|---|
| http-check 0.2.0 | https://example.com/ | production | ja | 2 | <code>website-qa-http https://example.com/ --strict --json</code> |
| crawl-check 0.2.0 | https://example.com/ | production | ja | 7 | <code>website-qa-crawl https://example.com/ --sitemap --max-pages=50 --max-resources=500 --strict --json</code> |
| browser-check 0.2.0 | https://example.com/ | production | ja | 5 | <code>website-qa-browser https://example.com/ --max-pages=10 --max-requests=300 --strict --json</code> |

## Checklistenpunkte

| ID | Modul | Projektstatus | Automatisch | Nicht automatisch |
|---|---|---|---:|---:|
| CORE-DOM-02 | core | Offen | 0/2 | 0/0 |
| CORE-DOM-04 | core | Externer Nachweis offen | 0/0 | 0/2 |
| CORE-DOM-05 | core | Teilweise nachgewiesen | 2/2 | 0/1 |
| CORE-DOM-07 | core | Offen | 0/3 | 0/1 |
| CORE-DOM-08 | core | Offen | 0/2 | 0/2 |
| CORE-ERR-01 | core | Offen | 0/2 | 0/1 |
| CORE-ERR-02 | core | Vollständig nachgewiesen | 2/2 | 0/0 |
| CORE-SEO-01 | core | Teilweise nachgewiesen | 3/3 | 0/1 |
| CORE-SEO-02 | core | Teilweise nachgewiesen | 2/2 | 0/1 |
| CORE-A11Y-01 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-A11Y-10 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-A11Y-13 | core | Teilweise nachgewiesen | 1/1 | 0/3 |
| CORE-QA-02 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-QA-07 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-PERF-01 | core | Offen | 0/3 | 0/1 |
| CORE-PERF-05 | core | Offen | 0/2 | 0/1 |
| GOV-RGT-02 | auftrag-recht-uebergabe | Vollständig nachgewiesen | 0/0 | 1/1 |

### CORE-DOM-02: Offen

HTTP leitet dauerhaft, pfad- und queryerhaltend und möglichst ohne unnötige Zwischenstation auf HTTPS um.

- [ ] `CORE-DOM-02/C1` Die geprüfte HTTP-Variante verwendet eine permanente Weiterleitung auf HTTPS. — automatic, noEvidence
- [ ] `CORE-DOM-02/C2` Pfad und Query bleiben bei der geprüften HTTP-zu-HTTPS-Weiterleitung erhalten. — automatic, noEvidence

### CORE-DOM-04: Externer Nachweis offen

Zertifikat, Zertifikatskette, Hostabdeckung und unterstützte TLS-Versionen sind mit einem geeigneten Werkzeug geprüft. Die automatische Verlängerung ist durch Konfiguration oder einen erfolgreichen Erneuerungsnachweis plausibilisiert.

Workflow: **Externer Nachweis offen** – Der Nachweis zur automatischen Zertifikatserneuerung liegt beim Hostinganbieter.

- [ ] `CORE-DOM-04/C1` Zertifikat, Zertifikatskette, Hostabdeckung und TLS-Versionen wurden für die vorgesehenen Hosts geprüft. — external, noEvidence
  - Erforderlicher Nachweis: Nachweis eines geeigneten TLS-Werkzeugs mit Datum, Hosts und Ergebnis referenzieren.
- [ ] `CORE-DOM-04/C2` Die automatische Zertifikatserneuerung ist durch Infrastrukturkonfiguration oder einen erfolgreichen Erneuerungsvorgang plausibilisiert. — manual, noEvidence
  - Erforderlicher Nachweis: Plattformkonfiguration oder Erneuerungsnachweis ohne Zugangsdaten dokumentieren.

### CORE-DOM-05: Teilweise nachgewiesen

Jede indexierbare Seite enthält genau einen absoluten Canonical auf der festgelegten Host- und HTTPS-Variante.

- [x] `CORE-DOM-05/C1` Alle vom Crawl geprüften indexierbaren Seiten besitzen genau einen absoluten Canonical. — automatic, pass
- [x] `CORE-DOM-05/C2` Die geprüften Canonicals entsprechen der jeweiligen finalen Seiten-URL. — automatic, pass
- [ ] `CORE-DOM-05/C3` Die finalen Seiten-URLs entsprechen der projektspezifisch festgelegten öffentlichen Host-, HTTPS- und Pfadstrategie. — manual, noEvidence
  - Erforderlicher Nachweis: Crawlziel und finale URL-Stichprobe mit der dokumentierten öffentlichen URL-Strategie des Projekts abgleichen.

### CORE-DOM-07: Offen

Weiterleitungen wurden auf Statuscode, Pfad- und Queryerhalt, Schleifen und unnötige Ketten geprüft.

- [ ] `CORE-DOM-07/C1` Die geprüfte HTTPS-Navigation enthält keinen Downgrade auf HTTP. — automatic, noEvidence
- [ ] `CORE-DOM-07/C2` Die geprüfte Zielnavigation enthält keine unnötige Weiterleitungskette. — automatic, noEvidence
- [ ] `CORE-DOM-07/C3` Die geprüfte HTTP-zu-HTTPS-Navigation enthält keine unnötige Weiterleitungskette. — automatic, noEvidence
- [ ] `CORE-DOM-07/C4` Alle veröffentlichten Host- und Routenvarianten, die zum Projektumfang gehören, wurden inventarisiert und geprüft. — manual, noEvidence
  - Erforderlicher Nachweis: Geprüfte Hosts und projektspezifische Redirectrouten mit Ergebnis dokumentieren.

### CORE-DOM-08: Offen

HSTS-Wert und Reichweite sind bewusst gewählt und auf allen relevanten HTTPS-Antworten einschließlich vorgeschalteter Weiterleitungshosts geprüft. `includeSubDomains` und `preload` werden nur nach Prüfung aller betroffenen Subdomains aktiviert.

- [ ] `CORE-DOM-08/C1` HSTS ist auf allen vom HTTP-Prüfer untersuchten HTTPS-Antwortklassen vorhanden. — automatic, noEvidence
- [ ] `CORE-DOM-08/C2` Der HSTS-max-age ist syntaktisch gültig und beträgt mindestens 180 Tage. — automatic, noEvidence
- [ ] `CORE-DOM-08/C3` Relevante HTTPS-Antwortklassen und vorgeschaltete Weiterleitungshosts wurden projektspezifisch bestimmt. — manual, noEvidence
  - Erforderlicher Nachweis: Antwortklassen, Hosts und nicht erreichbare Infrastrukturgrenzen dokumentieren.
- [ ] `CORE-DOM-08/C4` includeSubDomains und preload wurden anhand aller betroffenen Subdomains bewusst entschieden. — manual, noEvidence
  - Erforderlicher Nachweis: Entscheidung, Subdomaininventar und verantwortliche Stelle dokumentieren.

### CORE-ERR-01: Offen

Eine unbekannte Browserroute liefert eine verständliche HTML-Fehlerseite mit tatsächlichem HTTP-404-Status und ohne interne technische Details.

- [ ] `CORE-ERR-01/C1` Der geprüfte unbekannte Pfad antwortet mit HTTP 404. — automatic, noEvidence
- [ ] `CORE-ERR-01/C2` Die automatische Stichprobe erkennt keine typischen Stacktraces oder internen Dateipfade. — automatic, noEvidence
- [ ] `CORE-ERR-01/C3` Die Fehlerseite ist für die vorgesehenen Nutzer verständlich und enthält keine projektspezifisch sensiblen Details. — manual, noEvidence
  - Erforderlicher Nachweis: Fehlerseite visuell und redaktionell prüfen; automatische Mustererkennung genügt nicht.

### CORE-ERR-02: Vollständig nachgewiesen

Nicht indexierbare Fehlerseiten senden `noindex` und enthalten weder einen irreführenden Canonical noch `og:url` auf die Fehleradresse.

- [x] `CORE-ERR-02/C1` Die geprüfte 404-Antwort enthält eine noindex-Anweisung. — automatic, pass
- [x] `CORE-ERR-02/C2` Die geprüfte 404-Antwort enthält weder Canonical noch og:url. — automatic, pass

### CORE-SEO-01: Teilweise nachgewiesen

Jede relevante Seite besitzt einen eindeutigen, inhaltlich passenden Titel und eine passende Meta-Beschreibung.

- [x] `CORE-SEO-01/C1` Alle vom Crawl geprüften Seiten besitzen einen Seitentitel. — automatic, pass
- [x] `CORE-SEO-01/C2` Alle vom Crawl geprüften Seiten besitzen genau eine Meta-Beschreibung. — automatic, pass
- [x] `CORE-SEO-01/C3` Titel und Meta-Beschreibungen sind unter den geprüften indexierbaren Seiten eindeutig. — automatic, pass
- [ ] `CORE-SEO-01/C4` Titel und Meta-Beschreibungen sind für die vorgesehenen Seiten inhaltlich passend. — manual, noEvidence
  - Erforderlicher Nachweis: Titel und Meta-Beschreibungen redaktionell gegen Seiteninhalt, Suchintention und Projektvorgaben prüfen.

### CORE-SEO-02: Teilweise nachgewiesen

Die Seitensprache ist mit einem passenden `lang`-Attribut angegeben; Überschriften bilden eine nachvollziehbare Hierarchie mit verständlicher Hauptüberschrift.

- [x] `CORE-SEO-02/C1` Alle vom Crawl geprüften Seiten besitzen ein lang-Attribut. — automatic, pass
- [x] `CORE-SEO-02/C2` Alle vom Crawl geprüften Seiten besitzen genau eine H1-Überschrift. — automatic, pass
- [ ] `CORE-SEO-02/C3` Seitensprache, Überschriftenhierarchie und Hauptüberschrift sind inhaltlich passend und verständlich. — manual, noEvidence
  - Erforderlicher Nachweis: Sprachcode und Überschriftenstruktur auf repräsentativen Seitentypen redaktionell und semantisch prüfen.

### CORE-A11Y-01: Teilweise nachgewiesen

Semantische HTML-Elemente werden passend eingesetzt; Navigation, Hauptinhalt, ergänzende Bereiche und Footer sind sinnvoll ausgezeichnet.

- [x] `CORE-A11Y-01/C1` Alle geprüften Seiten-/Profil-Läufe besitzen genau ein Main-Landmark. — automatic, pass
- [ ] `CORE-A11Y-01/C2` Navigation, Hauptinhalt, ergänzende Bereiche und Footer sind semantisch passend und verständlich ausgezeichnet. — manual, noEvidence
  - Erforderlicher Nachweis: Semantische Struktur auf repräsentativen Seitentypen im DOM und Accessibility Tree fachlich prüfen.

### CORE-A11Y-10: Teilweise nachgewiesen

Bei 320 CSS-Pixeln und bei 200 Prozent reiner Textvergrößerung bleibt der Inhalt ohne zweidimensionales Scrollen sinnvoll nutzbar; lange URLs, E-Mail-Adressen und Komposita verursachen keinen Dokumentüberlauf.

- [x] `CORE-A11Y-10/C1` Die technischen 320-Pixel- und 200-%-Näherungsprofile erkennen auf den geprüften Seiten keinen horizontalen Dokumentüberlauf. — automatic, pass
- [ ] `CORE-A11Y-10/C2` Inhalt und Funktionen bleiben bei 320 CSS-Pixeln und tatsächlicher reiner Textvergrößerung sinnvoll sichtbar und bedienbar. — manual, noEvidence
  - Erforderlicher Nachweis: Repräsentative Seiten in einem realen Browser bei 320 CSS-Pixeln und 200 Prozent reiner Textvergrößerung visuell und funktional prüfen; die technische Näherung allein genügt nicht.

### CORE-A11Y-13: Teilweise nachgewiesen

Tastaturprüfung, automatisierter Accessibility-Audit und reale Mobilbrowserprüfung sind getrennt mit Datum und Werkzeug dokumentiert; eine Screenreader-Stichprobe erfolgt risikogerecht und bei vereinbarter Konformität zwingend.

- [x] `CORE-A11Y-13/C1` Der Axe-Audit wurde auf allen vorgesehenen Seiten-/Profil-Läufen ausgeführt und hat keine automatisiert erkennbaren Verstöße gemeldet. — automatic, pass
- [ ] `CORE-A11Y-13/C2` Eine eigenständige Tastaturprüfung ist mit Datum, Werkzeug beziehungsweise Browser und Ergebnis dokumentiert. — manual, noEvidence
  - Erforderlicher Nachweis: Tastaturprüfung ohne Maus auf repräsentativen Seiten und Funktionen durchführen und separat protokollieren.
- [ ] `CORE-A11Y-13/C3` Eine Prüfung in mindestens einem realen Mobilbrowser ist mit Gerät, Browser, Datum und Ergebnis dokumentiert. — manual, noEvidence
  - Erforderlicher Nachweis: Realen Mobilbrowser und Gerät verwenden; Headless- oder Desktop-Emulation nicht als reale Mobilbrowserprüfung ausgeben.
- [ ] `CORE-A11Y-13/C4` Die risikogerechte Screenreader-Stichprobe beziehungsweise ihre begründete Nichtanwendbarkeit ist dokumentiert. — manual, noEvidence
  - Erforderlicher Nachweis: Screenreader-Stichprobe risikogerecht durchführen; bei vereinbarter Konformität ist sie verpflichtend und nicht als nicht anwendbar zu behandeln.

### CORE-QA-02: Teilweise nachgewiesen

Browserengine, Headless-Emulation und reale Browser beziehungsweise Geräte werden im Nachweis korrekt unterschieden; eine WebKit-Prüfung wird nicht als Safari-Prüfung bezeichnet.

- [x] `CORE-QA-02/C1` Der technische Browserbericht dokumentiert Chromium-Version und ausgeführte Headless-Emulationsprofile. — automatic, pass
- [ ] `CORE-QA-02/C2` Der Projektnachweis unterscheidet Headless-Emulationen, Browserengines und reale Browser beziehungsweise Geräte und benennt nicht geprüfte Plattformen. — manual, noEvidence
  - Erforderlicher Nachweis: Ausgeführte und nicht ausgeführte Browser-/Geräteprüfungen korrekt deklarieren; Chromium nicht als Safari und Emulation nicht als reales Gerät bezeichnen.

### CORE-QA-07: Teilweise nachgewiesen

Die Seiten wurden ohne sichtbare JavaScript-, Netzwerk- oder Hydrationsfehler in der Browserkonsole geprüft.

- [x] `CORE-QA-07/C1` In den automatisch geprüften Seiten-/Profil-Läufen wurden keine Konsolen-, JavaScript-, Netzwerk- oder HTTP-Fehler beobachtet. — automatic, pass
- [ ] `CORE-QA-07/C2` Interaktionsabhängige und vom beobachtenden Browserlauf nicht erreichte Zustände wurden zusätzlich auf Konsolen-, Netzwerk- und Hydrationsfehler geprüft. — manual, noEvidence
  - Erforderlicher Nachweis: Vereinbarte interaktive Zustände manuell aufrufen und Browserkonsole sowie Netzwerkprotokoll beobachten; keine schreibenden Produktionsaktionen ausführen.

### CORE-PERF-01: Offen

Geeignete textbasierte Antworten wie HTML, CSS, JavaScript, JSON und größere SVG-Dateien werden per HTTP komprimiert. Produktion wurde mindestens für HTML, CSS und JavaScript mit Identity, Gzip und Brotli geprüft; `Content-Encoding`, `Vary` und tatsächliche Größenreduktion sind plausibel. Erfolgt die Kompression am Reverse Proxy, sind Middlewarekonfiguration und Zuordnung zum produktiven HTTPS-Router bestätigt.

- [ ] `CORE-PERF-01/C1` Identity-Antworten der ausgewählten textbasierten Ressourcen sind unverändert auslieferbar. — automatic, noEvidence
- [ ] `CORE-PERF-01/C2` Geeignete ausgewählte Ressourcen handeln wirksames Gzip mit passendem Vary aus. — automatic, noEvidence
- [ ] `CORE-PERF-01/C3` Geeignete ausgewählte Ressourcen handeln wirksames Brotli mit passendem Vary aus. — automatic, noEvidence
- [ ] `CORE-PERF-01/C4` Die Kompressionszuständigkeit der produktiven Anwendung beziehungsweise des Reverse Proxys wurde bestätigt. — manual, noEvidence
  - Erforderlicher Nachweis: Produktive Router-/Proxyzuordnung oder begründete Nichtanwendbarkeit dokumentieren.

### CORE-PERF-05: Offen

Cacheheader passen zur Ressource: versionierte unveränderliche Assets dürfen langfristig cachen, veränderliche öffentliche Dateien bleiben aktualisierbar und sensible Antworten werden nicht öffentlich gespeichert.

- [ ] `CORE-PERF-05/C1` Vom HTTP-Prüfer ausgewählte versioniert wirkende Assets besitzen einen langfristigen unveränderlichen Cache. — automatic, noEvidence
- [ ] `CORE-PERF-05/C2` Die geprüfte 404-Antwort ist nicht ausdrücklich langfristig öffentlich cachebar. — automatic, noEvidence
- [ ] `CORE-PERF-05/C3` Die Cachepolitik für veränderliche, sensible und weitere projektspezifische Antwortklassen wurde bewertet. — manual, noEvidence
  - Erforderlicher Nachweis: Antwortklassen, erwartete Cachepolitik und tatsächliche Header dokumentieren.

### GOV-RGT-02: Vollständig nachgewiesen

Inhalte, Logo, Bilder, Videos, Schriftarten, Testimonials und sonstige Materialien sind freigegeben oder ihre Nutzungs- und Veröffentlichungsrechte sind dokumentiert.

- [x] `GOV-RGT-02/C1` Die zuständige Stelle hat die Nutzungs- und Veröffentlichungsrechte der eingesetzten Materialien bestätigt oder dokumentiert. — external, pass

## Grenzen

- Der strukturierte Katalog ist ein Pilot und umfasst noch nicht die vollständige Website-Checkliste.
- Automatische Ergebnisse sind technische Teilnachweise und ersetzen keine manuellen, externen, rechtlichen oder organisatorischen Prüfungen.
- Nur technische Läufe der festgelegten Auswertungsumgebung fließen in die Checklistenbewertung ein.
- Quell- und Deploymentstand technischer Läufe sind projektseitig deklarierte Zuordnungen; das technische Werkzeug bestätigt sie nicht unabhängig.
