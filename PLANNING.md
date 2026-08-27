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

## Veröffentlichter Wartungsstand: 2.0.1

Der enge Sicherheitspatch ohne neue Produktoberfläche umfasst:

- IPv4-mapped-IPv6 wird vollständig durch die private Zielsperre erfasst;
- der Browser-Prüfer pinnt Chromium-DNS an die vorab geprüfte Adresse;
- Dekompression, Social-Sitemaps und Browserbeobachtungen besitzen ausdrückliche Grenzen;
- reale Exitcode-2-Ausgaben aller fünf CLIs entsprechen ihren veröffentlichten Schemata;
- Release- und Integrationsdokumentation bezeichnen denselben öffentlichen Stand.

**Freigabekriterien für den nächsten Wartungsstand:** Die jeweiligen Positiv-, Negativ-, Grenz- und Nebenwirkungstests bestehen. `npm run check` und `npm run test:chromium` werden unter einem unterstützten Node-22- und Node-24-Stand ohne übersprungene Browser- oder Lighthouse-Integration ausgeführt. Das erzeugte Tarball wird in einem leeren Verbraucherprojekt installiert; alle fünf installierten Befehle und ihre JSON-Berichte werden gegen die Paketschemata validiert.

## Priorisierter Arbeitsbacklog

Die Arbeitskennungen in diesem Abschnitt dienen ausschließlich der Wartungsplanung. Sie sind weder öffentliche Signal- noch Checklistenkennungen. `P1` kennzeichnet die höchste Korrekturpriorität, `P2` notwendige Wartungsarbeit und `P3` ausschließlich befundgetriebene spätere Kandidaten. Konkrete Releaseblockaden stehen unabhängig von der Priorität unter „Reihenfolge und Freigabeabhängigkeiten“. `Umgesetzt, unveröffentlicht` bezeichnet den aktuellen Arbeitsbaum, nicht den veröffentlichten Paketstand.

| ID | Priorität | Status | Ziel |
| --- | --- | --- | --- |
| `WQ-01` | P1 | umgesetzt, unveröffentlicht | IPv6-/SSRF-Klassifikation und Redaktion schließen |
| `WQ-02` | P1 | umgesetzt, unveröffentlicht | echte Browser-Gesamtlaufdeadline sicherstellen |
| `WQ-03` | P1 | umgesetzt, unveröffentlicht | Lighthouse-Referenzen semantisch und kataloggebunden erzeugen |
| `WQ-04` | P2 | umgesetzt, unveröffentlicht | WebSocket-Nebenwirkungsnachweis serverseitig vervollständigen |
| `WQ-05` | P2 | umgesetzt, unveröffentlicht | installierbares Tarball reproduzierbar prüfen |
| `WQ-06` | P2 | umgesetzt, unveröffentlicht | Social-Seitenlimit über Code und Dokumentation vereinheitlichen |
| `WQ-08` | P1 | umgesetzt, unveröffentlicht | automatisch entdeckte GET-Ziele und jeden Redirecthop zentral absichern |
| `WQ-07` | P3 | wartet auf Praxisbeleg | weitere technische Signale nur befundgetrieben auswählen |

### `WQ-01` – IPv6-/SSRF-Klassifikation und Redaktion

- **Problembeleg:** Der veröffentlichte Stand akzeptiert unter anderem NAT64- und 6to4-Adressen mit eingebetteten privaten IPv4-Zielen. Reservierte Teile von `2001::/23`, IPv6-URLs mit Querywerten und freistehende nicht öffentliche IPv6-Adressen sind nicht vollständig geschlossen beziehungsweise redigiert.
- **Risiko:** Ein Abruf kann eine nicht öffentliche Zieladresse erreichen oder ein Bericht kann sensible URL-Werte beziehungsweise interne Infrastruktur offenlegen.
- **Abhängigkeiten:** gemeinsame Netzlogik in `src/lib/http-client.mjs`, aktuelle IANA-Spezialbereichsklassifikation und alle fünf Verbraucher dieser Bibliothek.
- **Akzeptanz:** IPv4-eingebettete IPv6-, NAT64-, 6to4-, Dokumentations- und reservierte Bereiche werden geschlossen behandelt; ausdrücklich global erreichbare IANA-Ausnahmen bleiben nutzbar; URL-Querywerte und interne IPv6-Tokens werden redigiert; Positiv-, Negativ- und Redaktionsgrenzen sind getestet.

