#!/usr/bin/env python3
import argparse
from pathlib import Path

from html2docx import html2docx
from lxml import html as lxml_html

ROOT = Path(__file__).resolve().parents[1]
HTML_DIR = ROOT / "docs" / "exports" / "html"
DOCX_DIR = ROOT / "docs" / "exports" / "docx"


def rewrite_image_sources(html_content: str) -> str:
  document = lxml_html.fromstring(html_content)
  for img in document.xpath("//img"):
    src = img.get("src")
    if not src:
      continue
    if src.startswith("http://") or src.startswith("https://") or src.startswith("file:"):
      continue
    clean_src = src.split("#", 1)[0]
    abs_path = (ROOT / clean_src).resolve()
    if abs_path.exists():
      img.set("src", str(abs_path))
  return lxml_html.tostring(document, encoding="unicode", method="html")


def convert_file(html_path: Path) -> Path:
  html_content = html_path.read_text(encoding="utf-8")
  fixed_html = rewrite_image_sources(html_content)
  title = html_path.stem
  docx_bytes = html2docx(fixed_html, title)
  DOCX_DIR.mkdir(parents=True, exist_ok=True)
  docx_path = DOCX_DIR / f"{title}.docx"
  docx_path.write_bytes(docx_bytes.getvalue())
  return docx_path


def main() -> None:
  parser = argparse.ArgumentParser(description="Convert HTML exports to DOCX.")
  parser.add_argument("--all", action="store_true", help="Convert all HTML files")
  parser.add_argument("files", nargs="*", help="Specific HTML files to convert")
  args = parser.parse_args()

  if not HTML_DIR.exists():
    raise SystemExit("HTML exports not found. Run scripts/export-docs.py first.")

  if args.files:
    html_files = [Path(f) if Path(f).is_absolute() else HTML_DIR / f for f in args.files]
  else:
    html_files = sorted(HTML_DIR.glob("*.html"))

  if not html_files:
    print("No HTML files found to convert.")
    return

  for html_path in html_files:
    if not html_path.exists():
      print(f"Skipping missing file: {html_path}")
      continue
    docx_path = convert_file(html_path)
    print(f"Exported {docx_path}")


if __name__ == "__main__":
  main()
