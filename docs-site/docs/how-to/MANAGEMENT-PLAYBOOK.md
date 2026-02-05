# PSScript Manager Management Playbook

This playbook is a management-focused guide for deploying, governing, and scaling PSScript Manager. It is written for non-technical stakeholders while keeping enough detail for engineering and operations leads.

## Table of Contents

- [Purpose and audience](#purpose-and-audience)
- [Executive summary](#executive-summary)
- [Rollout phases](#rollout-phases)
- [Phase deliverables and success signals](#phase-deliverables-and-success-signals)
- [RACI and ownership](#raci-and-ownership)
- [KPIs and targets](#kpis-and-targets)
- [Risk register](#risk-register)
- [Governance cadence](#governance-cadence)
- [Change management checklist](#change-management-checklist)
- [Training alignment](#training-alignment)
- [Reporting templates](#reporting-templates)
- [Appendix: Glossary](#appendix-glossary)

## Purpose and audience

This document helps managers, program leads, and operations owners plan a phased rollout and keep governance consistent. It can also be used by engineering managers to align technical work with measurable outcomes.

## Executive summary

PSScript Manager reduces risk in PowerShell automation by adding centralized inventory, AI analysis, and governance workflows. The rollout should be staged to avoid disruption and to ensure outcomes are measurable.

Key outcomes:

- Centralized script inventory with ownership and tags
- AI-driven security and quality insights on critical scripts
- Searchable knowledge base with semantic similarity
- Governance cadence with scorecards and analytics

## Rollout phases

![Management Rollout Phases](/images/graphics/rollout-phases.svg)

## Phase deliverables and success signals

| Phase | Duration | Focus | Deliverables | Success signals |
| --- | --- | --- | --- | --- |
| Phase 0: Discover | 1-2 weeks | Inventory and ownership | Script inventory, owners, baseline risk | 90% of scripts cataloged |
| Phase 1: Pilot | 2-4 weeks | Validate workflows | Training completion, pilot scorecards | 10-20 scripts analyzed |
| Phase 2: Scale | 4-8 weeks | Expand coverage | Governance cadence, dashboards | 60% coverage, monthly reviews |
| Phase 3: Optimize | Ongoing | Continuous improvement | Automation backlog, SLA tracking | 95% on-time reviews |

## RACI and ownership

| Workstream | Responsible | Accountable | Consulted | Informed |
| --- | --- | --- | --- | --- |
| Script inventory | Script owners | Platform admin | Security | Management |
| Analysis and remediation | Security reviewer | Security lead | Script owner | Management |
| Search and documentation | Script authors | Engineering lead | Support | All users |
| Governance reporting | Platform admin | Program manager | Security | Executives |
| Training completion | Enablement lead | Program manager | Engineering | Management |

## KPIs and targets

| KPI | Definition | Target | Owner |
| --- | --- | --- | --- |
| Coverage | % scripts with analysis results | ≥ 80% | Platform admin |
| Risk reduction | High-risk findings closed | 100% in 30 days | Security lead |
| Owner coverage | Scripts with owner tag | 100% | Script owners |
| Search adoption | Weekly search sessions | ≥ 3 per user | Enablement lead |
| Review cadence | Days between reviews | ≤ 30 | Program manager |

## Risk register

| Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Unowned scripts | Medium | High | Owner tags required on upload | Program manager |
| Analysis backlog | Medium | Medium | Schedule batch analysis weekly | Platform admin |
| False positives | Low | Medium | Human review workflow | Security lead |
| Low adoption | Medium | High | Mandatory onboarding labs | Enablement lead |
| Data drift | Low | Medium | Quarterly taxonomy review | Platform admin |

## Governance cadence

![Governance Loop](/images/graphics/governance-loop.svg)

Recommended cadence:

- Weekly: Review top findings and remediation progress
- Monthly: Review scorecards and KPIs with leadership
- Quarterly: Audit taxonomy, access, and compliance requirements

## Change management checklist

- Define the script ownership policy
- Align with security and compliance requirements
- Communicate pilot scope and success criteria
- Schedule training completion for pilot teams
- Establish scorecard reporting cadence
- Define escalation path for high-risk findings

## Training alignment

Training materials:

- Training suite overview: `training-suite/README.md`
- End-to-end guide: `training-suite/TRAINING-GUIDE.md`

Recommended minimum training completion per phase:

- Phase 0: Module 01
- Phase 1: Modules 01-03 + Labs 01-02
- Phase 2: Modules 01-05 + Labs 01-04
- Phase 3: Quarterly refresher and governance review

## Reporting templates

Sample dashboard views:

![Analytics Dashboard](/images/screenshots/variants/analytics-v2.png)

![Sample Usage Metrics](/images/graphics/usage-metrics-v2.svg)

![Security Scorecard](/images/graphics/security-scorecard-v2.svg)

![KPI Dashboard](/images/graphics/kpi-dashboard-v2.svg)

Suggested monthly report template:

| Section | Details |
| --- | --- |
| Coverage | % of scripts analyzed, top categories |
| Risk | High-risk findings, remediation status |
| Adoption | Active users, searches, training completion |
| Operations | Uptime, backlog, automation changes |
| Next steps | Risks to address, upcoming training |

## Appendix: Glossary

| Term | Meaning |
| --- | --- |
| Coverage | Percentage of scripts analyzed |
| Scorecard | Security and quality summary for a script |
| Owner tag | Tag that identifies team accountability |
| Vector search | Semantic search using embeddings |
| Governance cadence | Scheduled reviews and audits |

## Visual reference

![Dashboard overview](/images/screenshots/variants/dashboard-v1.png)
