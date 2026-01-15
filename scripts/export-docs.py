#!/usr/bin/env python3
import argparse
import datetime
import re
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parents[1]


def rewrite_image_paths(md_text: str, src_path: Path) -> str:
  """Rewrite relative image paths to be absolute from project root.

  This ensures images work correctly when HTML uses <base href> pointing to ROOT.
  Example: ../screenshots/login.png in docs/training-suite/TRAINING-GUIDE.md
           becomes docs/screenshots/login.png
  """
  src_dir = src_path.parent

  def replace_img(match):
    alt_text = match.group(1)
    img_path = match.group(2)

    # Skip absolute URLs and already-absolute paths
    if img_path.startswith(('http://', 'https://', '/')):
      return match.group(0)

    # Resolve the relative path from the markdown file's directory
    resolved = (src_dir / img_path).resolve()

    # Make it relative to ROOT
    try:
      rel_to_root = resolved.relative_to(ROOT)
      return f'![{alt_text}]({rel_to_root})'
    except ValueError:
      # Path is outside ROOT, keep original
      return match.group(0)

  # Match markdown image syntax: ![alt](path)
  return re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', replace_img, md_text)


EXPORT_DIR = ROOT / "docs" / "exports"
HTML_DIR = EXPORT_DIR / "html"

CSS = """
:root {
  color-scheme: light;
}
body {
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #0f172a;
}
.markdown-body {
  max-width: 980px;
  margin: 40px auto 60px;
  padding: 0 32px;
  line-height: 1.65;
}
.markdown-body h1 {
  font-size: 32px;
  margin-bottom: 12px;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 12px;
  page-break-before: always;
  page-break-after: avoid;
  break-before: page;
  break-after: avoid;
}
.markdown-body h1:first-of-type {
  page-break-before: avoid;
  break-before: avoid;
}
.markdown-body h2 {
  font-size: 24px;
  margin-top: 28px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
  page-break-before: always;
  page-break-after: avoid;
  break-before: page;
  break-after: avoid;
}
.markdown-body h3 {
  font-size: 18px;
  margin-top: 20px;
  page-break-after: avoid;
  break-after: avoid;
}
.markdown-body h4, .markdown-body h5, .markdown-body h6 {
  page-break-after: avoid;
  break-after: avoid;
}
.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 14px;
  page-break-inside: avoid;
  break-inside: avoid;
}
.markdown-body th,
.markdown-body td {
  border: 1px solid #e2e8f0;
  padding: 8px 10px;
  text-align: left;
}
.markdown-body th {
  background: #f8fafc;
}
.markdown-body tr {
  page-break-inside: avoid;
  break-inside: avoid;
}
.markdown-body code {
  background: #f1f5f9;
  padding: 2px 4px;
  border-radius: 4px;
  font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 0.92em;
}
.markdown-body pre {
  background: #0f172a;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  page-break-inside: avoid;
  break-inside: avoid;
}
.markdown-body pre code {
  background: transparent;
  color: inherit;
}
.markdown-body blockquote {
  border-left: 4px solid #38bdf8;
  margin: 16px 0;
  padding: 8px 16px;
  background: #f8fafc;
  color: #334155;
}
.markdown-body img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 16px 0;
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
  page-break-inside: avoid;
  break-inside: avoid;
}
.markdown-body figure {
  page-break-inside: avoid;
  break-inside: avoid;
  margin: 16px 0;
}
.markdown-body a {
  color: #2563eb;
  text-decoration: none;
}
.markdown-body a:hover {
  text-decoration: underline;
}
.cover {
  padding: 80px 60px 60px;
  background: linear-gradient(135deg, #0b1220 0%, #1e3a8a 100%);
  color: #f8fafc;
  border-radius: 18px;
  margin-bottom: 32px;
}
.cover-title {
  font-size: 36px;
  font-weight: 700;
  margin: 0 0 12px;
}
.cover-subtitle {
  font-size: 18px;
  color: #cbd5f5;
  margin: 0 0 16px;
}
.cover-meta {
  font-size: 13px;
  color: #94a3b8;
}
.page-break {
  page-break-after: always;
  break-after: page;
}
.footer {
  margin-top: 40px;
  font-size: 12px;
  color: #64748b;
}
/* Print and PDF-specific styles */
@page {
  margin: 20mm 18mm;
}
@media print {
  .markdown-body {
    orphans: 3;
    widows: 3;
  }
  .markdown-body p {
    orphans: 3;
    widows: 3;
  }
  .markdown-body li {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .markdown-body ul, .markdown-body ol {
    page-break-before: avoid;
    break-before: avoid;
  }
  .markdown-body blockquote {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  /* Keep section content together */
  .markdown-body h2 + *, .markdown-body h3 + * {
    page-break-before: avoid;
    break-before: avoid;
  }
}
"""

DOCS_DEFAULT = [
  ("README.md", "README"),
  ("docs/index.md", "Documentation-Hub"),
  ("docs/GETTING-STARTED.md", "Getting-Started"),
  ("DOCKER-QUICKSTART.md", "Docker-Quickstart"),
  ("docs/README-VECTOR-SEARCH.md", "Vector-Search"),
  ("docs/README-VOICE-API.md", "Voice-API"),
  ("docs/LOGIN-CREDENTIALS.md", "Login-Credentials"),
  ("docs/MANAGEMENT-PLAYBOOK.md", "Management-Playbook"),
  ("docs/training-suite/README.md", "Training-Suite"),
  ("docs/training-suite/TRAINING-GUIDE.md", "Training-Guide"),
  ("docs/SUPPORT.md", "Support"),
  ("docs/REFERENCE-SOURCES.md", "Reference-Sources"),
]

