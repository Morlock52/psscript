import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/psscript/',
    component: ComponentCreator('/psscript/', 'a86'),
    routes: [
      {
        path: '/psscript/',
        component: ComponentCreator('/psscript/', '63e'),
        routes: [
          {
            path: '/psscript/',
            component: ComponentCreator('/psscript/', '5b2'),
            routes: [
              {
                path: '/psscript/explanation',
                component: ComponentCreator('/psscript/explanation', '66b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/explanation/agentic-framework',
                component: ComponentCreator('/psscript/explanation/agentic-framework', 'd14'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/explanation/ARCHITECTURE-EVALUATION-AND-REBUILD-STRATEGY',
                component: ComponentCreator('/psscript/explanation/ARCHITECTURE-EVALUATION-AND-REBUILD-STRATEGY', 'e19'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/explanation/DOCKER-INFRASTRUCTURE',
                component: ComponentCreator('/psscript/explanation/DOCKER-INFRASTRUCTURE', 'dc2'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/explanation/DOCKER-INFRASTRUCTURE-SUMMARY',
                component: ComponentCreator('/psscript/explanation/DOCKER-INFRASTRUCTURE-SUMMARY', '015'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/explanation/INFRASTRUCTURE-FEATURES',
                component: ComponentCreator('/psscript/explanation/INFRASTRUCTURE-FEATURES', 'd20'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/explanation/LANGGRAPH-IMPLEMENTATION',
                component: ComponentCreator('/psscript/explanation/LANGGRAPH-IMPLEMENTATION', '5a8'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/explanation/LANGGRAPH-MIGRATION-PLAN',
                component: ComponentCreator('/psscript/explanation/LANGGRAPH-MIGRATION-PLAN', 'ff9'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/explanation/VOICE-API-ARCHITECTURE',
                component: ComponentCreator('/psscript/explanation/VOICE-API-ARCHITECTURE', '2a4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to',
                component: ComponentCreator('/psscript/how-to', 'c6f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/AUTHENTICATION-IMPROVEMENTS',
                component: ComponentCreator('/psscript/how-to/AUTHENTICATION-IMPROVEMENTS', 'ebf'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/COMMAND-EXPLAIN-AND-ENRICHMENT',
                component: ComponentCreator('/psscript/how-to/COMMAND-EXPLAIN-AND-ENRICHMENT', 'a78'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/DATABASE_ISSUES_AND_FIXES',
                component: ComponentCreator('/psscript/how-to/DATABASE_ISSUES_AND_FIXES', '613'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/DOCKER-SETUP',
                component: ComponentCreator('/psscript/how-to/DOCKER-SETUP', 'c8e'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/DOCS-BUILD-CHECKLIST',
                component: ComponentCreator('/psscript/how-to/DOCS-BUILD-CHECKLIST', '7c9'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/LANGGRAPH-SETUP-SUMMARY',
                component: ComponentCreator('/psscript/how-to/LANGGRAPH-SETUP-SUMMARY', '843'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/MANAGEMENT-PLAYBOOK',
                component: ComponentCreator('/psscript/how-to/MANAGEMENT-PLAYBOOK', '747'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/README-FILE-HASH-TESTING',
                component: ComponentCreator('/psscript/how-to/README-FILE-HASH-TESTING', '6b1'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/README-FIXES',
                component: ComponentCreator('/psscript/how-to/README-FIXES', '946'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/README-GITHUB',
                component: ComponentCreator('/psscript/how-to/README-GITHUB', '293'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/SCRIPT-ANALYSIS-IMPROVEMENTS',
                component: ComponentCreator('/psscript/how-to/SCRIPT-ANALYSIS-IMPROVEMENTS', 'a65'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/SECURITY_INCIDENT_RESPONSE',
                component: ComponentCreator('/psscript/how-to/SECURITY_INCIDENT_RESPONSE', '140'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/SUPPORT',
                component: ComponentCreator('/psscript/how-to/SUPPORT', '8e9'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/VOICE-API-IMPLEMENTATION-STEPS',
                component: ComponentCreator('/psscript/how-to/VOICE-API-IMPLEMENTATION-STEPS', '419'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/VOICE-API-INTEGRATION',
                component: ComponentCreator('/psscript/how-to/VOICE-API-INTEGRATION', 'a7a'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/VOICE-API-INTEGRATION-SUMMARY',
                component: ComponentCreator('/psscript/how-to/VOICE-API-INTEGRATION-SUMMARY', '400'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/how-to/VOICE-API-NEXT-STEPS',
                component: ComponentCreator('/psscript/how-to/VOICE-API-NEXT-STEPS', '51c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reference',
                component: ComponentCreator('/psscript/reference', '685'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reference/CLAUDE',
                component: ComponentCreator('/psscript/reference/CLAUDE', 'e84'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reference/DATABASE_DOCUMENTATION',
                component: ComponentCreator('/psscript/reference/DATABASE_DOCUMENTATION', 'b0f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reference/DATABASE_TEST_PLAN',
                component: ComponentCreator('/psscript/reference/DATABASE_TEST_PLAN', 'f34'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reference/LOGIN-CREDENTIALS',
                component: ComponentCreator('/psscript/reference/LOGIN-CREDENTIALS', 'aba'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reference/README-FILE-HASH',
                component: ComponentCreator('/psscript/reference/README-FILE-HASH', 'e28'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reference/README-VECTOR-SEARCH',
                component: ComponentCreator('/psscript/reference/README-VECTOR-SEARCH', '149'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reference/README-VOICE-API',
                component: ComponentCreator('/psscript/reference/README-VOICE-API', '521'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reference/REFERENCE-SOURCES',
                component: ComponentCreator('/psscript/reference/REFERENCE-SOURCES', '55c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reference/style-guide',
                component: ComponentCreator('/psscript/reference/style-guide', '641'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reference/TOKEN-COUNTER-API-KEY-FEATURES',
                component: ComponentCreator('/psscript/reference/TOKEN-COUNTER-API-KEY-FEATURES', '983'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reference/VOICE-API-IMPLEMENTATION-EXAMPLES',
                component: ComponentCreator('/psscript/reference/VOICE-API-IMPLEMENTATION-EXAMPLES', 'c53'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports',
                component: ComponentCreator('/psscript/reports', '26b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/AI_COMPREHENSIVE_TEST_PLAN',
                component: ComponentCreator('/psscript/reports/AI_COMPREHENSIVE_TEST_PLAN', 'dac'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/AI-ANALYZER-FIXES',
                component: ComponentCreator('/psscript/reports/AI-ANALYZER-FIXES', '059'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/APP-FUNCTIONALITY-COMPLETE-FIX-REPORT-2026-01-09',
                component: ComponentCreator('/psscript/reports/APP-FUNCTIONALITY-COMPLETE-FIX-REPORT-2026-01-09', '25d'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/AUTHENTICATION-FIX-REPORT-2026-01-08',
                component: ComponentCreator('/psscript/reports/AUTHENTICATION-FIX-REPORT-2026-01-08', '662'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/COMPREHENSIVE-FEATURE-TEST-REPORT-2026-01-09',
                component: ComponentCreator('/psscript/reports/COMPREHENSIVE-FEATURE-TEST-REPORT-2026-01-09', '21f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/COMPREHENSIVE-STATUS-REPORT-2026-01-07',
                component: ComponentCreator('/psscript/reports/COMPREHENSIVE-STATUS-REPORT-2026-01-07', '090'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/COMPREHENSIVE-TEST-RESULTS-2026-01-08',
                component: ComponentCreator('/psscript/reports/COMPREHENSIVE-TEST-RESULTS-2026-01-08', 'a37'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/COMPREHENSIVE-TESTING-PLAN-2026',
                component: ComponentCreator('/psscript/reports/COMPREHENSIVE-TESTING-PLAN-2026', '1eb'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/DASHBOARD-FIX-REPORT-2026-01-08',
                component: ComponentCreator('/psscript/reports/DASHBOARD-FIX-REPORT-2026-01-08', '27e'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/DATABASE_REVIEW_2026',
                component: ComponentCreator('/psscript/reports/DATABASE_REVIEW_2026', '068'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/DATABASE_UPDATE_2026-01-16',
                component: ComponentCreator('/psscript/reports/DATABASE_UPDATE_2026-01-16', '398'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/DATABASE-IMPROVEMENTS',
                component: ComponentCreator('/psscript/reports/DATABASE-IMPROVEMENTS', '5e4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/DEPLOYMENT-STATUS',
                component: ComponentCreator('/psscript/reports/DEPLOYMENT-STATUS', '0f7'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/DEPLOYMENT-SUMMARY-2026-01-26',
                component: ComponentCreator('/psscript/reports/DEPLOYMENT-SUMMARY-2026-01-26', 'cb7'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/E2E-COMPREHENSIVE-FIX-FINAL-RESULTS-2026-01-08',
                component: ComponentCreator('/psscript/reports/E2E-COMPREHENSIVE-FIX-FINAL-RESULTS-2026-01-08', '5c4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/E2E-COMPREHENSIVE-FIX-FINAL-SUMMARY-2026-01-08',
                component: ComponentCreator('/psscript/reports/E2E-COMPREHENSIVE-FIX-FINAL-SUMMARY-2026-01-08', 'fcb'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/E2E-COMPREHENSIVE-FIX-IMPLEMENTATION-2026-01-08',
                component: ComponentCreator('/psscript/reports/E2E-COMPREHENSIVE-FIX-IMPLEMENTATION-2026-01-08', '749'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/E2E-COMPREHENSIVE-FIX-PLAN-2026-01-08',
                component: ComponentCreator('/psscript/reports/E2E-COMPREHENSIVE-FIX-PLAN-2026-01-08', '659'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/E2E-TEST-FIXES-2026-01-08',
                component: ComponentCreator('/psscript/reports/E2E-TEST-FIXES-2026-01-08', 'a74'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/E2E-TEST-FIXES-PHASE-4-RESULTS-2026-01-08',
                component: ComponentCreator('/psscript/reports/E2E-TEST-FIXES-PHASE-4-RESULTS-2026-01-08', '5d8'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/E2E-TEST-ISSUES-2026-01-08',
                component: ComponentCreator('/psscript/reports/E2E-TEST-ISSUES-2026-01-08', 'd00'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/FILE-HASH-IMPLEMENTATION-REPORT',
                component: ComponentCreator('/psscript/reports/FILE-HASH-IMPLEMENTATION-REPORT', '2b6'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/FINAL-DEPLOYMENT-SUMMARY',
                component: ComponentCreator('/psscript/reports/FINAL-DEPLOYMENT-SUMMARY', '544'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/FINAL-TEST-REPORT-2026-01-08',
                component: ComponentCreator('/psscript/reports/FINAL-TEST-REPORT-2026-01-08', '0f2'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/FIXES',
                component: ComponentCreator('/psscript/reports/FIXES', '82f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/IMPLEMENTATION-SUMMARY-2026-01-26',
                component: ComponentCreator('/psscript/reports/IMPLEMENTATION-SUMMARY-2026-01-26', 'f8c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/MODEL-UPDATE-2026-01-08',
                component: ComponentCreator('/psscript/reports/MODEL-UPDATE-2026-01-08', '934'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/PHASE-1-COMPLETE-READY-TO-TEST-2026-01-09',
                component: ComponentCreator('/psscript/reports/PHASE-1-COMPLETE-READY-TO-TEST-2026-01-09', '0d4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/PHASE-1-IMPLEMENTATION-COMPLETE-2026-01-09',
                component: ComponentCreator('/psscript/reports/PHASE-1-IMPLEMENTATION-COMPLETE-2026-01-09', 'f9f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/PROJECT-REVIEW-2026-02-04',
                component: ComponentCreator('/psscript/reports/PROJECT-REVIEW-2026-02-04', '67c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/REACT-QUERY-V5-MIGRATION-STATUS',
                component: ComponentCreator('/psscript/reports/REACT-QUERY-V5-MIGRATION-STATUS', '146'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/SCRIPT-ANALYSIS-COMPREHENSIVE-FIX-PLAN-2026-01-09',
                component: ComponentCreator('/psscript/reports/SCRIPT-ANALYSIS-COMPREHENSIVE-FIX-PLAN-2026-01-09', '6a3'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/TECH-REVIEW-2026',
                component: ComponentCreator('/psscript/reports/TECH-REVIEW-2026', '053'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/TEST-RESULTS-2026-01-08',
                component: ComponentCreator('/psscript/reports/TEST-RESULTS-2026-01-08', 'ed0'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/UPDATES',
                component: ComponentCreator('/psscript/reports/UPDATES', '03a'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/reports/USER_MANAGEMENT_SECURITY_AUDIT',
                component: ComponentCreator('/psscript/reports/USER_MANAGEMENT_SECURITY_AUDIT', 'd1b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/tutorials',
                component: ComponentCreator('/psscript/tutorials', '771'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/tutorials/GETTING-STARTED',
                component: ComponentCreator('/psscript/tutorials/GETTING-STARTED', 'a70'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/tutorials/LANGGRAPH-QUICK-START',
                component: ComponentCreator('/psscript/tutorials/LANGGRAPH-QUICK-START', '28b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/tutorials/TRAINING-GUIDE',
                component: ComponentCreator('/psscript/tutorials/TRAINING-GUIDE', '96e'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/tutorials/training-suite',
                component: ComponentCreator('/psscript/tutorials/training-suite', 'b07'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/psscript/',
                component: ComponentCreator('/psscript/', '1bb'),
                exact: true,
                sidebar: "docs"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
