---
title: Explain Drawer and Command Enrichment
description: Clickable cmdlets with a themed pop-out plus AI-enriched cmdlet cards (progress + cancel)
---

# Explain drawer and command enrichment

This feature makes PowerShell cmdlets clickable across the app and opens a themed right-side drawer that explains the command and shows a richer cmdlet card (flags, examples, sample output).

## What you get

- Clickable cmdlet pills in **Documentation** and clickable inline cmdlets in chat/analysis (backticks).
- A right-side **Explain Command** drawer with:
  - Deterministic breakdown (cmdlet, parameters, args, pipeline segments)
  - Flags (risky patterns)
  - Docs links
  - AI explanation (best-effort)
  - **Cmdlet Card** (AI-enriched: how-to, key params, use cases, examples, sample output)
- A manual **Command Enrichment** job that backfills cmdlet cards for everything already stored in the database, with **progress + cancel**.

## Where it works

- Documentation modal cmdlet pills
- Chat markdown (inline code cmdlets + PowerShell code blocks via an **Explain** action)
- Script analysis markdown/code blocks via an **Explain** action
- Agent orchestration chat markdown (PowerShell code blocks via **Explain**)

## UI: documentation → explain drawer

1. Open the documentation explorer: `http://localhost:3090/documentation`
2. Open a doc card and click a cmdlet pill (for example, `Set-Item`)
3. The drawer opens and renders the breakdown/flags immediately; AI sections load async

![Documentation explorer](/images/screenshots/variants/documentation-v9.png)

![Documentation modal](/images/screenshots/variants/documentation-modal-v1.png)

![Explain drawer](/images/screenshots/variants/command-explain-v1.png)

## Backfill cmdlet cards (progress + cancel)

1. Open: `http://localhost:3090/documentation/crawl`
2. In **Command Enrichment**, click **Start**
3. Watch progress; click **Cancel** any time while status is `queued` or `running`

![Command enrichment progress](/images/screenshots/variants/command-enrichment-v1.png)

Notes:
- The job scans `documentation.extracted_commands` and enriches each distinct cmdlet.
- The Explain drawer automatically shows enriched details once they exist for that cmdlet.

## API endpoints

- `GET /api/commands/:cmdlet` returns stored cmdlet card (404 if not enriched yet)
- `POST /api/commands/enrich` starts enrichment job (409 if one is already queued/running)
- `GET /api/commands/enrich/:jobId` poll status (must not be cached)
- `POST /api/commands/enrich/:jobId/cancel` request cancellation

## Troubleshooting

- Drawer shows “No enriched card found”:
  - Run **Command Enrichment** first, or wait for the cmdlet to be processed.
- Job is stuck on one cmdlet:
  - Cancel, then restart. The job continues even if individual cmdlets fail; failures are counted.
- AI explain fails:
  - Breakdown + Flags still render; AI is best-effort and failure is shown inline.

