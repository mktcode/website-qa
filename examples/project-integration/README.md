# Minimale Projektintegration

Diese Kopiervorlage enthält nur fünf unabhängige npm-Skripte und eine `.gitignore`-Regel.

1. URL und Limits in `package-scripts.json` anpassen.
2. Die gewünschten Skripte ins Projekt-`package.json` übernehmen.
3. `gitignore.txt` in die projektseitige `.gitignore` übernehmen.
4. HTTP, Crawl, Browser, Social und Lighthouse bewusst einzeln ausführen.
5. Die statischen Berichte manuell zusammen mit der zentralen Website-QA-Checkliste auswerten.

Exitcode 1 liefert weiterhin einen gültigen fachlichen Bericht. Exitcode 2 bezeichnet einen Aufruf- oder Laufzeitfehler.

Das Paket erzeugt keinen Gesamtbericht und pflegt keinen Checklistenstatus. Vollständige technische Berichte bleiben standardmäßig unter `.website-qa/` lokal und werden vor jeder abweichenden Archivierung oder Veröffentlichung gesichtet.
