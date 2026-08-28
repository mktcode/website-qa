# Öffentlicher Praxispilot 2.0.2

## Zweck und Aussagegrenze

Dieser einmalige, bewusst kleine Pilot prüft, ob die fünf unabhängigen Werkzeuge auf strukturell unterschiedlichen öffentlichen Websites begrenzt laufen, schemafähige Berichte erzeugen und ihre Aussagegrenzen sichtbar machen. Er bewertet weder die vollständige Websitequalität der Ziele noch deren Checklistenstatus und ist keine WCAG-, Datenschutz-, Sicherheits- oder Produktionsfreigabe.

Die zentrale manuelle Website-QA-Checkliste bleibt der Kern des Projekts. Die Skripte liefern ausschließlich solche technischen Hilfssignale, die sich innerhalb ihrer dokumentierten Nur-Lese- und Abdeckungsgrenzen automatisieren lassen.

## Stand und Umgebung

- Laufzeit: 2026-08-28, 08:57–09:00 UTC
- Werkzeugcommit: `2212ddc4d8089f915846e348e6f47b70922aa74c`
- vorbereitete Paketversion: `2.0.2`
- Node.js: `v24.19.0`
- npm: `11.17.0`
- Browser: lokales Chromium `151.0.7922.108`
- Sitemapmodus: aus
- Strict-Modus: aus
- Rohberichte: nicht versioniert, da sie zeitabhängige öffentliche Pfade, DOM-Daten und externe Ziele enthalten können

## Ziele

| Ziel | Gewählte Strukturklasse |
| --- | --- |
| `https://www.google.com/` | Such- und Webanwendung |
| `https://www.amazon.de/` | E-Commerce und Personalisierung |
| `https://de.wikipedia.org/` | serverseitige, inhaltsreiche Wissensplattform |
| `https://github.com/` | hybride Entwickler-SaaS |
| `https://www.bbc.com/` | Medien- und Nachrichtenplattform |

Die Auswahl ist eine diverse öffentliche Stichprobe und keine fachliche Referenz. Kein beobachteter Seitenaufbau, Befund oder Grenzwert wird zur generischen Produkterwartung.

## Exakte Befehle

Die folgenden Befehle wurden aus dem Repositorywurzelverzeichnis ausgeführt. `<slug>` und `<url>` wurden durch die fünf Tabellenzeilen ersetzt; die Slugs waren `google`, `amazon`, `wikipedia`, `github` und `bbc`.

```bash
node src/check-http.mjs <url> \
  --skip-http-redirect --max-redirects=3 --timeout=20000 \
  --json-file=/tmp/website-qa-pilot-2.0.2/<slug>-http.json

node src/check-crawl.mjs <url> \
  --max-pages=2 --max-resources=12 --max-redirects=3 --timeout=30000 \
  --json-file=/tmp/website-qa-pilot-2.0.2/<slug>-crawl.json

node src/check-social-preview.mjs <url> \
  --max-pages=1 --max-redirects=3 --timeout=20000 \
  --json-file=/tmp/website-qa-pilot-2.0.2/<slug>-social.json

node src/check-browser.mjs <url> \
  --max-pages=1 --max-requests=20 --profiles=desktop --settle=500 --timeout=30000 \
  --json-file=/tmp/website-qa-pilot-2.0.2/<slug>-browser.json

node src/check-lighthouse.mjs <url> \
  --max-requests=20 --timeout=45000 \
  --json-file=/tmp/website-qa-pilot-2.0.2/<slug>-lighthouse.json
```

Es wurden ausschließlich explizite HTTPS-Ziele verwendet. Formulare, Buttons und Sitemaps wurden nicht aufgerufen beziehungsweise betätigt. Die Berichte aller 24 fachlich abgeschlossenen Läufe attestieren ausschließlich GET und keine mutierenden Aktionen; der technische Lighthouse-Fehlerbericht enthält vertragsgemäß keine Laufattestierung. Öffentliche Servernebenwirkungen sind von außen nicht vollständig beweisbar und werden deshalb nicht behauptet.

## Ergebnisübersicht

`E/W` bezeichnet die im begrenzten Bericht gezählten Errors und Warnings. Exitcode 1 ist ein gültiger technischer Befund, Exitcode 2 ein technischer Laufzeitfehler.

