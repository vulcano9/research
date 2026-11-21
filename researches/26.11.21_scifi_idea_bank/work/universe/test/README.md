# Tests für das Ideen-Universum

Alle Skripte hier laufen ohne Netz und ohne Bibliothek im Projekt.
`puppeteer-core` wird **nicht** im Projekt installiert, sondern in einem
temporären Ordner.

## 1. Vorschau bauen

```bash
cd "/media/ziu/12 TB IronWolf/!_Alle_Coding_Projekte/Deep-Research_Opus/researches/26.11.21_scifi_idea_bank"
python3 work/universe/build_payload.py     # payload.json + images.json + Bericht
python3 work/universe/preview.py           # preview.html (ca. 6 MB)
```

## 2. Payload-Tests (Python, ohne Browser)

```bash
python3 work/universe/test/test_payload.py
```

Prüft 4.417 Ideen, 35.336 gültige Nachbarn, 24 Sternbilder, alle Bilder und
den Platzhalterpfad (fehlende `map.json`, `clusters_de.json` usw.) in einem
temporären Verzeichnis.

## 3. Browsertests (Headless-Chrome)

Einmalig Puppeteer in einem temporären Ordner bereitstellen:

```bash
mkdir -p /tmp/uvtest && cd /tmp/uvtest
npm init -y >/dev/null && npm install puppeteer-core@23 --no-audit --no-fund
```

Dann aus dem Projektordner:

```bash
cd "/media/ziu/12 TB IronWolf/!_Alle_Coding_Projekte/Deep-Research_Opus/researches/26.11.21_scifi_idea_bank"
CHROME=/usr/bin/google-chrome NODE_PATH=/tmp/uvtest/node_modules \
  node work/universe/test/run_tests.js
```

Geprüft werden:

- keine JS-Fehler in der Konsole
- `SFIB_UNIVERSE.openIdea(1)` und Drawer
- Suche „roboter“ (Treffer, 8 Vorschläge, Tastatur)
- Brücke zwischen zwei Ideen (kürzester Weg, Schritte klickbar)
- `applyFilter(...)` und Listenmodus
- `focusCluster(2)` mit Sternbild-Bild
- Klick auf einen Stern im Canvas
- Hash-Laden (`#idee=100&q=schlaf`)
- `prefers-reduced-motion`

## 4. Screenshots

```bash
CHROME=/usr/bin/google-chrome NODE_PATH=/tmp/uvtest/node_modules \
  node work/universe/test/shots.js
```

Schreibt nach `work/universe/test/`:

| Datei | Inhalt |
| --- | --- |
| `head-1440.png` | Kopf mit Hero-Bild |
| `gallery-1440.png` | Sternbilder-Galerie |
| `galaxy-1440.png` | Galaxie-Ansicht |
| `timeline-1440.png` | Zeitstrom |
| `wait-1440.png` | Wartezeit |
| `color-cluster-1440.png` | Färbung nach Sternbild |
| `drawer-1440.png` | Idee mit Zeitlinie |
| `search-1440.png` | Suche mit Vorschlägen |
| `bridge-1440.png` | Brücke mit Weg |
| `liste-1440.png` | Listenmodus |
| `sternbild-1440.png` | Sternbild-Drawer |
| `play-1440.png` | Zeitmaschine mitten in der Reise |
| `mobile-390.png` | Handy, Seitenanfang |
| `mobile-360.png` | kleinste Breite (360 px) |
| `mobile-galaxy-390.png` | Handy, Galaxie |
| `mobile-time-390.png` | Handy, Zeitstrom |
| `mobile-wait-390.png` | Handy, Wartezeit |
| `mobile-drawer-390.png` | Handy, Bottom-Sheet |
| `mobile-cluster-390.png` | Handy, Sternbild |
| `mobile-filters-390.png` | Handy, Filter aufgeklappt |
