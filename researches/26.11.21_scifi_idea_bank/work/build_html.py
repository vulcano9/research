#!/usr/bin/env python3
"""Build bericht.html from work/template.html and the read-only source data.

Inputs (read-only):
  sources/_ideas.json
  sources/_stats.json
  sources/related/_related_sources.json
  sources/notboring_images/*

Output:
  bericht.html   (single, offline-capable file)

The script computes every number shown in the hero, verifies it against
_stats.json, renders the startup / related-source / bibliography sections and
embeds the JSON payloads. Run from anywhere:

  python3 work/build_html.py
"""

import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(HERE)
TEMPLATE = os.path.join(HERE, "template.html")
OUT = os.path.join(BASE, "bericht.html")
IDEAS_PATH = os.path.join(BASE, "sources", "_ideas.json")
STATS_PATH = os.path.join(BASE, "sources", "_stats.json")
RELATED_PATH = os.path.join(BASE, "sources", "related", "_related_sources.json")
IMAGES_DIR = os.path.join(BASE, "sources", "notboring_images")

TODAY = "21.11.2026"

STARTUPS = {
    "varda": {
        "name": "Varda Space Industries",
        "badge": "Im Flugbetrieb",
        "tone": "st-yes",
        "short": "Fabrik im All",
    },
    "prophetic": {
        "name": "Prophetic",
        "badge": "Im Vorverkauf",
        "tone": "st-partial",
        "short": "Luzide Träume",
    },
    "pipedream": {
        "name": "Pipedream Labs",
        "badge": "Im Aufbau",
        "tone": "st-partial",
        "short": "Röhren unter der Stadt",
    },
    "astroforge": {
        "name": "AstroForge",
        "badge": "Aktiv, ohne Missionserfolg",
        "tone": "st-unknown",
        "short": "Asteroiden abbauen",
    },
}

RELATED_GROUPS = [
    ("datenbank", "Datenbanken & Nachschlagewerke"),
    ("studie", "Studien"),
    ("artikel", "Artikel & Analysen"),
    ("diskussion", "Diskussion"),
    ("startup", "Startups"),
]

COMMUNITY = ["Hadrian", "ICON", "Spiber", "OceanBit"]


def e(value):
    return html.escape(str(value), quote=True)


def dot(n):
    return f"{int(n):,}".replace(",", ".")


def dec(value, nd=1):
    return f"{float(value):.{nd}f}".replace(".", ",")


def de_text(value):
    """Kleine Sprachglättung für übernommene englische Alltagsbegriffe."""
    text = str(value)
    for old, new in (
        ("Fulfillment-Center", "Logistikzentrum"),
        ("CEO-Interviews", "Interviews mit dem Chef"),
        ("Space Elevator", "Weltraumlift"),
        ("Self-driving cars", "Selbstfahrende Autos"),
    ):
        text = text.replace(old, new)
    return text


def load_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def percent(part, whole):
    return ("%.1f %%" % (100.0 * part / whole)).replace(".", ",")


