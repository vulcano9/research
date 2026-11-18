# Deep Research

Sammlung meiner Forschungsberichte. Jeder Bericht ist eine einzelne HTML-Datei. Sie läuft offline, JavaScript ist eingebettet und es werden keine Bibliotheken nachgeladen.

**Online ansehen:** https://vulcano9.github.io/research/

## Berichte

| Datum | Thema | Bericht |
| --- | --- | --- |
| 18.11.2026 | Manuelle Flockenquetsche für Haferflocken (Produktsuche) | [bericht.html](researches/26.11.18_flockenquetsche_haferflocken/bericht.html) |
| 18.11.2026 | Balance Board für Plattfüße (Produktsuche) | [bericht.html](researches/26.11.18_balance_board_plattfuesse/bericht.html) |
| 18.11.2026 | 3D-Druck-Fußgewölbetrainer gegen Plattfüße (Produktsuche) | [bericht.html](researches/26.11.18_3d_druck_fussgewoelbetrainer/bericht.html) |
| 17.11.2026 | Alle Business-Ideen von Chris Koerner (350 Videos) | [bericht.html](researches/26.11.17_chris_koerner_business_ideas/bericht.html) |
| 12.11.2026 | Wie wird man laut Paul Graham reich? | [bericht.html](researches/26.11.12_paul_graham_reichtum/bericht.html) |
| 12.11.2026 | James Altucher: Wie wird man reich? | [bericht.html](researches/26.11.12_james_altucher_reichtum/bericht.html) |

## Aufbau

```
.
├── index.html                      Übersichtsseite mit Suchfeld, nach Kategorien gegliedert
├── motivation/index.html           Motivationsseite: Bilder aus motivation/ als Grid
├── .nojekyll                       GitHub Pages ohne Jekyll
├── .gitignore
└── researches/
    └── <jj.mm.tt>_<kurzer_titel>/
        ├── bericht.html            fertiger Bericht
        └── sources/                heruntergeladene Quellen (nicht im Repo)
```

Der Ordnername folgt dem Muster `<jj.mm.tt>_<kurzer_titel>`. Beispiel: `26.11.12_paul_graham_reichtum`.

## Was im Repo liegt und was nicht

Veröffentlicht werden `index.html` und die `bericht.html` jedes Berichts.

Über `.gitignore` bleiben lokal:
- `researches/*/sources/`: heruntergeladene Quellen. Sie können urheberrechtlich geschützt sein.
- `AGENTS.md`, `.kilo/`, `kilo.json`: Konfiguration der Agenten.

In den Berichten stehen die Quellen mit URL. Die lokale Kopie unter `sources/` gibt es nur auf meinem Rechner.

## Neuen Bericht veröffentlichen

1. Bericht und Quellen im neuen Ordner unter `researches/` ablegen.
2. In `index.html` einen weiteren `<li>`-Eintrag ergänzen (Datum, Titel, Link).
3. In dieser README die Tabelle oben ergänzen.
4. Veröffentlichen:

```bash
git add .
git commit -m "Neuer Bericht: <Titel>"
git push
```

GitHub Pages baut die Seite danach neu. Das dauert etwa eine Minute.

## Hinweis zu Git

Liegt das Projekt auf einem Laufwerk, das `root` gehört, meldet Git `dubious ownership`. Dann einmalig ausführen:

```bash
git config --global --add safe.directory '/media/ziu/12 TB IronWolf/!_Alle_Coding_Projekte/Deep-Research_Opus'
```
