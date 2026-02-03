# Graphics manifest (Replicate-ready)

Use this manifest to generate additional illustrative graphics that match the PSScript brand palette. Set `REPLICATE_API_TOKEN` before running any Replicate commands.

## Recommended model

- Primary: `black-forest-labs/flux-1.1-pro`
- Fallback: `stability-ai/stable-diffusion-3.5-large`

## Prompt template

Clean 3D isometric illustration, product documentation style, minimal background, PSScript brand colors (blue/purple), soft shadows, modern UI elements, no text.

## Planned assets

| Filename | Size | Topic |
| --- | --- | --- |
| `tutorials-onboarding-1600x900.png` | 1600×900 | Onboarding journey |
| `tutorials-first-analysis-1600x900.png` | 1600×900 | First script analysis |
| `howto-deployment-1600x900.png` | 1600×900 | Deployment pipeline |
| `howto-operations-1600x900.png` | 1600×900 | Operations dashboard |
| `reference-api-1200x1200.png` | 1200×1200 | API surface |
| `explanation-architecture-1600x900.png` | 1600×900 | System architecture |

## Placement targets

- `docs/tutorials/index.md` hero slot
- `docs/how-to/index.md` hero slot
- `docs/reference/index.md` hero slot
- `docs/explanation/index.md` hero slot
