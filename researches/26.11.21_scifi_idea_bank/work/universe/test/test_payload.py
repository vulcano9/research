#!/usr/bin/env python3
"""Prueft Payload und Bilder des Ideen-Universums (ohne Browser).

    python3 work/universe/test/test_payload.py

Baut den Payload frisch, prueft die Zaehlungen und testet zusaetzlich den
Platzhalterpfad (fehlende map.json/clusters_de.json/Bilder) in einem
temporaeren Verzeichnis.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
UNIVERSE = os.path.dirname(HERE)
BASE = os.path.dirname(os.path.dirname(UNIVERSE))
sys.path.insert(0, UNIVERSE)

from build_payload import build_payload  # noqa: E402

fails = []


def check(name, ok, extra=""):
    print(("PASS " if ok else "FAIL ") + name + ((" " + str(extra)) if extra else ""))
    if not ok:
        fails.append(name)


def main():
    universe_json, images_json, report = build_payload(BASE)
    data = json.loads(universe_json)
    images = json.loads(images_json)

    check("4417 Ideen", report["ideas"] == 4417, report["ideas"])
    check("24 Sternbilder", report["clusters"] == 24, report["clusters"])
    check("nn vollstaendig und gueltig", report["nn_valid"] and report["nn_entries"] == 35336,
          report["nn_entries"])
    check("echte Karte benutzt", report["map_source"] == "map.json", report["map_source"])
    check("deutsche Sternbildnamen", report["clusters_de"] is True)
    check("alle Uebersetzungen", report["translated_names"] == 4417,
          report["translated_names"])
    check("Hero-Bild", report["images"]["hero"] is True)
    check("24 Sternbild-Bilder", report["images"]["clusters"] == 24,
          report["images"]["clusters"])
    check("keine Warnungen", not report["warnings"], report["warnings"])

    check("pos-Laenge", len(data["pos"]) == 2 * 4417, len(data["pos"]))
    check("cl-Laenge", len(data["cl"]) == 4417, len(data["cl"]))
    check("Ideen-IDs eindeutig", len({i["id"] for i in data["ideas"]}) == 4417)
    bad = [i for i in data["ideas"] if not (1634 <= i["y"] <= 2026)]
    check("Jahre plausibel", not bad, len(bad))
    with_name = sum(1 for i in data["ideas"] if i.get("n") and i.get("ne"))
    check("Namen deutsch und englisch", with_name == 4417, with_name)
    check("Cluster-Kernlisten", all(len(c["core"]) > 0 for c in data["clusters"]))

    # Platzhalterpfad
    tmp = tempfile.mkdtemp(prefix="sfib-uv-")
    try:
        os.makedirs(os.path.join(tmp, "work", "data"))
        os.makedirs(os.path.join(tmp, "work", "img"))
        os.makedirs(os.path.join(tmp, "work", "translate"))
        shutil.copytree(os.path.join(BASE, "sources"), os.path.join(tmp, "sources"))
        shutil.copy(os.path.join(BASE, "work", "translate", "de.json"),
                    os.path.join(tmp, "work", "translate", "de.json"))
        u2, i2, r2 = build_payload(tmp)
        d2 = json.loads(u2)
        check("Platzhalter: Karte erkannt", r2["map_source"] == "placeholder", r2["map_source"])
        check("Platzhalter: 4417 Ideen", r2["ideas"] == 4417, r2["ideas"])
        check("Platzhalter: 24 Cluster", r2["clusters"] == 24, r2["clusters"])
        check("Platzhalter: nn gueltig", r2["nn_valid"] is True)
        check("Platzhalter: Warnungen", len(r2["warnings"]) >= 3, len(r2["warnings"]))
        check("Platzhalter: Flag im JSON", d2.get("ph") == 1)
        check("Platzhalter: Ersatzname", d2["clusters"][0]["name"].startswith("Sternbild"),
              d2["clusters"][0]["name"])
        check("Platzhalter: keine Bilder", r2["images"]["clusters"] == 0)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print()
    if fails:
        print("%d Test(s) fehlgeschlagen: %s" % (len(fails), ", ".join(fails)))
        sys.exit(1)
    print("Alle Payload-Tests bestanden.")


if __name__ == "__main__":
    main()