### `WQ-02` – Browser-Gesamtlaufdeadline

- **Problembeleg:** Der bisherige Timeout begrenzt einzelne Operationen, aber nicht zuverlässig Browserstart, alle Seiten-/Profilläufe und blockierende Renderer-Auswertungen gemeinsam.
- **Risiko:** Ein begrenzter Prüfer kann hängen, seine zugesagte Laufzeit überschreiten oder verspätet gestartete Browserressourcen offenlassen.
- **Abhängigkeiten:** Chromium-Start, Sitemap-Preflight, Profilwarteschlange, Axe-/DOM-Auswertung und sichere Ressourcenbereinigung.
- **Akzeptanz:** Eine gemeinsame Gesamtlaufdeadline umfasst den vollständigen Prüflauf; ein blockierender Renderer endet innerhalb der Toleranz; verspätet auflösende Startressourcen werden genau einmal geschlossen; bestehende Nur-Lese-Integrationstests bleiben grün.

### `WQ-03` – Lighthouse-Referenzen und Signalregister

- **Problembeleg:** Kategoriepauschalen ordnen technisch verschiedene Lighthouse-Audits denselben Checklistenpunkten zu; Lighthouse-Signale umgehen im veröffentlichten Stand teilweise die zentrale Katalogvalidierung.
- **Risiko:** Automatische Befunde lenken die manuelle QA fachlich falsch oder driften unbemerkt von `catalog/signals.json` ab.
- **Abhängigkeiten:** atomare Aussagen der Checkliste, Lighthouse-Audit-IDs, `src/lib/signal-report.mjs`, Signalkatalog und veröffentlichter Beispielbericht.
- **Akzeptanz:** Nur fachlich begründete Audit-ID-Zuordnungen werden ausgegeben; unbekannte oder mehrdeutige Audits erhalten keine Referenz; alle Lighthouse-Signale entstehen über das zentrale Register; Beispiel, Signalversion, Werkzeug und Referenzen werden gegeneinander getestet.

### `WQ-04` – WebSocket-Nebenwirkungsnachweis

- **Problembeleg:** Der Lighthouse-Integrationstest beobachtet HTTP-Requests, zählt aber keinen serverseitigen `upgrade`-Versuch und kann deshalb einen unerwarteten WebSocket-Handshake nicht unmittelbar nachweisen.
- **Risiko:** Eine Regression der vor Navigation installierten Browsergrenze bleibt im Nebenwirkungstest unentdeckt.
- **Abhängigkeiten:** echter Chromium-Lauf, lokaler Ziel- und Angreiferserver sowie Request-Interception vor Navigation.
- **Akzeptanz:** Der Test löst einen WebSocket-Versuch aus, erlaubt am Website-Ziel weiterhin nur GET und weist am externen WebSocket-Ziel-/Angreiferserver sowohl für normale Requesthandler als auch für serverseitige Upgradehandler null Zugriffe nach.

### `WQ-05` – installierbares Tarball

- **Problembeleg:** Der schnelle Binärtest verwendet Symlinks auf den Quellbaum und prüft weder Tarballinhalt und Installationsmodus noch die exportierten Schemata aus Sicht eines leeren Verbraucherprojekts.
- **Risiko:** Ein lokal grüner Quelltest kann fehlende Paketdateien, defekte Binärrechte, Exportfehler oder schemawidrige installierte Berichte übersehen.
- **Abhängigkeiten:** npm-Packliste, fünf Binärzuordnungen, lokale Chromium-Installation, unterstützte Node-22-/Node-24-Stände und Paketschemaexporte.
- **Akzeptanz:** `npm run test:package` erzeugt und hasht ein Tarball, installiert es isoliert, startet alle fünf installierten Binärdateien, beobachtet je Prüfer ausschließlich GET, validiert alle Berichte über die exportierten Schemata und protokolliert Node-, npm-, Chromium- und Paketversion.

### `WQ-06` – Social-Seitenlimit

