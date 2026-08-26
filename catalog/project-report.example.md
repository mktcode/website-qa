# Website-QA-Prüfbericht: Beispielwebsite

> Strukturierter Pilotbericht. Er umfasst noch nicht die vollständige Website-Checkliste und ist kein vollständiger WCAG-, Rechts-, Datenschutz-, Sicherheits- oder Produktionsfreigabenachweis.

## Berichtsstand

| Feld | Wert |
|---|---|
| Erstellt | 2026-08-24T12:30:00.000Z |
| Katalog | website-qa-pilot 1.0.0-pilot.7 (pilot) |
| Auswertungsumgebung | production |
| Bevorzugte URL | https://example.com/ |
| Quellstand | PROJEKT-COMMIT |
| Deployment | DEPLOYMENT-ARTEFAKT |
| Herkunft Quell-/Deploymentstand | projektseitig deklariert |

## Zusammenfassung

| Projektstatus | Anzahl |
|---|---:|
| Vollständig nachgewiesen | 3 |
| Fehlgeschlagen | 0 |
| Teilweise nachgewiesen | 25 |
| Offen | 5 |
| Unklar | 0 |
| Nicht zutreffend | 0 |
| Externer Nachweis offen | 1 |
| Zurückgestellt | 0 |
| Akzeptierte Abweichung (offen) | 0 |
| **Ausgewählte Pilotpunkte** | **34** |

Automatische Kriterien (57 gesamt): 46 bestanden, 0 fehlgeschlagen, 0 unklar, 0 nicht zutreffend, 11 ohne Nachweis.

Nicht automatische Kriterien (36 gesamt): 1 belegt, 0 fehlgeschlagen, 0 unklar, 0 nicht zutreffend, 35 ohne Nachweis.

## Technische Läufe

| Werkzeug | Ziel | Umgebung | Verwendet | Assertions | Befehl |
|---|---|---|---:|---:|---|
| http-check 0.6.1 | https://example.com/ | production | ja | 12 | <code>website-qa-http https://example.com/ --strict --json</code> |
| crawl-check 0.6.1 | https://example.com/ | production | ja | 16 | <code>website-qa-crawl https://example.com/ --sitemap --max-pages=50 --max-resources=500 --strict --json</code> |
| browser-check 0.6.1 | https://example.com/ | production | ja | 7 | <code>website-qa-browser https://example.com/ --max-pages=10 --max-requests=300 --strict --json</code> |
| social-preview-check 0.6.1 | https://example.com/ | production | ja | 10 | <code>website-qa-social https://example.com/ --sitemap --max-pages=20 --strict --json</code> |

## Checklistenpunkte

| ID | Modul | Projektstatus | Automatisch geklärt | Nicht automatisch geklärt |
|---|---|---|---:|---:|
| CORE-DOM-02 | core | Offen | 0/2 | 0/0 |
| CORE-DOM-04 | core | Externer Nachweis offen | 0/0 | 0/2 |
| CORE-DOM-05 | core | Teilweise nachgewiesen | 2/2 | 0/1 |
| CORE-DOM-07 | core | Offen | 0/3 | 0/1 |
| CORE-DOM-08 | core | Teilweise nachgewiesen | 2/2 | 0/2 |
| CORE-ERR-01 | core | Offen | 0/2 | 0/1 |
| CORE-ERR-02 | core | Vollständig nachgewiesen | 2/2 | 0/0 |
| CORE-ERR-03 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-ERR-04 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-SEO-01 | core | Teilweise nachgewiesen | 3/3 | 0/1 |
| CORE-SEO-02 | core | Teilweise nachgewiesen | 2/2 | 0/1 |
| CORE-SOC-01 | core | Teilweise nachgewiesen | 2/2 | 0/1 |
| CORE-SOC-02 | core | Vollständig nachgewiesen | 4/4 | 0/0 |
| CORE-SOC-03 | core | Offen | 0/0 | 0/1 |
| CORE-ROB-01 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-ROB-02 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-ROB-04 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-MAP-01 | core | Teilweise nachgewiesen | 2/2 | 0/1 |
| CORE-MAP-02 | core | Teilweise nachgewiesen | 2/2 | 0/1 |
| CORE-SEO-04 | core | Teilweise nachgewiesen | 3/3 | 0/1 |
| CORE-A11Y-01 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-A11Y-10 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-A11Y-13 | core | Teilweise nachgewiesen | 1/1 | 0/3 |
| CORE-QA-02 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-QA-05 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-QA-07 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-QA-08 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-PERF-01 | core | Offen | 0/3 | 0/1 |
| CORE-PERF-05 | core | Teilweise nachgewiesen | 1/2 | 0/1 |
| CORE-PRIV-02 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-PRIV-04 | core | Teilweise nachgewiesen | 1/1 | 0/2 |
| CORE-SEC-04 | core | Teilweise nachgewiesen | 1/1 | 0/1 |
| CORE-SEC-05 | core | Teilweise nachgewiesen | 6/6 | 0/1 |
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

