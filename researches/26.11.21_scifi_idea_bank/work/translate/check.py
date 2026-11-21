#!/usr/bin/env python3
"""Check translated chunks against their inputs and (optionally) merge them.

  python3 work/translate/check.py 07        # check one chunk
  python3 work/translate/check.py all       # check every chunk
  python3 work/translate/check.py merge     # check all + write work/translate/de.json

An output chunk may be one file (out/chunk_07.json) or several parts
(out/chunk_07_a.json, out/chunk_07_b.json, ...). Parts are concatenated in
name order.
"""
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
IN = os.path.join(HERE, "in")
OUT = os.path.join(HERE, "out")

EN_HINTS = re.compile(r"\b(the|and|which|with|that|from|this|would|could|into|their|there|was|were)\b", re.I)


def load_out(num):
    single = os.path.join(OUT, "chunk_%s.json" % num)
    parts = sorted(glob.glob(os.path.join(OUT, "chunk_%s_*.json" % num)))
    files = [single] if os.path.exists(single) else parts
    rows = []
    for f in files:
        with open(f, encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, list):
            raise ValueError("%s: top level must be a JSON array" % os.path.basename(f))
        rows.extend(data)
    return files, rows


def check(num):
    with open(os.path.join(IN, "chunk_%s.json" % num), encoding="utf-8") as fh:
        src = json.load(fh)
    try:
        files, out = load_out(num)
    except Exception as exc:
        return False, ["chunk %s: cannot read output: %s" % (num, exc)], {}
    problems = []
    if not files:
        return False, ["chunk %s: no output file" % num], {}
    by_id = {}
    for r in out:
        if not isinstance(r, dict) or "id" not in r:
            problems.append("row without id: %r" % (r,)[:80])
            continue
        if r["id"] in by_id:
            problems.append("duplicate id %s" % r["id"])
        by_id[r["id"]] = r
    english = 0
    for s in src:
        t = by_id.get(s["id"])
        if t is None:
            problems.append("missing id %s" % s["id"])
            continue
        for k in s:
            if k == "id":
                continue
            v = t.get(k)
            if s[k] and (not isinstance(v, str) or not v.strip()):
                problems.append("id %s: field %s empty/missing" % (s["id"], k))
        extra = set(t) - set(s)
        if extra:
            problems.append("id %s: unexpected fields %s" % (s["id"], sorted(extra)))
        d = t.get("d") or ""
        if len(EN_HINTS.findall(d)) >= 3:
            english += 1
            if english <= 5:
                problems.append("id %s: description still looks English: %s" % (s["id"], d[:70]))
    extra_ids = set(by_id) - {s["id"] for s in src}
    if extra_ids:
        problems.append("ids not in input: %s" % sorted(extra_ids)[:10])
    return not problems, problems, by_id


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else "all"
    nums = sorted(re.findall(r"chunk_(\d+)\.json", " ".join(os.listdir(IN))))
    if arg not in ("all", "merge"):
        nums = [arg.zfill(2)]
    merged = {}
    ok_all = True
    for n in nums:
        ok, problems, rows = check(n)
        ok_all = ok_all and ok
        print("chunk %s: %s" % (n, "OK (%d rows)" % len(rows) if ok else "FEHLER"))
        for p in problems[:25]:
            print("   - " + p)
        if len(problems) > 25:
            print("   ... %d more" % (len(problems) - 25))
        for i, r in rows.items():
            merged[str(i)] = {k: v for k, v in r.items() if k != "id"}
    if arg == "merge":
        if not ok_all:
            print("Merge abgebrochen: nicht alle Chunks sind OK.")
            return 1
        gpath = os.path.join(OUT, "glossary.json")
        with open(os.path.join(IN, "glossary.json"), encoding="utf-8") as fh:
            gsrc = json.load(fh)
        with open(gpath, encoding="utf-8") as fh:
            gout = json.load(fh)
        missing = [g for g in gsrc if not str(gout.get(g, "")).strip()]
        if missing:
            print("Glossar: %d Einträge fehlen, z. B. %s" % (len(missing), missing[:5]))
            return 1
        doc = {"ideas": merged, "glossary": {g: gout[g] for g in gsrc}}
        with open(os.path.join(HERE, "de.json"), "w", encoding="utf-8") as fh:
            json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
        print("de.json geschrieben: %d Ideen, %d Glossar-Einträge" % (len(merged), len(gsrc)))
    return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main())
