# „Ideen-Universum“ – Spezifikation

Projektordner (immer in Anführungszeichen, der Pfad enthält Leerzeichen und `!`):
"/media/ziu/12 TB IronWolf/!_Alle_Coding_Projekte/Deep-Research_Opus/researches/26.11.21_scifi_idea_bank"

Der Bericht `bericht.html` wird von `work/build_html.py` aus `work/template.html` gebaut. Die bisherige Ideenliste (Abschnitt `#entdecken`) und der „Gründer-Modus“ (`#zufall`) werden durch ein **interaktives Ideen-Universum** ersetzt: Jede der 4.417 Ideen ist ein Stern. Ähnliche Ideen liegen nah beieinander (semantische Karte), Themen bilden „Sternbilder“ mit eigenem Bild.

Ziel: ein Erlebnis, das neugierig macht. Man soll sich treiben lassen, springen, vergleichen, durch die Zeit reisen können. Alles offline in einer HTML-Datei, kein externes Skript, keine Bibliothek, kein Netz.

Sprache der Oberfläche: einfaches Deutsch.

**Wichtig – nicht mehr anzeigen:** den Satz „Was müsste wahr sein, damit man das heute bauen kann?“ und „Die drei Fragen: Welche Technik fehlt? · Wer würde dafür zahlen? · Was wäre ein erster kleiner Schritt?“ (auch nicht die Box „Die drei Fragen“). Das kommt später.

---

## 1. Eingabedaten

| Datei | Inhalt |
| --- | --- |
| `sources/_ideas.json` | `{"ideas":[...]}` 4.417 Ideen, Felder: `id,y,n,nv,a,d,b,w,p,fy,fyn,x,ba,co,tv,c,s` (englisch). Index i = Position im Array. |
| `work/translate/de.json` | `{"ideas": {"<id>": {"n":..,"d":..,"w"?:..,"p"?:..,"x"?:..}}, "glossary": {"<englisch>": "<deutsch>"}}`. Für `w`,`p`,`x`: erst `ideas[id]`, sonst `glossary[englisch]`, sonst Original. **Kann während der Entwicklung fehlen oder unvollständig sein → dann englisch als Rückfall.** Solange de.json fehlt, darf der Builder Teildateien aus `work/translate/out/chunk_*.json` + `out/glossary.json` lesen. |
| `work/data/map.json` | `pos` (2n ints 0..10000), `cl` (n ints), `nn` (8n Indizes), `nns` (8n ints = Ähnlichkeit×100), `clusters[]` mit `id,size,cx,cy,built,year,cats,terms,core`. |
| `work/data/clusters_de.json` | `[{ "id":0, "name":"…", "tagline":"…", "text":"…", "hue": 210 }]` deutsche Sternbild-Namen. **Kann noch fehlen → Rückfall „Sternbild 1“ usw., hue = id*15.** |
| `work/img/cluster_NN.png` | Ein Bild pro Sternbild (NN = 00..23). **Kann fehlen → Rückfall: generierter Farbverlauf.** |
| `work/img/hero.png` | Hero-Hintergrundbild (quadratisch, dunkelblau, Buch, aus dem Sterne aufsteigen). |

Kategorien deutsch (fest im Builder):
Space Tech → Raumfahrttechnik, Engineering → Ingenieurwesen, Robotics → Robotik, Culture → Kultur, Medical → Medizin, Weapon → Waffen, Communication → Kommunikation, Computers → Computer, Vehicle → Fahrzeuge, Surveillance → Überwachung, Transportation → Verkehr, Displays → Anzeigen, Material → Materialien, Biology → Biologie, Lifestyle → Alltag, Living Space → Wohnraum, Spacecraft → Raumschiffe, Clothing → Kleidung, Media → Medien, Entertainment → Unterhaltung, Miscellaneous → Sonstiges, Manufacturing → Fertigung, Data Storage → Datenspeicher, Work → Arbeit, Warfare → Kriegführung, Armor → Panzerung, Security → Sicherheit, Travel → Reisen, Input Devices → Eingabegeräte.

## 2. Payload (vom Builder erzeugt)