### CORE-DOM-08: Teilweise nachgewiesen

HSTS-Wert und Reichweite sind bewusst gewählt und auf allen relevanten HTTPS-Antworten einschließlich vorgeschalteter Weiterleitungshosts geprüft. `includeSubDomains` und `preload` werden nur nach Prüfung aller betroffenen Subdomains aktiviert.

- [x] `CORE-DOM-08/C1` HSTS ist auf allen vom HTTP-Prüfer untersuchten HTTPS-Antwortklassen vorhanden. — automatic, pass
- [x] `CORE-DOM-08/C2` Der HSTS-max-age ist syntaktisch gültig und beträgt mindestens 180 Tage. — automatic, pass
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

### CORE-ERR-03: Teilweise nachgewiesen

API-, Asset- und Content-Negotiation-Fehler liefern passende Statuscodes und Medientypen statt einer scheinbar erfolgreichen HTML-Antwort.

- [x] `CORE-ERR-03/C1` Alle vom Crawl geprüften internen Seitenressourcen antworten erfolgreich und verwenden einen zum Einbindungszweck passenden MIME-Typ. — automatic, pass
- [ ] `CORE-ERR-03/C2` API- und projektspezifische Content-Negotiation-Fehler liefern die vorgesehenen Statuscodes und Medientypen statt einer scheinbar erfolgreichen HTML-Antwort. — manual, noEvidence
  - Erforderlicher Nachweis: Einschlägige API- und Content-Negotiation-Fehler mit nebenwirkungsfreien Anfragen prüfen oder ihre begründete Nichtanwendbarkeit dokumentieren; der Ressourcenlauf allein genügt nicht.

### CORE-ERR-04: Teilweise nachgewiesen

Sicherheits-, Indexierungs- und Cacheheader wurden auch auf Fehlerantworten und app- sowie proxyseitigen Weiterleitungen geprüft.

- [x] `CORE-ERR-04/C1` Die geprüfte 404-Antwort enthält noindex und ist nicht ausdrücklich öffentlich cachebar; alle automatisch ausgewählten Antworten besitzen ihre einschlägige beobachtbare Sicherheitsheaderbasis. — automatic, pass
- [ ] `CORE-ERR-04/C2` Sicherheits-, Indexierungs- und Cacheheader auf projektspezifischen app- und proxyseitigen Weiterleitungen wurden vollständig bewertet. — manual, noEvidence
  - Erforderlicher Nachweis: App- und proxyseitige Redirectklassen, alternative Hosts und erwartete Sicherheits-, Indexierungs- und Cacheheader mit Infrastrukturbezug dokumentieren; die öffentliche 404-/Seitenstichprobe allein genügt nicht.

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

### CORE-SOC-01: Teilweise nachgewiesen

Relevante Seiten enthalten mindestens `og:title`, `og:description`, `og:type`, `og:url` und ein geeignetes `og:image` mit absoluter HTTPS-URL sowie, soweit vorgesehen, passende X-/Twitter-Metadaten.

- [x] `CORE-SOC-01/C1` Alle vom Social-Check geprüften Seiten besitzen eindeutige OpenGraph-Pflichtfelder mit absoluten HTTPS-URLs für og:url und og:image. — automatic, pass
- [x] `CORE-SOC-01/C2` twitter:card sowie erforderliche X-/Twitter-Werte oder geeignete OpenGraph-Fallbacks sind technisch verwendbar. — automatic, pass
- [ ] `CORE-SOC-01/C3` Titel, Beschreibungen, Bildinhalt und Bildzuschnitt sind für die vorgesehenen Seiten und Plattformen inhaltlich geeignet. — manual, noEvidence
  - Erforderlicher Nachweis: Social-Texte und Vorschaubilder redaktionell gegen Seiteninhalt, Projektvorgaben und vorgesehenen Plattformkontext prüfen; technische Metadatenprüfung allein genügt nicht.