- **Problembeleg:** Im veröffentlichten Stand nennen CLI-Standard, allgemeines Prüfverfahren und Kerncheckliste 50 Seiten, während README und Integrationsbeispiel 20 Seiten empfehlen.
- **Risiko:** Verbraucher führen unbeabsichtigt unterschiedlich große Läufe aus; Laufzeit-, Abdeckungs- und Vergleichsaussagen sind ohne bewusste Limitwahl uneinheitlich.
- **Abhängigkeiten:** konservativer Standard, CLI-Hilfe, README, Integrationsbeispiel, Kerncheckliste, neutraler Checklistenindex und Prüfverfahren.
- **Akzeptanz:** Werkzeugstandard und allgemeine Beispielaufrufe verwenden einheitlich 20 Seiten; größere Inventare benötigen eine ausdrückliche Option; Hilfe, README, Integrationsbeispiel, Kerncheckliste, Checklistenindex, Prüfverfahren und Parsertest stimmen mit dieser Entscheidung überein.

### `WQ-08` – zentrale Nur-Lese-Grenze für GET-Ziele

- **Problembeleg:** HTTP- und Crawl-Ressourcen, Crawl-Sitemapindex-Kinder sowie Lighthouse-Preflight-Redirects konnten die vorhandene Heuristik für potenziell zustandsverändernde Pfade und Queryparameter umgehen, wenn ein Aufrufer keinen eigenen Redirectvalidator setzte.
- **Risiko:** Ein fehlerhaft implementierter GET-Endpunkt kann durch eine automatisch entdeckte Ressource oder einen Redirect eine Servernebenwirkung auslösen, obwohl der Prüfer selbst ausschließlich GET verwendet.
- **Abhängigkeiten:** zentrale Abruflogik in `src/lib/http-client.mjs`, gemeinsame Heuristik in `src/lib/navigation-safety.mjs`, explizite Eingabeziele und alle fünf Verbraucher.
- **Akzeptanz:** Nur das exakt ausdrücklich angegebene erste Ziel darf die konservative Namensheuristik umgehen; automatisch erzeugte oder entdeckte Ziele und jeder Redirecthop werden vor dem Request zentral geprüft; HTTP und Crawl weisen ausgelassene Ressourcen sichtbar und abhängigkeitsbezogen unklar aus; lokale Nebenwirkungstests für direkte Ressourcen, CSS-Ressourcen, Sitemapindex-Kinder und mehrstufige Redirects beobachten null Requests am verdächtigen Ziel; Browser-, Social- und Lighthouse-Grenzen bleiben grün.

### `WQ-07` – befundgetriebene Signalkandidaten

- **Problembeleg:** Die Checkliste reicht bewusst weit über die 42 derzeit durch technische Signale referenzierten Punkte hinaus; daraus folgt weder eine Abdeckungslücke noch automatisch ein sinnvoller Automatisierungskandidat.
- **Risiko:** Ohne reale wiederkehrende Befunde entstehen laute, schwer interpretierbare Signale oder eine unzulässige Scheinsicherheit durch bloße Checklistenabdeckung.
- **Abhängigkeiten:** anonymisierte, websiteunabhängige Pilotbefunde und vollständig beschriebene Aussage-, Sicherheits-, Limit- und Testgrenzen.
- **Akzeptanz:** Ein Kandidat wird erst priorisiert, wenn mehrere reale Befunde oder ein klarer schwerwiegender Einzelbeleg vorliegen und das unten definierte Kandidatenraster vollständig erfüllt ist.

## Risikoregister

