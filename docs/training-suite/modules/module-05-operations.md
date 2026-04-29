# Module 05: Operations And Governance

Last updated: April 29, 2026.

## Objectives

- Monitor Netlify and Supabase production state.
- Review analytics and script activity.
- Use admin data maintenance safely.
- Confirm mobile UI health.

## Walkthrough

1. Open Analytics and review usage/cost indicators.
2. Check `https://pstest.morloksmaze.com/api/health`.
3. Review the latest Netlify production deploy and Function logs.
4. Review Supabase Auth/database logs for the same time window if a data issue is reported.
5. As an admin, open Settings -> Data Maintenance and confirm backup controls are available.
6. Verify mobile dashboard and navigation screenshots match current behavior.
7. For upload, delete, export, or data maintenance incidents, collect both the browser route and hosted API response.

## Operations Visuals

![Data maintenance](../../screenshots/readme/data-maintenance.png)

![Analytics](../../screenshots/readme/analytics.png)

![Support escalation ladder](../../graphics/support-escalation-ladder-2026-04-29.svg)

## Operational Signals

| Signal | Source | Target |
| --- | --- | --- |
| App health | Netlify production URL | app shell loads |
| API health | `/api/health` | healthy or degraded with reason |
| Auth gate | Supabase + `app_profiles` | disabled users blocked |
| Data maintenance | Settings -> Data Maintenance | admin only, backup first |
| Export | script analysis PDF | correct PDF download |
| Mobile | phone viewport | no overlap |
| Upload limit | upload screen | hosted 4 MB maximum |
| RLS | Supabase policies | users can access only authorized records |

## Governance Evidence

| Event | Evidence to keep |
| --- | --- |
| New script | Script id, title, owner, category, upload timestamp |
| Analysis complete | Criteria version, score, findings, PDF export |
| Remediation complete | Updated version, accepted findings, reviewer note |
| Delete complete | Script id, title, user, timestamp, result |
| Data maintenance | Backup id, action, confirmation text, admin user |
| Incident | Screenshot, route, deploy id, Function logs, Supabase logs |

## Verification Checklist

- Production health endpoint responds.
- Netlify deploy logs are reachable.
- Supabase logs show no active auth/database incident.
- Admin backup list loads.
- Mobile navigation works.
- Support evidence is enough for another person to reproduce the issue.
