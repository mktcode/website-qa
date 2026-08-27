# AGENTS.md

Dieses öffentliche MIT-Repository enthält frameworkunabhängige, ausschließlich lesende Werkzeuge und allgemeine Dokumentationsvorlagen für Website-Qualitätssicherung.

## Entstehung und Ziel

Die ersten Prüfer entstanden bei der systematischen Qualitätssicherung einer realen Nuxt-Website. Wiederverwendbare HTTP-, Crawl-, Browser- und Social-Prüfungen wurden anschließend bewusst aus dem Website-Repository herausgelöst, damit sie nicht kopiert, projektspezifisch verändert oder von einer benachbarten Arbeitskopie abhängig werden.

`markus-kottlaender.de` darf als zusätzlicher öffentlicher Regressionstest dienen, ist aber niemals eine fachliche Vorgabe. Kein Prüfer darf Domains, Routen, Seitenanzahlen, Frameworks, Texte, Headerausnahmen oder erwartete Funktionen dieser Website fest einbauen.

Das Paket heißt `@mktcode/website-qa`. Der erste Werkzeugstand wurde mit `65d4914` als `v0.1.0` veröffentlicht; die allgemeinen Website-QS-Vorlagen kamen mit `248767b` hinzu. Diese Commits erklären die Entstehung, ersetzen aber nicht den aktuellen Code- und Dokumentationsstand.

## Verbindliche Sicherheitsgrenzen

Alle allgemeinen Prüfer sind standardmäßig beobachtend, begrenzt und nebenwirkungsfrei:

- ausschließlich HTTP-GET; keine Formulare, Buttons, Uploads oder mutierenden API-Aufrufe;
- keine Formular-Action aufrufen und keine Browserinteraktion simulieren;
- externe Browserrequests, Nicht-GET-Methoden, Popups, Beacons, Worker, WebSockets, WebTransport und WebRTC vorsorglich blockieren;
- private, lokale und anderweitig nicht öffentliche Ziele standardmäßig gegen SSRF sperren;
- DNS-Auflösung, Redirects und Originwechsel vor jedem Abruf sicher behandeln;
- Seiten-, Ressourcen-, Redirect-, Antwortgrößen-, Request- und Zeitlimits beibehalten;
- sensible Querywerte, Zugangsdaten und interne Infrastruktur niemals protokollieren;
- bei Unsicherheit geschlossen abbrechen statt einen möglicherweise schreibenden Pfad aufzurufen.

Eine Lockerung dieser Grenzen ist keine gewöhnliche Funktionserweiterung. Sie erfordert eine ausdrückliche Entscheidung, eine enge Bedrohungsanalyse und Integrationstests, die fehlende Servernebenwirkungen nachweisen. Mutierende Produktionsprüfungen gehören grundsätzlich in projektspezifische, gesondert freigegebene Abläufe und nicht in diese Standardwerkzeuge.

## Architektur und öffentliche Schnittstellen

Es gibt bewusst vier unabhängige CLI-Befehle:

- `website-qa-http`
- `website-qa-crawl`
- `website-qa-browser`
- `website-qa-social`

Keinen allgemeinen Sammelbefehl und kein universelles `qa:local` einführen. Zielprojekte entscheiden selbst, welche Prüfer zu ihrem Workflow gehören, und können dafür lokale npm-Aliase anlegen.

Gemeinsame URL-, DNS-, SSRF-, Redirect-, Größen- und Antwortlogik gehört nach `src/lib/http-client.mjs`. Sicherheitslogik nicht zwischen Prüfern duplizieren oder in Verbraucherprojekte kopieren.

Bei CLI-Änderungen nach Möglichkeit erhalten:

- direkte Ausführbarkeit jedes Prüfers;
- `--help`;
- menschenlesbare und `--json`-Ausgabe;
- `--strict` für Warnungen;
- dokumentierte, automatisierbare Exitcodes;
- Paketversionsausgabe;
- stabile fachliche Checklistenkennungen in Befunden;
- symlink-sichere Ausführung installierter Paket-Binaries.

Automatische Ergebnisse sind technische Teilnachweise. Die Werkzeuge dürfen keine Projektchecklisten selbständig abhaken und keine vollständige WCAG-, Rechts-, Datenschutz-, Sicherheits- oder Produktionsfreigabe behaupten.

## Tests und Validierung

Primäre Tests verwenden lokale, kurzlebige Testserver mit unterschiedlichen HTML-Strukturen. Eine konkrete öffentliche Website ist nur ein ergänzender Smoke-Test und darf keine generische Erwartung definieren.

