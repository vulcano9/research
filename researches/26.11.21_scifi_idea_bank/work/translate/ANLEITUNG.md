# Übersetzung der Sci-Fi-Ideen ins Deutsche

Projektordner (in Anführungszeichen setzen, der Pfad enthält Leerzeichen und `!`):
"/media/ziu/12 TB IronWolf/!_Alle_Coding_Projekte/Deep-Research_Opus/researches/26.11.21_scifi_idea_bank"

## Eingabe

`work/translate/in/chunk_NN.json` – ein JSON-Array. Jede Zeile:

```json
{"id": 1, "n": "Astronaut Sleep", "d": "The idea that there is a benefit to ...", "w": "...", "p": "...", "x": "..."}
```

- `n` = Name der Idee (kurz, wie eine Überschrift)
- `d` = Beschreibung der Idee aus dem Roman
- `w` = wer es gebaut hat (Firma, Organisation, Gruppe) – nur manchmal vorhanden
- `p` = echtes Produkt – nur manchmal vorhanden
- `x` = Hinweis/Notiz – nur manchmal vorhanden

## Ausgabe

`work/translate/out/chunk_NN.json` – ein JSON-Array mit **genau denselben ids und genau denselben Feldern** wie die Eingabe, nur die Texte auf Deutsch. Nichts weglassen, nichts hinzufügen.

```json
{"id": 1, "n": "Schlaf für Astronauten", "d": "Die Idee, dass es Vorteile hat, Astronauten während der Raumfahrt schlafen zu lassen.", ...}
```

**Schreibe die Ausgabe in Teilen**, damit keine Datei zu groß wird: je ca. 60 Zeilen pro Datei, benannt
`out/chunk_NN_a.json`, `out/chunk_NN_b.json`, `out/chunk_NN_c.json`, `out/chunk_NN_d.json` (in Reihenfolge der Eingabe). Jede Teildatei ist ein eigenes gültiges JSON-Array. Lies die Eingabe abschnittsweise mit dem Read-Tool (offset/limit), übersetze selbst (kein Skript, keine Online-Übersetzer, keine Platzhalter) und schreibe jede Teildatei mit dem Write-Tool.

## Regeln für die Übersetzung

1. **Einfaches, natürliches Deutsch.** Kurze Sätze. Keine wörtliche Übersetzung, wenn sie holprig klingt. Bedeutung genau erhalten, nichts erfinden, nichts weglassen.
2. **Namen (`n`)**: kurz und griffig, wie ein deutscher Fachbegriff oder Buchtitel-Begriff. Etablierte deutsche Begriffe nutzen (z. B. „Space Elevator“ → „Weltraumlift“, „Ray Gun“ → „Strahlenpistole“, „Teleportation“ → „Teleportation“, „Robot“ → „Roboter“). Erfundene Eigennamen aus Romanen (z. B. „Tricorder“, „Babel Fish“, „Ansible“, „Psychohistory“) bleiben im Original, ggf. mit eingedeutschter Schreibweise, wenn üblich („Psychohistorik“).
3. **Eigennamen bleiben**: Personen, Firmen, Marken, Organisationen, Romanfiguren, Planeten, Schiffsnamen (NASA, SpaceX, 3M, AT&T, Apple, Mars, Nostromo …) nicht übersetzen.
4. **Zitate im Original** (in Anführungszeichen) sinngemäß übersetzen.
5. **Anführungszeichen**: Im Text deutsche Anführungszeichen „…“ benutzen. **Niemals** ein ungeschütztes gerades `"` innerhalb eines JSON-Strings – sonst ist das JSON kaputt. Apostroph `'` ist erlaubt.
6. **Einheiten** beibehalten (Meilen, Fuß dürfen bleiben; optional in Klammern umrechnen ist nicht nötig).
7. Kein Markdown, keine Zeilenumbrüche in den Texten.

## Prüfen (Pflicht)

Nach jeder fertigen Chunk-Nummer im Projektordner ausführen:

```bash
python3 work/translate/check.py NN
```

Es muss `chunk NN: OK` erscheinen. Bei FEHLER die genannten Zeilen in den Teildateien reparieren und erneut prüfen. Fertig ist ein Chunk erst bei OK.

Ändere keine anderen Dateien als deine eigenen `out/chunk_NN*.json`.
