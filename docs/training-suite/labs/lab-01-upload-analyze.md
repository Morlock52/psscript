# Lab 01: Upload, Analyze, Export

Last updated: April 29, 2026.

## Goal

Design a safe PowerShell script, upload it to the hosted app, verify hosted editing, export a `.ps1` copy for VS Code, run analysis, review runtime requirements, remediate or document findings, and export the analysis report as a PDF.

## Prerequisites

- Approved account on `https://pstest.morloksmaze.com`, or local mock UI for non-mutating demos.
- A disposable `.ps1` test script that contains no secrets and is safe to delete.

## Steps

1. Write a one-paragraph script intent statement.
2. Confirm the script has a safe name, owner, examples, and a test expectation.
3. Open Scripts and select Upload.
4. Upload the test script.
5. Add category, tags, owner/team tag, and description.
6. Open the script detail view.
7. Open the edit view and confirm title, description, and script content load from the hosted record.
8. Select **Open in VS Code** and confirm the browser downloads a `.ps1` copy of the current editor buffer.
9. Run or view AI analysis.
10. Review score, criteria version, confidence, runtime requirements, findings, remediation, and test recommendations.
11. Export the analysis report.
12. Confirm the downloaded file is a PDF.
13. Decide whether the test script should be kept for later labs or deleted after Lab 05.

## Expected Results

- Script appears in the library.
- Analysis shows security and quality scores.
- Edit view loads the hosted script and exports a `.ps1` file.
- Runtime requirements show PowerShell version guidance and any detected modules or assemblies.
- Findings and remediation are visible.
- Export downloads a PDF, not JSON.
- Metadata is clear enough for another reviewer to understand ownership and purpose.

## Troubleshooting

- If upload fails, check Netlify Function logs and the authenticated API response.
- If the file is larger than 4 MB, reduce the test file size before using the hosted app.
- If analysis is empty, check provider env vars and deterministic fallback behavior.
- If runtime requirements look incomplete, confirm the script includes explicit `#Requires`, `Import-Module`, `Add-Type`, or recognizable module commands.
- If export is not PDF, verify the latest Netlify deploy is live.
