import React from 'react';
import DocumentationSettingsView, { TrainingDoc, VisualReference } from './DocumentationSettingsView';

import lifecycleSuite from '../../../../../docs/training-suite/SCRIPT-LIFECYCLE-SUITE-2026-04-29.md?raw';
import trainingGuide from '../../../../../docs/training-suite/TRAINING-GUIDE.md?raw';
import screenshotAtlas from '../../../../../docs/training-suite/SCREENSHOT-ATLAS.md?raw';
import supportGuide from '../../../../../docs/SUPPORT.md?raw';
import labGovernance from '../../../../../docs/training-suite/labs/lab-05-governance-support.md?raw';
import lifecycleMapUrl from '../../../../../docs/graphics/script-lifecycle-map-2026-04-29.svg';
import supportSuiteMapUrl from '../../../../../docs/graphics/training-support-suite-map-2026-04-29.svg';
import escalationLadderUrl from '../../../../../docs/graphics/support-escalation-ladder-2026-04-29.svg';
import corporateDashboardUrl from '../../../../../docs/graphics/training-corporate-dashboard-2026-04-29.svg';
import readinessScorecardUrl from '../../../../../docs/graphics/training-readiness-scorecard-2026-04-29.svg';
import roleWorkflowUrl from '../../../../../docs/graphics/training-role-workflow-2026-04-29.svg';
import loginScreenshotUrl from '../../../../../docs/screenshots/readme/login.png';
import dashboardScreenshotUrl from '../../../../../docs/screenshots/readme/dashboard.png';
import scriptsScreenshotUrl from '../../../../../docs/screenshots/readme/scripts.png';
import uploadScreenshotUrl from '../../../../../docs/screenshots/readme/upload.png';
import editScreenshotUrl from '../../../../../docs/screenshots/readme/script-edit-vscode.png';
import analysisScreenshotUrl from '../../../../../docs/screenshots/readme/analysis.png';
import analysisRuntimeScreenshotUrl from '../../../../../docs/screenshots/readme/analysis-runtime-requirements.png';
import documentationScreenshotUrl from '../../../../../docs/screenshots/readme/documentation.png';
import dataMaintenanceScreenshotUrl from '../../../../../docs/screenshots/readme/data-maintenance.png';
import appearanceScreenshotUrl from '../../../../../docs/screenshots/readme/settings-appearance.png';
import settingsDocsScreenshotUrl from '../../../../../docs/screenshots/readme/settings-docs-training.png';

const canvaCompanionUrl = 'https://www.canva.com/d/tUOQyjVSCvQPyqJ';

const assetMap: Record<string, string> = {
  'graphics/script-lifecycle-map-2026-04-29.svg': lifecycleMapUrl,
  'graphics/training-support-suite-map-2026-04-29.svg': supportSuiteMapUrl,
  'graphics/support-escalation-ladder-2026-04-29.svg': escalationLadderUrl,
  'graphics/training-corporate-dashboard-2026-04-29.svg': corporateDashboardUrl,
  'graphics/training-readiness-scorecard-2026-04-29.svg': readinessScorecardUrl,
  'graphics/training-role-workflow-2026-04-29.svg': roleWorkflowUrl,
  'screenshots/readme/login.png': loginScreenshotUrl,
  'screenshots/readme/dashboard.png': dashboardScreenshotUrl,
  'screenshots/readme/scripts.png': scriptsScreenshotUrl,
  'screenshots/readme/upload.png': uploadScreenshotUrl,
  'screenshots/readme/script-edit-vscode.png': editScreenshotUrl,
  'screenshots/readme/analysis.png': analysisScreenshotUrl,
  'screenshots/readme/analysis-runtime-requirements.png': analysisRuntimeScreenshotUrl,
  'screenshots/readme/documentation.png': documentationScreenshotUrl,
  'screenshots/readme/data-maintenance.png': dataMaintenanceScreenshotUrl,
  'screenshots/readme/settings-appearance.png': appearanceScreenshotUrl,
  'screenshots/readme/settings-docs-training.png': settingsDocsScreenshotUrl,
};

