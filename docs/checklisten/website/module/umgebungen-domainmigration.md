## Modul: Umgebungen und Domainmigration

Dieses Modul gilt bei Staging-, Vorschau- oder Übergangsumgebungen, mehreren öffentlichen Domains oder einer geplanten Domainmigration.

### Umgebungstrennung

- [ ] `ENV-SEP-01` Zweck, URL, Verantwortlichkeit, Konfigurationsmodus und gewünschte Indexierung jeder Umgebung sind in der Umgebungsübersicht dokumentiert.
- [ ] `ENV-SEP-02` Nicht produktive Umgebungen sind bevorzugt zugriffsgeschützt. Soweit sie öffentlich erreichbar sein müssen, sind sie mindestens per passendem `X-Robots-Tag` beziehungsweise Meta-Robots von der Indexierung ausgeschlossen; `robots.txt` wird nicht als Zugriffsschutz missverstanden.
- [ ] `ENV-SEP-03` Nicht indexierbare Umgebungen veröffentlichen keine indexierbare Sitemap und keinen irreführenden Sitemap-Verweis. Fehlerantworten tragen ebenfalls die vorgesehene Indexierungsrichtlinie.
- [ ] `ENV-SEP-04` Canonical-, OpenGraph-, Sitemap- und interne URLs verwenden je Umgebung bewusst den festgelegten Host; Produktions- und Staginghosts gelangen nicht versehentlich in die jeweils andere Ausgabe.
- [ ] `ENV-SEP-05` Umgebungsabhängige Dienste, Formulare, Analysefunktionen und Zugangsdaten sind getrennt und werden nicht allein durch eine Beispielkonfiguration aktiviert.
- [ ] `ENV-SEP-06` Build und öffentlicher Abruf wurden für jede relevante Umgebung separat geprüft. Ein Nachweis einer Umgebung wird nicht auf eine andere übertragen.

### Übergangsdomains und Migration

- [ ] `ENV-MIG-01` Bevorzugte endgültige Domain, vorläufig öffentliche Domain, Migrationszeitpunkt, Domaininhaberschaft, Registrar und DNS-Zuständigkeit sind dokumentiert.
- [ ] `ENV-MIG-02` Während eines bewusst indexierbaren Übergangsbetriebs sind Canonicals, Sitemap und Social-URLs in sich konsistent; eine noch nicht erreichbare Zieldomain wird nicht vorzeitig als Canonical gesetzt.
- [ ] `ENV-MIG-03` Für die Migration sind alte und neue Hosts, HTTP/HTTPS-Varianten, Pfad- und Queryerhalt, Redirectstatus und vermeidbare Zwischenstationen festgelegt und getestet.
- [ ] `ENV-MIG-04` Nach der Migration werden Canonicals, interne Links, OpenGraph-URLs, Sitemap, Robots-Verweis, Zertifikate und Search-Console-Zuordnung gemeinsam auf den neuen Host umgestellt und öffentlich geprüft.
- [ ] `ENV-MIG-05` Alte Domains und Verifikationsdateien werden erst aufgegeben, wenn Eigentum, Weiterleitung und alternative Verifizierung belastbar bestätigt sind.