`work/universe/build_payload.py` stellt eine Funktion `build_payload(base_dir) -> (universe_json_str, images_json_str, report_dict)` bereit und schreibt beim direkten Aufruf `work/universe/payload.json` und `work/universe/images.json`.

`sfib-universe` (eingebettet als `<script type="application/json" id="sfib-universe">`):

```json
{
  "v": 1,
  "cats": ["Raumfahrttechnik", "..."],            // deutsche Labels, Index = Kategorie-Nr.
  "catsEn": ["Space Tech", "..."],
  "ideas": [                                         // Reihenfolge = Index i = map.json-Reihenfolge
    {"id":1,"y":1634,"n":"Schlaf für Astronauten","ne":"Astronaut Sleep",
     "d":"…deutsch…","de":"…englisch…","nv":"Somnium","a":"Johannes Kepler",
     "b":0,            // 0 = nicht gebaut, 1 = gebaut, 2 = teilweise, 3 = unbekannt
     "ba":0,           // 0 = unbekannt, 1 = Bits, 2 = Atome, 3 = Beides
     "w":"…","p":"…","x":"…","fy":"1960s","fyn":1960,"co":"","tv":4006,"c":[0,4]}
  ],
  "pos": [...], "cl": [...], "nn": [...], "nns": [...],
  "clusters": [{"id":0,"name":"…","tagline":"…","text":"…","hue":210,"size":312,"cx":..,"cy":..,
                "built":0.31,"year":1961,"cats":[[catIdx,count],...],"core":[i,...]}]
}
```
Leere Felder weglassen (Größe sparen). `"</"` im JSON-String als `"<\/"` escapen.

`sfib-images` (eingebettet als `<script type="application/json" id="sfib-images">`): `{"hero":"data:image/webp;base64,…","cluster_00":"data:image/webp;base64,…",…}`. Bilder mit Pillow verkleinern: hero 1400 px breit, Qualität 70; Sternbilder 640 px breit, Qualität 70, WebP. Fehlende Bilder einfach weglassen.

Selbstprüfung im Builder: 4.417 Ideen, alle Indizes in `nn` gültig, Anzahl übersetzter Namen/Beschreibungen (Bericht als dict zurückgeben und ausgeben).

## 3. Modul-Dateien

- `work/universe/universe.html` – HTML-Fragment des Abschnitts `<section id="universum">…</section>` (ohne `<style>`/`<script>`).
- `work/universe/universe.css` – nur Selektoren unter `#universum` bzw. Präfix `.uv-` (keine Kollision mit dem Template).
- `work/universe/universe.js` – eine IIFE, `"use strict"`, liest `sfib-universe` und `sfib-images`. Exportiert `window.SFIB_UNIVERSE = { openIdea(id), focusCluster(k), applyFilter(obj), resetFilter(), scrollIntoView() }`.
- `work/universe/preview.py` – baut `work/universe/preview.html` (Fragment + CSS + JS + Payload + Bilder) zum Testen ohne den Rest der Seite.

Das Template bindet später ein: `__UNIVERSE_CSS__` im `<style>`, `__UNIVERSE_HTML__` an der Stelle von `#entdecken`/`#zufall`, `__UNIVERSE_JSON__`, `__IMAGES_JSON__`, `__UNIVERSE_JS__` als eigenes `<script>` nach dem Hauptskript.

## 4. Erlebnis

Der Abschnitt ist immer dunkel (Weltraum), egal ob Hell- oder Dunkelmodus der Seite. Typografie: Serif (`ui-serif, Georgia`) für Namen und Sternbilder, System-Sans für Bedienung, tabellarische Ziffern für Zahlen. Farben: tiefes Nachtblau `#060a1c`, Sterne: **gebaut = warmes Gold `#ffc766` mit Glühen**, nicht gebaut = kühles Weißblau `#a9c4ff`, unbekannt = gedämpftes Violettgrau `#8a86a8`, teilweise = Bernstein `#ff9f4a`.

