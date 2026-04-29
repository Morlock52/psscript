# Module 03: AI Analysis And Security

## Objectives

- Read the current AI analysis criteria payload.
- Interpret security and quality scores.
- Read runtime requirements for PowerShell version, modules, and .NET assemblies.
- Track remediation actions.
- Export analysis as a PDF.

## Walkthrough

1. Open a script detail page.
2. Run or view AI analysis.
3. Review security score, quality score, criteria version, confidence, findings, remediation, and test recommendations.
4. Read the **Runtime Requirements** panel before approving execution.
5. Export the analysis report.
6. Confirm the downloaded report is a PDF, not JSON.

## Scorecard Snapshot

![Security Scorecard](../../graphics/security-scorecard.svg)

## Screenshots

![Analysis](../../screenshots/readme/analysis.png)

![Runtime requirements](../../screenshots/readme/analysis-runtime-requirements.png)

## Score Interpretation

| Band | Meaning | Action |
| --- | --- | --- |
| 9.0 - 10 | Low risk | Approve and monitor |
| 7.0 - 8.9 | Moderate risk | Plan fixes and rerun analysis |
| below 7.0 | High risk | Remediate before execution |

## What To Look For

- hardcoded credentials or tokens
- unsafe destructive commands
- missing parameter validation
- missing error handling and logging
- unclear operational ownership
- required modules or assemblies such as ActiveDirectory, Microsoft.Graph, Az, ExchangeOnlineManagement, Pester, VMware.PowerCLI, or `PresentationFramework (.NET assembly)`
- PowerShell 5.1 versus 7+ assumptions, especially for Windows-only UI assemblies and older WMI cmdlets

## Verification Checklist

- Analysis results display successfully.
- Criteria version and confidence are visible.
- Runtime requirements show PowerShell version guidance.
- Modules or assemblies are shown when detected.
- Findings have priorities.
- PDF export downloads and opens as a PDF.
