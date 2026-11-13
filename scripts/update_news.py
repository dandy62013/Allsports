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
from html.parser import HTMLParser
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

GENERIC_GOOGLE_IMAGE_ID = "J6_coFbogxhRI9iM864NL_liGXvsQp2AupsKei7z0cNNfDvGUmWUy20nuUhkREQyrpY4bEeIBuc"

def valid_image_url(value):
    if not value:
        return False
    parsed = urllib.parse.urlparse(value.strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return False
    # Google News can return its own colourful placeholder as if it were an article photo.
    if GENERIC_GOOGLE_IMAGE_ID in parsed.path:
        return False
    return True

def extract_image(node):
    # Prefer publisher-provided media, but reject Google's shared placeholder artwork.
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
        candidate = candidate.strip()
        if valid_image_url(candidate):
            return candidate
    return ""

class ArticleLinksParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a":
            data = dict(attrs)
            href = data.get("href", "")
            if href:
                self.links.append(urllib.parse.urljoin("https://news.google.com/", href))

class OpenGraphImageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.image = ""

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "meta" or self.image:
            return
        data = {key.lower(): value for key, value in attrs if value}
        key = (data.get("property") or data.get("name") or "").lower()
        value = data.get("content", "")
        if key in ("og:image", "og:image:url", "twitter:image", "twitter:image:src") and valid_image_url(value):
            self.image = value

def read_article_page(url):
    try:
        request = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(request, timeout=10) as response:
            content_type = response.headers.get("Content-Type", "").lower()
            if "html" not in content_type:
                return "", "", ""
            final_url = response.geturl()
            page = response.read(900_000).decode("utf-8", errors="replace")
        parser = OpenGraphImageParser()
        parser.feed(page)
        return parser.image, final_url, page
    except Exception:
        return "", "", ""

def fetch_article_image(url, source_home=""):
    # First follow Google's RSS redirect. If Google serves an intermediate page,
    # locate the publisher's article link and read that page's Open Graph image.
    image, final_url, page = read_article_page(url)
    final_host = urllib.parse.urlparse(final_url).hostname or ""
    if image and not final_host.endswith("news.google.com"):
        return image

    source_host = urllib.parse.urlparse(source_home).hostname or ""
    if page and source_host:
        links = ArticleLinksParser()
        links.feed(page)
        for candidate in links.links:
            host = urllib.parse.urlparse(candidate).hostname or ""
            if host == source_host or host.endswith("." + source_host):
                image, _, _ = read_article_page(candidate)
                if image:
                    return image

    # A Google News logo/placeholder is never presented as a real news photo.
    if image and GENERIC_GOOGLE_IMAGE_ID not in image:
        return image
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
        image = extract_image(node)\n        if not image:\n            image = fetch_article_image(link, source_node.attrib.get("url", "") if source_node is not None else "")
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
