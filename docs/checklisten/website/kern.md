## Verpflichtende Kernprüfung

Dieser Kern wird in jede Projektcheckliste übernommen. Bedingte Fachthemen werden nicht durch allgemeine Kernpunkte ersetzt, sondern über die ausgewählten Module ergänzt. Die konkreten Ausführungswege aus `pruefverfahren.md` im dokumentierten Quellvorlagenverzeichnis werden an das Projekt angepasst und mit tatsächlich verwendeten Befehlen und Werkzeugversionen protokolliert.

### Umfang, Inhalte und Verantwortlichkeit

- [ ] `CORE-SCP-01` Projektziel, veröffentlichte Funktionen, vereinbarter Prüfumfang, Rollen und ausdrücklich nicht geprüfte Bereiche sind dokumentiert.
- [ ] `CORE-SCP-02` Betreiber, inhaltlich Verantwortliche, technische Zuständigkeiten und Ansprechpartner für externe Nachweise sind benannt.
- [ ] `CORE-SCP-03` Ein Inventar ordnet alle öffentlichen Routen, Funktionen, Datenflüsse, externen Integrationen und administrativen Wege den einschlägigen Kernpunkten, Modulen und Prüfverfahren zu. Für nicht abgedeckte Sonderfunktionen wurden projektspezifische `PROJ-*`-Punkte ergänzt.
- [ ] `CORE-CNT-01` Veröffentlichte Texte, geschäftliche Angaben, Kontaktwege und Call-to-Action-Inhalte entsprechen dem freigegebenen Stand.
- [ ] `CORE-CNT-02` Besondere rechtliche, branchenspezifische, barrierefreiheitsbezogene oder sicherheitstechnische Anforderungen wurden abgefragt. Nicht vereinbarte Anforderungen werden nicht stillschweigend als erfüllt oder geschuldet dargestellt.
- [ ] `CORE-CNT-03` Inhalte für Suchmaschinen und ausdrücklich gewünschte KI-Such-, Index- oder nutzerinitiierte Antwortdienste sind klar strukturiert, eindeutig, informationsreich, aktuell, überprüfbar und serverseitig zugänglich. Konkrete Fakten, Zahlen und Entitäten werden soweit sinnvoll genannt und Aussagen durch Quellen oder Belege gestützt. Daraus wird keine Freigabe für KI-Training abgeleitet.

### Domain, HTTPS und URL-Verhalten

- [ ] `CORE-DOM-01` Bevorzugte öffentliche URL, Schema, Host und Slash-Strategie sind eindeutig festgelegt.
- [ ] `CORE-DOM-02` HTTP leitet dauerhaft, pfad- und queryerhaltend und möglichst ohne unnötige Zwischenstation auf HTTPS um.
- [ ] `CORE-DOM-03` Nicht bevorzugte Hostvarianten leiten dauerhaft, pfad- und queryerhaltend auf die bevorzugte URL um.
- [ ] `CORE-DOM-04` Zertifikat, Zertifikatskette, Hostabdeckung und unterstützte TLS-Versionen sind mit einem geeigneten Werkzeug geprüft. Die automatische Verlängerung ist durch Konfiguration oder einen erfolgreichen Erneuerungsnachweis plausibilisiert.
- [ ] `CORE-DOM-05` Jede indexierbare Seite enthält genau einen absoluten Canonical auf der festgelegten Host- und HTTPS-Variante.
- [ ] `CORE-DOM-06` Canonicals, interne Links, Sitemap, OpenGraph-URLs und Weiterleitungen verwenden konsistent die vorgesehene öffentliche URL.
- [ ] `CORE-DOM-07` Weiterleitungen wurden auf Statuscode, Pfad- und Queryerhalt, Schleifen und unnötige Ketten geprüft.
- [ ] `CORE-DOM-08` HSTS-Wert und Reichweite sind bewusst gewählt und auf allen relevanten HTTPS-Antworten einschließlich vorgeschalteter Weiterleitungshosts geprüft. `includeSubDomains` und `preload` werden nur nach Prüfung aller betroffenen Subdomains aktiviert.
- [ ] `CORE-DOM-09` Apex-, `www`- und sonstige veröffentlichte Hosts lösen über die beabsichtigten A-, AAAA- beziehungsweise CNAME-Einträge auf die zuständige Infrastruktur auf; IPv4 und IPv6, veraltete Einträge und unbeabsichtigt direkt erreichbare Altziele wurden geprüft.

