## Modul: Medien und Animationen

Dieses Modul gilt für relevante Bilder, Galerien, Videos, Animationen und dynamische Bildtransformationen.

### Inventar, Rechte und Alternativtexte

- [ ] `MEDIA-INV-01` Ein Medieninventar erfasst mindestens Datei, Größe, aktive Verwendung, Darstellungszweck, Alternativtext, Rechte-/Freigabestatus, externes Original beziehungsweise Archiv und Entscheidung über Behalten, Ersetzen oder Löschen.
- [ ] `MEDIA-INV-02` Technisches Inventar, redaktionelle Freigabe und Rechte-/Veröffentlichungsnachweis werden nicht miteinander gleichgesetzt.
- [ ] `MEDIA-INV-03` Alternativtexte beschreiben den tatsächlich sichtbaren und kontextrelevanten Inhalt, wurden redaktionell geprüft und nicht ungeprüft aus Dateinamen erzeugt. Dekorative Medien besitzen eine passende leere Alternative beziehungsweise bleiben außerhalb des Accessibility Trees.
- [ ] `MEDIA-INV-04` Nicht referenzierte Medien und Originaldateien im öffentlichen Verzeichnis wurden entfernt oder mit Zweck begründet. Vor einer Löschung ist der notwendige externe Original- oder Archivbestand bestätigt.

### Bildauslieferung

- [ ] `MEDIA-IMG-01` Jedes ausgelieferte Bild ist auf den tatsächlich benötigten maximalen Darstellungsumfang zugeschnitten und sinnvoll komprimiert; Schärfe und Farbdarstellung wurden auf Desktop und Mobil geprüft.
- [ ] `MEDIA-IMG-02` Moderne Formate wie AVIF oder WebP werden soweit sinnvoll eingesetzt; erforderliche Fallbacks und bewusst verlinkte Originaldownloads funktionieren.
- [ ] `MEDIA-IMG-03` Große oder mehrfach verwendete Bilder besitzen passende responsive Quellen, `srcset`/`sizes` oder eine gleichwertige Frameworkoptimierung.
- [ ] `MEDIA-IMG-04` Breite und Höhe beziehungsweise Seitenverhältnis sind festgelegt, sodass keine vermeidbaren Layoutverschiebungen entstehen.
- [ ] `MEDIA-IMG-05` Unmittelbar sichtbare LCP-Medien werden rechtzeitig geladen; nicht sichtbare Medien laden verzögert, ohne wichtige Interaktionen unnötig warten zu lassen.
- [ ] `MEDIA-IMG-06` Dynamische Bildtransformationen wurden im Produktionsdeployment auf Format, Maße, Qualität, Cacheheader und Verhalten nach Neustart beziehungsweise Redeployment geprüft. Ein erfolgreicher lokaler Build genügt nicht.

### Netzwerk- und Interaktionsverhalten

- [ ] `MEDIA-PERF-01` Transfer und Requestanzahl wurden getrennt für Initialaufruf, ersten Scroll, Galerie-/Dialogöffnung und weitere wesentliche Interaktionen betrachtet. Später gestartete Transfers werden nicht allein deshalb akzeptiert, weil ein Initial-Lighthouse-Lauf sie nicht erfasst.
- [ ] `MEDIA-PERF-02` Preload-, Idle-, Scroll- und Proximity-Ladestrategien besitzen ein nachvollziehbares Budget und laden nicht ohne fachlichen Grund ganze Originalbestände.
- [ ] `MEDIA-PERF-03` Große Galerien öffnen ohne leere, unscharfe oder unsichtbare Zwischenzustände; Vor- und Zurücknavigation, direktes Anspringen und wiederholtes Öffnen funktionieren.
- [ ] `MEDIA-PERF-04` Bilder und Einbettungen wurden mit echten GET-Abrufen beziehungsweise im Browser geprüft, wenn HEAD-Anfragen das tatsächliche Transformations- oder Cacheverhalten nicht zuverlässig abbilden.

### Video und Audio

- [ ] `MEDIA-VID-01` Videos besitzen sinnvolle Auflösung, Bitrate, Laufzeit und Dateigröße sowie Posterbild und verständliche Bedienung.
- [ ] `MEDIA-VID-02` Inhaltlich erforderliche Untertitel, Transkripte oder gleichwertige Textalternativen sind vorhanden.
- [ ] `MEDIA-VID-03` Große Videos oder Audiodateien werden nicht ohne fachlichen Grund automatisch vollständig geladen; Autoplay mit Ton wird nicht eingesetzt.

### Animation und dynamische Zustände

- [ ] `MEDIA-MOT-01` Animationen verdecken keine wesentlichen Inhalte bis zur JavaScriptinitialisierung und entfernen unsichtbare Bedienelemente aus Fokus- und Accessibility-Reihenfolge.
- [ ] `MEDIA-MOT-02` Unter `prefers-reduced-motion: reduce` entfallen wesentliche Entrance-, Scroll-, Parallax-, Smooth-Scroll- und Kreuzblendeeffekte oder werden durch diskrete Zustände ersetzt; der vollständige Inhalt bleibt sichtbar.
- [ ] `MEDIA-MOT-03` Saisonale, responsive, zufällige oder anderweitig dynamisch ersetzte Medien wurden über mehrere Zustandswechsel vorwärts und rückwärts geprüft; Observer, Lazy Loading, Fokus und Dialogzuordnung bleiben intakt.
