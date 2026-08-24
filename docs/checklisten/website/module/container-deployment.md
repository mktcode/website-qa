## Modul: Container und Deployment

Dieses Modul gilt für Docker-, Nixpacks-, Dokploy- und vergleichbare imagebasierte Deployments.

### Buildkontext und Buildplan

- [ ] `CONT-CTX-01` Eine projektspezifische `.dockerignore` schließt mindestens Git-Historie, lokale Abhängigkeiten und Buildausgaben, Caches, Logs, lokale Laufzeitdaten und unverschlüsselte Secrets aus.
- [ ] `CONT-CTX-02` Nicht benötigte Betriebsunterlagen und Tests werden nur ausgeschlossen, wenn der Produktionsbuild sie nachweislich nicht verwendet. Build, Tests und zentrale Produktionspfade wurden anschließend erneut geprüft.
- [ ] `CONT-CTX-03` Größe und Inhalt des lokal simulierten Buildkontexts sind plausibel; soweit die Plattform dies ausweist, wurden zusätzlich die tatsächlich übertragene Kontextgröße oder das effektive Buildlog kontrolliert.
- [ ] `CONT-PLAN-01` Automatisch erzeugte Buildpläne und erkannte Systempakete wurden auf tatsächlichen Bedarf und Fehlalarme geprüft. Browser, Medienwerkzeuge, Init-Systeme oder GUI-Bibliotheken werden nicht allein aufgrund ungenauer Heuristiken installiert.
- [ ] `CONT-PLAN-02` Bei generierten Buildsystemen wurden Werkzeugversion, zusammengeführter effektiver Plan, Installations-, Build- und Startkommando sowie tatsächlich ausgeführte Setup-Phasen protokolliert; die Konfigurationsdatei allein gilt nicht als effektiver Plan.
- [ ] `CONT-VAL-01` Dockerfile und Build wurden mindestens mit `docker build --check .` und einem vollständigen Build geprüft; Warnungen, Buildkontext und verwendete Basisimages wurden ausgewertet.

### Image und Laufzeit

- [ ] `CONT-IMG-01` Ein mehrstufiger Build hält Quellcode, Entwicklungsabhängigkeiten und Buildwerkzeuge aus dem finalen Image heraus; das Laufzeitstadium enthält nur benötigte Artefakte.
- [ ] `CONT-IMG-02` Basisimage und Laufzeit sind mit unterstützter exakter Version und möglichst unveränderlichem Digest reproduzierbar festgelegt. Architektur, native Artefakte und gemeinsamer Aktualisierungsweg für Version und Digest sind geprüft.
- [ ] `CONT-IMG-03` Arbeitsverzeichnis, Startkommando und Benutzer sind ausdrücklich festgelegt; der Laufzeitcontainer arbeitet soweit technisch möglich ohne Rootrechte.
- [ ] `CONT-IMG-04` Tatsächliche Laufzeitversion, Architektur, UID, Startkommando und enthaltene Laufzeitartefakte wurden im laufenden Container geprüft und nicht nur aus Buildkonfiguration oder funktionierenden nativen Funktionen abgeleitet.
- [ ] `CONT-IMG-05` Nach dem Deployment wurde bestätigt, dass Service beziehungsweise Container exakt das vorgesehene aktuelle Produktionsimage verwenden.
- [ ] `CONT-IMG-06` Finale Image-ID, komprimierte beziehungsweise serverseitig ausgewiesene Größe und Dateibestand des Laufzeit-Arbeitsverzeichnisses wurden kontrolliert; unnötiger Quellcode, Tests und Buildwerkzeuge fehlen.

### Secrets und Konfiguration

- [ ] `CONT-SEC-01` Build- und Laufzeitkonfiguration sind getrennt. Laufzeit-Secrets werden weder als Docker-`ARG` noch als dauerhafte Image-`ENV` geschrieben.
- [ ] `CONT-SEC-02` Nur tatsächlich während des Builds benötigte Geheimnisse werden über einen vorgesehenen Secret-Mount bereitgestellt; Image-Konfiguration und Buildprotokoll wurden ohne Ausgabe geheimer Werte kontrolliert.
- [ ] `CONT-SEC-03` Ohne Ausgabe von Werten wurde bestätigt, dass das Image keine Anwendungs-Secrets enthält und alle benötigten Laufzeitvariablen ausschließlich im laufenden Container vorhanden sind.
- [ ] `CONT-SEC-04` Falls Geheimnisse früher in Images, Layern oder Build-Caches lagen, wurde zuerst ein secretfreies Ersatzimage produktiv bestätigt. Danach wurden Zugangsdaten rotiert und betroffene Altimages und Caches gezielt entfernt; Volumes wurden nicht pauschal bereinigt.
- [ ] `CONT-SEC-05` Image-Konfiguration, Historie und relevante Buildausgaben wurden gezielt und ohne Ausgabe von Werten auf dauerhafte Secrets, Buildargumente und unerwünschte Umgebungsvariablen geprüft; ungefilterte Inspektionsdumps werden nicht protokolliert.

### Netzwerk und Betrieb

- [ ] `CONT-NET-01` Anwendung, Reverse Proxy und Providergrenzen sind dokumentiert. Interne Anwendungsports sind nicht unbeabsichtigt direkt öffentlich erreichbar.
- [ ] `CONT-NET-02` Weitergeleitete Client-IP-Header werden nur aus der vertrauenswürdigen Proxykette übernommen; die effektive Bereinigung beziehungsweise Überschreibung wurde risikogerecht praktisch geprüft.
- [ ] `CONT-OPS-01` Containerstatus, Neustartverhalten, Ressourcenverbrauch, freier Speicher und wachstumsrelevante Logs beziehungsweise Caches wurden geprüft. Bereinigungen gefährden keine aktiven Images oder persistenten Volumes.
- [ ] `CONT-OPS-02` Deploymentkonfiguration benennt Repository-Wurzel, Dockerfile, Stage, Buildargumente, Build-Secrets und Laufzeitvariablen eindeutig; nicht benötigte Felder und erzeugte `.env`-Dateien bleiben leer beziehungsweise deaktiviert.
- [ ] `CONT-OPS-03` Ein für die tatsächlich verwendete Infrastruktur dokumentierter, ausschließlich lesender Statuscheck wurde ausgeführt oder seine Nichtanwendbarkeit begründet. Werkzeug und Zugriffsgrenze werden benannt; Zugangsdaten, Serveradressen und ungefilterte Ausgaben werden nicht versioniert.