### Fehler- und Sonderantworten

- [ ] `CORE-ERR-01` Eine unbekannte Browserroute liefert eine verständliche HTML-Fehlerseite mit tatsächlichem HTTP-404-Status und ohne interne technische Details.
- [ ] `CORE-ERR-02` Nicht indexierbare Fehlerseiten senden `noindex` und enthalten weder einen irreführenden Canonical noch `og:url` auf die Fehleradresse.
- [ ] `CORE-ERR-03` API-, Asset- und Content-Negotiation-Fehler liefern passende Statuscodes und Medientypen statt einer scheinbar erfolgreichen HTML-Antwort.
- [ ] `CORE-ERR-04` Sicherheits-, Indexierungs- und Cacheheader wurden auch auf Fehlerantworten und app- sowie proxyseitigen Weiterleitungen geprüft.

### Technische SEO, Social-Metadaten und Crawler

- [ ] `CORE-SEO-01` Jede relevante Seite besitzt einen eindeutigen, inhaltlich passenden Titel und eine passende Meta-Beschreibung.
- [ ] `CORE-SEO-02` Die Seitensprache ist mit einem passenden `lang`-Attribut angegeben; Überschriften bilden eine nachvollziehbare Hierarchie mit verständlicher Hauptüberschrift.
- [ ] `CORE-SEO-03` Strukturierte Daten werden nur verwendet, wenn sie zum sichtbaren Inhalt passen, vollständig sind und mit einem geeigneten Validator geprüft wurden.
- [ ] `CORE-SOC-01` Relevante Seiten enthalten mindestens `og:title`, `og:description`, `og:type`, `og:url` und ein geeignetes `og:image` mit absoluter HTTPS-URL sowie, soweit vorgesehen, passende X-/Twitter-Metadaten.
- [ ] `CORE-SOC-02` Öffentlich ausgelieferte Social-Metadaten wurden automatisiert aus serverseitigem HTML mit Browser-, Facebook-, X-/Twitter- und LinkedIn-User-Agent geprüft. Pflichtfelder, Mehrdeutigkeiten, Canonical-/OpenGraph-Konsistenz, Redirects sowie Bildabruf, MIME-Typ, Dateigröße und Pixelmaße sind umfasst; Fehler liefern einen CI-tauglichen Exitcode. Standardverfahren mit lokal eingebundenem `@mktcode/website-qa`: `npm run ops:social:check -- https://[DOMAIN]/ --sitemap --max-pages=50 --max-sitemaps=20 --strict`; Paket-/Werkzeugcommit und Bericht werden protokolliert.
- [ ] `CORE-SOC-03` Zusätzlich wurde mindestens eine echte öffentliche Plattformvorschau oder ein echter Plattformcrawler manuell geprüft. Darstellung, Zuschnitt und Plattformcache werden nicht aus einer lokalen User-Agent-Simulation abgeleitet.
- [ ] `CORE-ROB-01` `robots.txt` ist öffentlich erreichbar, syntaktisch plausibel und blockiert keine für die gewünschte Indexierung notwendigen Seiten oder Ressourcen.
- [ ] `CORE-ROB-02` Aktuelle, offiziell dokumentierte Kennungen wichtiger Social-, Such-, KI-Such-, Nutzerabruf- und Trainingsdienste sowie reine Produkt- beziehungsweise Datennutzungstokens werden mit dokumentiertem Quellenstand getrennt bewertet.
- [ ] `CORE-ROB-03` KI-Training und vergleichbare Datennutzung sind standardmäßig per `robots.txt` ausgeschlossen. Eine Freigabe erfolgt nur nach ausdrücklicher dokumentierter Betreiber- beziehungsweise Kundenzustimmung; Such-/Indexbots und nutzerinitiierte Abrufe werden unabhängig entschieden.
- [ ] `CORE-ROB-04` Die automatisierte Prüfung dokumentiert erlaubte und blockierte Trainings-/Datennutzungstokens neutral. Menschen gleichen die Beobachtung mit der ausdrücklichen Betreiberentscheidung aus `CORE-ROB-03` ab; der technische Lauf nimmt keine Freigabe entgegen und leitet keine Zustimmung ab. `robots.txt` wird nicht als Zugriffsschutz, Rechtsgarantie oder rückwirkende Löschung dargestellt.
- [ ] `CORE-ROB-05` Der im Prüfbericht ausgewiesene Quellenstand der Crawler- und Produktkennungen wurde protokolliert und auf ausreichende Aktualität bewertet; Anbieteränderungen an Kennungen oder Richtlinien lösen eine erneute Quellenprüfung aus.
- [ ] `CORE-MAP-01` Soweit sinnvoll, ist eine Sitemap vorhanden und in `robots.txt` referenziert. Sie enthält ausschließlich absolute, kanonische, indexierbare 200-URLs und keine Fehler-, Redirect- oder `noindex`-Ziele.
- [ ] `CORE-MAP-02` Die öffentlich erzeugte Sitemap wurde als XML geparst, auf Medientyp, Hosts, Duplikate und Canonical-Abgleich geprüft. Nicht belastbare `lastmod`-, `changefreq`- oder `priority`-Werte werden nicht künstlich gesetzt; eine vorhandene XSL-Darstellung enthält keine Platzhalter oder sichtbaren Fehler.
- [ ] `CORE-SEO-04` Statuscodes, Weiterleitungen, Canonicals, Robots-Angaben, interne Links, Downloads und notwendige Seitenressourcen wurden mit einem technischen Crawl und echten GET-Abrufen kontrolliert. Standardverfahren mit lokal eingebundenem `@mktcode/website-qa`: `npm run ops:crawl:check -- https://[DOMAIN]/ --sitemap --max-pages=50 --max-resources=500 --strict`; Paket-/Werkzeugcommit und Bericht werden protokolliert. Der zentrale Social-Check ersetzt diesen allgemeinen Crawl nicht.
- [ ] `CORE-SEO-05` Search Console oder vergleichbare Webmaster-Werkzeuge sind soweit vereinbart eingerichtet; Eigentümer, Konto, Property, Verifizierungsweg und Ergebnisübermittlung sind dokumentiert.

