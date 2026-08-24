# Agenten-Prompt: Modulare Website-Prüfung

Ersetze `[DOMAIN]` und, falls erforderlich, den Pfad zum zentralen Vorlagenrepository vor Verwendung.

## Verbindliche Arbeitsgrundlage

Lies zuerst die Repository- und Verzeichnisanweisungen des Zielprojekts, insbesondere `AGENTS.md`, README-Dateien und darin referenzierte Betriebsdokumentation. Prüfe den vorhandenen Git-Arbeitsstand und überschreibe keine fremden oder uncommitteten Änderungen.

Verwende anschließend als fachliche Ausgangsvorlage das Verzeichnis `../checklisten/website/` aus diesem Werkzeugrepository.

Lies zuerst dessen [`README.md`](../checklisten/website/README.md) und [`pruefverfahren.md`](../checklisten/website/pruefverfahren.md) vollständig. Die Projektcheckliste wird aus folgenden Teilen zusammengestellt:

1. `projektkopf.md`,
2. dem verpflichtenden `kern.md`,
3. allen nach der Auswahlmatrix einschlägigen Dateien unter `module/`,
4. `abschluss.md`.

Kopiere nicht ungeprüft alle Module. Dokumentiere ausgewählte und nicht ausgewählte Module mit projektspezifischer Begründung. Behalte die stabilen Prüfpunktkennungen unverändert bei.

Lege die zusammengesetzte Projektkopie üblicherweise unter `docs/betrieb/checklisten/website.md` und das fortlaufende Protokoll unter `docs/betrieb/checklisten/website-protokoll.md` an. Wenn das Projekt eine zentrale operative Akte verwendet, nutze stattdessen deren festgelegte Pfade. Halte Quellverzeichnis, Quellcommit, Übernahmedatum, ausgewählte Module sowie Repository und Commit zentral verwendeter Prüfhilfen fest.

Existiert bereits eine Projektcheckliste, überschreibe oder regeneriere sie nicht. Vergleiche sie mit dem aktuellen Vorlagenstand, benenne das Vorlagendelta und übernimm neue oder geänderte Punkte erst kontrolliert. Eine neue Vorlage setzt bestehende Projektpunkte nicht automatisch auf erledigt.

## Status- und Nachweisregeln

- `[x]` nur bei erfülltem und angemessen belegtem Punkt oder bei begründeter Nichtanwendbarkeit.
- Teilweise belegte, externe, akzeptierte oder zurückgestellte Punkte bleiben `[ ]`.
- Akzeptierte Abweichungen nennen Risiko, Verantwortlichen und Wiedervorlage.
- Lokale Implementierung, Commit, Push, Plattformdeployment, tatsächlich laufender Stand und öffentliche Prüfung sind getrennte Zustände.
- Aussagen zu Produktion, Providerkonten, Kundenfreigaben und organisatorischen Abläufen nur mit technischem oder dokumentarischem Nachweis abschließen.
- Browserengine oder Emulation nicht als Prüfung eines realen Browsers oder Geräts ausgeben.
- Keine Secret-Werte, internen Serveradressen oder unnötigen personenbezogenen Produktionsdaten in Checkliste, Protokoll oder Antwort aufnehmen.
- Kein einzelnes Skript als Vollprüfung ausgeben; dessen dokumentierter Umfang und alle weiterhin manuellen beziehungsweise externen Nachweise bleiben sichtbar.

## Zentrale Prüfhilfen

Für öffentliche Social-Metadaten, Vorschaubilder, Sitemap und Robots-Matrix verwende das lesende zentrale Paket `@mktcode/website-qa`. Das Zielprojekt bindet einen festgelegten Commit oder Release ein und stellt den lokalen Einzelbefehl bereit:

```bash
npm run ops:social:check -- https://[DOMAIN]/ --sitemap --max-pages=50 --strict
```

Führe im Zielprojekt bei fehlender oder nicht reproduzierbarer Installation zuvor unter dessen vorgesehenem Node-/npm-Stand `npm ci` aus. Dokumentiere Paket-/Werkzeugcommit und den ausgegebenen Quellenstand der Robots-Matrix. Verwende `--ai-training-opt-in` ausschließlich bei ausdrücklicher dokumentierter Trainingsfreigabe. Der Social-Check ersetzt keinen allgemeinen Crawl, Browser-, TLS-, Performance- oder echten Plattformtest.

Für den davon getrennten allgemeinen Website-Crawl verwende:

```bash
npm run ops:crawl:check -- https://[DOMAIN]/ --sitemap --max-pages=50 --max-resources=500 --strict
```

Der Crawler verwendet ausschließlich GET. Er inventarisiert Formulare, ruft ihre Actions aber niemals auf, sendet keine Formulare ab und betätigt keine Buttons. Externe Links werden erfasst, jedoch nicht abgerufen. Interne Navigationen mit verdächtigen Aktionspfaden oder sensitiven Query-Parametern werden vorsorglich übersprungen. Diese Nur-Lese-Grenzen dürfen in Projektkonfigurationen oder Einzelprüfungen nicht aufgeweicht werden.