### 4.1 Aufbau
- Kopf: Kicker „02 · Ideen-Universum“, Überschrift „Jede Idee ein Stern“, ein Satz Erklärung: „Ähnliche Ideen liegen nah beieinander. Gold leuchtet, was schon gebaut wurde.“
- Bühne: volle Breite, Höhe `min(86vh, 920px)`, mindestens 560 px. Darin ein `<canvas>` (devicePixelRatio beachten) und Overlays:
  - **Links oben – Steuerpult** (halbtransparentes Glas, einklappbar, auf dem Handy als Leiste unten): Suchfeld („Suche: Teleporter, Roboter, Mars …“), Treffer-Zahl, Chips Status (Gebaut / Nicht gebaut / Unbekannt), Chips Bits / Atome / Beides, Auswahl Kategorie (deutsch), Auswahl Autor:in (nach Häufigkeit), Knopf „Zurücksetzen“.
  - **Oben Mitte – Ansicht** (Segmented Control): „Galaxie“ · „Zeitstrom“ · „Wartezeit“. **Färbung**: „Status“ · „Bits/Atome“ · „Sternbild“ · „Alter“.
  - **Rechts – Schublade** (Drawer, 380 px, auf dem Handy Bottom-Sheet): Detail einer Idee oder eines Sternbilds (siehe 4.4).
  - **Unten – Zeitmaschine**: Play/Pause, Jahres-Slider 1634–2026, große Jahreszahl, Zähler „geschrieben: N · gebaut: M“.
  - **Rechts unten – Minikarte** (140×100) mit Rechteck für den sichtbaren Ausschnitt, klickbar.
  - **Unten links – Knöpfe**: „Überrasch mich“ (Zufallsstern, nur nicht gebaute, beachtet Filter), „Gedankenreise“, „Brücke bauen“, „Übersicht“ (Zoom zurück), „Liste“.
- Unter der Bühne: **Sternbilder-Galerie** (Abschnitt 4.6) und der **Listenmodus** (4.8).

### 4.2 Zeichnen
- Hintergrund: Verlauf + zufälliges Hintergrund-Sternenrauschen (einmal in Offscreen-Canvas vorgerendert, leicht Parallaxe beim Verschieben).
- Pro Sternbild ein weicher Nebel: mehrere radiale Verläufe in Sternbild-Farbe (`hue`), sehr transparent (Alpha ≤ 0.10), an den Positionen einer Stichprobe der Mitglieder. Einmal pro Ansicht in Offscreen-Canvas vorberechnen.
- Sterne: vorgerenderte Glow-Sprites je Farbe (Offscreen-Canvas, drawImage). Radius 1.6–3.2 px je nach Zoom; gebaute größer und mit Halo. Leichtes Funkeln (Sinus über Zeit, Phase je Stern) – **aus bei `prefers-reduced-motion`**. Zeichne nur, wenn sich etwas ändert oder eine Animation läuft (requestAnimationFrame mit Dirty-Flag), sonst Leerlauf.
- Gefilterte (nicht passende) Sterne: Alpha 0.07, keine Halos.
- Beschriftung: Bei Zoom < 1.8 die Sternbild-Namen am Schwerpunkt (Serif, Kapitälchen, Letterspacing, weiß 70 %). Ab Zoom ≥ 2.2 Ideen-Namen (deutsch) neben hellen/gebauten Sternen; Kollisionsvermeidung über ein grobes Raster (pro Zelle max. 1 Label). Ausgewählter Stern und Nachbarn immer beschriftet.
- Auswahl: Ringe um den Stern (pulsierend, außer reduced motion), Linien zu den 8 Nachbarn wie ein Sternbild (Alpha nach Ähnlichkeit), Nachbarn beschriftet.

### 4.3 Bedienung
- Ziehen = verschieben, Mausrad = zoomen um den Cursor (Zoom 0.6–40), Doppelklick = hineinzoomen, Pinch-Zoom und Ein-Finger-Pan auf Touch (Pointer Events). Tastatur auf der fokussierten Bühne: Pfeile verschieben, +/- zoomen, Esc schließt Drawer, `R` Zufallsstern.
- Hover: Tooltip mit deutschem Namen, Jahr, Status, Autor:in. Hit-Test über ein Raster (Grid-Buckets) in Weltkoordinaten, Radius 10 px Bildschirm.
- Klick: Idee auswählen, **Kamerafahrt** (ease-in-out, 700 ms) zum Stern mit passendem Zoom, Drawer öffnen.
- Der Hash wird aktualisiert: `#idee=<id>`, `#sternbild=<k>`, und Filter `#q=..&st=..&ba=..&cat=..&a=..` (URLSearchParams). Beim Laden wird ein solcher Hash angewendet (und zum Abschnitt gescrollt).

