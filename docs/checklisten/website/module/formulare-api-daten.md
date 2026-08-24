## Modul: Formulare, APIs und Datenflüsse

Dieses Modul gilt für Formulare, API-Endpunkte, Uploads, E-Mail-Versand, Webhooks und andere zustandsverändernde Funktionen.

### Auftrag und Weisung

- [ ] `FORM-GOV-01` Für komplexe Formulare, Uploads, Administrationsbereiche und andere Zusatzfunktionen liegen soweit erforderlich Zusatzauftrag, dokumentierte Weisung, Berechtigungsmodell und ergänzende Verarbeitungsbeschreibung vor.

### Datenfluss und Nutzeroberfläche

- [ ] `FORM-FLOW-01` Erfasste Felder, Zweck, Empfänger, serverseitige Verarbeitung, externe Dienste, temporäre und dauerhafte Speicherorte sowie Fristen sind als tatsächlicher Datenfluss dokumentiert.
- [ ] `FORM-FLOW-02` Es werden nur erforderliche Daten abgefragt; Zweck und Datenschutzhinweis sind verständlich angegeben. Ein Hinweis wird nicht fälschlich als Einwilligung bezeichnet.
- [ ] `FORM-FLOW-03` Ein Standard-Kontaktformular versendet nur an vereinbarte Empfänger und speichert außerhalb notwendiger kurzfristiger Verarbeitung nichts dauerhaft, sofern keine andere dokumentierte Weisung besteht.
- [ ] `FORM-FLOW-04` Sichtbare, aber noch deaktivierte Formulare senden keine Daten, erzeugen keine Nebenwirkung und täuschen keinen Erfolg vor; der alternative Kontaktweg ist verständlich.
- [ ] `FORM-FLOW-05` Erfolgs-, Validierungs-, Missbrauchs- und technische Fehlerzustände sind für Nutzer verständlich, zugänglich und unterscheiden keine intern sensiblen Details.

### Eingabe- und Zugriffsschutz

- [ ] `FORM-SEC-01` Eingaben werden serverseitig anhand eines dokumentierten Schemas validiert; Clientvalidierung ist nur ergänzend.
- [ ] `FORM-SEC-02` Zulässige HTTP-Methoden, Content-Types, Bodygrößen, Feldlängen und Zeichensätze sind begrenzt; unerwartete Inhalte werden kontrolliert abgewiesen.
- [ ] `FORM-SEC-03` Zustandsverändernde Browserendpunkte sind gegen fremde Origins beziehungsweise CSRF geschützt. CORS, Cookies und vertrauenswürdige Proxyheader passen zum tatsächlichen Aufrufmodell.
- [ ] `FORM-SEC-04` Spam- und Missbrauchsschutz ist risikogerecht und datenschutzrechtlich dokumentiert. Schutzmaßnahmen verhindern weder legitime Nutzung noch verlassen sie sich auf manipulierbare Clientheader.
- [ ] `FORM-SEC-05` Bei IP-basiertem Schutz werden vollständige IP-Adressen nicht unnötig im Anwendungszustand gespeichert; Pseudonymisierung, Ablauf und periodische Bereinigung begrenzen Speicher und Schutzfenster. Weitergeleitete Client-IP-Header werden nur aus einer vertrauenswürdigen Proxykette übernommen und risikogerecht praktisch geprüft.
- [ ] `FORM-SEC-06` Fehlermeldungen, API-Antworten und Logs geben keine Secrets, Stacktraces, Datenbankdetails oder unnötigen personenbezogenen Formularinhalt preis.
- [ ] `FORM-SEC-07` Serverseitige Abrufe und Proxyendpunkte begrenzen Zielhosts, Protokolle, Redirects, Koordinaten beziehungsweise Pfade, Timeouts und Antwortgrößen; nutzerkontrollierte Eingaben ermöglichen keinen Zugriff auf interne oder private Ziele.

### Authentifizierung und administrative Wege