### Barrierearme und nutzerfreundliche Umsetzung

> **Qualitätsziel:** Websites auf Basis dieser verpflichtenden Kerncheckliste werden mit [WCAG 2.2 auf Konformitätsstufe AA](https://www.w3.org/TR/WCAG22/) als Ziel umgesetzt und geprüft. Ergänzend dienen die offiziellen W3C-Hilfen [How to Meet WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) und [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/) der praktischen Auslegung. Die folgenden Prüfpunkte bilden eine operative Basis, aber keine vollständige Zuordnung aller Erfolgskriterien und keinen Konformitätsnachweis. Eine formelle Konformitätsaussage setzt die separate Dokumentation nach `CORE-A11Y-14` voraus.
>
> **Automatisierter Teilnachweis:** Mit lokal eingebundenem `@mktcode/website-qa` kann `npm run ops:browser:check -- https://[DOMAIN]/ --sitemap --max-pages=10 --max-requests=300 --strict` verwendet werden. Paket-/Werkzeugcommit, Chromium-Version, Profile, Grenzen und Befunde werden protokolliert. Der beobachtende Lauf klickt nicht und ersetzt insbesondere keine Tastatur-, Screenreader-, Safari-, reale Mobilgeräte- oder vollständige WCAG-Prüfung.

- [ ] `CORE-A11Y-01` Semantische HTML-Elemente werden passend eingesetzt; Navigation, Hauptinhalt, ergänzende Bereiche und Footer sind sinnvoll ausgezeichnet.
- [ ] `CORE-A11Y-02` Alle interaktiven Elemente sind per Tastatur in nachvollziehbarer Reihenfolge erreichbar und besitzen eine deutlich sichtbare Fokusanzeige. Navigation, eingebettete Inhalte und sonstige Komponenten erzeugen keine Fokusfalle.
- [ ] `CORE-A11Y-03` Links, Schaltflächen und reine Icons besitzen verständliche zugängliche Namen; Zustände und Informationen werden nicht ausschließlich über Farbe vermittelt.
- [ ] `CORE-A11Y-04` Per Opacity, Transformation, Offscreen-Position oder Animation unsichtbare Bedienelemente sind bis zu ihrer Sichtbarkeit weder fokussierbar noch irreführend im Accessibility Tree vorhanden.
- [ ] `CORE-A11Y-05` Modale Dialoge erhalten sinnvollen initialen Fokus, begrenzen Vorwärts- und Rückwärts-Tabben, setzen den Hintergrund inaktiv, unterstützen einen verständlichen Schließweg und stellen den Fokus auf den Auslöser zurück.
- [ ] `CORE-A11Y-06` Formulare besitzen zugeordnete Labels, verständliche Pflichtfeldhinweise, zugängliche Fehlermeldungen und nachvollziehbare Erfolgs- und Fehlerzustände.
- [ ] `CORE-A11Y-07` Dynamische Formularfehler und Statusmeldungen verwenden passend `aria-invalid`, `aria-describedby` und Live-Regionen, ohne Fokus oder Screenreader unnötig zu überlasten.
- [ ] `CORE-A11Y-08` Bilder besitzen redaktionell passende Alternativtexte; dekorative Bilder und Hintergründe werden nicht unnötig vorgelesen.
- [ ] `CORE-A11Y-09` Text, Bedienelemente, Fokus und wichtige Zustände besitzen ausreichenden Kontrast.
- [ ] `CORE-A11Y-10` Bei 320 CSS-Pixeln und bei 200 Prozent reiner Textvergrößerung bleibt der Inhalt ohne zweidimensionales Scrollen sinnvoll nutzbar; lange URLs, E-Mail-Adressen und Komposita verursachen keinen Dokumentüberlauf.
- [ ] `CORE-A11Y-11` Wesentliche Inhalte und Funktionen bleiben ohne Maus sowie bei erzwungener reduzierter Bewegung vollständig sichtbar und bedienbar.
- [ ] `CORE-A11Y-12` `prefers-reduced-motion` berücksichtigt CSS-Animationen, Übergänge, Smooth-Scroll, scrollgekoppelte Effekte und JavaScript-Animationsbibliotheken. Automatisch startende, blinkende oder ablenkende Inhalte werden vermieden beziehungsweise sind anhaltbar; Autoplay mit Ton wird nicht eingesetzt.
- [ ] `CORE-A11Y-13` Tastaturprüfung, automatisierter Accessibility-Audit und reale Mobilbrowserprüfung sind getrennt mit Datum und Werkzeug dokumentiert; eine Screenreader-Stichprobe erfolgt risikogerecht und bei vereinbarter Konformität zwingend.
- [ ] `CORE-A11Y-14` Falls BFSG-, BITV- oder WCAG-Konformität geschuldet ist, sind Umfang, Prüfverfahren, Ergebnis und Abweichungen separat dokumentiert. Ohne ausdrückliche Vereinbarung wird keine Konformität behauptet.

### Basisperformance und Auslieferung

- [ ] `CORE-PERF-01` Geeignete textbasierte Antworten wie HTML, CSS, JavaScript, JSON und größere SVG-Dateien werden per HTTP komprimiert. Produktion wurde mindestens für HTML, CSS und JavaScript mit Identity, Gzip und Brotli geprüft; `Content-Encoding`, `Vary` und tatsächliche Größenreduktion sind plausibel. Erfolgt die Kompression am Reverse Proxy, sind Middlewarekonfiguration und Zuordnung zum produktiven HTTPS-Router bestätigt.
- [ ] `CORE-PERF-02` Bereits komprimierte Bilder, Archive und Schriftformate werden nicht unnötig erneut komprimiert.
- [ ] `CORE-PERF-03` Ladezeit, realer LCP-Kandidat, CLS, Blocking Time und Renderprobleme wurden lokal gegen den Produktionsbuild und nach Möglichkeit öffentlich geprüft. Tracewarnungen werden zusätzlich zum Gesamtscore bewertet.
- [ ] `CORE-PERF-04` Wesentliche Above-the-fold-Inhalte sind nicht bis zu einer verspäteten JavaScript-Freigabe vollständig unsichtbar; es werden keine unsichtbaren Duplikate oder künstlichen Platzhalter zur Beschönigung von Metriken eingesetzt.
- [ ] `CORE-PERF-05` Cacheheader passen zur Ressource: versionierte unveränderliche Assets dürfen langfristig cachen, veränderliche öffentliche Dateien bleiben aktualisierbar und sensible Antworten werden nicht öffentlich gespeichert.

### Datenschutz und externe Ressourcen

- [ ] `CORE-PRIV-01` Impressum und Datenschutzerklärung sind unter dauerhaften Links erreichbar und entsprechen den tatsächlich eingesetzten Funktionen und Diensten.
- [ ] `CORE-PRIV-02` Tatsächliche externe Schriftarten, CDNs, Karten, Videos, Tracker, Analyse-, Fehlertracking- und sonstige Drittanbieteranfragen wurden per Quellprüfung und Browsernetzwerk kontrolliert.
- [ ] `CORE-PRIV-03` Externe Dienste sind nur aktiviert, wenn Zweck, Rechtsgrundlage, Hinweis-/Einwilligungsbedarf und technische Einbindung geklärt sind; Beispielkonfigurationen aktivieren nichts unbeabsichtigt.
- [ ] `CORE-PRIV-04` Cookies sowie Local- und Session-Storage stimmen mit Dokumentation und Einwilligungslogik überein. Sicherheitsrelevante Cookies verwenden soweit einschlägig `Secure`, `HttpOnly` und eine passende `SameSite`-Richtlinie.
- [ ] `CORE-PRIV-05` Ein Datenschutzhinweis wird nicht fälschlich als Einwilligung behandelt; eine Einwilligung wird nur eingesetzt, wenn sie tatsächlich erforderlich und technisch nachweisbar umgesetzt ist.

### Sicherheit und technische Qualität

- [ ] `CORE-SEC-01` Secrets, Zugangsdaten und private Schlüssel befinden sich nicht im Repository, Clientcode, öffentlich ausgelieferten Dateien oder frei zugänglichen Buildartefakten.
- [ ] `CORE-SEC-02` Abhängigkeiten, Lockdatei, Build und Produktionskonfiguration wurden auf bekannte Probleme geprüft. Meldungen werden anhand realer Laufzeit, Plattform und Angriffsweg bewertet statt blind ignoriert oder erzwungen aktualisiert.
- [ ] `CORE-SEC-03` Produktionslaufzeit, Architektur und Frameworkversionen sind unterstützt und passen zu nativen Buildartefakten.
- [ ] `CORE-SEC-04` Sicherheitsheader und Proxygrenzen wurden passend zum Projekt für HTML, statische Assets, APIs, Fehler, appseitige sowie proxyseitige Weiterleitungen geprüft. Anwendung und Proxy entfernen oder widersprechen sich nicht unbeabsichtigt.
- [ ] `CORE-SEC-05` CSP, Framing-Schutz, MIME-Sniffing-Schutz, Referrer Policy, Permissions Policy und HSTS wurden risikogerecht bewertet; eine bewusst begrenzte Richtlinie wird nicht als Vollschutz ausgegeben.
- [ ] `CORE-SEC-06` Öffentlich ausgelieferte Verzeichnisse und Dateien enthalten keine Secrets, Produktionsdaten, internen Dokumente, Debugausgaben oder unnötigen Source Maps.
- [ ] `CORE-SEC-07` Zentrale Nutzerpfade und Fehlerfälle funktionieren ohne interne Fehlermeldungen, unerwartete Browserkonsolenfehler oder fehlgeschlagene Netzwerkanfragen.
- [ ] `CORE-SEC-08` Falls verschlüsselte Secretdateien im privaten Repository verwaltet werden, arbeiten Ver- und Entschlüsselungsskripte fehlersicher, mit restriktiver `umask`, sicheren Dateimodi und Bereinigung unvollständiger Ausgaben; entschlüsselte Dateien sind ignoriert und Secret-Werte erscheinen nicht in Logs.
- [ ] `CORE-SEC-09` Erforderliche Laufzeitvariablen sind ohne reale Werte in einer Beispiel- oder Betriebsdokumentation beschrieben. Nicht mehr verwendete Variablen wurden entfernt; Beispielwerte aktivieren keine externen Dienste oder unsicheren Fallbacks.
- [ ] `CORE-SEC-10` Zuständigkeit, sichere Übergabe, Rotation und Wiederbeschaffung produktiver Zugangsdaten sind dokumentiert. Rotation wird insbesondere nach möglicher Ablage in Repository, Logs, Images, Layern oder Caches durchgeführt.

### Reproduzierbare technische Validierung

- [ ] `CORE-VAL-01` Unterstützte Laufzeit, Architektur und Paketmanagerversion sind aus Projektkonfiguration und Deploymentvorgaben ermittelt und mit den tatsächlich verwendeten Versionen protokolliert.
- [ ] `CORE-VAL-02` Eine saubere, lockdateibasierte Installation wurde mit dem vorgesehenen Paketmanager durchgeführt; uncommittete Lockdateiänderungen, Installationswarnungen und optionale plattformspezifische Artefakte wurden bewertet.
- [ ] `CORE-VAL-03` Die im Projekt vorhandenen Skripte für Lint, Typecheck, Unit-/Integrationstests, Datenbank- beziehungsweise Migrationsprüfung und Produktionsbuild wurden erfasst und alle einschlägigen Prüfungen ausgeführt oder mit Grund als nicht anwendbar dokumentiert.
- [ ] `CORE-VAL-04` Die erzeugte Produktionsausgabe wurde mit dem vorgesehenen Produktionsstartkommando lokal gestartet und per HTTP sowie im Browser einem Smoke-Test unterzogen; ein Dev-Server gilt nicht als Produktionsbuildnachweis.
- [ ] `CORE-VAL-05` `git diff --check`, relative Dokumentationslinks und soweit relevant generierte Dokumente wurden geprüft. Ein erfolgreicher Code-Linter wird nicht als Link- oder Dokumentationsprüfung ausgegeben.
- [ ] `CORE-VAL-06` Entwicklungs- und Produktionsabhängigkeiten wurden getrennt auditiert und Meldungen anhand von Laufzeitpfad, Plattform und Erreichbarkeit bewertet; es wurde kein ungeprüftes erzwungenes Audit-Fix verwendet.
- [ ] `CORE-VAL-07` Versionierte Dateien, öffentliche Verzeichnisse und relevante Artefakte wurden mit geeigneten Mustern auf Secrets, private Schlüssel, interne Produktionsdaten und versehentliche Debugausgaben geprüft, ohne Trefferwerte zu protokollieren.
- [ ] `CORE-VAL-08` Für jede ausgeführte Prüfung sind exakter Befehl beziehungsweise reproduzierbarer Aufruf, Werkzeugversion, Zielumgebung, Ergebnis und bewusst übersprungene Teilprüfung im Protokoll festgehalten.

### Browser-, Geräte- und Inhaltsprüfung

- [ ] `CORE-QA-01` Darstellung und Bedienung wurden risikogerecht auf aktuellen Desktop- und Mobilbrowsern geprüft; Browser, Versionen, Viewports und nicht geprüfte Plattformen sind dokumentiert.
- [ ] `CORE-QA-02` Browserengine, Headless-Emulation und reale Browser beziehungsweise Geräte werden im Nachweis korrekt unterschieden; eine WebKit-Prüfung wird nicht als Safari-Prüfung bezeichnet.
- [ ] `CORE-QA-03` Navigation, Kontaktwege, Links, Downloads und alle vereinbarten nebenwirkungsfreien Funktionen wurden durchgespielt.
- [ ] `CORE-QA-04` Texte wurden eigenständig redaktionell auf Tippfehler und Verständlichkeit geprüft; Telefonnummern, E-Mail-Adressen, Anschriften und Öffnungszeiten sind korrekt.
- [ ] `CORE-QA-05` Bilder, Videos, Dokumente und externe Einbettungen laden wie erwartet; defekte interne und externe Links wurden automatisiert oder manuell gesucht.
- [ ] `CORE-QA-06` Dynamische Zustandswechsel, responsive Varianten und wiederholte Vorwärts-/Rückwärtsinteraktionen wurden geprüft, damit neu erzeugte oder umsortierte Elemente funktionsfähig bleiben.
- [ ] `CORE-QA-07` Die Seiten wurden ohne sichtbare JavaScript-, Netzwerk- oder Hydrationsfehler in der Browserkonsole geprüft.
- [ ] `CORE-QA-08` Der öffentliche Ressourcenlauf erfasst neben HTML auch tatsächlich angeforderte CSS-, JavaScript-, Schrift-, Bild- und Downloadressourcen mit Status und MIME-Typ; dynamische Pfade und erst nach Interaktion geladene Ressourcen werden zusätzlich im Browser geprüft.

### Repository, Release und laufende Dokumentation

- [ ] `CORE-REP-01` Das Repository enthält eine grundlegende README zu Aufbau, unterstützter Laufzeit, Installation, Build, Tests und lokalem Produktionsstart.
- [ ] `CORE-REP-02` Buildartefakte, Abhängigkeiten, Caches, Logs, temporäre Dateien, lokale Laufzeitdaten und unverschlüsselte Secrets sind nicht versioniert; Ausschlussdateien entsprechen den verwendeten Werkzeugen.
- [ ] `CORE-REP-03` Nicht referenzierte Komponenten, Beispieldaten, Altdateien und überholte Varianten wurden identifiziert und entfernt oder mit Zweck und Aufbewahrungsgrund dokumentiert.
- [ ] `CORE-REP-04` Vor Löschungen wurden dynamische Pfade, Build- und Dokumentationsskripte sowie Laufzeitkonfigurationen berücksichtigt; danach wurden Build, Tests, Links und zentrale Pfade erneut geprüft.
- [ ] `CORE-REP-05` Direkte Abhängigkeiten, Skripte, Komponenten und Konfigurationen wurden auf tatsächliche Verwendung geprüft; direkte Imports sind direkt deklariert, nicht mehr benötigte Einträge entfernt und Lockdateien konsistent.
- [ ] `CORE-REP-06` Große versionierte Dateien, Repository-Größe und Deploymentkontext wurden inventarisiert; für Build und Betrieb unnötige Inhalte werden durch geeignete plattformspezifische Ausschlüsse ferngehalten.
- [ ] `CORE-REP-07` Bewusst aufbewahrte historische, rechtlich relevante oder revisionsdienliche Dokumente sind durch Verzeichnis, Dateiname, Version oder README als gewollter Bestand erkennbar und werden nicht pauschal als veraltet gelöscht.
- [ ] `CORE-REL-01` Lokale Implementierung, Commit, Push, Plattformdeployment, laufendes Artefakt und öffentliche Verifikation sind getrennt dokumentiert.
- [ ] `CORE-REL-02` Der öffentlich geprüfte Stand wurde über Commit-, Image-, Artefakt- oder andere belastbare Deploymentinformationen identifiziert. Ein erfolgreicher lokaler Build oder eine bloße Betreiberbestätigung ersetzt dies nicht, soweit ein technischer Nachweis möglich ist.
- [ ] `CORE-REL-03` Nach dem Deployment wurden öffentliche URL, TLS, Weiterleitungen, HSTS, Kompression, Metadaten, Fehlerseiten, zentrale Ressourcen und Nutzerpfade erneut geprüft.
- [ ] `CORE-REL-04` Die Veröffentlichung wurde technisch sowie getrennt davon inhaltlich beziehungsweise visuell durch die zuständigen Personen freigegeben; bekannte offene Punkte sind dokumentiert.
- [ ] `CORE-REL-05` Offene Punkte besitzen Priorität, verantwortliche Person und Prüftermin. Bewusst akzeptierte Abweichungen nennen Risiko, Entscheidung und Wiedervorlage.
- [ ] `CORE-REL-06` Entscheidungen, Änderungen, ausgeführte Prüfungen, Commits, Deployments und offene Folgen werden fortlaufend im projektspezifischen Prüfprotokoll dokumentiert; das Protokoll ersetzt nicht die Checkboxen.
- [ ] `CORE-REL-07` Deploymentweg, zuständige Infrastrukturkomponenten und Grenzen zwischen Anwendung, Plattform, Reverse Proxy und Provider sind dokumentiert; ein Rollback oder Neuaufbau auf einen bekannten Commit ist grundsätzlich möglich.