### CORE-SOC-02: Vollständig nachgewiesen

Öffentlich ausgelieferte Social-Metadaten wurden automatisiert aus serverseitigem HTML mit Browser-, Facebook-, X-/Twitter- und LinkedIn-User-Agent geprüft. Pflichtfelder, Mehrdeutigkeiten, Canonical-/OpenGraph-Konsistenz, Redirects sowie Bildabruf, MIME-Typ, Dateigröße und Pixelmaße sind umfasst; Fehler liefern einen CI-tauglichen Exitcode. Standardverfahren mit lokal eingebundenem `@mktcode/website-qa`: `npm run ops:social:check -- https://[DOMAIN]/ --sitemap --max-pages=50 --strict`; Paket-/Werkzeugcommit und Bericht werden protokolliert.

- [x] `CORE-SOC-02/C1` Browser, Facebook, X/Twitter und LinkedIn erhalten erfolgreiche, konsistente HTML-Antworten und Social-Metadaten. — automatic, pass
- [x] `CORE-SOC-02/C2` Canonical, finale Seiten-URL und og:url sind auf allen geprüften Seiten eindeutig und konsistent. — automatic, pass
- [x] `CORE-SOC-02/C3` Alle vorgesehenen Vorschaubilder erfüllen die geprüften Anforderungen an Abruf, MIME-Typ, Dateigröße, Pixelmaße, Seitenverhältnis, Deklarationen und Alternativtext. — automatic, pass
- [x] `CORE-SOC-02/C4` Der technische Social-Lauf wurde streng ausgewertet, sodass Warnungen einen fachlich negativen Exitcode erzeugen. — automatic, pass

### CORE-SOC-03: Offen

Zusätzlich wurde mindestens eine echte öffentliche Plattformvorschau oder ein echter Plattformcrawler manuell geprüft. Darstellung, Zuschnitt und Plattformcache werden nicht aus einer lokalen User-Agent-Simulation abgeleitet.

- [ ] `CORE-SOC-03/C1` Mindestens eine echte öffentliche Plattformvorschau oder ein echter Plattformcrawler wurde mit Datum, Plattform, URL und Ergebnis dokumentiert. — manual, noEvidence
  - Erforderlicher Nachweis: Echte öffentliche Plattformvorschau oder echten Plattformcrawler verwenden und Darstellung, Zuschnitt sowie gegebenenfalls Cacheverhalten dokumentieren; lokale User-Agent-Simulation nicht als Plattformnachweis ausgeben.

### CORE-ROB-01: Teilweise nachgewiesen

`robots.txt` ist öffentlich erreichbar, syntaktisch plausibel und blockiert keine für die gewünschte Indexierung notwendigen Seiten oder Ressourcen.

- [x] `CORE-ROB-01/C1` robots.txt wurde erfolgreich ausgewertet und blockiert die vorgesehenen Social-Crawler auf den geprüften Seiten nicht. — automatic, pass
- [ ] `CORE-ROB-01/C2` Die robots.txt-Regeln wurden gegen die projektspezifisch gewünschte Indexierung notwendiger Seiten und Ressourcen bewertet. — manual, noEvidence
  - Erforderlicher Nachweis: Gewünschte Indexierung und erforderliche Seiten beziehungsweise Ressourcen mit den ausgelieferten Regeln abgleichen; robots.txt nicht als Zugriffsschutz bewerten.

### CORE-ROB-02: Teilweise nachgewiesen

Aktuelle, offiziell dokumentierte Kennungen wichtiger Social-, Such-, KI-Such-, Nutzerabruf- und Trainingsdienste sowie reine Produkt- beziehungsweise Datennutzungstokens werden mit dokumentiertem Quellenstand getrennt bewertet.

- [x] `CORE-ROB-02/C1` Der technische Bericht dokumentiert die geprüften Kennungen, Kategorien, offiziellen Quellen und den Quellenstand der Policy-Matrix. — automatic, pass
- [ ] `CORE-ROB-02/C2` Quellenstand und Auswahl der Kennungen wurden auf ausreichende Aktualität und projektspezifische Relevanz bewertet. — manual, noEvidence
  - Erforderlicher Nachweis: Quellenstand, relevante Anbieter und erkennbare Richtlinienänderungen prüfen; der im Werkzeug eingebettete Stand ist kein automatischer Aktualitätsnachweis.

