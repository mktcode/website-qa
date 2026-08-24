# Strukturierter Prüfkatalog (Pilot)

Dieses Verzeichnis erprobt ein maschinenlesbares Nachweismodell für die allgemeine Website-Checkliste. Der Pilot ersetzt die vollständige Markdown-Vorlage noch nicht.

- `website-pilot.json` enthält ausgewählte HTTP-nahe Punkte sowie mit `CORE-DOM-04` und `GOV-RGT-02` bewusst rein administrative, externe und kommunikative Nachweise.
- `assertions.json` registriert atomare Aussagen, die ein Werkzeug positiv, negativ oder unklar belegen kann.
- `website-catalog.schema.json` beschreibt das Katalogformat; zusätzliche semantische Konsistenzregeln werden durch Tests geprüft.
- `project-evidence.schema.json` und `project-evidence.example.json` beschreiben projektspezifische manuelle, kommunikative und externe Nachweise. Erfolgreiche Nachweise benötigen mindestens Kriterium, Ergebnis, Datum, bestätigende beziehungsweise prüfende Stelle und eine redigierte Notiz.
- `project-report.schema.json` und `project-report.example.json` beschreiben die Projektauswahl, Auswertungsumgebung, technischen JSON-Berichte und Workflowzustände für einen abgeleiteten Projektbericht. `project-report.output.schema.json` versioniert die erzeugte JSON-Ausgabe. Ein vollständig gerendertes allgemeines Beispiel liegt unter [`project-report.example.md`](project-report.example.md); es verwendet `http-report.example.json`, `crawl-report.example.json` und `project-evidence.example.json` als Eingaben.

Ein Checklistenpunkt kann automatische, manuelle und externe Kriterien verbinden. Ein erfolgreicher Werkzeuglauf schließt den Punkt nur ab, wenn alle erforderlichen Kriterien belegt sind. Fehlende Infrastrukturzugänge, Freigaben, Medienrechte oder andere kommunikative Nachweise bleiben deshalb ausdrücklich offen und werden nicht aus einem fehlenden technischen Befund abgeleitet.

Projektbezogene Auswahl, Nichtanwendbarkeit, manuelle Nachweise und akzeptierte Abweichungen gehören weiterhin ausschließlich in das jeweilige Websiteprojekt. Alte Berichte werden bei einer neuen Katalogversion nicht automatisch als Nachweis für neue oder geänderte Kriterien behandelt.

Die Exportfunktionen unter `@mktcode/website-qa/report` lesen eine solche Projektkonfiguration samt referenzierten Berichten, führen aber selbst keine Netzwerkprüfung aus. Nur Läufe der ausdrücklich festgelegten Auswertungsumgebung werden berücksichtigt. Die konfigurierte Ziel-URL muss im technischen Bericht enthalten sein. Quell- und Deploymentstand sind dagegen projektseitig deklarierte Zuordnungen und werden vom technischen Werkzeug nicht unabhängig bestätigt. Der Zielstand kann anschließend als JSON gespeichert und als Markdown gerendert werden.
