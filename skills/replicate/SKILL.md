---
name: replicate
description: Run Replicate models through the Replicate MCP server for image, video, audio, and text tasks (generation, editing, upscaling, transcription, style transfer, etc.). Use when a user asks to use Replicate/replicate.com, replicate-mcp, configure the Replicate MCP server, or run a specific Replicate model by name or version.
---

# Replicate

## Overview
Use the Replicate MCP server to discover models and run predictions. Keep interactions model-specific, validate required inputs, and return outputs in the format the user wants (URLs, downloaded files, or extracted text).

## Quick Start
1. Confirm MCP server configuration exists.
   - If missing, provide a safe template and instruct the user to set `REPLICATE_API_TOKEN` via secrets/env (never paste or store real tokens).

```json
{
  "mcpServers": {
    "replicate": {
      "command": "npx",
      "args": ["-y", "replicate-mcp"],
      "env": {
        "REPLICATE_API_TOKEN": "<set via env or secret store>"
      }
    }
  }
}
```

2. Identify the model and version.
   - If the user doesn’t specify a model, ask for the task category (image, video, audio, text), desired quality/speed, and any constraints.

3. Gather required inputs.
   - Use the model’s schema to confirm required fields and defaults.
   - Typical inputs include `prompt`, `negative_prompt`, `image`/`audio`/`video`, `width/height`, `steps`, `seed`, or `guidance`.

4. Run the prediction and monitor status.
   - Poll until completion; handle failures by surfacing the model’s error message and suggesting corrective inputs.

5. Deliver outputs.
   - Provide URLs or download assets to local files when requested.

## Task Guidance
- **Image generation/editing**: Confirm prompt, aspect ratio, and whether an input image or mask is needed.
- **Video generation**: Clarify duration, resolution, fps, and source inputs.
- **Audio (TTS/music/transcription)**: Confirm language, voice/style, sample rate, and output format.
- **Upscaling/restoration**: Ask for target resolution and whether to preserve fine details vs. speed.
- **Training/fine-tuning (if supported by the model)**: Collect dataset location, target outputs, and expected training budget/constraints.

## Quality and Safety Checks
- Validate required inputs from the model’s schema before running.
- Keep outputs within user constraints (file size, format, resolution, duration).
- Avoid storing secrets in files or logs.

## Troubleshooting
- **Auth errors (401/403)**: `REPLICATE_API_TOKEN` missing or invalid.
- **Model not found**: Confirm the model slug and version.
- **Input errors**: Re-check required fields and types; ensure files are accessible.
- **Long runs**: Offer smaller resolution/duration or fewer steps.

## Example Requests
- “Use Replicate to generate a 16:9 cinematic landscape image.”
- “Run the model `owner/model:version` with this prompt and seed.”
- “Upscale this image to 4x and return a PNG.”
- “Transcribe this audio file and return SRT.”
