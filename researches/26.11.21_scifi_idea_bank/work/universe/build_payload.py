#!/usr/bin/env python3
"""Baut Payload und Bilder fuer das Ideen-Universum.

    python3 work/universe/build_payload.py

Schreibt payload.json und images.json neben dieses Skript und gibt einen
Bericht auf stdout aus.  Fehlt map.json, wird eine erkennbare
Platzhalterkarte erzeugt (mit lauter Warnung).
"""
from __future__ import annotations

import base64
import glob
import io
import json
import math
import os
import sys

BASE_DEFAULT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CATS = [
    ("Space Tech", "Raumfahrttechnik"),
    ("Engineering", "Ingenieurwesen"),
    ("Robotics", "Robotik"),
    ("Culture", "Kultur"),
    ("Medical", "Medizin"),
    ("Weapon", "Waffen"),
    ("Communication", "Kommunikation"),
    ("Computers", "Computer"),
    ("Vehicle", "Fahrzeuge"),
    ("Surveillance", "Überwachung"),
    ("Transportation", "Verkehr"),
    ("Displays", "Anzeigen"),
    ("Material", "Materialien"),
    ("Biology", "Biologie"),
    ("Lifestyle", "Alltag"),
    ("Living Space", "Wohnraum"),
    ("Spacecraft", "Raumschiffe"),
    ("Clothing", "Kleidung"),
    ("Media", "Medien"),
    ("Entertainment", "Unterhaltung"),
    ("Miscellaneous", "Sonstiges"),
    ("Manufacturing", "Fertigung"),
    ("Data Storage", "Datenspeicher"),
    ("Work", "Arbeit"),
    ("Warfare", "Kriegführung"),
    ("Armor", "Panzerung"),
    ("Security", "Sicherheit"),
    ("Travel", "Reisen"),
    ("Input Devices", "Eingabegeräte"),
]
CAT_EN = [c[0] for c in CATS]
CAT_DE = [c[1] for c in CATS]
CAT_INDEX = {en: i for i, en in enumerate(CAT_EN)}

STATUS_MAP = {"Yes": 1, "No": 0, "Partial": 2, "": 3}
BA_MAP = {"Bits": 1, "Atoms": 2, "Both": 3, "": 0}


# ---------------------------------------------------------------- Laden

def _load_json(path, default=None):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return default


def load_translation(base_dir, warnings):
    path = os.path.join(base_dir, "work", "translate", "de.json")
    data = _load_json(path)
    if data and isinstance(data.get("ideas"), dict):
        return data.get("ideas", {}), data.get("glossary", {})

    # Teildateien als Rueckfall
    ideas, glossary = {}, {}
    out_dir = os.path.join(base_dir, "work", "translate", "out")
    for chunk in sorted(glob.glob(os.path.join(out_dir, "chunk_*.json"))):
        part = _load_json(chunk, {})
        if isinstance(part, dict):
            ideas.update(part.get("ideas", part))
    gpath = os.path.join(out_dir, "glossary.json")
    g = _load_json(gpath, {})
    if isinstance(g, dict):
        glossary.update(g)
    if ideas:
        warnings.append("de.json fehlt – Teildateien aus work/translate/out/ benutzt.")
    else:
        warnings.append("Keine Uebersetzung gefunden – alles englisch.")
    return ideas, glossary


def _pick(idea_id, field, original, translations, glossary):
    entry = translations.get(str(idea_id)) or {}
    val = entry.get(field)
    if val:
        return val
    if original and original in glossary:
        return glossary[original]
    return original or ""


# ---------------------------------------------------------------- Platzhalterkarte

