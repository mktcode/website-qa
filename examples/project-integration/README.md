# Minimale Projektintegration

Diese Dateien sind allgemeine Kopiervorlagen. Vor Verwendung müssen URL, Auswertungsumgebung, Modulauswahl und Limits an das Zielprojekt angepasst werden.

1. `website-qa.project.json` in den Projekt-Root kopieren.
2. `website-qa-report.mjs` als `scripts/website-qa-report.mjs` kopieren.
3. Die Einträge aus `package-scripts.json` in das Ziel-`package.json` übernehmen.
4. Den Inhalt von `gitignore.txt` in die projektseitige `.gitignore` übernehmen.
5. HTTP, Crawl, Browser und Social bewusst einzeln ausführen; anschließend `npm run qa:report` starten.

Ein Exitcode 1 ist ein fachlicher Befund und der zugehörige JSON-Bericht bleibt auswertbar. Ein Exitcode 2 ist ein Laufzeit- oder Aufruffehler und muss vor der Berichtserzeugung behoben werden.

Das Berichtsskript führt selbst keine Netzwerkprüfung aus. Vollständige Bundles bleiben unter `.website-qa/` lokal; nur die datenarme Zusammenfassung unter `docs/website-qa/berichte/` ist nach Sichtprüfung zur Versionierung vorgesehen.

Die Konfiguration bindet den stabilen Basiskatalog `website-qa-baseline` in Version `1.0.0`. Das Berichtsskript verwendet `writeProjectReportBundle`; es akzeptiert keine früheren Katalogkennungen oder Projektberichtsformate. Der vollständige Bericht verwendet ausschließlich `schemaVersion: 3`.
