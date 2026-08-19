#!/usr/bin/env python3
"""Fetch Kufam + IBM Plex into ./fonts so the flat preview renders with the real faces.

The published canvas pulls these from Google Fonts directly. This script exists only
so a local browser (which may have no network access) can screenshot the preview with
the actual typography instead of silently falling back to a system font — a fallback
is easy to miss and makes any judgement about the type worthless.

Run once:  python3 fetch-fonts.py
"""

import hashlib
import os
import re
import urllib.request

FAMILIES = [
    "Kufam:wght@400..900",
    "IBM+Plex+Sans+Arabic:wght@400;500;600;700",
    "IBM+Plex+Mono:wght@400;500",
]

# Google Fonts serves woff2 only to browsers that advertise support.
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

here = os.path.dirname(os.path.abspath(__file__))
out_dir = os.path.join(here, "fonts")
os.makedirs(out_dir, exist_ok=True)

proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({"https": proxy} if proxy else {})
)
opener.addheaders = [("User-Agent", UA)]

css = ""
for family in FAMILIES:
    url = f"https://fonts.googleapis.com/css2?family={family}&display=swap"
    css += opener.open(url, timeout=60).read().decode("utf-8")

# Rewrite every remote face to a sibling file, so fonts.css resolves offline.
count = 0
for remote in sorted(set(re.findall(r"url\((https://fonts\.gstatic\.com/[^)]+\.woff2)\)", css))):
    name = hashlib.md5(remote.encode()).hexdigest()[:10] + ".woff2"
    with open(os.path.join(out_dir, name), "wb") as fh:
        fh.write(opener.open(remote, timeout=60).read())
    css = css.replace(remote, "./" + name)
    count += 1

with open(os.path.join(out_dir, "fonts.css"), "w", encoding="utf-8") as fh:
    fh.write(css)

print(f"fetched {count} font files into {out_dir}")
