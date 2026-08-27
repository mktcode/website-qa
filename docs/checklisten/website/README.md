# Modulare Vorlage für Website-Prüfungen

> **Wiederverwendbare operative Vorlage – kein projektspezifischer Prüfnachweis.** Die Dateien dieses Verzeichnisses werden nicht für ein konkretes Projekt abgehakt oder mit Projektdaten gefüllt. Für jedes Projekt wird daraus eine eigenständige, versionierte Projektcheckliste erstellt.
>
> Die Vorlage begründet keine rechtliche, barrierefreie oder sicherheitstechnische Garantie. Besondere Anforderungen müssen ausdrücklich vereinbart werden. Aussagen zu Produktion, externen Konten und organisatorischen Abläufen dürfen nur mit belastbarem Nachweis abgeschlossen werden.
>
> Die technischen Werkzeuge lesen und verändern den Checkboxstatus niemals. Checklistenpunkte werden ausschließlich durch Menschen in der jeweiligen Projektkopie bearbeitet.

## Aufbau

Vor Zusammenstellung und Prüfung ist [`pruefverfahren.md`](pruefverfahren.md) vollständig zu lesen. Die Datei beschreibt konkrete, wiederholbare Befehle, zentrale Prüfhilfen, sichere Produktionsstichproben und Grenzen automatisierter Nachweise.

Eine Projektcheckliste wird anschließend in dieser Reihenfolge zusammengestellt:

1. [`projektkopf.md`](projektkopf.md)
2. [`kern.md`](kern.md) – für jede Website verpflichtend
3. alle nach der Auswahlmatrix einschlägigen Module
4. [`abschluss.md`](abschluss.md)

Verfügbare Module:

| Modul | Auswählen, wenn … |
|---|---|
| [`module/auftrag-recht-uebergabe.md`](module/auftrag-recht-uebergabe.md) | Auftrag, Abrechnung, Kundenfreigaben, Rechtstexte, AVV/TOM oder Übergabe zum Prüfumfang gehören. |
| [`module/formulare-api-daten.md`](module/formulare-api-daten.md) | Formulare, API-Endpunkte, Uploads, E-Mail-Versand, Webhooks oder andere zustandsverändernde Abläufe vorhanden sind. |
| [`module/medien-animationen.md`](module/medien-animationen.md) | relevante Bilder, Galerien, Videos, Animationen oder dynamische Bildtransformationen eingesetzt werden. |
| [`module/umgebungen-domainmigration.md`](module/umgebungen-domainmigration.md) | Staging, Vorschau-, Übergangs- oder mehrere öffentliche Domains bestehen oder eine Domainmigration geplant ist. |
| [`module/container-deployment.md`](module/container-deployment.md) | Docker, Nixpacks, Dokploy oder ein vergleichbarer Containerbuild verwendet wird. |
| [`module/datenbetrieb-wiederherstellung.md`](module/datenbetrieb-wiederherstellung.md) | persistente Anwendungsdaten, Datenbanken, Backups, Migrationen oder eigene Wiederherstellungsverantwortung bestehen. |

Nicht ausgewählte Module werden im Projektkopf mit einer konkreten Begründung dokumentiert. Einzelne Punkte innerhalb eines ausgewählten Moduls können weiterhin begründet nicht zutreffen.

Die Modulliste ist keine Obergrenze. Ergibt das Funktions- und Risikoinventar besondere Bereiche wie Shop, Zahlung, Buchung, Benutzerkonten, Mehrsprachigkeit, Suche, Import/Export oder branchenspezifische Schnittstellen, wird die Projektkopie um einen projektspezifischen Abschnitt mit stabilen `PROJ-*`-Kennungen, konkreten Prüfverfahren und Freigabekriterien ergänzt. Ein fehlendes Standardmodul begründet keine stillschweigende Nichtprüfung.

## Verbindliche Statusregeln

- `[x]` **Erledigt:** Umsetzung und erforderlicher Nachweis sind abgeschlossen.
- `[x]` **Nicht zutreffend:** nur mit kurzer projektspezifischer Begründung.
- `[ ]` **Offen:** noch nicht geprüft, nicht umgesetzt oder nicht belegt.
- `[ ]` **Teilweise:** Teilnachweise werden notiert, der Punkt bleibt offen.
- `[ ]` **Extern:** Nachweis liegt bei Kunde oder Partner noch nicht belastbar vor.
- `[ ]` **Zurückgestellt:** Grund, Risiko, verantwortliche Person und Wiedervorlage werden dokumentiert.
- **Akzeptierte Abweichungen** bleiben offen, sofern der Wortlaut des Prüfpunkts nicht erfüllt ist. Entscheidung, Risiko, Verantwortlicher und Prüftermin gehören zusätzlich in die Abschlusstabelle.

