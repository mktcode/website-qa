# Wiederholbare Prüfverfahren für Website-Projekte

Diese Datei ergänzt die fachlichen Prüfpunkte um konkrete Ausführungsverfahren. Sie ist vollständig zu lesen, aber nicht unverändert als abgehakte Checkliste zu behandeln. Im Projektprotokoll werden nur tatsächlich ausgeführte Befehle, Werkzeugversionen, Zielumgebungen und Ergebnisse festgehalten.

Befehle sind Beispiele und an Paketmanager, Skriptnamen, Plattform und vereinbarten Umfang des Zielprojekts anzupassen. Prüfungen bleiben lesend und nebenwirkungsfrei, solange keine gesonderte Freigabe dokumentiert ist.

## 1. Arbeitsstände und Werkzeugversionen

Vor jeder größeren Prüfserie mindestens erfassen:

```bash
pwd; git status --short --branch; git rev-parse HEAD; node --version; npm --version
```

Zusätzlich dokumentieren:

- Quellcommit des Zielprojekts,
- Commit der zentralen Prüfhilfen,
- Betriebssystem und Architektur,
- Browser und Versionen,
- lokale, Staging- und Produktions-URLs,
- tatsächlich laufenden Deployment- beziehungsweise Image-Stand.

Der im Projekt festgelegte Node- und Paketmanagerstand wird verwendet. Ein zufällig lokal installierter neuerer Stand gilt nicht als reproduzierbare Prüfumgebung.

## 2. Saubere Installation und Projektvalidierung

Zuerst die vorhandenen Projektanweisungen, `package.json`, Lockdatei und angebotenen Skripte lesen. Keine nicht vorhandenen Standardskripte erfinden. Für ein npm-Projekt sind typischerweise auszuführen:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Projektabhängig kommen etwa Migrations-, Generierungs-, End-to-end- oder Validierungsskripte hinzu. Der Produktionsbuild wird mit dem vorgesehenen Produktionsstartkommando lokal gestartet und über HTTP geprüft; ein Dev-Server ersetzt diesen Nachweis nicht.

Zu dokumentieren sind mindestens:

- exakte Node- und npm-Version,
- frische Lockdateiinstallation,
- Lint, Typecheck, Unit-/Integrationstests und Produktionsbuild,
- projektbezogene Datenbank- oder Migrationsprüfung,
- Start und Smoke-Test der erzeugten Produktionsausgabe,
- veränderte oder übersprungene Prüfungen samt Grund.

`git diff --check` prüft keine Markdown-Links. Relative Dokumentationslinks und bei Bedarf externe Links werden gesondert validiert.

## 3. Abhängigkeiten, Audit und Secret-Suche

Mindestens Entwicklungs- und Produktionsabhängigkeiten getrennt bewerten:

```bash
npm audit
npm audit --omit=dev
npm ls
```

Auditmeldungen werden nach Plattform, Laufzeitpfad, Erreichbarkeit und Upstreamstatus bewertet. Kein ungeprüftes `npm audit fix --force`, kein unkontrollierter Major-Wechsel und kein vermeintlicher Fix außerhalb deklarierter Versionsbereiche.

Direkte Imports müssen direkt deklariert sein. Automatische Werkzeuge zur Erkennung ungenutzter Abhängigkeiten oder Dateien liefern bei Frameworkmodulen, dynamischen Imports, Icons und Buildskripten nur Hinweise und ersetzen keine manuelle Bewertung.

Versionierte Dateien und öffentlich ausgelieferte Verzeichnisse werden mit geeigneten Secretmustern geprüft. Treffer werden inhaltlich bewertet; Secret-Werte werden weder in Befehlsausgaben noch in Protokolle kopiert. Ebenfalls zu kontrollieren sind alte Commits, Images, Layer und Build-Caches, wenn dort früher Geheimnisse verarbeitet wurden.

## 4. Zentraler Social-, Sitemap- und Crawler-Check