### 4.4 Drawer „Idee“
- Oben: Jahr der Geschichte groß (Serif, Gold, wenn gebaut), deutscher Name (Serif, groß), englischer Originalname klein darunter.
- „aus *Werk* von Autor:in“.
- Badges: Status, Bits/Atome, Sternbild (klickbar, mit Farbtupfer).
- Beschreibung deutsch; Umschalter „Original (Englisch) zeigen“.
- Falls gebaut: kleine **Zeitlinie**: Geschichte (Jahr) ──── Wartezeit N Jahre ──── erstmals gebaut (fy). Mit „Von wem“ und „Produkt“. Falls Baujahr < Jahr der Geschichte: Hinweis „vermutlich Datenfehler“.
- Hinweis-Feld (x), Kategorien (deutsch), Startup (co), Quelle.
- **Verwandte Ideen**: die 8 Nachbarn als Liste mit Ähnlichkeitsbalken und Status-Punkt; Klick = dorthin reisen. Darüber ein kleines Mini-Diagramm (SVG, 220×120) der Nachbarschaft: Mittelpunkt + 8 Punkte im Kreis, Abstand nach Ähnlichkeit.
- Knöpfe: „Als Start der Brücke“, „Als Ziel der Brücke“, „Bei Technovelgy lesen ↗“ (`http://www.technovelgy.com/ct/content.asp?Bnum=<tv>`), „Wer baut das heute? ↗“ (DuckDuckGo-Suche nach englischem Namen + „startup“), „Link kopieren“.
- Navigation „‹ vorherige / nächste ›“ durch den Verlauf der besuchten Ideen (Breadcrumbs der letzten 8 als kleine Chips).

### 4.5 Ansichten (Layouts) mit Morph
Wechsel animiert: alle Sterne gleiten 900 ms (easeInOutCubic) von alten zu neuen Positionen (bei reduced motion sofort).
- **Galaxie**: `pos` aus map.json.
- **Zeitstrom**: x = Jahr der Geschichte mit stückweiser Skala (1634–1880 → 0–18 %, 1880–2026 → 18–100 %), y = Band je Sternbild (24 Bahnen, nach mittlerem Jahr sortiert, Sternbild-Name links am Band), innerhalb des Bandes deterministisches Jitter (Hash der id). Jahrzehnt-Gitterlinien mit Beschriftung.
- **Wartezeit**: nur gebaute Ideen mit `fyn ≥ y`: x = Jahr der Geschichte, y = Wartezeit in Jahren (0 unten), Achsen beschriftet. Alle anderen Ideen sinken als dichtes „Meer der ungebauten Ideen“ in einen Streifen unter die Achse (x = Jahr, y = Jitter). Beschriftung: „Hier warten noch N Ideen“.
In allen Ansichten funktionieren Hover, Klick, Filter, Zeitmaschine.

### 4.6 Sternbilder
- Galerie unter der Bühne: Karten in einem Grid (auto-fill, min 220 px): Bild (aus `sfib-images`, sonst Verlauf in `hue`), Name, Tagline, „N Ideen · X % gebaut · Ø Jahr“, kleiner Balken gebaut/nicht gebaut. Hover: leichter Zoom des Bildes.
- Klick (auf Karte oder Sternbild-Label im Canvas): Kamera fliegt zum Sternbild, nur seine Sterne bleiben hell, Drawer zeigt **Sternbild-Ansicht**: großes Bild, Name, Text, Kennzahlen, Top-Kategorien als Balken, „Leitsterne“ (die `core`-Ideen) als klickbare Liste, Knopf „Zufällige ungebaute Idee aus diesem Sternbild“.

