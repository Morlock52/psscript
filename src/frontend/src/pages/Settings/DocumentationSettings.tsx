import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import SafeHtml from '../../components/SafeHtml';
import SettingsLayout from './SettingsLayout';

import lifecycleSuite from '../../../../../docs/training-suite/SCRIPT-LIFECYCLE-SUITE-2026-04-29.md?raw';
import trainingGuide from '../../../../../docs/training-suite/TRAINING-GUIDE.md?raw';
import screenshotAtlas from '../../../../../docs/training-suite/SCREENSHOT-ATLAS.md?raw';
import supportGuide from '../../../../../docs/SUPPORT.md?raw';
import labGovernance from '../../../../../docs/training-suite/labs/lab-05-governance-support.md?raw';
import lifecycleMapUrl from '../../../../../docs/graphics/script-lifecycle-map-2026-04-29.svg';
import supportSuiteMapUrl from '../../../../../docs/graphics/training-support-suite-map-2026-04-29.svg';
import escalationLadderUrl from '../../../../../docs/graphics/support-escalation-ladder-2026-04-29.svg';

type TrainingDoc = {
  id: string;
  title: string;
  description: string;
  audience: string;
  content: string;
};

const docs: TrainingDoc[] = [
  {
    id: 'lifecycle',
    title: 'Script Lifecycle Suite',
    description: 'Complete design, upload, analysis, remediation, discovery, cleanup, and support playbook.',
    audience: 'Authors, reviewers, admins',
    content: lifecycleSuite,
  },
  {
    id: 'training',
    title: 'Training Guide',
    description: 'Facilitator agenda, role paths, readiness checks, labs, and source-guided training notes.',
    audience: 'Trainers and leads',
    content: trainingGuide,
  },
  {
    id: 'screenshots',
    title: 'Screenshot Atlas',
    description: 'Current screenshot inventory and recommended use for training decks and support notes.',
    audience: 'Trainers and support',
    content: screenshotAtlas,
  },
  {
    id: 'support',
    title: 'Support & Operations',
    description: 'Hosted Netlify/Supabase support intake, escalation evidence, and developer-only appendix.',
    audience: 'Admins and support',
    content: supportGuide,
  },
  {
    id: 'governance-lab',
    title: 'Lab 05: Governance Support',
    description: 'Hands-on support lifecycle for evidence capture, PDF export, delete checks, and safe cleanup.',
    audience: 'All operators',
    content: labGovernance,
  },
];

const visualReferences = [
  {
    label: 'Lifecycle map',
    path: lifecycleMapUrl,
  },
  {
    label: 'Support suite map',
    path: supportSuiteMapUrl,
  },
  {
    label: 'Escalation ladder',
    path: escalationLadderUrl,
  },
];

const normalizeMarkdown = (content: string) =>
  content
    .replace(/^!\[[^\]]*\]\([^)]+\)\s*$/gm, '')
    .replace(/\.\.\/graphics\//g, '/docs/graphics/')
    .replace(/\.\.\/screenshots\/readme\//g, '/docs/screenshots/readme/');

const DocumentationSettings: React.FC = () => {
  const [selectedId, setSelectedId] = useState(docs[0].id);
  const selectedDoc = docs.find((doc) => doc.id === selectedId) ?? docs[0];

  const renderedHtml = useMemo(() => {
    const html = marked.parse(normalizeMarkdown(selectedDoc.content), {
      gfm: true,
      breaks: false,
    });
    return typeof html === 'string' ? html : '';
  }, [selectedDoc]);

  return (
    <SettingsLayout
      title="Docs & Training"
      description="Read the current lifecycle, training, screenshot, and support documents from inside Settings."
    >
      <div className="space-y-6">
        <section className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
          <h2 className="mb-2 text-base font-semibold">Hosted operating model</h2>
          <p>
            These documents describe the current production path: Netlify for the UI/API and hosted Supabase
            for Auth/Postgres. Local database workflows are developer-only notes, not the training target.
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          {docs.map((doc) => {
            const isActive = doc.id === selectedId;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedId(doc.id)}
                className={`rounded-lg border p-4 text-left transition ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 shadow-sm dark:border-blue-400 dark:bg-blue-950/40'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-600 dark:hover:bg-gray-800'
                }`}
              >
                <span className="mb-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {doc.audience}
                </span>
                <h3 className="text-base font-semibold text-gray-950 dark:text-white">{doc.title}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{doc.description}</p>
              </button>
            );
          })}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex flex-col gap-2 border-b border-gray-200 pb-4 dark:border-gray-700 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                Selected document
              </p>
              <h2 className="text-xl font-semibold text-gray-950 dark:text-white">{selectedDoc.title}</h2>
            </div>
            <p className="max-w-xl text-sm text-gray-500 dark:text-gray-400">{selectedDoc.description}</p>
          </div>
          <SafeHtml
            html={renderedHtml}
            variant="markdown"
            className="prose prose-sm max-w-none text-gray-800 dark:prose-invert dark:text-gray-100 prose-headings:scroll-mt-20 prose-a:text-blue-600 dark:prose-a:text-blue-300 prose-table:block prose-table:overflow-x-auto"
          />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-950 dark:text-white">Graphic references</h2>
          <div className="grid gap-3 lg:grid-cols-3">
            {visualReferences.map((visual) => (
              <div
                key={visual.path}
                className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
              >
                <img
                  src={visual.path}
                  alt={visual.label}
                  className="aspect-video w-full rounded-md border border-gray-100 object-cover dark:border-gray-800"
                />
                <p className="mt-2 text-sm font-medium text-gray-800 dark:text-gray-100">{visual.label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </SettingsLayout>
  );
};

export default DocumentationSettings;
