# Lab 04: Analytics And Governance

## Goal

Review analytics and define a governance checklist for script changes.

## Steps

1. Open Analytics.
2. Review usage metrics, AI activity, and recent changes.
3. Check `https://pstest.morloksmaze.com/api/health`.
4. Draft a release governance checklist.
5. As an admin, open Settings -> Data Maintenance and confirm backup-first controls.

## Expected Results

- Analytics dashboard renders without errors.
- Governance checklist includes review, analysis, export evidence, and audit steps.
- Data maintenance is admin-only.

## Troubleshooting

- If analytics fail, check Netlify Function logs.
- If health is degraded, inspect the reason and Supabase connectivity.
- If data maintenance is visible to a non-admin, treat it as a security issue.
