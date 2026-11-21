#!/usr/bin/env python3
"""Baut work/universe/preview.html zum Testen des Ideen-Universums.

    python3 work/universe/preview.py

Die Datei enthaelt nur den Abschnitt #universum, seine CSS, die Payload- und
Bilddaten und das Skript - also genau das, was das Template spaeter einbindet.
"""
from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from build_payload import build_payload  # noqa: E402

BASE_CSS = """
:root{
  --bg:#f6f3ec;--surface:#fffcf6;--text:#20202a;--muted:#5f5c66;--border:#e0dacd;
  --font-sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --font-serif:ui-serif,Georgia,"Times New Roman",serif;
  --font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
  --max:1180px;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;background:var(--bg);color:var(--text);
  font-family:var(--font-sans);font-size:16px;line-height:1.6;
  -webkit-font-smoothing:antialiased;
}
img{max-width:100%}
h1,h2,h3,h4{font-family:var(--font-serif);font-weight:700;letter-spacing:-.015em;line-height:1.14;margin:0}
p{margin:0 0 1em}
p:last-child{margin-bottom:0}
:focus-visible{outline:3px solid #b8501a;outline-offset:2px;border-radius:4px}
"""


def read(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def main():
    universe_json, images_json, report = build_payload(BASE)
    css = read(os.path.join(HERE, "universe.css"))
    fragment = read(os.path.join(HERE, "universe.html"))
    js = read(os.path.join(HERE, "universe.js"))

    html = """<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vorschau · Ideen-Universum</title>
<style>%s</style>
<style>%s</style>
</head>
<body>
%s
<script type="application/json" id="sfib-universe">%s</script>
<script type="application/json" id="sfib-images">%s</script>
<script>%s</script>
</body>
</html>
""" % (BASE_CSS, css, fragment, universe_json, images_json, js)

    out = os.path.join(HERE, "preview.html")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(html)

    size = os.path.getsize(out)
    print("preview.html: %.2f MB" % (size / 1e6))
    print("Ideen: %d | Karte: %s | Sternbilder: %d" % (
        report["ideas"], report["map_source"], report["clusters"]))
    print("Bilder: hero=%s, clusters=%d" % (report["images"]["hero"], report["images"]["clusters"]))
    print("Uebersetzt: %d Namen, %d Beschreibungen" % (
        report["translated_names"], report["translated_descriptions"]))
    if report["warnings"]:
        for w in report["warnings"]:
            print("WARNUNG: " + w, file=sys.stderr)


if __name__ == "__main__":
    main()
