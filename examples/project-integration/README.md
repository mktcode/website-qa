# Minimale Projektintegration

Diese Kopiervorlage enthält nur fünf unabhängige npm-Skripte und eine `.gitignore`-Regel.

1. Limits und Berichtspfade in `package-scripts.json` anpassen; die Ziel-URL wird beim Aufruf nach `--` übergeben.
2. Die gewünschten Skripte ins Projekt-`package.json` übernehmen.
3. `gitignore.txt` in die projektseitige `.gitignore` übernehmen.
4. HTTP, Crawl, Browser, Social und Lighthouse bewusst einzeln ausführen, zum Beispiel `npm run ops:http:check -- https://example.com/`.
5. Die statischen Berichte manuell zusammen mit der zentralen Website-QA-Checkliste auswerten.

Exitcode 1 liefert weiterhin einen gültigen fachlichen Bericht. Exitcode 2 bezeichnet einen Aufruf- oder Laufzeitfehler. Kurze synthetische Beispiele und die jeweils erforderliche manuelle Reaktion stehen in [`report-interpretation.md`](report-interpretation.md).

Das Paket erzeugt keinen Gesamtbericht und pflegt keinen Checklistenstatus. Vollständige technische Berichte bleiben standardmäßig unter `.website-qa/` lokal und werden vor jeder abweichenden Archivierung oder Veröffentlichung gesichtet.
