#!/usr/bin/env python3
"""Render a captioned PSScript training video from local screenshots.

This intentionally uses only Pillow plus ffmpeg so the training video can be
regenerated without adding Remotion or other runtime dependencies to the repo.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import textwrap
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "videos"
BUILD_DIR = OUT_DIR / "training-video-build"
FRAMES_DIR = BUILD_DIR / "slides"
WIDTH = 1920
HEIGHT = 1080
FPS = 30
BG = "#071018"
PANEL = "#101b27"
PANEL_2 = "#142233"
INK = "#f6f7f2"
MUTED = "#b5bdc8"
CYAN = "#7dd3fc"
BLUE = "#5b7cff"
LINE = "#2a3a4d"


@dataclass(frozen=True)
class Slide:
    id: str
    title: str
    eyebrow: str
    body: str
    image: str | None = None
    bullets: tuple[str, ...] = ()
    duration: int = 6
    image_side: str = "right"


SLIDES = [
    Slide(
        "01-title",
        "PSScript Training & Support Library",
        "Hosted Netlify + Supabase operating model",
        "A role-based walkthrough for basic users, beginners, senior engineers, support teams, and executive stakeholders.",
        "docs/screenshots/readme/settings-docs-training.png",
        ("Find scripts", "Upload safely", "Analyze risk", "Export evidence", "Support with logs"),
        7,
    ),
    Slide(
        "02-audiences",
        "Train Different Roles At The Right Depth",
        "Audience tracks",
        "The same app teaches different outcomes: usage, authoring, technical review, operations, and governance.",
        None,
        (
            "Basic user: search, read, download approved reports",
            "New beginner: upload disposable scripts with complete metadata",
            "Senior engineer: review dependencies, findings, and accepted risk",
            "Admin/support: collect route, role, deploy id, and logs",
            "C-level: understand governance posture and escalation",
        ),
        8,
    ),
    Slide(
        "03-lifecycle",
        "The Governed Script Lifecycle",
        "Access -> Upload -> Edit -> Analyze -> Discover -> Operate -> Support",
        "Every training session should end with proof: a route, script id, screenshot, PDF, or support note.",
        "docs/screenshots/readme/dashboard.png",
        ("Use hosted production for training", "Keep disposable data separate", "Do not introduce local database workflows"),
        7,
    ),
    Slide(
        "04-login",
        "Access Starts With Approved Accounts",
        "Login and approval gate",
        "Users sign in through hosted auth. Pending users need profile approval before they can operate in the app.",
        "docs/screenshots/readme/login.png",
        ("Verify account status", "Use the correct role", "Escalate login loops with callback URL and user email"),
        6,
    ),
    Slide(
        "05-dashboard",
        "First Orientation: Dashboard",
        "Basic user path",
        "The dashboard gives a quick status view before users move into scripts, search, documentation, or settings.",
        "docs/screenshots/readme/dashboard.png",
        ("Confirm navigation", "Know where scripts and docs live", "Use responsive navigation on mobile"),
        6,
    ),
    Slide(
        "06-upload",
        "Upload With Complete Metadata",
        "Beginner author path",
        "A training upload should be disposable, below the hosted 4 MB limit, and include clear title, category, tags, and owner context.",
        "docs/screenshots/readme/upload.png",
        ("Use safe test scripts", "Add meaningful tags", "Record the script id after upload"),
        7,
    ),
    Slide(
        "07-edit",
        "Edit And Export For Local Review",
        "Engineer path",
        "The edit flow supports hosted updates and a .ps1 export for local VS Code review without changing the hosted database model.",
        "docs/screenshots/readme/script-edit-vscode.png",
        ("Save intentional changes", "Open/export .ps1 locally", "Avoid accidental production edits"),
        6,
    ),
    Slide(
        "08-analysis",
        "AI Analysis Is A Review Aid",
        "Security, quality, maintainability, runtime requirements",
        "Senior reviewers should read score, findings, PowerShell version, modules, assemblies, recommendations, and PDF export status.",
        "docs/screenshots/readme/analysis-runtime-requirements.png",
        ("Treat output as advisory", "Confirm required modules", "Document remediation or accepted risk"),
        8,
    ),
    Slide(
        "09-discover",
        "Search And Documentation Prevent Rework",
        "Discover approved patterns",
        "Search and documentation help users find existing scripts, policies, and supporting context before creating duplicates.",
        "docs/screenshots/readme/documentation.png",
        ("Search by keyword and intent", "Open docs before reuse", "Validate the actual script before approval"),
        6,
    ),
    Slide(
        "10-settings-docs",
        "Settings Docs Train Inside The App",
        "Training library",
        "The training page combines role tracks, lifecycle steps, guide cards, reader content, screenshots, and graphics.",
        "docs/screenshots/readme/settings-docs-training.png",
        ("Use the learner tracks", "Open the selected guide", "Use screenshots as support evidence"),
        7,
    ),
    Slide(
        "11-maintenance",
        "Data Maintenance Is Backup-First",
        "Admin and support path",
        "Maintenance training should teach what to verify, not encourage destructive action. Cleanup uses disposable test data only.",
        "docs/screenshots/readme/data-maintenance.png",
        ("Confirm admin role", "Verify backup state", "Never clear production data as a diagnostic"),
        7,
    ),
    Slide(
        "12-support",
        "Support Needs Reproducible Evidence",
        "Escalation packet",
        "A useful support case includes route, user role, script id, expected result, actual result, screenshot, Netlify deploy id, and Supabase log window.",
        "docs/screenshots/readme/analysis.png",
        ("Classify severity", "Attach logs", "Capture cleanup or rollback need"),
        7,
    ),
    Slide(
        "13-leadership",
        "Executive View: Control, Reuse, Evidence",
        "C-level summary",
        "PSScript centralizes PowerShell knowledge, reduces unsafe reuse, preserves a hosted source of record, and supports audit-style evidence.",
        None,
        (
            "Governed lifecycle for scripts",
            "Hosted Supabase as the database source of record",
            "Netlify deploys and function logs for operational evidence",
            "AI analysis as a structured risk review input",
            "PDF reports and screenshots for stakeholder handoff",
        ),
        8,
    ),
    Slide(
        "14-close",
        "Training Complete",
        "What learners should now know",
        "Use the right path for the role, produce evidence, and keep production changes intentional.",
        "docs/screenshots/readme/settings-docs-training.png",
        ("Basic use", "Safe upload", "Technical review", "Admin support", "Governance summary"),
        6,
    ),
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Helvetica.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


FONT_EYEBROW = font(26, True)
FONT_TITLE = font(66, True)
FONT_BODY = font(34)
FONT_BULLET = font(28)
FONT_SMALL = font(22)


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def wrap_text(text: str, chars: int) -> list[str]:
    return textwrap.wrap(text, width=chars, break_long_words=False)


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, xy, fnt, fill, chars: int, line_gap: int = 10) -> int:
    x, y = xy
    for line in wrap_text(text, chars):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + line_gap
    return y


def fit_image(path: Path, target_w: int, target_h: int) -> Image.Image:
    img = Image.open(path).convert("RGB")
    img.thumbnail((target_w, target_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (target_w, target_h), PANEL)
    x = (target_w - img.width) // 2
    y = (target_h - img.height) // 2
    canvas.paste(img, (x, y))
    return canvas


def draw_image_card(base: Image.Image, image_path: str, side: str):
    draw = ImageDraw.Draw(base)
    path = ROOT / image_path
    if not path.exists():
        return
    if side == "right":
        box = (1040, 150, 1800, 930)
    else:
        box = (120, 170, 900, 910)
    rounded_rect(draw, box, 34, PANEL_2, LINE, 2)
    inner = (box[0] + 28, box[1] + 28, box[2] - 28, box[3] - 28)
    img = fit_image(path, inner[2] - inner[0], inner[3] - inner[1])
    mask = Image.new("L", img.size, 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, img.width, img.height), radius=22, fill=255)
    base.paste(img, (inner[0], inner[1]), mask)


def draw_bullets(draw: ImageDraw.ImageDraw, bullets: tuple[str, ...], x: int, y: int, max_chars: int):
    for bullet in bullets:
        draw.ellipse((x, y + 9, x + 12, y + 21), fill=CYAN)
        y = draw_wrapped(draw, bullet, (x + 28, y), FONT_BULLET, INK, max_chars, 6) + 8
    return y


def draw_role_chart(draw: ImageDraw.ImageDraw):
    roles = [
        ("Basic user", "Find and export"),
        ("Beginner", "Upload safely"),
        ("Senior engineer", "Review risk"),
        ("Admin/support", "Operate evidence"),
        ("C-level", "Governance posture"),
    ]
    x, y = 1030, 190
    for idx, (role, outcome) in enumerate(roles):
        top = y + idx * 132
        rounded_rect(draw, (x, top, 1780, top + 96), 22, PANEL_2, LINE, 2)
        draw.text((x + 28, top + 18), role, font=font(30, True), fill=INK)
        draw.text((x + 28, top + 56), outcome, font=FONT_SMALL, fill=MUTED)
        draw.text((x + 660, top + 30), f"{idx + 1:02d}", font=font(34, True), fill=CYAN)


def render_slide(slide: Slide, index: int, total: int) -> Path:
    base = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(base)

    # Subtle technical background.
    for offset in range(-300, WIDTH, 140):
        draw.line((offset, 0, offset + 700, HEIGHT), fill="#0d1d2a", width=2)
    draw.rectangle((0, 0, WIDTH, 90), fill="#060b11")
    draw.text((80, 28), "PSScript", font=font(30, True), fill=INK)
    draw.text((244, 34), "AI OPS STUDIO", font=font(18, True), fill="#9fbe78")
    draw.text((WIDTH - 250, 32), f"{index:02d}/{total:02d}", font=FONT_SMALL, fill=MUTED)

    visual_right = bool(slide.image) or slide.id in {"02-audiences", "13-leadership"}
    title_chars = 21 if visual_right else 34
    body_chars = 36 if visual_right else 68
    draw.text((110, 150), slide.eyebrow.upper(), font=FONT_EYEBROW, fill=CYAN)
    title_y = draw_wrapped(draw, slide.title, (110, 195), FONT_TITLE, INK, title_chars, 8)
    body_y = draw_wrapped(draw, slide.body, (110, title_y + 24), FONT_BODY, MUTED, body_chars, 12)
    draw_bullets(draw, slide.bullets, 120, body_y + 42, 34 if visual_right else 76)

    if slide.image:
        draw_image_card(base, slide.image, slide.image_side)
    elif slide.id == "02-audiences":
        draw_role_chart(draw)
    else:
        rounded_rect(draw, (1020, 190, 1780, 870), 34, PANEL_2, LINE, 2)
        cx, cy = 1400, 470
        for r, color in [(250, "#0b2a3e"), (180, "#133b54"), (110, "#1d5c78"), (46, CYAN)]:
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=color, width=10)
        draw.text((1110, 790), "Control -> Reuse -> Evidence", font=font(38, True), fill=INK)

    out = FRAMES_DIR / f"{slide.id}.png"
    base.save(out, quality=95)
    return out


def write_storyboard(output: Path):
    lines = [
        "# PSScript Training Video Storyboard",
        "",
        "This is the Remotion-ready structure for the generated training video.",
        "The MP4 in this folder was rendered with the local Pillow/FFmpeg fallback because Remotion is not installed in this repo.",
        "",
        "## Composition",
        "",
        "- Size: 1920x1080",
        f"- FPS: {FPS}",
        "- Style: dark operator UI, muted cyan/blue accents, screenshot-led corporate training",
        "- Intended duration: about 90 seconds",
        "",
        "## Slide Timing",
        "",
    ]
    current = 0
    for slide in SLIDES:
        lines.append(f"- `{current:02d}s-{current + slide.duration:02d}s` {slide.title}")
        current += slide.duration
    lines.extend(
        [
            "",
            "## Remotion Mapping",
            "",
            "- Each slide maps to a Remotion `<Sequence>`.",
            "- Use the slide `duration` multiplied by `fps` for `durationInFrames`.",
            "- Use screenshots from `docs/screenshots/readme/` and graphics from `docs/graphics/`.",
            "- Keep the Settings training content role-based: Basic user, New beginner, Senior engineer, Admin/support, and C-level management.",
        ]
    )
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")


def render_video(slide_paths: list[Path], output: Path):
    concat = BUILD_DIR / "concat.txt"
    with concat.open("w", encoding="utf-8") as handle:
        for slide, path in zip(SLIDES, slide_paths):
            handle.write(f"file '{path.as_posix()}'\n")
            handle.write(f"duration {slide.duration}\n")
        handle.write(f"file '{slide_paths[-1].as_posix()}'\n")

    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat),
        "-vf",
        f"fps={FPS},format=yuv420p",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(output),
    ]
    subprocess.run(cmd, check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(OUT_DIR / "psscript-training-video.mp4"))
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    slide_paths = [render_slide(slide, i + 1, len(SLIDES)) for i, slide in enumerate(SLIDES)]
    output = Path(args.output)
    render_video(slide_paths, output)
    write_storyboard(OUT_DIR / "PSSCRIPT-TRAINING-VIDEO-STORYBOARD.md")
    print(output)


if __name__ == "__main__":
    main()
