# PSScript Training Video Storyboard

This is the Remotion-ready structure for the generated training video.
The MP4 in this folder was rendered with the local Pillow/FFmpeg fallback because Remotion is not installed in this repo.

## Composition

- Size: 1920x1080
- FPS: 30
- Style: dark operator UI, muted cyan/blue accents, screenshot-led corporate training
- Intended duration: about 90 seconds

## Slide Timing

- `00s-07s` PSScript Training & Support Library
- `07s-15s` Train Different Roles At The Right Depth
- `15s-22s` The Governed Script Lifecycle
- `22s-28s` Access Starts With Approved Accounts
- `28s-34s` First Orientation: Dashboard
- `34s-41s` Upload With Complete Metadata
- `41s-47s` Edit And Export For Local Review
- `47s-55s` AI Analysis Is A Review Aid
- `55s-61s` Search And Documentation Prevent Rework
- `61s-68s` Settings Docs Train Inside The App
- `68s-75s` Data Maintenance Is Backup-First
- `75s-82s` Support Needs Reproducible Evidence
- `82s-90s` Executive View: Control, Reuse, Evidence
- `90s-96s` Training Complete

## Remotion Mapping

- Each slide maps to a Remotion `<Sequence>`.
- Use the slide `duration` multiplied by `fps` for `durationInFrames`.
- Use screenshots from `docs/screenshots/readme/` and graphics from `docs/graphics/`.
- Keep the Settings training content role-based: Basic user, New beginner, Senior engineer, Admin/support, and C-level management.