def main():
    ideas_doc = load_json(IDEAS_PATH)
    stats = load_json(STATS_PATH)
    related = load_json(RELATED_PATH)
    ideas = ideas_doc["ideas"]

    # ------------------------------------------------------------------
    # Compute the hero numbers from the raw ideas (not from the prose).
    # ------------------------------------------------------------------
    total = len(ideas)
    built = sum(1 for x in ideas if x["b"] == "Yes")
    partial = sum(1 for x in ideas if x["b"] == "Partial")
    unbuilt = sum(1 for x in ideas if x["b"] == "No")
    unknown = sum(1 for x in ideas if x["b"] == "")
    bits = [x for x in ideas if x["ba"] == "Bits"]
    atoms = [x for x in ideas if x["ba"] == "Atoms"]
    both = [x for x in ideas if x["ba"] == "Both"]
    bits_built = sum(1 for x in bits if x["b"] == "Yes")
    atoms_built = sum(1 for x in atoms if x["b"] == "Yes")
    both_built = sum(1 for x in both if x["b"] == "Yes")
    years = [x["y"] for x in ideas if x["y"]]
    authors = {x["a"] for x in ideas if x["a"]}
    categories = {c for x in ideas for c in x.get("c", [])}
    startup_rows = [x for x in ideas if x.get("co")]
    companies = {x["co"] for x in startup_rows if x.get("co")}

    sheet_rows = stats["technovelgy_match"]["sheet_rows"]
    matched = stats["technovelgy_match"]["matched"]
    tv_entries = stats["technovelgy_match"]["technovelgy_entries"]
    tv_only = stats["technovelgy_match"]["technovelgy_only"]
    unmatched = stats["unmatched_sheet_rows"]["count"]
    match_rate = 100.0 * matched / sheet_rows

    pkd = next((a for a in stats["top_authors"] if a["author"] == "Philip K. Dick"), None)
    pkd_total = sum(1 for x in ideas if x["a"] == "Philip K. Dick")
    bits_stat = stats["bits_atoms_built_rates_sheet_rows"]["Bits"]
    atoms_stat = stats["bits_atoms_built_rates_sheet_rows"]["Atoms"]
    median_bits = stats["gap_bits_atoms"]["Bits"]["median"]
    median_atoms = stats["gap_bits_atoms"]["Atoms"]["median"]
    scatter_n = sum(
        1 for x in ideas if x["b"] == "Yes" and x["fyn"] and x["y"] and x["fyn"] >= x["y"]
    )
    negative_gaps = sum(
        1 for x in ideas if x["b"] == "Yes" and x["fyn"] and x["y"] and x["fyn"] < x["y"]
    )
    image_files = sorted(
        f for f in os.listdir(IMAGES_DIR)
        if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif"))
    ) if os.path.isdir(IMAGES_DIR) else []

    expected = {
        "total": 4417,
        "built": 966,
        "sheet_rows": 3746,
        "tv_only": 671,
        "categories": 29,
        "pkd": 241,
        "match_pct": 99.1,
    }
    checks = [
        ("Ideen gesamt", total, expected["total"]),
        ("davon gebaut", built, expected["built"]),
        ("Tabellen-Zeilen", sheet_rows, expected["sheet_rows"]),
        ("neue Technovelgy-Ideen", tv_only, expected["tv_only"]),
        ("Kategorien", len(categories), expected["categories"]),
        ("Philip-K.-Dick-Ideen", pkd["count"] if pkd else -1, expected["pkd"]),
        ("Match-Quote in Prozent", round(match_rate, 1), expected["match_pct"]),
    ]
    failed = False
    print("Prüfung der Kennzahlen")
    for label, got, want in checks:
        ok = got == want
        failed = failed or not ok
        print(f"  {'OK ' if ok else 'FEHLER'}  {label:28s} {got!r:>8}  erwartet {want!r}")
    print(f"  Info   Bits gebaut: {bits_built}/{len(bits)} = {percent(bits_built, len(bits))}")
    print(f"  Info   Atome gebaut: {atoms_built}/{len(atoms)} = {percent(atoms_built, len(atoms))}")
    print(f"  Info   Tabellen-Quote: {built}/{sheet_rows} = {percent(built, sheet_rows)}")
    if failed:
        print("\nAbbruch: Die Daten passen nicht zu den erwarteten Werten.", file=sys.stderr)
        return 1

    values = {
        "TOTAL": dot(total),
        "TOTAL_DOT": dot(total),
        "AUTHORS_DOT": dot(len(authors)),
        "BUILT_DOT": dot(built),
        "BUILT_SHEET_PCT": percent(built, sheet_rows),
        "SHEET_ROWS_DOT": dot(sheet_rows),
        "BITS_PCT": percent(bits_built, len(bits)),
        "ATOMS_PCT": percent(atoms_built, len(atoms)),
        "BITS_NUM": dec(100.0 * bits_built / len(bits)),
        "ATOMS_NUM": dec(100.0 * atoms_built / len(atoms)),
        "BITS_CSS": "%.1f" % (100.0 * bits_built / len(bits)),
        "ATOMS_CSS": "%.1f" % (100.0 * atoms_built / len(atoms)),
        "MIN_YEAR": str(min(years)),
        "TV_NEW_DOT": dot(tv_only),
        "N_CATS": dot(len(categories)),
        "C_BUILT": dot(built),
        "C_NO": dot(unbuilt),
        "C_PARTIAL": dot(partial),
        "C_UNKNOWN": dot(unknown),
        "C_BITS": dot(len(bits)),
        "C_ATOMS": dot(len(atoms)),
        "C_BOTH": dot(len(both)),
        "MEDIAN_BITS": str(median_bits).replace(".0", ""),
        "MEDIAN_ATOMS": str(median_atoms).replace(".0", ""),
        "N_SCATTER": dot(scatter_n),
        "N_NEG": dot(negative_gaps),
        "TV_ENTRIES_DOT": dot(tv_entries),
        "MATCHED_DOT": dot(matched),
        "MATCH_PCT": percent(matched, sheet_rows),
        "UNMATCHED": dot(unmatched),
        "N_STARTUP_IDEAS": dot(len(startup_rows)),
        "N_STARTUPS": dot(len(companies)),
        "PKD_COUNT": dot(pkd["count"]),
        "PKD_BUILT": dot(pkd["built"]),
        "PKD_TOTAL": dot(pkd_total),
        "N_IMAGES": dot(len(image_files)),
    }
    # sanity: bits/atoms rates agree with _stats.json
    if abs(100 * bits_built / len(bits) - 100 * bits_stat["rate"]) > 0.15:
        print("Warnung: Bits-Quote weicht von _stats.json ab.", file=sys.stderr)
    if abs(100 * atoms_built / len(atoms) - 100 * atoms_stat["rate"]) > 0.15:
        print("Warnung: Atome-Quote weicht von _stats.json ab.", file=sys.stderr)

    # ------------------------------------------------------------------
    # Startup cards
    # ------------------------------------------------------------------
    rel_by_slug = {s["slug"]: s for s in related}
    rel_num = {s["slug"]: i + 8 for i, s in enumerate(related)}
    for slug, num in (("varda", 21), ("prophetic", 22), ("pipedream", 23), ("astroforge", 24)):
        if rel_num.get(slug) != num:
            print(f"Abbruch: Quellennummer für {slug} ist {rel_num.get(slug)}, erwartet {num}.", file=sys.stderr)
            return 1

    idea_by_name = {}
    for x in ideas:
        idea_by_name.setdefault(x["n"].strip().lower(), x)

    def find_idea(name):
        if not name:
            return None
        hit = idea_by_name.get(name.strip().lower())
        if hit:
            return hit
        for x in ideas:
            if x["n"].strip().lower() == name.strip().lower():
                return x
        return None

    startup_cards = []
    for slug in ("varda", "prophetic", "pipedream", "astroforge"):
        s = rel_by_slug[slug]
        meta = STARTUPS[slug]
        idea = find_idea(s.get("idea_link"))
        if idea:
            idea_line = (
                '<p class="startup-sub">Idee: ' + e(idea["n"]) + " · " + e(idea["a"]) + " · " + str(idea["y"]) + "</p>"
            )
        else:
            idea_line = ""
        note = ""
        if idea and idea["b"] != "Yes":
            note = (
                '<p class="mini-note">Die Tabelle von 2023 führt diese Idee noch als „nicht gebaut“. '
                "Die Firma arbeitet heute daran – ein gutes Beispiel dafür, wie schnell die Daten altern.</p>"
            )
        facts = "".join("<li>" + e(de_text(k)) + "</li>" for k in s.get("key_facts_de", []))
        if idea:
            q = e(s.get("idea_link") or idea["n"])
        else:
            q = e(s.get("idea_link") or "")
        startup_cards.append(
            '<article class="startup-card" id="startup-' + slug + '">'
            '<div class="startup-top"><h3>' + e(meta["name"]) + "</h3>"
            '<span class="badge ' + meta["tone"] + '">' + e(meta["badge"]) + "</span></div>"
            + idea_line
            + "<p>" + e(de_text(s["summary_de"])) + "</p>"
            + '<ul class="facts">' + facts + "</ul>"
            + '<p class="startup-status"><strong>Stand:</strong> ' + e(de_text(s["startup_status_de"])) + "</p>"
            + note
            + '<div class="startup-actions">'
            + '<button class="btn btn-small js-search-idea" type="button" data-q="' + q + '">Ideen dazu ansehen</button>'
            + '<a class="btn btn-small" href="#q' + str(rel_num[slug]) + '">Quelle [' + str(rel_num[slug]) + "]</a>"
            + '<a class="btn btn-small" href="' + e(s["url"]) + '" target="_blank" rel="noopener">Original ↗</a>' 
            + "</div></article>"
        )

    # ------------------------------------------------------------------
    # Community names from the co field (no invented status)
    # ------------------------------------------------------------------
    community_items = []
    for company in COMMUNITY:
        hit = next(
            (x for x in ideas if x.get("co") and x["co"].strip().lower() == company.lower()),
            None,
        )
        if not hit:
            continue
        community_items.append(
            "<li><button class=\"js-search-idea\" type=\"button\" data-q=\"" + e(hit["n"]) + "\">" + e(company) + "</button>"
            '<span>' + e(hit["n"]) + " · " + str(hit["y"]) + "</span></li>"
        )
    if not community_items:
        community_items.append('<li><span>Keine Einträge gefunden.</span></li>')

    # ------------------------------------------------------------------
    # Related-source cards, grouped by type
    # ------------------------------------------------------------------
    by_type = {}
    for s in related:
        by_type.setdefault(s.get("type", "artikel"), []).append(s)

    related_html = []
    for typ, heading in RELATED_GROUPS:
        items = by_type.get(typ, [])
        if not items:
            continue
        cards = []
        for s in items:
            facts = "".join("<li>" + e(de_text(k)) + "</li>" for k in s.get("key_facts_de", []))
            cards.append(
                '<article class="rel-card">'
                '<p class="rel-type">' + e(typ.capitalize()) + ' · <a href="#q' + str(rel_num[s["slug"]]) + '">Quelle [' + str(rel_num[s["slug"]]) + "]</a></p>"
                '<h4><a href="' + e(s["url"]) + '" target="_blank" rel="noopener">' + e(s["title"]) + "</a></h4>"
                "<p>" + e(de_text(s["summary_de"])) + "</p>"
                + ('<ul class="facts">' + facts + "</ul>" if facts else "")
                + '<p class="rel-links"><a href="' + e(s["url"]) + '" target="_blank" rel="noopener">' + e(s["url"]) + "</a><br>"
                + 'Lokale Kopie: <a href="sources/' + e(s["file"]) + '">sources/' + e(s["file"]) + "</a></p>"
                + "</article>"
            )
        related_html.append(
            '<div class="rel-group"><h3>' + e(heading) + '</h3><div class="related-grid">' + "".join(cards) + "</div></div>"
        )

    # ------------------------------------------------------------------
    # Bibliography
    # ------------------------------------------------------------------
    def src(num, title_html, url, local_html):
        if url:
            url_html = (
                '<a href="' + e(url) + '" target="_blank" rel="noopener">' + e(url) + "</a>"
            )
            label = "Original"
        else:
            url_html = "Kein externes Original – die Datei ist Teil der Aufbereitung."
            label = "Herkunft"
        return (
            '<li id="q' + str(num) + '"><span class="src-num">[' + str(num) + "]</span><div>"
            "<p>" + title_html + "</p>"
            '<p class="src-links">' + label + ": " + url_html + "<br>"
            "Lokale Kopie: " + local_html + "</p></div></li>"
        )

    source_items = [
        src(
            1,
            "Packy McCormick: <em>Sci-Fi Idea Bank</em>, Not Boring, 15.08.2023.",
            "https://www.notboring.co/p/sci-fi-idea-bank",
            '<a href="sources/notboring_scifi_idea_bank.md">sources/notboring_scifi_idea_bank.md</a> · '
            '<a href="sources/notboring_scifi_idea_bank.html">sources/notboring_scifi_idea_bank.html</a>',
        ),
        src(
            2,
            "Sci-Fi Idea Bank – Google-Tabelle (Hauptblatt und Hivemind), abgerufen am 21.11.2026.",
            "https://docs.google.com/spreadsheets/d/1sBkJ8nZwyG_J1v_WLub-5RM4GhLWCf_b7ml8_qNgNsg/edit",
            '<a href="sources/scifi_idea_bank.xlsx">sources/scifi_idea_bank.xlsx</a>',
        ),
        src(
            3,
            "Packy McCormick: <em>Building the Sci-Fi Idea Bank</em> (Google-Dokument).",
            "https://docs.google.com/document/d/17gN6wouk0-IFd-3uiHZ7HEbpLz8Myf1neibF34uWnIU/edit",
            '<a href="sources/building_the_scifi_idea_bank.txt">sources/building_the_scifi_idea_bank.txt</a>',
        ),
        src(
            4,
            "Technovelgy – Zeitleiste der Sci-Fi-Erfindungen nach Erscheinungsjahr (10 gespeicherte Seiten).",
            "http://www.technovelgy.com/ct/ctnlistPubDate.asp",
            '<a href="sources/technovelgy/">sources/technovelgy/</a> (Ordner mit den gespeicherten Seiten, u. a. pubdate_*.html)',
        ),
        src(
            5,
            "Technovelgy – Kategorienliste „Science List“ und 30 gespeicherte Kategorieseiten.",
            "http://www.technovelgy.com/ct/Science_List.asp",
            '<a href="sources/technovelgy/science_list.html">sources/technovelgy/science_list.html</a> · '
            '<a href="sources/technovelgy/">sources/technovelgy/</a>',
        ),
        src(
            6,
            "Aufbereitung dieser Seite: Merge-Skript und erzeugte Daten.",
            None,
            '<a href="sources/_build_data.py">sources/_build_data.py</a> · '
            '<a href="sources/_ideas.json">sources/_ideas.json</a> · '
            '<a href="sources/_stats.json">sources/_stats.json</a>',
        ),
        src(
            7,
            "Abbildungen aus dem Not-Boring-Artikel (" + dot(len(image_files)) + " Dateien).",
            "https://www.notboring.co/p/sci-fi-idea-bank",
            '<a href="sources/notboring_images/">sources/notboring_images/</a>',
        ),
    ]

    for s in related:
        source_items.append(
            src(
                rel_num[s["slug"]],
                e(s["title"]) + " (" + e(s.get("type", "")) + ").",
                s["url"],
                '<a href="sources/' + e(s["file"]) + '">sources/' + e(s["file"]) + "</a>",
            )
        )

    # ------------------------------------------------------------------
    # Template
    # ------------------------------------------------------------------
    with open(TEMPLATE, encoding="utf-8") as fh:
        template = fh.read()

    def payload(path):
        with open(path, encoding="utf-8") as fh:
            raw = fh.read()
        # JSON is valid JS-free payload; escape the only sequence that can
        # terminate a <script> element.
        return raw.replace("</", "<\\/")

    replacements = {
        "__IDEAS_JSON__": payload(IDEAS_PATH),
        "__STATS_JSON__": payload(STATS_PATH),
        "__RELATED_JSON__": payload(RELATED_PATH),
        "__STARTUP_CARDS__": "\n".join(startup_cards),
        "__COMMUNITY_ITEMS__": "\n".join(community_items),
        "__RELATED_CARDS__": "\n".join(related_html),
        "__SOURCE_ITEMS__": "\n".join(source_items),
    }
    for key, val in values.items():
        replacements["__" + key + "__"] = str(val)

    for key, val in replacements.items():
        template = template.replace(key, val)

    leftovers = sorted(set(re.findall(r"__[A-Z][A-Z0-9_]*__", template)))
    if leftovers:
        print("Abbruch: Nicht ersetzte Platzhalter: " + ", ".join(leftovers), file=sys.stderr)
        return 1

    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(template)

    # ------------------------------------------------------------------
    # Self-check of the written file
    # ------------------------------------------------------------------
    with open(OUT, encoding="utf-8") as fh:
        written = fh.read()
    problems = []
    if re.search(r"<script[^>]*\bsrc\s*=", written, re.I):
        problems.append("externes <script src>")
    if re.search(r"<link[^>]*\bhref\s*=", written, re.I):
        problems.append("externes <link href>")
    if re.search(r"url\(\s*[\"']?https?://", written, re.I):
        problems.append("remote CSS url()")
    m = re.search(r'<script type="application/json" id="sfib-ideas">(.*?)</script>', written, re.S)
    if not m:
        problems.append("Ideen-JSON fehlt")
    else:
        try:
            embedded = json.loads(m.group(1))
            if len(embedded.get("ideas", [])) != total:
                problems.append("Ideen-JSON hat %d statt %d Einträge" % (len(embedded.get("ideas", [])), total))
        except Exception as exc:
            problems.append("Ideen-JSON nicht lesbar: %s" % exc)
    if "__IDEAS_JSON__" in written or re.search(r"__[A-Z][A-Z0-9_]*__", written):
        problems.append("unersetzte Platzhalter")
    if problems:
        print("Abbruch: Selbstprüfung fehlgeschlagen: " + ", ".join(problems), file=sys.stderr)
        return 1

    size = os.path.getsize(OUT)
    print("\nGeschrieben: " + OUT)
    print("  Größe: %.2f MB (%d Bytes)" % (size / (1024 * 1024), size))
    print("  Selbstprüfung: keine externen Skripte/Stylesheets, JSON mit %d Ideen lesbar" % total)
    print("  Ideen im JSON: %d" % total)
    print("  Startups: %d, Community-Namen: %d, verwandte Quellen: %d"
          % (len(startup_cards), len(community_items), len(related)))
    print("  Quellen im Literaturverzeichnis: %d" % len(source_items))
    return 0


if __name__ == "__main__":
    sys.exit(main())