COVER_PAGES = {
  "README": {
    "title": "PSScript Manager",
    "subtitle": "AI-powered PowerShell script management and analysis platform",
    "meta": "Product README",
  },
  "Documentation-Hub": {
    "title": "Documentation Hub",
    "subtitle": "Navigation, onboarding, and deep-dive references",
    "meta": "PSScript Manager Docs",
  },
  "Getting-Started": {
    "title": "Getting Started",
    "subtitle": "Setup steps and first-run workflow",
    "meta": "PSScript Manager Docs",
  },
  "Docker-Quickstart": {
    "title": "Docker Quickstart",
    "subtitle": "Infrastructure setup and service validation",
    "meta": "PSScript Manager Docs",
  },
  "Vector-Search": {
    "title": "Vector Search",
    "subtitle": "pgvector embeddings and semantic search",
    "meta": "PSScript Manager Docs",
  },
  "Voice-API": {
    "title": "Voice API",
    "subtitle": "Speech synthesis and recognition flows",
    "meta": "PSScript Manager Docs",
  },
  "Login-Credentials": {
    "title": "Login Credentials",
    "subtitle": "Demo accounts and authentication notes",
    "meta": "PSScript Manager Docs",
  },
  "Management-Playbook": {
    "title": "Management Playbook",
    "subtitle": "Phased rollout, KPIs, and governance cadences",
    "meta": "PSScript Manager Docs",
  },
  "Training-Suite": {
    "title": "Training Suite",
    "subtitle": "Modules, labs, and onboarding paths",
    "meta": "PSScript Manager Training",
  },
  "Training-Guide": {
    "title": "Training Guide",
    "subtitle": "End-to-end walkthrough with screenshots and labs",
    "meta": "PSScript Manager Training",
  },
  "Support": {
    "title": "Support and Operations",
    "subtitle": "Triage, escalation, and operational checks",
    "meta": "PSScript Manager Docs",
  },
  "Reference-Sources": {
    "title": "Reference Sources",
    "subtitle": "Documentation patterns and inspirations",
    "meta": "PSScript Manager Docs",
  },
}


def md_to_html(md_text: str) -> str:
  return markdown.markdown(
    md_text,
    extensions=["fenced_code", "tables", "toc"]
  )


def build_cover(title: str, subtitle: str, meta: str) -> str:
  return f"""
  <section class=\"cover page-break\">
    <h1 class=\"cover-title\">{title}</h1>
    <p class=\"cover-subtitle\">{subtitle}</p>
    <p class=\"cover-meta\">{meta}</p>
  </section>
  """


def build_html(title: str, body_html: str, cover: dict | None = None) -> str:
  base_href = ROOT.as_uri() + "/"
  generated = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
  cover_html = ""
  if cover:
    cover_html = build_cover(cover["title"], cover["subtitle"], cover["meta"])
  return f"""<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <base href=\"{base_href}\" />
  <title>{title}</title>
  <style>{CSS}</style>
</head>
<body>
  <div class=\"markdown-body\">
    {cover_html}
    {body_html}
    <div class=\"footer\">Generated {generated}</div>
  </div>
</body>
</html>"""


def export_docs(docs):
  HTML_DIR.mkdir(parents=True, exist_ok=True)
  outputs = []
  for src, name in docs:
    src_path = ROOT / src
    if not src_path.exists():
      print(f"Skipping missing file: {src_path}")
      continue
    md_text = src_path.read_text(encoding="utf-8")
    # Rewrite relative image paths to be absolute from project root
    md_text = rewrite_image_paths(md_text, src_path)
    body_html = md_to_html(md_text)
    cover = COVER_PAGES.get(name)
    html = build_html(name, body_html, cover)
    html_path = HTML_DIR / f"{name}.html"
    html_path.write_text(html, encoding="utf-8")
    outputs.append(html_path)
  return outputs


def collect_all_docs():
  docs = list(DOCS_DEFAULT)
  seen_sources = {src for src, _ in DOCS_DEFAULT}

  for path in sorted((ROOT / "docs").rglob("*.md")):
    rel = path.relative_to(ROOT)
    rel_str = str(rel)
    if rel_str in seen_sources:
      continue
    safe_name = rel_str.replace("/", "-").replace(".md", "")
    docs.append((rel_str, safe_name))

  if (ROOT / "README.md").exists() and "README.md" not in seen_sources:
    docs.append(("README.md", "README"))
  return docs


def main():
  parser = argparse.ArgumentParser(description="Export markdown docs to HTML.")
  parser.add_argument("--all", action="store_true", help="Export all docs/*.md files")
  args = parser.parse_args()

  docs = collect_all_docs() if args.all else DOCS_DEFAULT
  outputs = export_docs(docs)
  print(f"Exported {len(outputs)} HTML files to {HTML_DIR}")


if __name__ == "__main__":
  main()
