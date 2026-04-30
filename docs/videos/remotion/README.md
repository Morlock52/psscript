# Remotion Source Notes

This folder contains a Remotion-ready composition for the PSScript training video.

The actual MP4 at `../psscript-training-video.mp4` was rendered with the local Pillow/FFmpeg fallback in `scripts/create-training-video.py` because Remotion is not installed in this repository and no Remotion MCP plugin was available in the current Codex session.

## Composition

- File: `PSScriptTrainingVideo.tsx`
- Resolution: 1920x1080
- FPS: 30
- Style: dark PSScript operator UI with muted cyan and blue accents
- Source assets: `docs/screenshots/readme/*`

## Intended Remotion Registration

In a Remotion project, register the composition like this:

```tsx
import {Composition} from 'remotion';
import {PSScriptTrainingVideo, durationInFrames} from './PSScriptTrainingVideo';

export const RemotionRoot = () => (
  <Composition
    id="PSScriptTrainingVideo"
    component={PSScriptTrainingVideo}
    durationInFrames={durationInFrames}
    fps={30}
    width={1920}
    height={1080}
  />
);
```

## Current Render

Regenerate the checked-in MP4 with:

```bash
python3 scripts/create-training-video.py
```