Für den getrennten beobachtenden Browserlauf verwende:

```bash
npm run ops:browser:check -- https://[DOMAIN]/ --sitemap --max-pages=10 --max-requests=300 --strict
```

Der Browser-Check klickt nie, verwendet keine persistenten Profile und blockiert Formulare, Uploads, Nicht-GET-Anfragen, externe Seitenrequests, Popups sowie aktive Hintergrundkanäle. Dokumentiere Chromium-Version, Profile, blockierte Requests und Abdeckungsgrenzen. Werte automatisierte axe-core-Befunde fachlich aus und behaupte daraus weder vollständige WCAG-Konformität noch eine Tastatur-, Screenreader-, Safari- oder reale Mobilgeräteprüfung.

Einen Infrastrukturstatuscheck führst du nur aus, wenn das Zielprojekt dafür einen ausdrücklich dokumentierten, ausschließlich lesenden lokalen Befehl und sichere Zugriffswege bereitstellt. Übernimm keinen Infrastrukturcheck aus einem anderen Projekt. Zugangsdaten, Serveradressen und ungefilterte Ausgaben werden nicht in Kundenrepositories oder Prüfprotokolle kopiert.

## Phase 1: Bestandsaufnahme und Planung

Analysiere das Website-Projekt für `[DOMAIN]` vollständig anhand der zusammengestellten Projektcheckliste. Außer Projektcheckliste und Prüfprotokoll nimmst du noch keine Änderungen vor.

Berichte zunächst:

1. welche Punkte belegt erfüllt erscheinen,
2. welche Punkte nur lokal, nur konfigurativ oder nur teilweise belegt sind,
3. welche Informationen und externen Nachweise fehlen,
4. welche Abweichungen und Risiken bestehen,
5. welche Module oder Einzelpunkte nicht zutreffen und warum,
6. welche Änderungen voraussichtlich erforderlich sind und
7. in welcher Reihenfolge die Umsetzung sinnvoll ist.

Ordne jeden Produktionsbefund der konkret geprüften URL, Umgebung und soweit möglich dem laufenden Commit beziehungsweise Artefakt zu. Leite öffentliches Verhalten nicht allein aus Quellcode, Buildausgabe oder Betreiberhinweis ab. Erfasse vor der Prüfung die angebotenen Projektskripte, Laufzeit- und Paketmanagerversionen und stelle daraus eine konkrete Validierungsmatrix für saubere Installation, Lint, Typecheck, Tests, Migrationen, Produktionsbuild und lokalen Produktionsstart zusammen.

Führe nur lesende und nebenwirkungsfreie Prüfungen aus. Sende keine Formulare ab, erzeuge keine E-Mails, Nachrichten, Datenbankeinträge oder Object-Storage-Objekte und verändere keine produktive Konfiguration ohne ausdrückliche Freigabe.

## Phase 2: Kontrollierte Umsetzung

Gehe die Befunde nach Priorität einzeln mit mir durch. Stelle konkrete Fragen oder schlage eine klar abgegrenzte Änderung vor. Führe sie erst nach meiner Freigabe aus.

Nach jeder Änderung:

1. führe die angemessenen lokalen Prüfungen gemäß der dokumentierten Validierungsmatrix aus,
2. aktualisiere die betroffenen Statusfelder nur entsprechend dem tatsächlichen Nachweisstand,
3. ergänze das Prüfprotokoll um Entscheidung, Dateien, Tests und offene Folgen,
4. trenne Implementierung und Dokumentation soweit sinnvoll,
5. committe oder pushe nur nach ausdrücklicher Freigabe.

Ein Punkt, der eine öffentliche oder organisatorische Bestätigung verlangt, bleibt nach einer rein lokalen Korrektur offen.

## Phase 3: Deployment- und Produktionsnachweis

Behandle Push, Deployment und Produktionsprüfung als getrennte Schritte. Nach ausdrücklicher Freigabe und abgeschlossenem Deployment:

1. identifiziere den tatsächlich laufenden Stand soweit technisch möglich,
2. prüfe die in der Checkliste betroffenen öffentlichen Seiten und Antwortklassen erneut und wiederhole insbesondere den strikten zentralen Social-/Sitemap-/Robots-Check,
3. vermeide bei Produktionstests reale Nebenwirkungen; ein gültiger End-to-end-Test mit E-Mail-, Datenbank-, Storage-, Kalender- oder Nachrichtenwirkung benötigt eine gesonderte Freigabe und einen Bereinigungsplan,
4. dokumentiere URL, Datum, Werkzeug, Ergebnis, nicht geprüfte Plattformen und offene Abweichungen,
5. schließe erst danach die entsprechenden Produktionspunkte und Release-Gates.

Aktualisiere zum Abschluss Projektcheckliste und Prüfprotokoll konsistent. Die allgemeine Vorlage bleibt unverändert und ist kein Nachweis für das geprüfte Projekt.