### 4.7 Erkundungs-Werkzeuge
- **Überrasch mich**: zufällige nicht gebaute Idee (beachtet aktive Filter), Kamerafahrt dorthin.
- **Gedankenreise** (Autopilot): Start bei der aktuellen oder einer zufälligen Idee; alle 3,5 s Sprung zum ähnlichsten noch nicht besuchten Nachbarn (bei Sackgasse: zufälliger Nachbar eines Nachbarn). Eine leuchtende Spur verbindet die besuchten Sterne. Drawer aktualisiert sich. Stopp bei jeder Nutzer-Interaktion oder Knopf „Reise anhalten“. Bei reduced motion: keine automatische Reise, stattdessen Knopf „Nächster Schritt“.
- **Brücke bauen**: Start und Ziel wählen (über Drawer-Knöpfe oder zwei Suchfelder mit Vorschlagsliste im Brücken-Panel). Kürzester Weg (BFS) im ungerichteten Nachbarschaftsgraph (`nn`). Weg als leuchtende Linie, die nacheinander aufgebaut wird; Panel listet die Schritte: „Von *Teleportation* zu *Kochroboter* in 5 Sprüngen“. Klick auf einen Schritt öffnet die Idee. Falls kein Weg: freundliche Meldung.
- **Zeitmaschine**: Slider setzt Jahr J. Sichtbar sind nur Ideen mit `y ≤ J` (andere ganz ausgeblendet); als gebaut leuchten nur Ideen mit `fyn ≤ J`. Play spielt in ca. 28 s von 1634 bis 2026 (stückweise Geschwindigkeit: vor 1880 schnell). Wenn eine Idee während des Abspielens „gebaut“ wird, kurzer goldener Blitz. Große Jahreszahl über der Bühne während des Abspielens. Knopf „Heute“ setzt auf 2026 (Standard).

### 4.8 Listenmodus (Barrierefreiheit)
Knopf „Liste“ blendet unter der Bühne eine Liste der aktuell gefilterten Ideen ein (Karten-Grid, je 60 per „Mehr laden“, sortierbar: Jahr ↓, Jahr ↑, Name, längste Wartezeit). Jede Karte: Jahr, deutscher Name, Werk · Autor:in, 2 Zeilen deutscher Beschreibung, Status-Badge, Sternbild-Punkt. Klick → Idee im Universum öffnen und hochscrollen. Tastaturbedienbar (Enter/Space).

### 4.9 Suche
Durchsucht deutsch **und** englisch: Name, Beschreibung, Werk, Autor:in, Produkt, Von wem, Firma, Kategorien. Groß/Klein und Akzente egal (`normalize("NFD")` ohne Diakritika), mehrere Wörter = UND. Beim Tippen (debounce 120 ms): Treffer hell, Rest dunkel, Zähler; Vorschlagsliste mit den ersten 8 Treffern (Pfeiltasten + Enter = hinfliegen).

### 4.10 API für den Rest der Seite
`window.SFIB_UNIVERSE`:
- `openIdea(id)` – Idee per **id** (nicht Index) öffnen, zum Abschnitt scrollen.
- `focusCluster(k)`
- `applyFilter({q, status:["Yes","No","Partial",""], ba:["Bits","Atoms","Both"], cat:"Space Tech" (englisch), author, from, to})` – setzt Filter, öffnet Listenmodus, scrollt zum Abschnitt.
- `resetFilter()`

## 5. Qualität
- Kein externes Laden, keine `fetch`, keine Bibliothek. Läuft per `file://`.
- 60 fps beim Pan/Zoom auf einem normalen Laptop mit 4.417 Sternen. Kein Dauer-Rendering im Leerlauf (außer leichtem Funkeln mit max. 30 fps, aus bei reduced motion oder wenn Bühne nicht sichtbar – IntersectionObserver).
- Responsive: ab 360 px Breite benutzbar (Steuerpult einklappbar, Drawer als Bottom-Sheet).
- `aria-label` für Canvas, Fokusringe, `aria-live` für Trefferzahl, alle Knöpfe echte `<button>`.
- Keine Konsolenfehler. Fehler sichtbar melden (kleine Box), nicht still schlucken.
- Kommentare sparsam.
