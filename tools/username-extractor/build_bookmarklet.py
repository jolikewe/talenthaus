"""Minify grab.src.js into a javascript: bookmarklet and inject it into index.html.

Requires Node with terser (`npm i terser`). Run from this folder: python3 build_bookmarklet.py
"""
import pathlib, re, subprocess, urllib.parse

here = pathlib.Path(__file__).resolve().parent
src = (here / "grab.src.js").read_text()
mini = subprocess.run(["npx", "--yes", "terser", "--compress", "--mangle"], input=src,
                      capture_output=True, text=True, check=True).stdout.strip()
href = "javascript:" + urllib.parse.quote(mini, safe="(){}[];,.=:!?'+-*/<>&|\"_$ ")
href = href.replace('"', "%22")
page = here / "index.html"
html = page.read_text()
html, n = re.subn(r'(<a id="bm" class="bm" href=")[^"]*(")', lambda m: m.group(1) + href + m.group(2), html)
assert n == 1, "bookmarklet anchor not found"
page.write_text(html)
print(f"bookmarklet: {len(href)} chars")
