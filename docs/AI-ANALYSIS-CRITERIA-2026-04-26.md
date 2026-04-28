# AI Analysis Criteria Design - 2026-04-26

This document defines the current PSScript AI analysis output contract for PowerShell script review. The criteria are designed for hosted Netlify execution and hosted Supabase persistence without requiring a database schema migration.

## Research Sources

- Microsoft Learn, PSScriptAnalyzer rules: static PowerShell analysis surfaces common issues as Error, Warning, and Information findings.
  https://learn.microsoft.com/en-us/powershell/utility-modules/psscriptanalyzer/rules/readme?view=ps-modules
- Microsoft Learn, ShouldProcess and WhatIf: destructive or state-changing functions should implement `SupportsShouldProcess`, `$PSCmdlet.ShouldProcess`, `-WhatIf`, and `-Confirm` behavior.
  https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-shouldprocess?view=powershell-7.6
- Microsoft Learn, advanced function methods: `ShouldProcess` is the confirmation method for actions that change system state.
  https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_functions_advanced_methods?view=powershell-7.6
- Microsoft Learn, PowerShell Gallery publishing guidance: package authors are expected to run PSScriptAnalyzer and address Errors and Warnings or document exceptions.
  https://learn.microsoft.com/en-us/powershell/gallery/concepts/publishing-guidelines?view=powershellget-3.x
- OWASP Secure Coding Practices Quick Reference Guide: emphasizes input validation, avoiding dynamic execution of user-supplied data, secure credentials, least privilege database access, and protected configuration.
  https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/stable-en/02-checklist/05-checklist
- NIST SP 800-218 SSDF: recommends secure development practices that reduce released vulnerabilities, mitigate impact, and address root causes through review and testing.
  https://csrc.nist.gov/pubs/sp/800/218/final

## Weighted Criteria

| Criterion | Weight | What It Checks |
| --- | ---: | --- |
| Security | 35 | Secrets, credential handling, injection, dynamic execution, remote downloads, privilege changes, remoting, and least privilege. |
| Operational safety | 20 | Destructive/system-changing commands, target scope, rollback expectations, idempotency, and `SupportsShouldProcess`/`-WhatIf`/`-Confirm`. |
| Reliability | 15 | Strict mode, parameter validation, terminating errors, try/catch behavior, retries, timeouts, and observable failure modes. |
| Maintainability | 15 | Verb-Noun naming, approved verbs, advanced functions, comment-based help, readable parameters, comments, and module hygiene. |
| Compatibility | 10 | PowerShell 5.1 versus 7+ behavior, platform dependencies, deprecated cmdlets, required modules, and environmental assumptions. |
| Performance | 5 | Pipeline streaming, filtering strategy, collection materialization, remote fan-out, throttling, and expensive loops. |

## Output Shape

Every new hosted analysis should include:

```json
{
  "criteria_version": "2026-04-26",
  "purpose": "Short script purpose",
  "beginner_explanation": "Plain English explanation",
  "management_summary": "Business and operational summary",
  "security_score": 0,
  "quality_score": 0,
  "risk_score": 0,
  "suggestions": [],
  "command_details": [],
  "security_issues": [],
  "best_practice_violations": [],
  "performance_insights": [],
  "analysis_criteria": [
    {
      "name": "Security",
      "weight": 35,
      "score": 0,
      "summary": "Reason for the score"
    }
  ],
  "prioritized_findings": [
    {
      "id": "PS-001",
      "severity": "high",
      "category": "Security",
      "title": "Finding title",
      "evidence": "Concrete script evidence",
      "impact": "Why it matters",
      "recommendation": "What to change"
    }
  ],
  "remediation_plan": [
    {
      "priority": "high",
      "action": "Specific fix",
      "rationale": "Reason",
      "effort": "low|medium|high"
    }
  ],
  "test_recommendations": [],
  "confidence": 0.75,
  "execution_summary": {
    "what_it_does": "Summary",
    "business_value": "Value",
    "key_actions": [],
    "operational_risk": "Risk summary"
  }
}
```

## Persistence Strategy

The hosted Supabase `script_analysis` table already stores JSONB fields for `command_details`, `security_issues`, `best_practice_violations`, `performance_insights`, and `execution_summary`. The richer criteria are stored inside `execution_summary` to avoid requiring a database migration:

- `execution_summary.criteria_version`
- `execution_summary.analysis_criteria`
- `execution_summary.prioritized_findings`
- `execution_summary.remediation_plan`
- `execution_summary.test_recommendations`
- `execution_summary.confidence`

The Netlify API maps those fields to camelCase for the frontend and the Markdown export.