Für Browser-Sicherheitsgrenzen sind echte Chromium-Integrationstests erforderlich. Bestehende Tests weisen insbesondere nach, dass automatische POSTs, Formularübermittlungen, externe Requests und Popups keine Servernebenwirkungen erzeugen. Diese Nachweise bei Änderungen an Request-Interception, Navigation, Seitenerkennung oder Browserkontexten erhalten und erweitern.

Vor Abschluss einer Änderung mit dem in `package.json` vorgesehenen Node-Bereich ausführen:

```bash
npm ci
npm run check
npm pack --dry-run
```

Bei Änderungen an Binaries, Paketmetadaten oder Installationsverhalten zusätzlich das erzeugte Tarball in einem temporären Verbraucherprojekt installieren und alle betroffenen installierten Befehle ausführen. Der unterstützte Bereich ist derzeit Node.js `>=22.19 <23 || >=24.11 <25`; für den Browser-Check wird lokal Chromium oder Google Chrome benötigt.

Öffentliche Live-Smoke-Tests bleiben ausschließlich lesend. Ziele, exakte Befehle, Werkzeugcommit und Befunde dokumentieren; keine öffentlichen Formulare absenden.

## Dokumentation und Projektgrenzen

`docs/` enthält nur allgemeine, wiederverwendbare Website-QS-Vorlagen und Prompts. Es enthält keine ausgefüllten Projektakten und keine Nachweise für eine konkrete Website.

Für jedes Zielprojekt entsteht eine eigene versionierte Projektkopie. Änderungen der allgemeinen Vorlage setzen dort keinen Prüfpunkt automatisch auf erledigt. Stabile Kennungen dürfen nicht für eine neue fachliche Bedeutung wiederverwendet werden.

Nicht in dieses öffentliche Repository gehören insbesondere:

- Kunden- und Vertragsunterlagen;
- personenbezogene oder vertrauliche Projektdaten;
- Zugangsdaten, Serveradressen und interne Infrastrukturdetails;
- ausgefüllte Website-, VM- oder Betriebsakten;
- organisationsspezifische Freigaben und rechtliche Nachweise;
- projektbezogene Deployment-, Backup- oder Wiederherstellungsskripte.

Vor Änderungen an den Prüfdokumenten `docs/README.md`, die modulare Checkliste und `docs/checklisten/website/pruefverfahren.md` vollständig lesen. Relative Markdown-Links anschließend gesondert validieren.

## Vorgehen bei neuen Automatisierungen

Vor einer Implementierung klären:

1. Ist die Prüfung tatsächlich website- und frameworkunabhängig?
2. Kann sie mit GET und ohne Zustandsänderung belastbar arbeiten?
3. Welche Aussage kann sie beweisen und welche ausdrücklich nicht?
4. Welche Limits, SSRF-/Redirect-Grenzen und Redaktionen benötigt sie?
5. Reicht ein neuer unabhängiger Prüfer, oder gehört die Funktion fachlich in einen vorhandenen Befehl?
6. Welche lokalen Positiv-, Negativ-, Grenz- und Nebenwirkungstests sind erforderlich?
7. Welche stabilen Checklistenkennungen und maschinenlesbaren Befunde werden ausgegeben?

Projektbuilds, Deploymentchecks, schreibende Formularprüfungen, Serverzugriffe und operative Wiederherstellung bleiben in den jeweiligen privaten Zielprojekten.

## Veröffentlichung und Wartung

Das Paket wird derzeit öffentlich über GitHub genutzt und von Verbrauchern auf einen geprüften Tag oder besser einen unveränderlichen Commit festgelegt. Eine neue Version benötigt nachvollziehbare lokale Validierung, aktualisierte Dokumentation und einen bewussten Tag. Ein Dokumentationscommit allein erfordert nicht automatisch eine neue CLI-Version.

GitHub Actions sind derzeit bewusst nicht Bestandteil des Wartungsmodells. Nicht ohne ausdrückliche Entscheidung CI-, Registry-, Token- oder automatische Release-Infrastruktur hinzufügen.

Abhängigkeiten bewusst und möglichst reproduzierbar aktualisieren. Sicherheitsrelevante Parser-, Netzwerk-, Browser- und XML-Änderungen nicht ungeprüft als reine Wartungsupdates behandeln. Keine erzwungenen Audit-Fixes oder unkontrollierten Major-Upgrades durchführen.