Die wiederverwendbaren öffentlichen Prüfer werden im MIT-lizenzierten Repository [`mktcode/website-qa`](https://github.com/mktcode/website-qa) gepflegt. Das Zielprojekt bindet einen geprüften Commit oder Release unveränderlich als Entwicklungsabhängigkeit ein und stellt für die benötigten Einzelbefehle lokale npm-Aliase bereit. Die Prüfung wird aus dem Zielprojekt ausgeführt:

```bash
npm run ops:social:check -- https://example.de/ --sitemap --max-pages=50 --max-sitemaps=20 --strict
```

Vor der ersten Verwendung beziehungsweise nach Änderungen an der Lockdatei wird im Zielprojekt mit dessen vorgesehenem Node-/npm-Stand eine saubere Installation ausgeführt:

```bash
npm ci
```

Mehrere URLs können gemeinsam geprüft werden:

```bash
npm run ops:social:check -- https://example.de/ https://www.example.de/ --strict
```

Wichtige Optionen:

- `--sitemap` prüft zusätzlich die URLs der Standard-Sitemap.
- `--sitemap-url=<URL>` verwendet eine abweichende Sitemap.
- `--max-pages=<N>` begrenzt den Seitenumfang bewusst; der Wert muss alle erwarteten Sitemapseiten abdecken oder die bewusste Stichprobe und ausgelassene Seiten werden dokumentiert.
- `--max-sitemaps=<N>` begrenzt die Zahl abgerufener Sitemap-Dateien; ein erreichtes Limit bleibt als unvollständige Coverage sichtbar.
- `--json` erzeugt maschinenlesbare Ausgabe auf stdout; `--json-file=<Pfad>` schreibt sie atomar in eine lokale Datei und legt Elternverzeichnisse an.
- `--strict` behandelt Warnungen als fehlgeschlagene Prüfung.
- `--allow-http` erlaubt unabhängig von der Zieladresse unverschlüsseltes HTTP. `--allow-private` erlaubt unabhängig vom Protokoll private beziehungsweise lokale Zieladressen. Ein lokales HTTP-Ziel benötigt beide bewussten Freigaben.

Exitcodes: `0` ohne Fehlerbefund, `1` mit Fehlerbefund beziehungsweise Warnung im strikten Modus, `2` Aufruf- oder Laufzeitfehler.

Der statische Bericht liefert atomare technische Signale zu OpenGraph-Pflichtfeldern, X-/Twitter-Metadaten beziehungsweise Fallbacks, Canonical-/OpenGraph-Konsistenz, Antworten und Metadaten der simulierten Social-Crawler, Vorschaubildern, Erreichbarkeit von `robots.txt`, Social-Crawler-Regeln und der dokumentierten Policy-Matrix. Er zeichnet erlaubte und blockierte Trainings-/Datennutzungstokens neutral auf. Fehlende HTML-, Bild- oder Robots-Antworten führen bei nicht abschließend beobachtbaren Signalen zu `inconclusive`, während beobachtete technische Abweichungen als `defect` ausgewiesen werden. Checklistenreferenzen sind nur Hinweise für die manuelle Prüfung.

Redaktionelle Eignung von Text und Bild, eine echte öffentliche Plattformvorschau, Plattformcache, projektspezifisch gewünschte Indexierung, Aktualitätsbewertung der Policy-Quellen und die tatsächliche Betreiberentscheidung zu Training beziehungsweise Datennutzung bleiben manuelle oder externe Kriterien. Der Lauf nimmt keine Freigabe oder Zustimmung entgegen und bewertet nicht, ob eine beobachtete Trainingsregel der Betreiberentscheidung entspricht. Ein Lauf ohne Fehlerbefund darf diese Kriterien nicht automatisch abschließen.

Der Nachweis nennt den Commit des zentralen Werkzeugrepositorys und den im Bericht ausgegebenen Quellenstand der Robots-Matrix. Jede Kennung trägt zusätzlich den Quellenstatus `currentOfficial`, `officialContextOnly` oder `historicalRedirect`. Technisch weiterhin relevante Social-Crawler bleiben bei begrenzter offizieller Quellenlage beobachtbar, werden aber nicht als aktuell offiziell belegt dargestellt; das Matrixsignal ist dann `inconclusive`. Menschen bewerten die ausreichende Aktualität und Anbieteränderungen weiterhin unter `CORE-ROB-05`. Das Werkzeug prüft ausschließlich begrenzte GET-Abrufe von HTML, Vorschaubildern, `robots.txt` und optional Sitemap; es sendet keine Formulare. Es ersetzt nicht den allgemeinen Linkcrawl, TLS-, Browser-, Performance- oder echten Plattformvorschautest.

## 5. HTTP, Redirects, Header und Kompression

Mit echten GET-Anfragen prüfen; HEAD kann bei Bildtransformationen, Proxys und Frameworkrouten abweichen.

Für eine wiederholbare technische Basisprüfung steht im Paket `@mktcode/website-qa` ein lesender HTTP-Prüfer bereit:

```bash
npm run ops:http:check -- https://example.de/ --strict
```

Er kontrolliert Redirects, zentrale Sicherheits- und Cacheheader, einen konfigurierbaren unbekannten Pfad sowie Identity-, Gzip- und Brotli-Auslieferung von HTML und je einer entdeckten CSS-/JavaScript-Ressource. Bei HTTPS-Zielen prüft er standardmäßig zusätzlich die HTTP-Weiterleitung mit einem ungefährlichen Query-Parameter auf permanente, pfad- und queryerhaltende Umleitung. `--json` erzeugt eine maschinenlesbare Ausgabe auf stdout; `--json-file=<Pfad>` schreibt sie atomar in eine lokale Datei und impliziert `--json`. Private und unverschlüsselte Eingabeziele sind standardmäßig gesperrt. Werkzeugcommit, Ziel, Optionen und Befunde werden protokolliert.

Der statische Bericht des HTTP-Prüfers gibt atomare technische Signale aus. Er bildet deklarierte CSP, einen syntaktisch erkennbaren Framing-Schutz, `X-Content-Type-Options: nosniff`, Referrer Policy, Permissions Policy und HSTS auf dem regulären HTML, der 404-Probe und soweit entdeckt je einer bereits für MIME-, Cache- und Kompressionsprüfungen abgerufenen CSS-/JavaScript-Ressource ab. Ein fehlgeschlagener Abruf führt für die betroffene Headerabdeckung zu `inconclusive`; HSTS ist bei ausdrücklich zugelassenem HTTP `notApplicable`. Dafür werden keine zusätzlichen Anfragen gestartet.

Die bloße Deklaration belegt weder inhaltliche Stärke, widerspruchsfreie Direktiven noch risikogerechte Projekteignung. APIs, weitere Assets und öffentliche Dateien, sensible Antworten, alternative Hosts, app- und proxyseitige Redirectheader sowie die tatsächliche Anwendung-/Proxygrenze bleiben projektspezifisch zu prüfen. Das Werkzeug berechnet keinen Checklistenfortschritt und verbindet technische Berichte nicht mit manuellen Projektstatus.

Der Prüfer deckt bewusst keine DNS-, Zertifikatsketten-, vollständige Headermatrix, Crawl-, Browser- oder fachliche Sicherheitsprüfung ab. Weitere Antwortklassen und Alternativhosts werden deshalb weiterhin projektspezifisch kontrolliert.

Status und Header einer einzelnen Antwort:

```bash
curl --silent --show-error --dump-header - --output /dev/null https://example.de/
```

Weiterleitung ohne automatisches Folgen prüfen:

```bash
curl --silent --show-error --dump-header - --output /dev/null 'http://www.example.de/pfad?test=1'
```

Endziel und Weiterleitungskette begrenzt verfolgen:

```bash
curl --silent --show-error --location --max-redirs 5 --output /dev/null --write-out '%{url_effective} %{http_code} %{num_redirects}\n' 'http://www.example.de/pfad?test=1'
```

Kompressionsgrößen getrennt messen:

```bash
curl --silent --show-error -H 'Accept-Encoding: identity' --output /dev/null --write-out 'identity %{http_code} %{size_download}\n' https://example.de/
curl --silent --show-error -H 'Accept-Encoding: gzip' --output /dev/null --write-out 'gzip %{http_code} %{size_download}\n' https://example.de/
curl --silent --show-error -H 'Accept-Encoding: br' --output /dev/null --write-out 'br %{http_code} %{size_download}\n' https://example.de/
```

Für HTML, CSS und JavaScript jeweils `Content-Encoding`, `Vary: Accept-Encoding` und Größenreduktion kontrollieren. Bereits komprimierte Bilder, Schriften und Archive müssen ohne unnötige erneute Kompression antworten.

Die Headermatrix umfasst mindestens:

- reguläres HTML,
- statische versionierte Assets,
- veränderliche öffentliche Dateien,
- dynamisch transformierte Bilder,
- API-Antworten,
- Fehlerseiten,
- sensible Downloads,
- appseitige Redirects,
- proxyseitige Redirects auf alternativen Hosts.

## 6. TLS und Zertifikatsbetrieb

Zertifikatskette und Hostname mit SNI prüfen:

```bash
openssl s_client -connect example.de:443 -servername example.de -verify_return_error </dev/null
```

Zusätzlich Ablauf, Aussteller, SAN-Hostabdeckung und die tatsächlich akzeptierten TLS-Versionen mit einem geeigneten TLS-Werkzeug kontrollieren. Apex- und `www`-Host werden getrennt geprüft. Ein aktuell gültiges Zertifikat belegt keine automatische Verlängerung; dafür sind Resolver-/Plattformkonfiguration oder ein erfolgreicher Erneuerungsnachweis erforderlich.

## 7. Crawl, Sitemap und öffentliche Ressourcen

Für den allgemeinen lesenden Produktionscrawl steht im Paket `@mktcode/website-qa` ein wiederverwendbares Werkzeug bereit:

```bash
npm run ops:crawl:check -- https://example.de/ --sitemap --max-pages=50 --max-resources=500 --strict
```

Der Crawler verwendet ausnahmslos GET und begrenzt Seiten, Ressourcen, Antwortgrößen, Redirects und Laufzeit. Formulare werden nur inventarisiert; ihre Actions werden nie aufgerufen, kein Formular wird abgesendet und kein Button betätigt. Externe Links werden erfasst, aber nicht abgerufen. Interne Navigationen mit verdächtigen Aktionspfaden oder sensitiven Query-Parametern werden vorsorglich nicht angefordert und als ausgelassene Prüfung ausgewiesen. `--json` erzeugt eine maschinenlesbare Ausgabe mit ausdrücklichem Nachweis dieser Nur-Lese-Grenzen; `--json-file=<Pfad>` schreibt sie direkt in eine lokale Datei. Werkzeugcommit, Ziel, Optionen, Abdeckung und ausgelassene Pfade werden protokolliert.

Der statische Crawlbericht enthält technische Signale zu Canonical-Vollständigkeit und -Konsistenz, vorhandenen und eindeutigen Titeln beziehungsweise Meta-Beschreibungen, `lang`, der Anzahl der H1-Überschriften, Sitemap-Dateien und -Einträgen, robots.txt-Referenz, Sitemap-Abdeckung, internen Seiten- und Fragmentzielen sowie Status und MIME-Typ interner Ressourcen. Ein begrenzter, fehlgeschlagener oder aus Nur-Lese-Vorsicht ausgelassener Lauf führt bei betroffenen Signalen zu `inconclusive` statt zu einem stillschweigenden positiven Ergebnis. Inhaltliche Eignung, tatsächliche Sprachpassung, Überschriftenhierarchie, projektspezifische Inventarvollständigkeit, API- und Content-Negotiation-Fehler, externe Links sowie dynamische oder interaktionsabhängige Ressourcen bleiben manuell zu prüfen.

Der technische Crawl erfasst mindestens:

- alle vorgesehenen HTML-Routen,
- interne Links und Downloads,
- CSS-, JavaScript-, Schrift- und Bildressourcen,
- unbekannte Route,
- Canonical, Robots-Meta und Status,
- Sitemapziele und deren Self-Canonical,
- fehlgeschlagene serverseitige Seiten- und Ressourcenabrufe.

Browserkonsole, clientseitig nachgeladene und erst durch Interaktion ausgelöste Ressourcen gehören dagegen zum getrennten Browserverfahren.

Die Sitemap wird unabhängig vom Social-Check als XML geparst. Inhaltstyp, absolute Hosts, Duplikate, Statuscodes, Canonicals und Ausschluss von Fehler-, Redirect- und `noindex`-Seiten werden kontrolliert. Eine vorhandene XSL-Ansicht wird im Browser beziehungsweise als Text auf sichtbare Platzhalter wie `undefined` geprüft.

Das öffentliche Dateiverzeichnis und ein Medieninventar werden gegen Quellreferenzen, dynamisch erzeugte Pfade und tatsächliche Produktionsabrufe abgeglichen. Bei potenziell dynamischem Verhalten echte GET-Abrufe statt ausschließlich HEAD verwenden.

## 8. Browser, Barrierearmut und Performance

Für den allgemeinen ausschließlich beobachtenden Chromium-Lauf steht im Paket `@mktcode/website-qa` ein URL-basiertes Werkzeug bereit:

```bash
npm run ops:browser:check -- https://example.de/ --sitemap --max-pages=10 --max-requests=300 --strict
```

Der Standardlauf verwendet isolierte, nicht persistente Browserkontexte für Desktop, 390 und 320 CSS-Pixel, Reduced Motion und eine ausdrücklich als Näherung bezeichnete 200-%-Zoom-Prüfung. Er inventarisiert Browserkonsole, JavaScript-/Netzwerkfehler, Overflow, Cookies, Local-/Session-Storage, IndexedDB, Grundstruktur und axe-core-Befunde. Das Werkzeug klickt nie und blockiert Formularübermittlungen bereits im DOM sowie auf Netzwerkebene. Alle Nicht-GET-Anfragen, externen Seitenrequests, Popups, Beacons, Worker, WebSockets, WebTransport und WebRTC werden blockiert und protokolliert. `--json-file=<Pfad>` kann den vollständigen redigierten Browserbericht direkt in den ignorierten lokalen Arbeitsbereich schreiben. Diese Grenzen dürfen ohne ein gesondertes Prüfverfahren nicht gelockert werden.

Der statische Browserbericht liefert atomare technische Signale zu Main-Landmark, horizontalem Überlauf in den technischen 320-Pixel- und 200-%-Näherungsprofilen, Axe-Befunden, dokumentiertem Chromium-/Headless-Kontext, beobachteten Konsolen-, JavaScript-, Netzwerk- und HTTP-Fehlern sowie zur passiven Inventarisierung externer Requestversuche und des initialen Cookie-/Storagezustands. Fehlende Profile, Seitenlimits, Laufzeitfehler, Berichtslimits oder relevante sicherheitsbedingte Auslassungen führen bei abhängigen Signalen zu `inconclusive`. Semantische Angemessenheit, tatsächliche reine Textvergrößerung, Tastatur, Screenreader, reale Mobilbrowser und interaktionsabhängige Zustände bleiben manuell zu prüfen. Auch ein vollständig grüner Axe-Lauf ist kein WCAG-Konformitätsnachweis.

Für die passive Datenschutzbeobachtung werden Cookie-Namen, Domain und die Attribute `Secure`, `HttpOnly` und `SameSite`, Local-/Session-Storage-Schlüssel sowie IndexedDB-Datenbanknamen erfasst, aber niemals deren Werte oder Inhalte in den Bericht übernommen. Pro Art und Seiten-/Profil-Lauf werden höchstens 100 Bezeichner berichtet; eine Überschreitung bleibt sichtbar und macht das abhängige Signal unklar. Auch Browserkonsole, JavaScript-Fehler, fehlgeschlagene Requests, HTTP-Fehlerantworten, Popups und blockierte DOM-Aktionen sind auf jeweils 100 Berichtseinträge je Seiten-/Profil-Lauf begrenzt. Dasselbe gilt für gespeicherte Links, Formulare und H1-Texte aus der DOM-Inventarisierung; Gesamtzahl, gespeicherte Zahl und Kürzungsstatus bleiben maschinenlesbar. Ein positives Beobachtungsergebnis bedeutet nur, dass der deklarierte isolierte Initiallauf vollständig inventarisiert wurde. Externe Versuche bleiben blockiert und können deshalb keine Folgeanfragen oder eigenen Speicherzustände erzeugen. Quell- und Konfigurationsabgleich, Zweck und Zulässigkeit externer Dienste, Dokumentation, Einwilligungslogik, interaktionsabhängige Zustände sowie die fachliche Eignung von Cookieattributen werden manuell bewertet.

Chromium-Pfad und -Version, Werkzeugcommit, URL, Profile, Limits, blockierte Requests und ausgelassene Seiten werden protokolliert. Ein blockierter externer Dienst kann Darstellung und Folgefehler beeinflussen; solche Befunde werden deshalb mit der dokumentierten Positivliste und einem gesonderten Datenschutztest bewertet. Der Lauf ersetzt keine Tastatur-, Screenreader-, Safari-, reale Mobilgeräte- oder vollständige WCAG-Prüfung.

Das Qualitätsziel ist [WCAG 2.2, Konformitätsstufe AA](https://www.w3.org/TR/WCAG22/). Für den Abgleich sind die Erfolgskriterien der Stufen A und AA anhand der normativen W3C-Veröffentlichung zu berücksichtigen; [How to Meet WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) und [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/) können als offizielle Umsetzungshilfen dienen. Die festen Kernprüfpunkte ersetzen keinen kriterienbezogenen Abgleich. Geprüfte Kriterien, nicht einschlägige Kriterien, Befunde und bewusste Abweichungen werden risikogerecht dokumentiert; eine vollständige Konformität wird nur nach einem entsprechend vollständigen Nachweis behauptet.

Mindestens gegen den lokalen Produktionsbuild und nach dem Deployment gegen die öffentliche URL prüfen:

- Desktop und Mobil in den vereinbarten Browsern,
- schmale Viewports einschließlich 320 CSS-Pixel,
- 200 Prozent reine Textvergrößerung,
- Tastaturreihenfolge, sichtbaren Fokus und Dialogfokus,
- `prefers-reduced-motion: reduce`,
- Accessibility Tree beziehungsweise automatisierten Accessibility-Audit,
- Browserkonsole, Hydration und fehlgeschlagene Requests,
- normalen sowie reduzierten Bewegungsmodus,
- wiederholte dynamische Zustandswechsel.

Chromium, Firefox und Playwright-WebKit werden getrennt benannt. WebKit ist nur eine Safari-Näherung; Safari und reale Mobilgeräte werden nur behauptet, wenn sie tatsächlich geprüft wurden.

Der feste mobile Lighthouse-Lauf gehört zur technischen Standardserie:

```bash
npm run ops:lighthouse:check -- https://example.de/ --strict
```

Er verwendet Performance, Accessibility, Best Practices und SEO ohne projektspezifische Scorebudgets. Externe Requests, Nicht-GET-Methoden, Formulare, Beacons, Popups und Workerfamilien werden vor der Navigation blockiert. Haben solche Grenzen eingegriffen, kennzeichnet der Bericht die Messung als nicht repräsentativ. Lighthouse-Version, Chromium-Version, Modus, URL, Kategorien und zentrale Werte werden dokumentiert. Nicht nur den Score betrachten: LCP-Kandidat, LCP Breakdown, Warnungen wie `NO_LCP`, CLS, TBT und übertragene Bytes kontrollieren. Zusätzlich den Netzwerktransfer nach erstem Scroll, Galerieöffnung und anderen wesentlichen Interaktionen prüfen, weil diese Last im Initialaudit fehlen kann.

Automatisierte Accessibility-Werte ersetzen keine Tastatur-, reale Mobil- oder risikogerechte Screenreaderprüfung.

## 9. Bilder, Animationen und dynamische Transformationen

Im Browser beziehungsweise mit einem Bildwerkzeug kontrollieren:

- tatsächlich ausgewählte responsive Quelle,
- MIME-Typ, Pixelmaße und Dateigröße,
- `srcset`-/`sizes`-Wirkung,
- LCP-Priorität und Lazy Loading,
- Schärfe, Farbe und Zuschnitt auf Desktop und Mobil,
- Cacheheader und ETag,
- Transformation nach Neustart und Redeployment,
- Dialog-, Galerie- und Saisonwechsel vorwärts und rückwärts,
- vollständige Sichtbarkeit unter Reduced Motion.

Preload-, Idle-, Scroll- und Proximity-Ladevorgänge werden anhand realer Requests und nicht nur anhand des Quellcodes bewertet.

## 10. Formulare, APIs und sichere Produktionsstichproben

Ohne gesonderte Freigabe nur Anfragen verwenden, die nachweislich vor einer Nebenwirkung abgewiesen werden. Keine gültigen Formulare absenden, keine E-Mails, Telegram-Nachrichten, Kalender- oder Datenbankeinträge erzeugen und keine Object-Storage-Objekte anlegen.

Sichere Stichproben umfassen je nach Projekt:

- falsche HTTP-Methode,
- unzulässigen Content-Type,
- leeren oder strukturell ungültigen Body,
- fremden beziehungsweise fehlenden Origin,
- ungültige Koordinaten oder IDs,
- fehlendes Webhook-Secret,
- Rate-Limit-Verhalten ohne gültige Fachdaten.

Vorher aus Quellcode und Tests bestätigen, dass der gewählte Fehlerpfad keine Nebenwirkung erreicht. Ein gültiger End-to-end-Produktionslauf erfordert ausdrückliche Freigabe, kontrollierte Empfänger, eindeutige Testdaten und einen Bereinigungsnachweis.

## 11. Container, Deployment und Infrastruktur

Lokale Dockerfile-Prüfung und Build soweit einschlägig:

```bash
docker build --check .
docker build --pull --progress=plain .
```

Zu prüfen sind Buildkontext, automatisch erzeugter Buildplan, Basisdigest, Architektur, finale Imagegröße, Dateibestand, Benutzer, Arbeitsverzeichnis, Startkommando, Health-/Neustartverhalten und native Artefakte.

Inspektionen werden gezielt gefiltert. Keine vollständigen Environment-, Label- oder Plattformdumps in Antworten oder Protokolle kopieren. Secret-Werte nie ausgeben. Nur Variablennamen beziehungsweise Vorhandensein melden.

Nach Deployment getrennt bestätigen:

- Service ist stabil,
- laufender Container verwendet exakt das vorgesehene Image,
- Laufzeitversion, Architektur und UID stimmen,
- Image enthält keine Laufzeit-Secrets,
- benötigte Variablen sind nur im Container vorhanden,
- interne Ports sind nicht direkt veröffentlicht,
- Proxygrenze und Client-IP-Bereinigung wirken praktisch,
- öffentliche Seiten und sichere Fehlerpfade funktionieren.

Ein Infrastrukturstatuscheck ist immer projektspezifisch. Er wird nur ausgeführt, wenn das Zielprojekt einen ausdrücklich dokumentierten, ausschließlich lesenden lokalen Befehl und die dafür nötigen sicheren Zugriffswege bereitstellt. Das verwendete Werkzeug, seine Grenzen und die geprüfte Infrastruktur werden im Nachweis benannt. Ein Statuscheck aus einem anderen Projekt wird nicht ungeprüft übernommen. Servernamen, IP-Adressen, Zugangsdaten und ungefilterte Ausgaben werden nicht in Kundenrepositories oder Prüfprotokolle kopiert.

Dockerbereinigungen erfolgen gezielt erst nach Bestätigung des Ersatzimages. Keine pauschale Volume-Bereinigung. Aktive Images, Datenvolumes und Wiederherstellbarkeit müssen erhalten bleiben.

## 12. Manuelle und externe Nachweise

Folgende Nachweise lassen sich nicht aus einem erfolgreichen Build oder einem einzelnen Skript ableiten:

- echte Social-Plattformvorschau und Plattformcache,
- Search-Console-Eigentum und Property-Zuordnung,
- Domaininhaberschaft, Registrar- und DNS-Zuständigkeit,
- Kundenfreigaben, Rechte und Rechtstextquelle,
- reale Safari-/Geräte- und Screenreaderprüfung,
- tatsächliche E-Mail-Zustellung und nachgelagerte Integrationen,
- automatische Zertifikatserneuerung,
- Backupwiederherstellung,
- tatsächlich laufendes Produktionsartefakt.

Diese Punkte bleiben bis zum jeweiligen technischen oder dokumentarischen Nachweis offen.