const docs: TrainingDoc[] = [
  {
    id: 'lifecycle',
    title: 'Script Lifecycle Suite',
    description: 'Complete design, upload, analysis, remediation, discovery, cleanup, and support playbook.',
    audience: 'Authors, reviewers, admins',
    audienceTags: ['Authors', 'Reviewers', 'Admins'],
    moduleType: 'Lifecycle playbook',
    status: 'Current',
    icon: 'flow',
    accent: 'cyan',
    featuredGraphic: lifecycleMapUrl,
    content: lifecycleSuite,
  },
  {
    id: 'training',
    title: 'Training Guide',
    description: 'Facilitator agenda, role paths, readiness checks, labs, and source-guided training notes.',
    audience: 'Trainers and leads',
    audienceTags: ['Trainers', 'Team leads'],
    moduleType: 'Curriculum',
    status: 'Current',
    icon: 'book',
    accent: 'blue',
    featuredGraphic: supportSuiteMapUrl,
    content: trainingGuide,
  },
  {
    id: 'screenshots',
    title: 'Screenshot Atlas',
    description: 'Current screenshot inventory and recommended use for training decks and support notes.',
    audience: 'Trainers and support',
    audienceTags: ['Trainers', 'Support'],
    moduleType: 'Reference atlas',
    status: 'Current',
    icon: 'image',
    accent: 'indigo',
    featuredGraphic: supportSuiteMapUrl,
    content: screenshotAtlas,
  },
  {
    id: 'support',
    title: 'Support & Operations',
    description: 'Hosted Netlify/Supabase support intake, escalation evidence, and developer-only appendix.',
    audience: 'Admins and support',
    audienceTags: ['Admins', 'Support'],
    moduleType: 'Operations guide',
    status: 'Current',
    icon: 'support',
    accent: 'violet',
    featuredGraphic: escalationLadderUrl,
    content: supportGuide,
  },
  {
    id: 'governance-lab',
    title: 'Lab 05: Governance Support',
    description: 'Hands-on support lifecycle for evidence capture, PDF export, delete checks, and safe cleanup.',
    audience: 'All operators',
    audienceTags: ['Operators', 'Support', 'Admins'],
    moduleType: 'Hands-on lab',
    status: 'Current',
    icon: 'check',
    accent: 'slate',
    featuredGraphic: lifecycleMapUrl,
    content: labGovernance,
  },
];

const visualReferences: VisualReference[] = [
  {
    label: 'Lifecycle Map',
    description: 'End-to-end script design, analysis, remediation, discovery, and cleanup.',
    path: lifecycleMapUrl,
  },
  {
    label: 'Support Suite Map',
    description: 'How training, labs, screenshots, and support materials fit together.',
    path: supportSuiteMapUrl,
  },
  {
    label: 'Escalation Ladder',
    description: 'Support evidence and escalation flow for production issues.',
    path: escalationLadderUrl,
  },
  {
    label: 'Business Training Dashboard',
    description: 'Business and technical overview for role tracks, lifecycle stages, evidence assets, and hosted operations.',
    path: corporateDashboardUrl,
  },
  {
    label: 'Readiness Scorecard',
    description: 'Readiness chart for screenshot coverage, lifecycle coverage, support evidence, and mobile review.',
    path: readinessScorecardUrl,
  },
  {
    label: 'Role Workflow',
    description: 'Swimlane diagram for author, reviewer, admin, and support responsibilities.',
    path: roleWorkflowUrl,
  },
  {
    label: 'Dashboard Screenshot',
    description: 'First-run orientation screenshot for corporate onboarding and support handoff.',
    path: dashboardScreenshotUrl,
  },
  {
    label: 'Upload Screenshot',
    description: 'Script intake, metadata, tags, and hosted upload limit reference.',
    path: uploadScreenshotUrl,
  },
  {
    label: 'Edit And VS Code Export Screenshot',
    description: 'Hosted editor and local PowerShell handoff reference.',
    path: editScreenshotUrl,
  },
  {
    label: 'Analysis Requirements Screenshot',
    description: 'PowerShell version, module, assembly, score, and PDF export reference.',
    path: analysisRuntimeScreenshotUrl,
  },
  {
    label: 'Data Maintenance Screenshot',
    description: 'Admin backup-first maintenance and cleanup reference.',
    path: dataMaintenanceScreenshotUrl,
  },
  {
    label: 'Appearance Screenshot',
    description: 'Light and dark mode, muted accent, and accessibility settings reference.',
    path: appearanceScreenshotUrl,
  },
  {
    label: 'Settings Docs Screenshot',
    description: 'Current business and technical training library inside Settings.',
    path: settingsDocsScreenshotUrl,
  },
];

const DocumentationSettings: React.FC = () => (
  <DocumentationSettingsView
    docs={docs}
    visualReferences={visualReferences}
    canvaCompanionUrl={canvaCompanionUrl}
    assetMap={assetMap}
  />
);

export default DocumentationSettings;
