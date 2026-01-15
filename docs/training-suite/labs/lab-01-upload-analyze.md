# Lab 01: Upload and Analyze a Script

## Goal

Upload a PowerShell script, run AI analysis, and record the top recommendation.

## Prerequisites

- Services running
- Access to a test script (example: `test-script.ps1`)

## Steps

1. Go to Scripts and select Upload.
2. Upload `test-script.ps1`.
3. Add category and tags.
4. Open the script detail view.
5. Run analysis and review scores.

## Expected results

- Script appears in the library
- Analysis shows security and quality scores
- Recommendation list contains at least one entry

## Troubleshooting

- If the upload fails, confirm the backend is running on port 4000
- If analysis is empty, check mock mode and AI service logs
