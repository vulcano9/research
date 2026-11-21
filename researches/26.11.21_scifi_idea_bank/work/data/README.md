# Semantische Karte der Sci-Fi-Ideenbank

`map.json` enthaelt die vorberechnete 2D-Karte fuer die Sternenkarte:

- `pos`: 2*n Ganzzahlen 0..10000 (x0,y0,x1,y1,...), gleiches Seitenverhaeltnis, zentriert.
- `cl`: n Cluster-IDs 0..23, nach Groesse absteigend (0 = groesster).
- `nn`: 8*n Nachbar-Indizes (Indizes im Ideen-Array, nicht `id`), je Idee 8 Stueck.
- `nns`: 8*n Kosinus-Aehnlichkeiten als Ganzzahl (`round(sim*100)`, z. B. 87).
- `clusters`: je Cluster `size`, `cx`/`cy`, `built` (Anteil `b=="Yes"`), `year`
  (Mittel), `cats` (Top 12 mit Anzahl), `terms` (TF-IDF Top 12), `core`
  (15 Indizes nahe am Embedding-Zentroid).
- Reihenfolge aller Arrays = Reihenfolge der Ideen in `sources/_ideas.json`.

`cluster_samples.md` enthaelt je Cluster die Kennzahlen und Beispiel-Ideen
(Kern-Ideen + 10 Zufallsmitglieder, seed 42); damit lassen sich deutsche
Cluster-Namen vergeben.

## Neuerzeugen

```bash
~/.local/bin/uv run --python 3.12 \
  --with sentence-transformers --with umap-learn --with scikit-learn \
  --index https://download.pytorch.org/whl/cpu --index https://pypi.org/simple \
  python3 work/data/build_map.py
```

## Modell und Parameter

- Modell: `BAAI/bge-small-en-v1.5` (lokaler HF-Cache, 384 Dimensionen),
  Embeddings L2-normalisiert; Text = `n + ". " + d` (+ `" Product: " + p`).
- Nachbarn: Kosinus, Top 8 ohne Selbsttreffer.
- Cluster: KMeans, k=24, `n_init=10`, `random_state=42`.
- Karte: UMAP `n_neighbors=15`, `min_dist=0.12`, `metric="cosine"`,
  `random_state=42`; gemeinsame Skalierung beider Achsen auf 0..10000.
- Begriffe: TF-IDF (englische Stoppwoerter, `min_df=2`), Mittel je Cluster.
- Alles deterministisch (42).
