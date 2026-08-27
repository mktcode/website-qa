# Technische Berichte kurz interpretieren

Die folgenden Ausschnitte sind bewusst synthetisch und keine vollständigen schemafähigen Berichte. Vollständige Beispiele und JSON-Schemata liegen unter [`../../catalog/`](../../catalog/).

## `defect`: beobachtete technische Abweichung

```json
{
  "id": "http.security.nosniff-valid",
  "status": "defect",
  "message": "X-Content-Type-Options: nosniff fehlt."
}
```

Ein `defect` belegt nur die konkret beobachtete Abweichung. Antwortklasse und Ziel-URL im vollständigen Bericht prüfen, Konfiguration korrigieren und denselben begrenzten Lauf wiederholen. Der referenzierte Checklistenpunkt wird erst nach menschlicher Gesamtprüfung bearbeitet.

## `inconclusive`: technisch nicht abschließend beobachtbar

```json
{
  "id": "social.crawlers.html-metadata-consistent",
  "status": "inconclusive",
  "message": "Mindestens eine Crawlerantwort konnte nicht vollständig ausgewertet werden."
}
```

Typische Ursachen sind Abruffehler, Sicherheitsblockierungen oder erreichte Seiten-, Sitemap-, Request-, Größen- oder Berichtslimits. Zuerst Issues und Coverage-Felder prüfen. Ein Limit nur bewusst und innerhalb der dokumentierten Sicherheitsgrenzen erhöhen; andernfalls den ausgelassenen Umfang protokollieren und manuell prüfen. `inconclusive` ist kein positiver Nachweis.

## Exitcode 2: kein fachlich auswertbarer Lauf

```json
{
  "error": "URL ist ungültig.",
  "schemaVersion": 2,
  "tool": "http-check",
  "toolPackage": {
    "name": "@mktcode/website-qa",
    "version": "2.0.1"
  }
}
```

Exitcode 2 bedeutet Aufruf-, Laufzeit- oder Berichtserzeugungsfehler. Eingabe, Umgebung und Werkzeugversion korrigieren und den Lauf wiederholen. Dieser Fehlerbericht darf nicht als Websitebefund oder als ausgeführter Prüfnachweis behandelt werden.

## Exitcode und Signalstatus getrennt behandeln

- Exitcode `0`: begrenzter Lauf ohne Fehlerdefekt und ohne strict-relevante Warnung; keine Freigabe.
- Exitcode `1`: gültiger Bericht mit Defekt, strict-relevanter Warnung oder sicherheitsbedingt nicht repräsentativem Lighthouse-Lauf.
- Exitcode `2`: technisch fehlgeschlagener Lauf.

Ein Bericht kann mehrere Signalstatus enthalten. Maßgeblich sind deshalb immer Issues, Signale, Coverage, Limits, Ziel, Optionen und Werkzeugversion gemeinsam.
