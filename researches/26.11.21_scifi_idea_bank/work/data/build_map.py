#!/usr/bin/env python3
"""Baut die semantische 2D-Karte der Sci-Fi-Ideenbank.

Erzeugt:
  work/data/map.json            Karte, Cluster, Nachbarn (kompakt)
  work/data/cluster_samples.md  Stichproben je Cluster (zum Benennen)

Lauf (aus dem Projektordner):
  ~/.local/bin/uv run --python 3.12 \
    --with sentence-transformers --with umap-learn --with scikit-learn \
    --index https://download.pytorch.org/whl/cpu --index https://pypi.org/simple \
    python3 work/data/build_map.py
"""
from __future__ import annotations

import json
import random
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
BASE = HERE.parent.parent
SRC = BASE / "sources" / "_ideas.json"

MODEL_LOCAL = Path.home() / (
    ".cache/huggingface/hub/models--unsloth--bge-small-en-v1.5/"
    "snapshots/7382f1122c10708a1faa0bbe548674a14b1ffe7e"
)
MODEL_NAME = "BAAI/bge-small-en-v1.5"

K = 24                 # Cluster
N_NEIGHBORS = 8        # Nachbarn je Idee
N_CORE = 15            # Kern-Ideen je Cluster
N_RANDOM = 10          # zusaetzliche Zufallsmitglieder je Cluster
N_TERMS = 12           # Top-Begriffe je Cluster
N_CATS = 12            # Top-Kategorien je Cluster
SEED = 42
SPAN = 10000


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def idea_text(idea: dict) -> str:
    parts = [f"{idea['n']}. {idea['d']}".strip()]
    product = (idea.get("p") or "").strip()
    if product:
        parts.append(f"Product: {product}")
    return " ".join(p for p in parts if p).strip()


def load_ideas() -> list[dict]:
    with SRC.open(encoding="utf-8") as fh:
        data = json.load(fh)
    ideas = data["ideas"]
    log(f"{len(ideas)} Ideen geladen aus {SRC}")
    return ideas


def embed(texts: list[str]) -> np.ndarray:
    from sentence_transformers import SentenceTransformer

    model_path = str(MODEL_LOCAL) if MODEL_LOCAL.exists() else MODEL_NAME
    log(f"Lade Modell: {model_path}")
    model = SentenceTransformer(model_path)
    log("Erzeuge Embeddings ...")
    emb = model.encode(
        texts,
        batch_size=64,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=True,
    )
    emb = np.asarray(emb, dtype=np.float32)
    assert emb.shape == (len(texts), emb.shape[1]), emb.shape
    log(f"Embeddings: {emb.shape}")
    return emb