| Ziel | HTTP | Crawl | Social | Browser | Lighthouse |
| --- | --- | --- | --- | --- | --- |
| Google | Exit 1, 4/10 E/W | Exit 1, 3/3 E/W | Exit 1, 10/2 E/W | Exit 1, 3/13 E/W | Exit 1, 10/17 E/W |
| Amazon | Exit 1, 1/3 E/W | Exit 1, 9/7 E/W | Exit 1, 11/11 E/W | Exit 1, 3/3 E/W | Exit 2, Gesamtlaufdeadline |
| Wikipedia | Exit 1, 1/12 E/W | Exit 1, 2/22 E/W | Exit 1, 7/3 E/W | Exit 1, 1/34 E/W | Exit 1, 4/30 E/W |
| GitHub | Exit 1, 1/4 E/W | Exit 1, 2/0 E/W | Exit 0, 0/1 E/W | Exit 1, 4/106 E/W | Exit 1, 3/100 E/W |
| BBC | Exit 0, 0/8 E/W | Exit 1, 5/1 E/W | Exit 1, 3/10 E/W | Exit 0, 0/87 E/W | Exit 1, 1/100 E/W |

- 25 von 25 Ausgaben waren gültiges JSON und entsprachen dem generischen veröffentlichten Berichtsschema.
- 3 Läufe endeten mit Exitcode 0, 21 mit Exitcode 1 und einer mit Exitcode 2.
- Die Summe der einzeln gemessenen Laufzeiten betrug 118 Sekunden.
- Alle Crawl-Läufe erreichten erwartungsgemäß das absichtlich sehr niedrige Seitenlimit. Betroffene Signale wurden nicht positiv, sondern `inconclusive` ausgegeben.
- Browser und Lighthouse blockierten auf den dynamischen Zielen zahlreiche externe Requests beziehungsweise erreichten Requestlimits. Repräsentativitätsabhängige Signale blieben dadurch `inconclusive`.
- Der Amazon-Lighthouse-Lauf überschritt nach 44.085 ms die verbleibende Gesamtlaufdeadline und lieferte einen schemafähigen Exitcode-2-Fehlerbericht.

Die unter den starken Sicherheitsgrenzen aufgezeichneten Lighthouse-Scores waren:

| Ziel | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Google | 91 | 96 | 96 | 92 |
| Wikipedia | 98 | 88 | 100 | 92 |
| GitHub | 62 | 91 | 100 | 100 |
| BBC | 70 | 100 | 100 | 100 |

Diese Scores sind wegen blockierter externer Requests und erreichter Limits ausdrücklich nicht repräsentativ. Für Amazon entstand wegen der Gesamtlaufdeadline kein verwertbarer Scorebericht.

## Wiederkehrende Beobachtungen

- Der HTTP-Prüfer lieferte schnell konkrete Header-, Kompressions- und 404-Signale; ein positiver Gesamtexit blieb ohne `--strict` trotz Warnungen möglich.
- Der Crawl machte die absichtlich unvollständige Abdeckung auf allen großen Websites sichtbar, statt aus zwei Seiten eine vollständige Aussage abzuleiten.
- Social-Metadaten und crawlerabhängige Antworten unterschieden sich deutlich; GitHub war der einzige Social-Lauf ohne Error-Befund.
- Dynamische Plattformen erzeugten im isolierten Browser viele blockierte externe Requests. Die hohe Warnungszahl ist primär ein Abdeckungs- und Repräsentativitätssignal, keine entsprechend hohe Zahl unabhängiger Websitefehler.
- Lighthouse bewahrte die Produktgrenze: Kategorien wurden aufgezeichnet, aber bei Sicherheitsblockierungen durchgehend als `inconclusive` signalisiert.
- Die fünf Werkzeuge ergänzen einander, ersetzen aber weder die manuelle Checkliste noch eine projektspezifische Auswahl geeigneter Prüfumfänge.

## Folgerung für die Planung

Der Pilot bestätigt die beabsichtigte Produktgrenze. Er liefert keinen belastbaren Grund für eine automatische Checklistenaggregation oder eine Ausweitung zur Freigabeplattform. Die wiederkehrenden Befunde werden bereits durch vorhandene Signale abgedeckt; aus diesem Pilot wird daher kein neuer technischer Signalkandidat priorisiert.

Für künftige Zielprojekte sollten Limits bewusst nach Inventargröße und Prüfzweck gewählt werden. Extrem niedrige Pilotlimits eignen sich zur sicheren Werkzeugerprobung, nicht zur fachlichen Vollprüfung einer Website.