- [ ] `FORM-AUTH-01` Administrationsbereiche und geschützte APIs erzwingen Authentifizierung und Autorisierung serverseitig bei jeder Anfrage; erratbare IDs, Clientzustand oder versteckte UI gelten nicht als Berechtigung.
- [ ] `FORM-AUTH-02` Sitzungen, Tokens und Cookies besitzen angemessene Gültigkeit, Rotation, Widerruf, Logout und Schutzattribute. Anmeldung, Fehlversuche und Wiederherstellung sind gegen Missbrauch begrenzt, ohne unnötige Kontoinformationen preiszugeben.
- [ ] `FORM-AUTH-03` Rollen und Rechte folgen dem Minimalprinzip; administrative Änderungen, Exporte und Löschungen werden soweit erforderlich nachvollziehbar protokolliert, ohne sensible Inhalte übermäßig zu loggen.

### Nebenwirkungen und Integrationen

- [ ] `FORM-SIDE-01` Reihenfolge, Verantwortlichkeit und Fehlersemantik aller Nebenwirkungen wie Datenbank, Object Storage, E-Mail, Kalender, Telegram oder Webhooks sind dokumentiert.
- [ ] `FORM-SIDE-02` Teilfehler, Wiederholungen, Timeouts, Idempotenz, Rollback beziehungsweise Kompensation und Nutzerkommunikation sind so festgelegt, dass kein unbemerkter falscher Erfolg oder unkontrolliertes Duplikat entsteht.
- [ ] `FORM-SIDE-03` Deaktivierte oder falsch konfigurierte Integrationen werden früh und kontrolliert erkannt; sie melden nicht erfolgreich, wenn die fachlich zugesagte Wirkung ausbleibt.
- [ ] `FORM-SIDE-04` E-Mail-Absender, Envelope-From, Reply-To, Empfänger, Transportverschlüsselung und soweit relevant SPF-, DKIM- und DMARC-Ausrichtung entsprechen dem vereinbarten Versandweg.
- [ ] `FORM-SIDE-05` Webhooks und administrative Endpunkte prüfen Secrets beziehungsweise Signaturen, Berechtigungen und Replay-/Missbrauchsrisiken; öffentliche Hilfsfunktionen sind gesondert begrenzt.

### Speicher, Upload und Zugriff

- [ ] `FORM-DATA-01` Dauerhaft gespeicherte Formulardaten besitzen eine dokumentierte und technisch getestete Speicherfrist. Eine organisatorische Standardfrist wie 90 Tage wird nur angewandt, wenn sie für das Projekt gilt.
- [ ] `FORM-DATA-02` Download- oder Freigabelinks sind ausreichend zufällig, zeitlich begrenzt, nicht erratbar und senden sensible Inhalte mit geeigneten Cacheheadern. Ablauf des Links und Löschung des Objekts werden getrennt geprüft.
- [ ] `FORM-UP-01` Uploads begrenzen Dateigröße und erlaubte Typen, prüfen tatsächlichen Inhalt statt nur Dateiendung beziehungsweise Browser-MIME und verhindern Pfadmanipulation sowie ausführbare öffentliche Ablage.
- [ ] `FORM-UP-02` Speicherung, Downloadberechtigung, Lifecycle, Löschung, Malware-/Missbrauchsrisiko und Verhalten nach Redeployment sind für Uploads getestet.

### Sichere Prüfungen

- [ ] `FORM-TEST-01` Unit- und Integrationstests decken Validierung, Berechtigung, Missbrauchsschutz, Fehlerfälle und Nebenwirkungsgrenzen ab.
- [ ] `FORM-TEST-02` Ungültige öffentliche Stichproben enden nachweislich vor E-Mail-, Datenbank-, Object-Storage-, Kalender-, Telegram- oder sonstiger externer Wirkung.
- [ ] `FORM-TEST-03` Ein gültiger Produktionsend-to-end-Test mit Nebenwirkungen erfolgt nur nach ausdrücklicher Freigabe, mit eindeutigem Testdatensatz, Kontrolle aller Empfänger und anschließendem Bereinigungsnachweis. Wird er bewusst nicht durchgeführt, bleibt diese Grenze dokumentiert.
- [ ] `FORM-TEST-04` Prüfskripte und Crawler senden nicht unbeabsichtigt Formulare ab und erzeugen keine E-Mails, Nachrichten oder Speicherobjekte.
- [ ] `FORM-TEST-05` Fremde beziehungsweise fehlende Origins, manipulierte weitergeleitete IP-Header und das öffentliche Rate-Limit-Verhalten wurden mit nachweislich nebenwirkungsfreien Anfragen geprüft; erwartete 4xx-Antworten und Schutzfenster sind protokolliert.