### CORE-ROB-04: Teilweise nachgewiesen

Die automatisierte Prüfung warnt vor jedem ohne dokumentiertes Opt-in erlaubten Training-/Datennutzungstoken und behandelt diese Warnungen im Standardaufruf mit `--strict` als Fehler. `--ai-training-opt-in` wird ausschließlich nach ausdrücklicher dokumentierter Freigabe verwendet und verändert keine Robots-Regel. `robots.txt` wird nicht als Zugriffsschutz, Rechtsgarantie oder rückwirkende Löschung dargestellt.

- [x] `CORE-ROB-04/C1` Trainings-/Datennutzungstokens sind blockiert oder der strikte technische Lauf deklariert ausdrücklich ein separat nachzuweisendes Opt-in. — automatic, pass
- [ ] `CORE-ROB-04/C2` Die projektspezifische Opt-out- beziehungsweise Opt-in-Entscheidung ist mit zuständiger Stelle, Umfang und Datum dokumentiert. — manual, noEvidence
  - Erforderlicher Nachweis: Standardmäßiges Opt-out oder ausdrückliche Trainingsfreigabe dokumentieren; die CLI-Option allein gilt nicht als Betreiber- beziehungsweise Kundenfreigabe.

### CORE-MAP-01: Teilweise nachgewiesen

Soweit sinnvoll, ist eine Sitemap vorhanden und in `robots.txt` referenziert. Sie enthält ausschließlich absolute, kanonische, indexierbare 200-URLs und keine Fehler-, Redirect- oder `noindex`-Ziele.

- [x] `CORE-MAP-01/C1` Die geprüften Sitemap-Dateien sind als gültiges XML erreichbar und die Einstiegssitemap ist in robots.txt referenziert. — automatic, pass
- [x] `CORE-MAP-01/C2` Die geprüfte Sitemap enthält ausschließlich eindeutige, absolute, kanonische, indexierbare 200-URLs des Zielorigins. — automatic, pass
- [ ] `CORE-MAP-01/C3` Vorhandensein und erwarteter Seitenumfang der Sitemap entsprechen dem projektspezifischen Routen- und Indexierungsinventar. — manual, noEvidence
  - Erforderlicher Nachweis: Sinnhaftigkeit der Sitemap und erwartete indexierbare Routen mit dem Projektinventar abgleichen; der begrenzte Crawl kennt nicht selbständig alle vorgesehenen Seiten.

### CORE-MAP-02: Teilweise nachgewiesen

Die öffentlich erzeugte Sitemap wurde als XML geparst, auf Medientyp, Hosts, Duplikate und Canonical-Abgleich geprüft. Nicht belastbare `lastmod`-, `changefreq`- oder `priority`-Werte werden nicht künstlich gesetzt; eine vorhandene XSL-Darstellung enthält keine Platzhalter oder sichtbaren Fehler.

- [x] `CORE-MAP-02/C1` Sitemap-XML, Medientyp, Zielorigin, eindeutige Einträge und Canonical-Abgleich sind technisch unauffällig. — automatic, pass
- [x] `CORE-MAP-02/C2` Alle gültig erfassten Sitemap-URLs wurden innerhalb der dokumentierten Limits vollständig geprüft. — automatic, pass
- [ ] `CORE-MAP-02/C3` Optionale lastmod-, changefreq-, priority- und XSL-Angaben wurden auf tatsächliche Belastbarkeit beziehungsweise sichtbare Fehler geprüft oder begründet als nicht anwendbar dokumentiert. — manual, noEvidence
  - Erforderlicher Nachweis: Optionale Sitemap-Metadaten und eine vorhandene XSL-Ausgabe fachlich prüfen; fehlen alle optionalen Angaben, ihre Nichtanwendbarkeit ausdrücklich dokumentieren.

### CORE-SEO-04: Teilweise nachgewiesen

Statuscodes, Weiterleitungen, Canonicals, Robots-Angaben, interne Links, Downloads und notwendige Seitenressourcen wurden mit einem technischen Crawl und echten GET-Abrufen kontrolliert. Standardverfahren mit lokal eingebundenem `@mktcode/website-qa`: `npm run ops:crawl:check -- https://[DOMAIN]/ --sitemap --max-pages=50 --max-resources=500 --strict`; Paket-/Werkzeugcommit und Bericht werden protokolliert. Der zentrale Social-Check ersetzt diesen allgemeinen Crawl nicht.