def placeholder_map(ideas, warnings):
    """Deterministische Ersatzkarte: Kategorie + Jahr, Nachbarn = Kategorie."""
    warnings.append(
        "map.json fehlt – PLATZHALTERKARTE aktiv (Kategorie + Jahr). "
        "Sobald work/data/map.json existiert, wird sie automatisch benutzt."
    )
    n = len(ideas)

    # 24 Sternbilder aus den 24 haeufigsten Hauptkategorien
    from collections import Counter
    counts = Counter()
    for idea in ideas:
        cats = idea.get("c") or []
        counts[cats[0] if cats else "Miscellaneous"] += 1
    top = [c for c, _ in counts.most_common(24)]
    while len(top) < 24:
        for en in CAT_EN:
            if en not in top:
                top.append(en)
                break
    cl_of_cat = {en: i for i, en in enumerate(top)}

    def main_cat(idea):
        cats = idea.get("c") or []
        for en in cats:
            if en in cl_of_cat:
                return en
        return top[-1]

    cl = []
    pos = []
    for i, idea in enumerate(ideas):
        cat = main_cat(idea)
        k = cl_of_cat[cat]
        cl.append(k)
        # Ring-Layout, leicht nach Jahr verschoben
        ang = 2 * math.pi * k / 24 + 0.35
        rad = 0.30 + 0.055 * math.sin(k * 1.7)
        year_t = max(0.0, min(1.0, (idea.get("y", 1900) - 1634) / 392.0))
        jx = math.sin(i * 12.9898) * 43758.5453
        jy = math.sin(i * 78.233) * 12345.6789
        jx = (jx - math.floor(jx)) - 0.5
        jy = (jy - math.floor(jy)) - 0.5
        radius = rad * (0.72 + 0.55 * year_t) + 0.02
        x = 0.5 + math.cos(ang) * radius + jx * 0.09
        y = 0.5 + math.sin(ang) * radius * 0.82 + jy * 0.09
        pos.extend([int(max(0, min(10000, x * 10000))), int(max(0, min(10000, y * 10000)))])

    # Nachbarn: 8 naechste Mitglieder derselben Kategorie
    nn, nns = [], []
    members = {}
    for i, k in enumerate(cl):
        members.setdefault(k, []).append(i)
    for i, k in enumerate(cl):
        pool = [j for j in members[k] if j != i]
        xi, yi = pos[2 * i], pos[2 * i + 1]
        pool.sort(key=lambda j: (pos[2 * j] - xi) ** 2 + (pos[2 * j + 1] - yi) ** 2)
        chosen = pool[:8]
        while len(chosen) < 8:
            chosen.append(i if not chosen else chosen[-1])
        nn.extend(chosen)
        for j in chosen:
            d = math.hypot(pos[2 * j] - xi, pos[2 * j + 1] - yi) / 10000.0
            nns.append(int(max(5, min(99, round((1 - d * 2.2) * 100)))))

    clusters = []
    for k, cat in enumerate(top):
        idxs = members.get(k, [])
        if not idxs:
            idxs = [0]
        cx = sum(pos[2 * i] for i in idxs) / len(idxs)
        cy = sum(pos[2 * i + 1] for i in idxs) / len(idxs)
        years = [ideas[i].get("y", 1950) for i in idxs]
        built = sum(1 for i in idxs if ideas[i].get("b") == "Yes") / max(1, len(idxs))
        cc = Counter()
        for i in idxs:
            for en in ideas[i].get("c") or []:
                cc[en] += 1
        core = sorted(idxs, key=lambda i: abs(ideas[i].get("y", 1950) - sum(years) / len(years)))[:15]
        clusters.append({
            "id": k, "size": len(idxs), "cx": int(cx), "cy": int(cy),
            "built": round(built, 3), "year": int(sum(years) / len(years)),
            "cats": [[en, c] for en, c in cc.most_common(12)],
            "terms": [cat.lower().split()[0]],
            "core": core,
        })

    return {"pos": pos, "cl": cl, "nn": nn, "nns": nns, "clusters": clusters,
            "placeholder": True}


# ---------------------------------------------------------------- Bilder

def _webp_data_uri(path, max_width, quality=70):
    try:
        from PIL import Image
    except Exception:
        return None, 0
    try:
        img = Image.open(path)
        img.load()
    except Exception:
        return None, 0
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    if img.width > max_width:
        h = max(1, round(img.height * max_width / img.width))
        img = img.resize((max_width, h), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality, method=6)
    raw = buf.getvalue()
    return "data:image/webp;base64," + base64.b64encode(raw).decode("ascii"), len(raw)


