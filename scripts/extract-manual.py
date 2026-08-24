#!/usr/bin/env python3
"""
Download a state driver's manual and extract its text, so a flashcard deck can
be written from the actual source rather than from memory.

    pip install pypdf     # only dependency; a maintainer tool, not part of the app
    python3 scripts/extract-manual.py <pdf-url> <out.txt>

Text is written one page at a time with "=== PAGE n ===" separators, because
deck cards cite a manual page and the citation has to be checkable. The page
numbers here are PDF pages; printed manuals usually differ by a few pages of
front matter, so confirm against the page number printed on the page itself
before using it as a card's `ref`.

Why this exists: WebFetch cannot read PDF interiors, so every state needs the
file pulled down and extracted locally before any question can be written
against it.
"""
import sys
import urllib.request

USER_AGENT = "Mozilla/5.0 (compatible; student-driver-log deck builder)"


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2

    url, out_path = sys.argv[1], sys.argv[2]

    try:
        from pypdf import PdfReader
    except ImportError:
        print("pypdf is not installed.  pip install pypdf", file=sys.stderr)
        return 1

    print(f"Downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req) as resp:
        data = resp.read()

    tmp_pdf = out_path + ".pdf"
    with open(tmp_pdf, "wb") as f:
        f.write(data)
    print(f"  {len(data):,} bytes -> {tmp_pdf}")

    reader = PdfReader(tmp_pdf)
    chunks = []
    empty_pages = 0
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if not text.strip():
            empty_pages += 1
        chunks.append(f"\n=== PAGE {i} ===\n{text}")

    out = "".join(chunks)
    with open(out_path, "w") as f:
        f.write(out)

    print(f"  {len(reader.pages)} pages, {len(out):,} characters -> {out_path}")
    if empty_pages:
        # Usually cover art and section dividers. A high count can also mean the
        # manual is scanned images rather than text, in which case extraction
        # produced nothing usable and the deck cannot be written from it.
        print(f"  note: {empty_pages} page(s) produced no text")
        if empty_pages > len(reader.pages) / 2:
            print("  WARNING: most pages are empty — this PDF may be scanned images, not text.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
