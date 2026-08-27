# Projektcheckliste: [DOMAIN]

> **Projektspezifischer Prüf- und Arbeitsstand.** Diese Datei wurde aus der modularen Website-Vorlage zusammengestellt. Sie ist der projektspezifische Nachweis; die Quelldateien der allgemeinen Vorlage werden nicht projektspezifisch abgehakt.
>
> Es gelten die Status- und Nachweisregeln aus dem README der Quellvorlage. „Nicht zutreffend“ ist mit Begründung als erledigt zu markieren. Teilweise erfüllte, externe, akzeptierte oder zurückgestellte Punkte bleiben offen.

## Kopfdaten

| Feld | Eintrag |
|---|---|
| Kunde / Projekt | |
| Vertragspartner / technischer Auftraggeber | |
| Rolle und Verantwortungsgrenze der prüfenden Stelle | |
| Domain und bevorzugte öffentliche URL | |
| Repository und ursprünglicher Prüfcommit | |
| Aktueller lokaler Quellstand | |
| Quellvorlage, Quellcommit und Übernahmedatum | |
| Zentrales Werkzeugrepository und geprüfter Werkzeugcommit | |
| Prüfdatum, prüfende Person und Werkzeuge | |
| Vereinbarter Prüfumfang und ausdrückliche Ausschlüsse | |
| Besondere Anforderungen, z. B. Shop, Buchung, BFSG oder Mehrsprachigkeit | |
| Datenflüsse, Formulare und Speicherfristen | |
| Letzte technische Freigabe | |
| Letzte inhaltliche/rechtliche Kundenfreigabe | |
| Nächste reguläre Prüfung | |

## Ausgewählte Vorlagenmodule

| Bestandteil | Ausgewählt | Begründung beziehungsweise Abgrenzung |
|---|---:|---|
| Verpflichtender Kern | ja | Für jede Website verbindlich. |
| Auftrag, Recht und Übergabe | | |
| Formulare, APIs und Datenflüsse | | |
| Medien und Animationen | | |
| Umgebungen und Domainmigration | | |
| Container und Deployment | | |
| Datenbetrieb und Wiederherstellung | | |

## Umgebungsübersicht

Mindestens die produktive Umgebung wird eingetragen. Zusätzliche Umgebungen werden unabhängig davon erfasst, ob das Umgebungsmodul ausgewählt ist.

| Umgebung | URL / Host | Zweck | gewünschte Indexierung | Canonical-Basis | Sitemap | erwarteter Deployment-Stand | zuletzt öffentlich geprüft |
|---|---|---|---|---|---|---|---|
| Produktion | | | | | | | |

## Technische Validierungsmatrix

Die tatsächlichen Projektskripte und zentralen Prüfhilfen werden vor Beginn eingetragen; nicht vorhandene Standardkommandos werden nicht erfunden.

| Prüfung | exakter Befehl / Werkzeug | Laufzeit / Version | Umgebung | Ergebnis / Protokollverweis |
|---|---|---|---|---|
| saubere Installation | | | lokal | |
| Lint | | | lokal | |
| Typecheck | | | lokal | |
| Unit-/Integrationstests | | | lokal | |
| Migration-/Datenbankprüfung | | | lokal | |
| Produktionsbuild und lokaler Start | | | lokal | |
| `website-qa-http` | | | öffentlich | |
| `website-qa-crawl` | | | öffentlich | |
| `website-qa-browser` | | | öffentlich beziehungsweise lokaler Produktionsbuild | |
| `website-qa-social` | | | öffentlich | |
| `website-qa-lighthouse` | | | öffentlich | |
| manuelle TLS-/Zertifikatsprüfung | | | öffentlich | |
| manuelle Accessibility-/Cross-Browser-/Geräteprüfung | | | | |
| Deployment-/Infrastrukturprüfung | | | Produktion | |

## Release- und Nachweisstand

| Zustand | Commit / Artefakt / Umgebung | Datum und Nachweis |
|---|---|---|
| lokal implementiert und geprüft | | |
| committed | | |
| gepusht beziehungsweise von Plattform abrufbar | | |
| Deployment abgeschlossen | | |
| tatsächlich laufender Stand identifiziert | | |
| öffentlich technisch verifiziert | | |
| inhaltlich beziehungsweise visuell freigegeben | | |
