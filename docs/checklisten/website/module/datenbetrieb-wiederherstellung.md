## Modul: Datenbetrieb und Wiederherstellung

Dieses Modul gilt bei persistenten Anwendungsdaten, Datenbanken, eigenen Backups oder eigener Wiederherstellungsverantwortung.

### Datenmodell und Migrationen

- [ ] `DATA-MIG-01` Schema, Datenarten, Verantwortlichkeiten und produktiv verwendete Datenbank beziehungsweise Speicherziele sind dokumentiert.
- [ ] `DATA-MIG-02` Migrationen sind versioniert und sowohl gegen eine leere Umgebung als auch als Upgrade vom maßgeblichen Vorgängerstand geprüft.
- [ ] `DATA-MIG-03` Vor riskanten Migrationen bestehen ein geeigneter Sicherungs- und Rückfallplan sowie klare Abbruchkriterien. Irreversible Schritte sind ausdrücklich gekennzeichnet.
- [ ] `DATA-MIG-04` Parallelität, Eindeutigkeit, Transaktionen und Konfliktfälle zentraler Schreibvorgänge wurden geprüft; reine UI-Prüfungen ersetzen keine server- beziehungsweise datenbankseitige Absicherung.
- [ ] `DATA-MIG-05` Der projektspezifische Migrations- beziehungsweise Schemaprüfbefehl, Werkzeugversion und benötigte sichere Konfiguration sind in der Validierungsmatrix dokumentiert und wurden ohne Ausgabe von Zugangsdaten ausgeführt.

### Aufbewahrung und technische Löschung

- [ ] `DATA-RET-01` Speicherfristen sind je Datenart dokumentiert und technisch umgesetzt; vertragliche oder projektspezifische Vorgaben werden nicht als allgemeine gesetzliche Frist dargestellt.
- [ ] `DATA-RET-02` Löschung wird unabhängig von seltenen Nutzerzugriffen zuverlässig ausgelöst, ist wiederholbar und begrenzt auch Hilfszustände wie Rate-Limit-, Session- oder Downloaddatensätze.
- [ ] `DATA-RET-03` Ablauf von Downloadlinks, Sessions oder Freigaben und die tatsächliche Löschung der zugrunde liegenden Objekte werden getrennt geprüft.

### Backup und Wiederherstellung

- [ ] `DATA-REC-01` Backupumfang, Häufigkeit, Aufbewahrung, Verschlüsselung, Speicherort, Zuständigkeit und ausdrücklich nicht gesicherte Bestandteile sind dokumentiert.
- [ ] `DATA-REC-02` Wiederherstellung umfasst neben Daten auch benötigte Konfiguration, Secrets, DNS-/Proxygrenzen und externe Abhängigkeiten oder benennt deren getrennte Wiederbeschaffung.
- [ ] `DATA-REC-03` Ein Wiederherstellungstest beziehungsweise risikogerechter Neuaufbau auf einer leeren Umgebung wurde mit Datum, Dauer, Ergebnis und offenen Grenzen dokumentiert. Das bloße Vorhandensein eines Backups genügt nicht.
- [ ] `DATA-REC-04` Rollback und Wiederanlauf auf einen bekannten Anwendungs- und Datenstand sind beschrieben; Zuständigkeit und zulässiger Datenverlust beziehungsweise Ausfallzeit sind transparent.

### Laufender Betrieb

- [ ] `DATA-OPS-01` Erreichbarkeit, Zertifikatsablauf, Speicher, Datenbankzustand, fehlgeschlagene Jobs und relevante Integrationen werden angemessen überwacht oder bewusst mit dokumentierter Zuständigkeit manuell geprüft.
- [ ] `DATA-OPS-02` Betriebslogs und Fehlermeldungen erlauben eine Diagnose ohne unnötige personenbezogene Inhalte oder Secrets; Zugriff, Aufbewahrung und Löschung sind geregelt.
- [ ] `DATA-OPS-03` Wiederherstellungs-, Rotations- und Wartungsanweisungen verwenden keine im Repository gespeicherten Serveradressen oder Zugangsdaten, sofern sichere lokale Aliasse beziehungsweise Secret-Systeme vorgesehen sind.
