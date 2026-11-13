#!/usr/bin/env python3
"""Build a small, attributed sports-news feed from Google News RSS."""
import json
import re
import html
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

def extract_image(node):
    # RSS image metadata, or an image embedded in the RSS description.
    candidates = []
    for element in node.iter():
        local = element.tag.rsplit("}", 1)[-1].lower()
        if local in ("content", "thumbnail", "enclosure"):
            url = element.attrib.get("url") or element.attrib.get("href")
            mime = element.attrib.get("type", "").lower()
            if url and (local != "enclosure" or mime.startswith("image/")):
                candidates.append(url)
    raw_description = node.findtext("description") or ""
    for match in re.findall(r"""(?i)<img[^>]+(?:src|data-src)=["']([^"']+)["']""", raw_description):
        candidates.append(html.unescape(match))
    for candidate in candidates:
        parsed = urllib.parse.urlparse(candidate.strip())
        if parsed.scheme in ("http", "https") and parsed.netloc:
            return candidate.strip()
    return ""

def clean_title(title, source):
    title = clean(title)
    if source:
        title = re.sub(r"\s*(?:-|–|—|\|)\s*" + re.escape(source) + r"\s*$", "", title, flags=re.I)
    return title.strip(" -–—|")

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
        raw_title = clean(node.findtext("title"))
        link = (node.findtext("link") or "").strip()
        source_node = node.find("source")
        source = clean(source_node.text if source_node is not None else "Google News")
        title = clean_title(raw_title, source)
        description = clean(node.findtext("description"))
        image = extract_image(node)
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
            "image": image,
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