def nearest_neighbors(emb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Top-8-Nachbarn (ohne sich selbst), Kosinus, absteigend."""
    n = emb.shape[0]
    idx = np.empty((n, N_NEIGHBORS), dtype=np.int32)
    sims = np.empty((n, N_NEIGHBORS), dtype=np.float32)
    log("Berechne Aehnlichkeitsmatrix ...")
    sim = emb @ emb.T  # normiert => Kosinus
    np.fill_diagonal(sim, -2.0)
    for i in range(n):
        row = sim[i]
        cand = np.argpartition(-row, N_NEIGHBORS - 1)[:N_NEIGHBORS]
        order = np.lexsort((cand, -row[cand]))
        cand = cand[order]
        idx[i] = cand
        sims[i] = row[cand]
    log("Nachbarn fertig")
    return idx, sims


def cluster(emb: np.ndarray) -> np.ndarray:
    from sklearn.cluster import KMeans

    log(f"KMeans k={K} ...")
    km = KMeans(n_clusters=K, n_init=10, random_state=SEED)
    raw = km.fit_predict(emb)
    counts = Counter(int(c) for c in raw)
    # absteigend nach Groesse; Gleichstand: kleinere alte ID zuerst
    order = sorted(counts, key=lambda c: (-counts[c], c))
    remap = {old: new for new, old in enumerate(order)}
    cl = np.array([remap[int(c)] for c in raw], dtype=np.int32)
    log(f"Cluster: {[counts[o] for o in order]}")
    return cl


def project(emb: np.ndarray) -> np.ndarray:
    import umap

    log("UMAP 2D ...")
    reducer = umap.UMAP(
        n_neighbors=15,
        min_dist=0.12,
        metric="cosine",
        random_state=SEED,
    )
    xy = reducer.fit_transform(emb).astype(np.float64)
    lo = xy.min(axis=0)
    hi = xy.max(axis=0)
    span = float((hi - lo).max())
    scale = SPAN / span if span > 0 else 1.0
    center = (lo + hi) / 2.0
    scaled = (xy - center) * scale + SPAN / 2.0
    out = np.clip(np.rint(scaled), 0, SPAN).astype(np.int32)
    log(f"2D: x {out[:,0].min()}..{out[:,0].max()}  y {out[:,1].min()}..{out[:,1].max()}")
    return out


def cluster_terms(ideas: list[dict], cl: np.ndarray) -> list[list[str]]:
    from sklearn.feature_extraction.text import TfidfVectorizer

    docs = [f"{i['n']} {i['d']}" for i in ideas]
    log("TF-IDF ...")
    vec = TfidfVectorizer(
        stop_words="english",
        lowercase=True,
        token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z\-]{2,}\b",
        min_df=2,
        sublinear_tf=True,
    )
    mat = vec.fit_transform(docs)
    vocab = np.array(vec.get_feature_names_out())
    result: list[list[str]] = []
    for c in range(K):
        rows = np.flatnonzero(cl == c)
        mean = np.asarray(mat[rows].mean(axis=0)).ravel()
        top = np.lexsort((vocab, -mean))[:N_TERMS]
        terms = [str(vocab[t]) for t in top if mean[t] > 0]
        result.append(terms)
    return result


def build_clusters(ideas, emb, cl, pos, terms) -> list[dict]:
    n = len(ideas)
    years = np.array([int(i["y"]) for i in ideas], dtype=np.float64)
    built = np.array([1 if i.get("b") == "Yes" else 0 for i in ideas], dtype=np.float64)
    clusters = []
    for c in range(K):
        members = np.flatnonzero(cl == c)
        size = int(members.size)
        cats = Counter()
        for m in members:
            for lab in ideas[int(m)].get("c") or []:
                cats[str(lab)] += 1
        cat_list = sorted(cats.items(), key=lambda kv: (-kv[1], kv[0]))[:N_CATS]
        centroid = emb[members].mean(axis=0)
        dot = emb[members] @ centroid
        core_order = np.lexsort((members, -dot))[: min(N_CORE, size)]
        core = [int(members[t]) for t in core_order]
        cx = int(round(float(pos[members, 0].mean())))
        cy = int(round(float(pos[members, 1].mean())))
        clusters.append(
            {
                "id": c,
                "size": size,
                "cx": cx,
                "cy": cy,
                "built": round(float(built[members].mean()), 2),
                "year": int(round(float(years[members].mean()))),
                "cats": [[lab, int(cnt)] for lab, cnt in cat_list],
                "terms": terms[c],
                "core": core,
            }
        )
    assert sum(c["size"] for c in clusters) == n
    return clusters


def write_samples(ideas, cl, clusters) -> None:
    rng = random.Random(SEED)
    lines = [
        "# Cluster-Stichproben",
        "",
        f"{len(ideas)} Ideen, {K} Cluster, Modell `bge-small-en-v1.5`.",
        "Die 15 Kern-Ideen liegen dem Embedding-Zentroid am naechsten;",
        f"dazu {N_RANDOM} zufaellige weitere Mitglieder (seed {SEED}).",
        "",
    ]
    for c in clusters:
        members = [int(m) for m in np.flatnonzero(cl == c["id"])]
        core = set(c["core"])
        rest = [m for m in members if m not in core]
        extra = rng.sample(rest, min(N_RANDOM, len(rest)))
        cats = ", ".join(f"{lab} ({cnt})" for lab, cnt in c["cats"])
        years = [ideas[m]["y"] for m in members]
        lines += [
            f"## Cluster {c['id']} - {c['size']} Ideen",
            "",
            f"- Groesse: {c['size']}",
            f"- Anteil gebaut (b=Yes): {c['built']:.0%}",
            f"- Mittleres Jahr: {c['year']} (Spanne {min(years)}-{max(years)})",
            f"- Top-Kategorien: {cats}",
            f"- Top-Begriffe: {', '.join(c['terms'])}",
            "",
            "### Kern-Ideen (nahe am Zentroid)",
            "",
        ]
        for m in c["core"]:
            idea = ideas[m]
            desc = (idea.get("d") or "").replace("\n", " ").strip()[:90]
            lines.append(f"- {idea['n']} ({idea['y']}) - {desc}")
        lines += ["", f"### Weitere Mitglieder (Zufall, seed {SEED})", ""]
        for m in extra:
            idea = ideas[m]
            desc = (idea.get("d") or "").replace("\n", " ").strip()[:90]
            lines.append(f"- {idea['n']} ({idea['y']}) - {desc}")
        lines.append("")
    (HERE / "cluster_samples.md").write_text("\n".join(lines), encoding="utf-8")
    log(f"cluster_samples.md: {(HERE / 'cluster_samples.md').stat().st_size:,} Bytes")


def write_readme() -> None:
    text = f"""# Semantische Karte der Sci-Fi-Ideenbank

`map.json` enthaelt die vorberechnete 2D-Karte fuer die Sternenkarte:

- `pos`: 2*n Ganzzahlen 0..10000 (x0,y0,x1,y1,...), gleiches Seitenverhaeltnis, zentriert.
- `cl`: n Cluster-IDs 0..{K - 1}, nach Groesse absteigend (0 = groesster).
- `nn`: 8*n Nachbar-Indizes (Indizes im Ideen-Array, nicht `id`), je Idee 8 Stueck.
- `nns`: 8*n Kosinus-Aehnlichkeiten als Ganzzahl (`round(sim*100)`, z. B. 87).
- `clusters`: je Cluster `size`, `cx`/`cy`, `built` (Anteil `b=="Yes"`), `year`
  (Mittel), `cats` (Top 12 mit Anzahl), `terms` (TF-IDF Top 12), `core`
  (15 Indizes nahe am Embedding-Zentroid).
- Reihenfolge aller Arrays = Reihenfolge der Ideen in `sources/_ideas.json`.

`cluster_samples.md` enthaelt je Cluster die Kennzahlen und Beispiel-Ideen
(Kern-Ideen + 10 Zufallsmitglieder, seed {SEED}); damit lassen sich deutsche
Cluster-Namen vergeben.

## Neuerzeugen

```bash
~/.local/bin/uv run --python 3.12 \\
  --with sentence-transformers --with umap-learn --with scikit-learn \\
  --index https://download.pytorch.org/whl/cpu --index https://pypi.org/simple \\
  python3 work/data/build_map.py
```

## Modell und Parameter

- Modell: `BAAI/bge-small-en-v1.5` (lokaler HF-Cache, 384 Dimensionen),
  Embeddings L2-normalisiert; Text = `n + ". " + d` (+ `" Product: " + p`).
- Nachbarn: Kosinus, Top {N_NEIGHBORS} ohne Selbsttreffer.
- Cluster: KMeans, k={K}, `n_init=10`, `random_state={SEED}`.
- Karte: UMAP `n_neighbors=15`, `min_dist=0.12`, `metric="cosine"`,
  `random_state={SEED}`; gemeinsame Skalierung beider Achsen auf 0..10000.
- Begriffe: TF-IDF (englische Stoppwoerter, `min_df=2`), Mittel je Cluster.
- Alles deterministisch ({SEED}).
"""
    (HERE / "README.md").write_text(text, encoding="utf-8")


def main() -> int:
    t0 = time.time()
    ideas = load_ideas()
    n = len(ideas)
    texts = [idea_text(i) for i in ideas]
    emb = embed(texts)
    idx, sims = nearest_neighbors(emb)
    cl = cluster(emb)
    pos = project(emb)
    terms = cluster_terms(ideas, cl)
    clusters = build_clusters(ideas, emb, cl, pos, terms)

    payload = {
        "version": 1,
        "model": "bge-small-en-v1.5",
        "n": n,
        "pos": pos.ravel().tolist(),
        "cl": cl.tolist(),
        "nn": idx.ravel().tolist(),
        "nns": [int(round(float(s) * 100)) for s in sims.ravel()],
        "clusters": clusters,
    }
    out = HERE / "map.json"
    out.write_text(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False),
        encoding="utf-8",
    )
    log(f"map.json: {out.stat().st_size:,} Bytes")

    write_samples(ideas, cl, clusters)
    write_readme()

    # ---- Pruefungen ----
    log("Pruefe Ausgabe ...")
    assert len(payload["pos"]) == 2 * n, "pos-Laenge"
    assert len(payload["cl"]) == n, "cl-Laenge"
    assert len(payload["nn"]) == N_NEIGHBORS * n, "nn-Laenge"
    assert len(payload["nns"]) == N_NEIGHBORS * n, "nns-Laenge"
    assert len(payload["clusters"]) == K, "Cluster-Anzahl"
    assert sum(c["size"] for c in payload["clusters"]) == n, "Cluster-Summe"
    assert all(0 <= v <= SPAN for v in payload["pos"]), "Koordinatenbereich"
    assert min(payload["cl"]) == 0 and max(payload["cl"]) == K - 1, "Cluster-IDs"
    nn = np.array(payload["nn"], dtype=np.int64).reshape(n, N_NEIGHBORS)
    assert not np.any(nn == np.arange(n)[:, None]), "Selbstnachbar"
    assert nn.min() >= 0 and nn.max() < n, "Nachbarbereich"
    nns = np.array(payload["nns"], dtype=np.int64).reshape(n, N_NEIGHBORS)
    assert np.all(np.diff(nns, axis=1) <= 0), "Nachbarn nicht absteigend"
    assert np.all((nns >= -100) & (nns <= 100)), "Aehnlichkeitsbereich"
    assert all(len(c["core"]) == min(N_CORE, c["size"]) for c in clusters), "core"
    assert all(len(c["terms"]) > 0 for c in clusters), "leere Begriffsliste"
    log(f"OK: {n} Ideen, {K} Cluster, {N_NEIGHBORS} Nachbarn, alles konsistent")
    log(f"Laufzeit: {time.time() - t0:.1f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