- [x] `CORE-SEO-04/C1` Die geprüften internen Seiten- und Fragmentziele sind erfolgreich und ohne Weiterleitung erreichbar. — automatic, pass
- [x] `CORE-SEO-04/C2` Die geprüften internen Seitenressourcen antworten erfolgreich und mit passendem MIME-Typ. — automatic, pass
- [x] `CORE-SEO-04/C3` Der ausschließlich lesende Crawl blieb innerhalb seiner dokumentierten Grenzen und ließ keine Navigation aus Sicherheitsgründen aus. — automatic, pass
- [ ] `CORE-SEO-04/C4` Der geprüfte Seiten-, Download- und Ressourcenumfang entspricht dem projektspezifisch vorgesehenen öffentlichen Inventar; bewusst ausgelassene Pfade sind bewertet. — manual, noEvidence
  - Erforderlicher Nachweis: Crawlbericht und ausgelassene Navigationen gegen das Projektinventar abgleichen; externe Links, dynamische Interaktionspfade und sicherheitsbedingt übersprungene Ziele getrennt bewerten.

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

### CORE-QA-05: Teilweise nachgewiesen

Bilder, Videos, Dokumente und externe Einbettungen laden wie erwartet; defekte interne und externe Links wurden automatisiert oder manuell gesucht.

- [x] `CORE-QA-05/C1` Die geprüften internen Seiten-, Fragment- und Ressourcenziele sind technisch erfolgreich erreichbar. — automatic, pass
- [ ] `CORE-QA-05/C2` Darstellung von Medien und Einbettungen sowie nur inventarisierte externe Links wurden risikogerecht zusätzlich geprüft. — manual, noEvidence
  - Erforderlicher Nachweis: Medien und Einbettungen visuell prüfen und externe Links mit einem gesondert freigegebenen Verfahren bewerten; der allgemeine Crawler ruft externe Ziele bewusst nicht ab.

### CORE-QA-07: Teilweise nachgewiesen

Die Seiten wurden ohne sichtbare JavaScript-, Netzwerk- oder Hydrationsfehler in der Browserkonsole geprüft.

- [x] `CORE-QA-07/C1` In den automatisch geprüften Seiten-/Profil-Läufen wurden keine Konsolen-, JavaScript-, Netzwerk- oder HTTP-Fehler beobachtet. — automatic, pass
- [ ] `CORE-QA-07/C2` Interaktionsabhängige und vom beobachtenden Browserlauf nicht erreichte Zustände wurden zusätzlich auf Konsolen-, Netzwerk- und Hydrationsfehler geprüft. — manual, noEvidence
  - Erforderlicher Nachweis: Vereinbarte interaktive Zustände manuell aufrufen und Browserkonsole sowie Netzwerkprotokoll beobachten; keine schreibenden Produktionsaktionen ausführen.

### CORE-QA-08: Teilweise nachgewiesen

Der öffentliche Ressourcenlauf erfasst neben HTML auch tatsächlich angeforderte CSS-, JavaScript-, Schrift-, Bild- und Downloadressourcen mit Status und MIME-Typ; dynamische Pfade und erst nach Interaktion geladene Ressourcen werden zusätzlich im Browser geprüft.

- [x] `CORE-QA-08/C1` Die vom Crawl entdeckten und mit GET abgerufenen internen Seitenressourcen besitzen erfolgreiche Statuscodes und passende MIME-Typen. — automatic, pass
- [ ] `CORE-QA-08/C2` Dynamische, browserabhängige und erst nach vereinbarter Interaktion geladene Ressourcen wurden zusätzlich geprüft oder mit ihrer Grenze dokumentiert. — manual, noEvidence
  - Erforderlicher Nachweis: Browsernetzwerk für dynamische und interaktionsabhängige Ressourcen prüfen, ohne schreibende Produktionsaktionen auszuführen; serverseitiger HTML-/CSS-Crawl allein genügt nicht.

### CORE-PERF-01: Offen

Geeignete textbasierte Antworten wie HTML, CSS, JavaScript, JSON und größere SVG-Dateien werden per HTTP komprimiert. Produktion wurde mindestens für HTML, CSS und JavaScript mit Identity, Gzip und Brotli geprüft; `Content-Encoding`, `Vary` und tatsächliche Größenreduktion sind plausibel. Erfolgt die Kompression am Reverse Proxy, sind Middlewarekonfiguration und Zuordnung zum produktiven HTTPS-Router bestätigt.