Ein Commit, Push, erfolgreicher Build, Plattformstatus und öffentlicher Produktionsnachweis sind unterschiedliche Zustände. Keiner davon darf stillschweigend für einen anderen stehen.

## Stabile Kennungen

Jeder Prüfpunkt besitzt eine fachliche Kennung wie `CORE-DOM-01`, `FORM-SEC-03` oder `CONT-IMG-02`. Diese Kennungen werden in Projektkopien, Protokollen und späteren Vorlagenrevisionen beibehalten. Neue Punkte erhalten neue Kennungen; bestehende Kennungen werden nicht für andere Aussagen wiederverwendet.

### Technische Signale als Arbeitshilfe

Unter [`../../../catalog/checklist-index.json`](../../../catalog/checklist-index.json) liegt ein neutraler maschinenlesbarer Index aller 215 stabilen Kennungen. Er dient ausschließlich dazu, Informationsreferenzen technischer Signale zu prüfen. Er enthält keinen Projekt- oder Prüfstatus.

HTTP-, Crawl-, Browser-, Social- und Lighthouse-Prüfer liefern begrenzte technische Signale mit `positive`, `defect`, `inconclusive` oder `notApplicable`. Ein positives Signal bedeutet nur, dass der konkrete Defekt im dokumentierten Umfang nicht beobachtet wurde. Ein Signal kann auf einen oder mehrere Punkte dieser Checkliste verweisen, hakt sie aber niemals ab und bewertet weder manuelle, rechtliche, organisatorische noch projektspezifische Anforderungen.

Die statischen Werkzeugberichte sind eine erste Temperaturmessung für die anschließende manuelle QA-Arbeit. Sie werden einzeln gelesen und bei Bedarf in der Projektkopie referenziert. Das Paket erzeugt keinen Projektgesamtstatus, keine Freigabe und kein Checklistenbundle.

## Anforderungen an Nachweise

Ein belastbarer Nachweis nennt, soweit einschlägig:

- Datum und prüfende Person,
- Umgebung und vollständigen Host,
- Quell-, Release- oder Deployment-Commit beziehungsweise Artefaktkennung,
- Werkzeug, Werkzeugcommit und exakten Befehl beziehungsweise reproduzierbare Aufrufbeschreibung,
- bei Browserprüfungen Browser, Version, Modus und Viewport,
- erwartetes und tatsächliches Ergebnis,
- bewusst nicht geprüfte Plattformen oder Pfade,
- verbleibende Folgen und Zuständigkeit.

Konfiguration und generierte Buildausgaben werden nicht mit dem öffentlich ausgelieferten Verhalten gleichgesetzt. Lokale, Staging- und Produktionsprüfungen werden getrennt bezeichnet. Eine Browserengine oder Emulation wird nicht als Prüfung des entsprechenden realen Browsers oder Geräts ausgegeben. Ein spezialisiertes Skript deckt nur seinen dokumentierten Umfang ab und ersetzt keine übrigen manuellen, Browser-, TLS-, Infrastruktur- oder Organisationsnachweise.

## Projektkopie und Prüfprotokoll

Die zusammengesetzte Projektcheckliste liegt im jeweiligen Zielprojekt, beispielsweise unter `docs/betrieb/checklisten/website.md` oder in einer getrennten operativen Akte unter `docs/betrieb/projekte/<domain>/checklisten/website.md`. Pfad, Quellcommit dieses Vorlagenrepositorys und ausgewählte Module werden in der Projektkopie dokumentiert.

Entscheidungen, Änderungen, Prüfungen und offene Folgen werden ergänzend fortlaufend in `website-protokoll.md` im selben Checklistenverzeichnis dokumentiert. Das Protokoll ersetzt nicht den Status in der Projektcheckliste.

Bei einer späteren Prüfung wird die bestehende Projektkopie nicht durch die aktuelle Vorlage überschrieben. Stattdessen werden Quellcommit und ausgewählte Module mit dem aktuellen Vorlagenstand verglichen; neue oder geänderte Punkte werden kontrolliert übernommen und als Vorlagendelta protokolliert. Eine Änderung der allgemeinen Vorlage setzt keinen Projektpunkt automatisch auf erledigt.