def build_images(base_dir, warnings):
    out = {}
    hero_path = os.path.join(base_dir, "work", "img", "hero.png")
    if os.path.exists(hero_path):
        uri, size = _webp_data_uri(hero_path, 1400, 70)
        if uri:
            out["hero"] = uri
    else:
        warnings.append("work/img/hero.png fehlt.")
    n_ok = 0
    for k in range(24):
        p = os.path.join(base_dir, "work", "img", "cluster_%02d.png" % k)
        if os.path.exists(p):
            uri, size = _webp_data_uri(p, 640, 70)
            if uri:
                out["cluster_%02d" % k] = uri
                n_ok += 1
    if n_ok < 24:
        warnings.append("Nur %d von 24 Sternbild-Bildern gefunden – Rest als Farbverlauf." % n_ok)
    return out, n_ok


# ---------------------------------------------------------------- Payload

def build_payload(base_dir):
    warnings = []
    ideas_src = _load_json(os.path.join(base_dir, "sources", "_ideas.json"), {"ideas": []})
    raw_ideas = ideas_src.get("ideas", [])
    translations, glossary = load_translation(base_dir, warnings)

    map_path = os.path.join(base_dir, "work", "data", "map.json")
    mp = _load_json(map_path)
    if not mp or not mp.get("pos") or len(mp.get("pos", [])) != 2 * len(raw_ideas):
        mp = placeholder_map(raw_ideas, warnings)
        map_source = "placeholder"
    else:
        map_source = "map.json"

    # Sternbild-Namen
    cde = _load_json(os.path.join(base_dir, "work", "data", "clusters_de.json"))
    by_id = {}
    if isinstance(cde, list):
        for entry in cde:
            if isinstance(entry, dict) and "id" in entry:
                by_id[int(entry["id"])] = entry
    elif isinstance(cde, dict):
        for key, entry in cde.items():
            if isinstance(entry, dict):
                by_id[int(entry.get("id", key))] = entry
    if not by_id:
        warnings.append("work/data/clusters_de.json fehlt – Ersatznamen „Sternbild 1 … 24“.")

    cats_count = {i: 0 for i in range(len(CAT_EN))}
    built_count = 0
    trans_n = trans_d = 0
    ideas_out = []

    for i, idea in enumerate(raw_ideas):
        iid = idea.get("id", i + 1)
        de = translations.get(str(iid), {}) or {}
        name = de.get("n") or idea.get("n", "")
        desc = de.get("d") or idea.get("d", "")
        if de.get("n"):
            trans_n += 1
        if de.get("d"):
            trans_d += 1
        b = STATUS_MAP.get(idea.get("b", ""), 3)
        if b == 1:
            built_count += 1
        cats = []
        for en in idea.get("c") or []:
            ci = CAT_INDEX.get(en)
            if ci is not None:
                cats.append(ci)
                cats_count[ci] += 1
        item = {
            "id": iid,
            "y": int(idea.get("y") or 0),
            "n": name,
            "ne": idea.get("n", ""),
            "d": desc,
            "de": idea.get("d", ""),
            "nv": idea.get("nv", ""),
            "a": idea.get("a", ""),
            "b": b,
            "ba": BA_MAP.get(idea.get("ba", ""), 0),
        }
        fyn = idea.get("fyn")
        if isinstance(fyn, int):
            item["fyn"] = fyn
        if idea.get("fy"):
            item["fy"] = idea["fy"]
        for key, src in (("w", "w"), ("p", "p"), ("x", "x")):
            val = _pick(iid, key, idea.get(src, ""), translations, glossary)
            if val:
                item[key] = val
        if idea.get("co"):
            item["co"] = idea["co"]
        if idea.get("tv"):
            item["tv"] = idea["tv"]
        item["c"] = cats
        ideas_out.append(item)

    # Cluster
    clusters_out = []
    for c in mp.get("clusters", []):
        k = int(c.get("id", len(clusters_out)))
        info = by_id.get(k, {})
        name = info.get("name") or ("Sternbild %d" % (k + 1))
        tagline = info.get("tagline") or ""
        text = info.get("text") or ""
        hue = info.get("hue")
        if not isinstance(hue, (int, float)):
            hue = (k * 15) % 360
        cats = []
        for pair in c.get("cats", []):
            if isinstance(pair, list) and pair and isinstance(pair[0], str):
                ci = CAT_INDEX.get(pair[0])
                if ci is not None:
                    cats.append([ci, int(pair[1])])
        core = [int(x) for x in c.get("core", []) if 0 <= int(x) < len(ideas_out)]
        entry = {
            "id": k,
            "name": name,
            "tagline": tagline,
            "text": text,
            "hue": int(hue) % 360,
            "size": int(c.get("size", 0)),
            "cx": int(c.get("cx", 5000)),
            "cy": int(c.get("cy", 5000)),
            "built": round(float(c.get("built", 0)), 3),
            "year": int(c.get("year", 1950)),
            "cats": cats,
            "terms": c.get("terms", [])[:8],
            "core": core,
        }
        # Kennzahlen selbst nachrechnen (robuster als die Datei)
        members = [i for i, cl in enumerate(mp["cl"]) if int(cl) == k]
        if members:
            entry["size"] = len(members)
            entry["built"] = round(sum(1 for i in members if ideas_out[i]["b"] == 1) / len(members), 3)
            entry["year"] = int(sum(ideas_out[i]["y"] for i in members) / len(members))
        clusters_out.append(entry)
    clusters_out.sort(key=lambda c: c["id"])

    payload = {
        "v": 1,
        "cats": CAT_DE,
        "catsEn": CAT_EN,
        "ideas": ideas_out,
        "pos": mp.get("pos", []),
        "cl": mp.get("cl", []),
        "nn": mp.get("nn", []),
        "nns": mp.get("nns", []),
        "clusters": clusters_out,
        "meta": {
            "n": len(ideas_out),
            "built": built_count,
            "mapSource": map_source,
            "namesDe": bool(by_id),
        },
    }
    if map_source == "placeholder":
        payload["ph"] = 1

    # Pruefungen
    nn = payload["nn"]
    nn_len_ok = len(nn) == 8 * len(ideas_out)
    nn_valid = nn_len_ok and all(0 <= int(x) < len(ideas_out) for x in nn)
    if not nn_len_ok:
        warnings.append("nn hat %d Eintraege statt %d." % (len(nn), 8 * len(ideas_out)))
    elif not nn_valid:
        warnings.append("nn enthaelt ungueltige Indizes.")
    if len(payload["pos"]) != 2 * len(ideas_out):
        warnings.append("pos passt nicht zur Ideenzahl.")
    if len(payload["cl"]) != len(ideas_out):
        warnings.append("cl passt nicht zur Ideenzahl.")

    images, n_images = build_images(base_dir, warnings)

    def dumps(obj):
        s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
        return s.replace("</", "<\\/")

    universe_json = dumps(payload)
    images_json = dumps(images)
    report = {
        "ideas": len(ideas_out),
        "clusters": len(clusters_out),
        "built": built_count,
        "translated_names": trans_n,
        "translated_descriptions": trans_d,
        "nn_entries": len(nn),
        "nn_valid": bool(nn_valid),
        "map_source": map_source,
        "clusters_de": bool(by_id),
        "images": {"hero": "hero" in images, "clusters": n_images},
        "payload_bytes": len(universe_json.encode("utf-8")),
        "images_bytes": len(images_json.encode("utf-8")),
        "cats": dict(zip(CAT_EN, cats_count.values())),
        "warnings": warnings,
    }
    return universe_json, images_json, report


def main():
    base = BASE_DEFAULT
    if len(sys.argv) > 1:
        base = os.path.abspath(sys.argv[1])
    universe_json, images_json, report = build_payload(base)
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "payload.json"), "w", encoding="utf-8") as fh:
        fh.write(universe_json)
    with open(os.path.join(here, "images.json"), "w", encoding="utf-8") as fh:
        fh.write(images_json)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    for w in report["warnings"]:
        print("WARNUNG: " + w, file=sys.stderr)
    expected = 4417
    if report["ideas"] != expected:
        print("WARNUNG: %d statt %d Ideen." % (report["ideas"], expected), file=sys.stderr)


if __name__ == "__main__":
    main()
