# Abdeckungsmatrix der modularen Website-QA-Checkliste

> **Status: Planungsgrundlage, kein stabiler Katalog und kein Projektbericht.** Die Matrix ändert weder die Bedeutung bestehender Checklistenkennungen noch den Status irgendeiner Projektcheckliste. Sie priorisiert keine vollständige Automatisierung, sondern trennt sichere technische Teilnachweise von Projektwissen, menschlicher Bewertung und bewusst ausgeschlossenen Produktionsaktionen.

Die maschinenlesbare Einzelklassifikation aller 215 Punkte liegt in [`website-coverage-matrix.json`](website-coverage-matrix.json). Ein Test gleicht sie vollständig und in Quellreihenfolge mit den modularen Markdowndateien sowie mit `website-qa-baseline` 1.0.0 ab.

## Ergebnis

| Klassifikation | Punkte | Bedeutung |
|---|---:|---|
| Bereits automatisch im Basiskatalog modelliert | 31 | Mindestens ein automatisches Kriterium besteht bereits; manuelle oder externe Reste können den Gesamtpunkt weiterhin offen halten. |
| Direkter GET-/Passivkandidat | 25 | Ein allgemeiner begrenzter Lauf kann einen normativen technischen Teilnachweis liefern. |
| Reiner Beobachtungskandidat | 19 | Ein allgemeiner begrenzter Lauf kann hilfreiche Daten sammeln, aber keine fachliche Erfüllung entscheiden. |
| Projektlokal oder manifestgebunden | 79 | Quellcode, Build, lokales Manifest, Sollinventar oder Deploymentzuordnung sind erforderlich. |
| Manuell, extern oder administrativ | 41 | Redaktion, Recht, Organisation, reale Plattformen, Freigaben oder Infrastrukturzuständigkeit entscheiden. |
| Für Standardwerkzeuge unsicher oder mutierend | 20 | Ein belastbarer Nachweis würde Authentifizierung, Zustandsänderung, sensible Betriebszugriffe oder gesondert freizugebende Tests benötigen. |
| **Gesamt** | **215** | |

34 Punkte kommen im stabilen Basiskatalog vor. Davon besitzen 31 bereits automatische Kriterien. `CORE-DOM-04`, `CORE-SOC-03` und `GOV-RGT-02` sind dort bewusst nur über manuelle oder externe Kriterien modelliert und werden deshalb nicht als bestehende automatische Abdeckung gezählt.

Die 44 noch nicht modellierten technischen Kandidaten sind keine Zusage für 44 neue Assertions: 17 wurden als hoch, 23 als mittel und vier als niedrig priorisiert. Die eigentliche v1.1-Auswahl bleibt auf sechs Kandidaten begrenzt.

## Begrenzte v1.1-Auswahl zur fachlichen Prüfung

Alle sechs Kandidaten vermeiden neue Zielklassen und mutierende Interaktionen. Sie nutzen vorhandene HTML-, Crawl-, Social-, Browser- oder Axe-Beobachtungen; nur die strukturierte Auswertung und atomare Zuordnung würden erweitert.