- [ ] `CORE-PERF-01/C1` Identity-Antworten der ausgewählten textbasierten Ressourcen sind unverändert auslieferbar. — automatic, noEvidence
- [ ] `CORE-PERF-01/C2` Geeignete ausgewählte Ressourcen handeln wirksames Gzip mit passendem Vary aus. — automatic, noEvidence
- [ ] `CORE-PERF-01/C3` Geeignete ausgewählte Ressourcen handeln wirksames Brotli mit passendem Vary aus. — automatic, noEvidence
- [ ] `CORE-PERF-01/C4` Die Kompressionszuständigkeit der produktiven Anwendung beziehungsweise des Reverse Proxys wurde bestätigt. — manual, noEvidence
  - Erforderlicher Nachweis: Produktive Router-/Proxyzuordnung oder begründete Nichtanwendbarkeit dokumentieren.

### CORE-PERF-05: Teilweise nachgewiesen

Cacheheader passen zur Ressource: versionierte unveränderliche Assets dürfen langfristig cachen, veränderliche öffentliche Dateien bleiben aktualisierbar und sensible Antworten werden nicht öffentlich gespeichert.

- [ ] `CORE-PERF-05/C1` Vom HTTP-Prüfer ausgewählte versioniert wirkende Assets besitzen einen langfristigen unveränderlichen Cache. — automatic, noEvidence
- [x] `CORE-PERF-05/C2` Die geprüfte 404-Antwort ist nicht ausdrücklich langfristig öffentlich cachebar. — automatic, pass
- [ ] `CORE-PERF-05/C3` Die Cachepolitik für veränderliche, sensible und weitere projektspezifische Antwortklassen wurde bewertet. — manual, noEvidence
  - Erforderlicher Nachweis: Antwortklassen, erwartete Cachepolitik und tatsächliche Header dokumentieren.

### CORE-PRIV-02: Teilweise nachgewiesen

Tatsächliche externe Schriftarten, CDNs, Karten, Videos, Tracker, Analyse-, Fehlertracking- und sonstige Drittanbieteranfragen wurden per Quellprüfung und Browsernetzwerk kontrolliert.

- [x] `CORE-PRIV-02/C1` Externe Requestversuche wurden innerhalb der deklarierten passiven und isolierten Browserprüfumgebung vollständig inventarisiert und weiterhin blockiert. — automatic, pass
- [ ] `CORE-PRIV-02/C2` Das technische Browserinventar wurde mit Quellcode, Build- und Laufzeitkonfiguration sowie der projektspezifisch dokumentierten Liste externer Dienste abgeglichen. — manual, noEvidence
  - Erforderlicher Nachweis: Blockierte Requestversuche und Browseraktionen mit Quellcode, Konfiguration und dokumentierten Drittanbietern vergleichen; externe Links nicht mit tatsächlich initiierten Requests verwechseln und rechtliche Eignung getrennt bewerten.

### CORE-PRIV-04: Teilweise nachgewiesen

Cookies sowie Local- und Session-Storage stimmen mit Dokumentation und Einwilligungslogik überein. Sicherheitsrelevante Cookies verwenden soweit einschlägig `Secure`, `HttpOnly` und eine passende `SameSite`-Richtlinie.

- [x] `CORE-PRIV-04/C1` Cookies, Local Storage, Session Storage und IndexedDB wurden im passiven Initialzustand frischer isolierter Browserkontexte ohne Speicherung ihrer Werte vollständig inventarisiert. — automatic, pass
- [ ] `CORE-PRIV-04/C2` Das technische Initialinventar stimmt mit Dokumentation und Einwilligungslogik überein; interaktionsabhängige Zustände wurden gesondert bewertet. — manual, noEvidence
  - Erforderlicher Nachweis: Cookie- und Storage-Bezeichner sowie Setzzeitpunkt mit Dokumentation und Einwilligungslogik vergleichen; notwendige reale Interaktionszustände in einem gesondert freigegebenen manuellen Verfahren prüfen.
- [ ] `CORE-PRIV-04/C3` Für sicherheitsrelevante Cookies wurde projektspezifisch bewertet, ob `Secure`, `HttpOnly` und die beobachtete `SameSite`-Richtlinie angemessen sind. — manual, noEvidence
  - Erforderlicher Nachweis: Zweck und Zugriffspfad jedes sicherheitsrelevanten Cookies bestimmen und die beobachteten Attribute fachlich bewerten; bloße Attributpräsenz oder -abwesenheit genügt nicht.