| Risiko | Auswirkung | Kontrolle | Auslöser für erneute Bewertung |
| --- | --- | --- | --- |
| IPv6-/Spezialbereichsdrift | SSRF oder unnötige Sperre öffentlicher Ziele | gemeinsame Klassifikation, IANA-Abgleich und Grenztests (`WQ-01`) | Änderung an URL-, DNS-, Redirect- oder IP-Logik; Änderung der IANA IPv6 Special-Purpose Address Registry; Prüfung vor jedem Tag |
| unvollständige Browserbeendigung | hängende Läufe oder verwaiste Chromium-Prozesse | Gesamtlaufdeadline, Prozess-/Ressourcenbereinigung und echte Chromium-Tests (`WQ-02`, `WQ-05`) | Änderung an Browserstart, Warteschlange, CDP oder Auswertung |
| fachlich überdehnte Referenzen | falsche manuelle Prüfspur und Scheinsicherheit | Audit-ID-Matrix, zentrale Signalvalidierung und Beispielabgleich (`WQ-03`) | neue Lighthouse-Version, neue Audit-ID oder Checklistenänderung |
| Quell-/Paketabweichung | veröffentlichte CLIs oder Schemata funktionieren trotz grüner Quelltests nicht | isolierter Tarball-Verbrauchertest unter beiden Node-Zweigen (`WQ-05`) | Änderung an `bin`, `exports`, `files`, Paketmanager oder Schemata |
| Abhängigkeitsregression | Parser-, Netzwerk-, Browser- oder Mediengrenzen ändern sich unbemerkt | gezielte Sicherheits- und Nebenwirkungstests statt erzwungener Updates | jede direkte oder transitive sicherheitsrelevante Aktualisierung |
| Dokumentationsdrift bei Limits | nicht vergleichbare oder unerwartet große Läufe | zentrale Entscheidung und gesonderte Link-/Dokumentprüfung (`WQ-06`) | Änderung eines Defaults, Hilfetexts oder Integrationsbeispiels |
| zustandsverändernder GET durch automatische Ziele | unbeabsichtigte Servernebenwirkung trotz GET-only | zentrale Zielheuristik vor jedem automatischen Request und Redirecthop sowie lokale Nebenwirkungstests (`WQ-08`) | Änderung an HTTP-Client, Ressourcenentdeckung, Sitemap-Queues oder Redirectlogik |

## Reihenfolge und Freigabeabhängigkeiten

1. `WQ-01` bis `WQ-03` sowie `WQ-08` sind fachliche Releaseblocker und werden vor einem neuen Tag vollständig validiert.
2. `WQ-04` und `WQ-05` liefern die erforderlichen Nebenwirkungs- und Paketevidenzen für denselben Stand.
3. `WQ-06` wird vor einer weiteren Dokumentations- oder Paketveröffentlichung vollständig validiert, damit keine bekannte Limitabweichung fortgeschrieben wird.
4. `WQ-07` beginnt erst nach ausgewerteten Pilotbefunden; eine gewünschte höhere Checklistenabdeckung allein ist keine Abhängigkeit und kein Akzeptanzgrund.
5. Änderungen an Sicherheitsinvarianten benötigen unabhängig von dieser Reihenfolge eine ausdrückliche Bedrohungsanalyse und passende Servernebenwirkungstests.

## Spätere fachliche Arbeit

Neue Automatisierungen werden nur aufgenommen, wenn sie frameworkunabhängig, passiv, begrenzt und als technisches Signal belastbar sind. Jeder Kandidat nennt Problembeleg, Priorität, betroffenen Prüfer, Aussage und Nichtaussage, GET-/SSRF-/Redirect-/Größen-/Zeitgrenzen, stabile Signalreferenzen sowie Positiv-, Negativ-, Grenz- und Nebenwirkungstests. Kandidaten ohne diese Angaben werden nicht umgesetzt.

Nicht automatisierbare Rechts-, Datenschutz-, Infrastruktur-, Plattform-, Geräte-, Screenreader-, Kommunikations- und Freigabefragen bleiben Bestandteil der menschlichen Checkliste. Das Paket modelliert ihren Projektstatus nicht.

## Veröffentlichung

Vor jedem neuen Paket-Tag sind erforderlich:

```bash
npm ci
npm run check
npm run test:chromium
npm run test:package
npm pack --dry-run
```

`npm run test:package` installiert das erzeugte Tarball in einem temporären Verbraucher, führt alle fünf installierten Befehle aus und validiert die JSON-Ausgaben gegen die exportierten Paketschemata. Die Releaseprüfung wird jeweils unter einem unterstützten Node-22- und Node-24-Stand mit Node-, npm-, Chromium- und Paketversion sowie dem SHA-256-Hash des Tarballs protokolliert. Veröffentlichung und Tagging bleiben bewusste getrennte Entscheidungen; veröffentlichte Tags werden nicht verschoben.

Historische Entscheidungen und veröffentlichte 0.x-/1.x-Stände bleiben im [`CHANGELOG.md`](CHANGELOG.md) und über Git-Tags nachvollziehbar.
