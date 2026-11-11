#!/usr/bin/env python3
"""Build a small, attributed sports-news feed from Google News RSS."""
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path

QUERIES = [
    ("deportes", "deportes"),
    ("fútbol OR LaLiga OR Champions", "fútbol"),
    ("baloncesto OR NBA OR Euroliga", "baloncesto"),
    ("tenis OR ATP OR WTA", "tenis"),
    ("Fórmula 1 OR MotoGP OR rally", "motor"),
]
HEADERS = {"User-Agent": "ALLSPORTS-NewsBot/1.0 (+https://github.com/dandy62013/Allsports)"}

def clean(value):
    value = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", unescape(value)).strip()

def category_for(title, fallback):
    t = title.lower()
    rules = [
        ("Motor", ("fórmula 1", "formula 1", "f1", "motogp", "rally", "moto gp")),
        ("Baloncesto", ("baloncesto", "nba", "euroliga", "acb", "basket")),
        ("Tenis", ("tenis", "atp", "wta", "alcaraz", "sinner", "swiatek")),
        ("Fútbol", ("fútbol", "laliga", "champions", "liga", "selección", "mundial", "premier league")),
    ]
    for category, words in rules:
        if any(word in t for word in words):
            return category
    return fallback

items = {}
for query, fallback in QUERIES:
    params = urllib.parse.urlencode({"q": query, "hl": "es", "gl": "ES", "ceid": "ES:es"})
    url = "https://news.google.com/rss/search?" + params
    request = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            root = ET.fromstring(response.read())
    except Exception as exc:
        print(f"No se pudo leer RSS para {query}: {exc}")
        continue

    for node in root.findall("./channel/item"):
        title = clean(node.findtext("title"))
        link = (node.findtext("link") or "").strip()
        source_node = node.find("source")
        source = clean(source_node.text if source_node is not None else "Google News")
        description = clean(node.findtext("description"))
        pub_date = node.findtext("pubDate") or ""
        try:
            published = parsedate_to_datetime(pub_date).astimezone(timezone.utc).isoformat()
        except Exception:
            published = ""
        if not title or not link:
            continue
        key = link
        items[key] = {
            "title": title,
            "url": link,
            "source": source,
            "published": published,
            "description": description[:240],
            "category": category_for(title, fallback),
        }

ordered = sorted(items.values(), key=lambda item: item["published"], reverse=True)[:24]
payload = {
    "updatedAt": datetime.now(timezone.utc).isoformat(),
    "items": ordered,
}
Path("news.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Guardadas {len(ordered)} noticias deportivas.")
if not ordered:
    raise SystemExit("No se encontraron noticias; no se debe publicar un feed vacío.")