### CORE-SEC-04: Teilweise nachgewiesen

Sicherheitsheader und Proxygrenzen wurden passend zum Projekt für HTML, statische Assets, APIs, Fehler, appseitige sowie proxyseitige Weiterleitungen geprüft. Anwendung und Proxy entfernen oder widersprechen sich nicht unbeabsichtigt.

- [x] `CORE-SEC-04/C1` Die automatisch ausgewählten HTML-, CSS-, JavaScript- und 404-Antworten wurden vollständig auf die jeweils einschlägige öffentlich beobachtbare Sicherheitsheaderbasis geprüft. — automatic, pass
- [ ] `CORE-SEC-04/C2` Projektspezifische APIs, weitere Assets, sensible Antworten, alternative Hosts, app- und proxyseitige Weiterleitungen sowie die tatsächlichen Proxygrenzen wurden zusätzlich bewertet. — manual, noEvidence
  - Erforderlicher Nachweis: Vollständige projektspezifische Antwortklassen und Proxyzuständigkeiten inventarisieren, öffentliche Headerstichproben gegen Anwendung und Proxy abgleichen und Abweichungen dokumentieren.

### CORE-SEC-05: Teilweise nachgewiesen

CSP, Framing-Schutz, MIME-Sniffing-Schutz, Referrer Policy, Permissions Policy und HSTS wurden risikogerecht bewertet; eine bewusst begrenzte Richtlinie wird nicht als Vollschutz ausgegeben.

- [x] `CORE-SEC-05/C1` Content-Security-Policy ist auf den ausgewählten dokumentartigen Antworten deklariert. — automatic, pass
- [x] `CORE-SEC-05/C2` CSP frame-ancestors oder X-Frame-Options begrenzt Framing auf den ausgewählten dokumentartigen Antworten. — automatic, pass
- [x] `CORE-SEC-05/C3` X-Content-Type-Options ist auf allen ausgewählten Antworten wirksam als nosniff deklariert. — automatic, pass
- [x] `CORE-SEC-05/C4` Referrer-Policy ist auf den ausgewählten dokumentartigen Antworten deklariert. — automatic, pass
- [x] `CORE-SEC-05/C5` Permissions-Policy ist auf den ausgewählten dokumentartigen Antworten deklariert. — automatic, pass
- [x] `CORE-SEC-05/C6` HSTS ist auf den ausgewählten HTTPS-Antworten vorhanden und besitzt einen gültigen max-age von mindestens 180 Tagen. — automatic, pass
- [ ] `CORE-SEC-05/C7` Inhalt, Reichweite, Widerspruchsfreiheit und risikogerechte Eignung der Richtlinien wurden für das Projekt bewertet, ohne eine begrenzte Richtlinie als Vollschutz auszugeben. — manual, noEvidence
  - Erforderlicher Nachweis: CSP-Direktiven, erlaubte Quellen, Framingbedarf, Referrer- und Featureanforderungen sowie HSTS-Reichweite einschließlich includeSubDomains/preload risikogerecht bewerten; bloße Headerpräsenz genügt nicht.

### GOV-RGT-02: Vollständig nachgewiesen

Inhalte, Logo, Bilder, Videos, Schriftarten, Testimonials und sonstige Materialien sind freigegeben oder ihre Nutzungs- und Veröffentlichungsrechte sind dokumentiert.

- [x] `GOV-RGT-02/C1` Die zuständige Stelle hat die Nutzungs- und Veröffentlichungsrechte der eingesetzten Materialien bestätigt oder dokumentiert. — external, pass

## Grenzen

- Der strukturierte Katalog ist ein Pilot und umfasst noch nicht die vollständige Website-Checkliste.
- Automatische Ergebnisse sind technische Teilnachweise und ersetzen keine manuellen, externen, rechtlichen oder organisatorischen Prüfungen.
- Nur technische Läufe der festgelegten Auswertungsumgebung fließen in die Checklistenbewertung ein.
- Quell- und Deploymentstand technischer Läufe sind projektseitig deklarierte Zuordnungen; das technische Werkzeug bestätigt sie nicht unabhängig.
- Simulierte Social-Crawler-User-Agents ersetzen keine echte Plattformvorschau und keinen Nachweis des Plattformcaches.