| ID | Vorgesehener technischer Teilnachweis | Bewusst offen bleibend |
|---|---|---|
| `CORE-DOM-06` | Finale URL, Canonical, interne Links, Sitemap- und OpenGraph-URLs gegen den deklarierten öffentlichen Origin abgleichen. | Vollständigkeit des projektspezifischen Host-, Routen- und Migrationsinventars. |
| `CORE-SEO-03` | Strukturierte Daten aus bereits geladenem HTML syntaktisch parsen und erkennbare Typ- oder Pflichtfeldprobleme atomar berichten. | Übereinstimmung mit sichtbarem Inhalt, redaktionelle Vollständigkeit und offizieller Validatornachweis. |
| `CORE-ROB-03` | Ausgelieferte `robots.txt` getrennt nach Training/Datennutzung, Suche und nutzerinitiiertem Abruf bewerten. | Betreiberentscheidung, Rechtsbewertung, Freigabe und Quellenaktualität. |
| `CORE-A11Y-03` | Bereits ausgeführte Axe-/DOM-Befunde zu fehlenden zugänglichen Namen atomar zuordnen. | Verständlichkeit, dynamische Zustände und ausschließlich visuell vermittelte Bedeutung. |
| `CORE-A11Y-08` | Bereits beobachtete technische Befunde zu Bildalternativen und Dekorativauszeichnung atomar zuordnen. | Inhaltliche und kontextuelle Qualität der Alternativtexte. |
| `CORE-A11Y-09` | Bereits vorhandene Axe-Kontrastbefunde als eigene Assertionfamilie zuordnen. | Fokus-, Hover-, Aktiv- und dynamische Zustände sowie bildbasierte Sonderfälle. |

Die drei Accessibility-Kandidaten sind absichtlich keine WCAG-Konformitätsaussage. Sie zerlegen nur das bisherige allgemeine Axe-Gesamtergebnis in fachlich besser zuordenbare technische Teilbefunde.

## Bewusst nicht zuerst umsetzen

Folgende Themen bleiben trotz technischer Teilmöglichkeiten außerhalb der ersten v1.1-Auswahl:

- Performance- und Medienmessungen benötigen zunächst ein belastbares, begrenztes Beobachtungsmodell für Variabilität, Budgets und dynamische Zustände.
- Formularinventare dürfen keine Feldwerte erfassen und keine Absende- oder Consentinteraktion auslösen; ihr Nutzen und ihre Redaktionsgrenze müssen vor neuen Records enger spezifiziert werden.
- Secret- und Debugsignatursuchen in öffentlichen Antworten besitzen Fehlalarm- und Redaktionsrisiken. Ein negativer URL-Befund kann Repository oder Artefakte nie vollständig freigeben.
- Umgebungs-, Host- und Migrationsprüfungen benötigen ein explizites Projektmanifest; Ziele dürfen nicht aus einer Live-Website erraten werden.
- Container-, Datenbank-, Backup-, Wiederherstellungs- und Betriebsnachweise bleiben projektlokal oder infrastrukturell. Allgemeine URL-Erreichbarkeit darf sie nicht ersetzen.
- Gültige Formular-, Upload-, Webhook-, Authentifizierungs-, Lösch-, Migrations- oder Wiederherstellungstests gehören weiterhin nicht in die allgemeinen Nur-Lese-Werkzeuge.

## Entscheidungsregeln für eine spätere Umsetzung

Ein Kandidat gelangt erst in eine Implementierungsrunde, wenn alle folgenden Fragen belastbar beantwortet sind:

1. Liefert er einen frameworkunabhängigen technischen Teilnachweis mit stabiler fachlicher Kennung?
2. Kann er vorhandene GET-/Browserbeobachtungen wiederverwenden oder seine zusätzlichen Abrufe eng und sicher begrenzen?
3. Bleiben SSRF-, Redirect-, Größen-, Seiten-, Ressourcen-, Request- und Zeitlimits vollständig erhalten?
4. Werden Limit-, Abruf- und Sicherheitsauslassungen abhängigkeitsbezogen als `inconclusive` ausgewiesen?
5. Welche menschliche, redaktionelle, rechtliche, organisatorische oder infrastrukturelle Restbewertung bleibt ausdrücklich offen?
6. Welche neuen Positiv-, Negativ-, Grenz-, Redaktions- und Nebenwirkungstests sind erforderlich?
7. Rechtfertigt der Nutzen eine neue Katalogversion, Assertionversion oder technische Berichtserweiterung?

Bis zu einer solchen Einzelentscheidung bleibt `website-qa-baseline` 1.0.0 unverändert. Insbesondere werden aus dieser Matrix weder automatisch neue Assertions erzeugt noch Projektchecklisten abgehakt.
