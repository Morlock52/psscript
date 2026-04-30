import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DocumentationSettingsView, { TrainingDoc, VisualReference } from '../DocumentationSettingsView';

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      created_at: '2026-04-29T00:00:00Z',
    },
  }),
}));

const fixtureDocs: TrainingDoc[] = [
  {
    id: 'lifecycle',
    title: 'Script Lifecycle Suite',
    description: 'Lifecycle description',
    audience: 'Authors, reviewers, admins',
    audienceTags: ['Authors', 'Reviewers', 'Admins'],
    moduleType: 'Lifecycle playbook',
    status: 'Current',
    icon: 'flow',
    accent: 'cyan',
    featuredGraphic: '/graphics/lifecycle.svg',
    content: '# Script Lifecycle Suite\n\n## Lifecycle Map\n\nLifecycle content',
  },
  {
    id: 'training',
    title: 'Training Guide',
    description: 'Training description',
    audience: 'Trainers and leads',
    audienceTags: ['Trainers', 'Team leads'],
    moduleType: 'Curriculum',
    status: 'Current',
    icon: 'book',
    accent: 'blue',
    featuredGraphic: '/graphics/support.svg',
    content: '# Training Guide\n\n## Program Overview\n\nTraining content',
  },
  {
    id: 'screenshots',
    title: 'Screenshot Atlas',
    description: 'Screenshot description',
    audience: 'Trainers and support',
    audienceTags: ['Trainers', 'Support'],
    moduleType: 'Reference atlas',
    status: 'Current',
    icon: 'image',
    accent: 'indigo',
    featuredGraphic: '/graphics/support.svg',
    content: '# Screenshot Atlas\n\n## Screenshot Gallery\n\nScreenshot content',
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
    featuredGraphic: '/graphics/escalation.svg',
    content: '# Support & Operations\n\n## Support Intake\n\nSupport content',
  },
  {
    id: 'governance-lab',
    title: 'Lab 05: Governance Support',
    description: 'Governance lab description',
    audience: 'All operators',
    audienceTags: ['Operators', 'Support', 'Admins'],
    moduleType: 'Hands-on lab',
    status: 'Current',
    icon: 'check',
    accent: 'slate',
    featuredGraphic: '/graphics/lifecycle.svg',
    content: '# Lab 05: Governance Support\n\n## Lab Steps\n\nGovernance content',
  },
];

const fixtureVisuals: VisualReference[] = [
  {
    label: 'Lifecycle Map',
    description: 'Lifecycle visual',
    path: '/graphics/lifecycle.svg',
  },
  {
    label: 'Support Suite Map',
    description: 'Support visual',
    path: '/graphics/support.svg',
  },
  {
    label: 'Escalation Ladder',
    description: 'Escalation visual',
    path: '/graphics/escalation.svg',
  },
  {
    label: 'Business Training Dashboard',
    description: 'Business dashboard visual',
    path: '/graphics/business-dashboard.svg',
  },
  {
    label: 'Readiness Scorecard',
    description: 'Readiness scorecard visual',
    path: '/graphics/readiness.svg',
  },
  {
    label: 'Settings Docs Screenshot',
    description: 'Settings docs screenshot',
    path: '/screenshots/settings-docs.png',
  },
];

function renderDocumentationSettings(canvaCompanionUrl = '') {
  render(
    <MemoryRouter initialEntries={['/settings/docs']}>
      <DocumentationSettingsView
        docs={fixtureDocs}
        visualReferences={fixtureVisuals}
        canvaCompanionUrl={canvaCompanionUrl}
      />
    </MemoryRouter>
  );
}

describe('DocumentationSettings training library', () => {
  it('renders the designed training library header', () => {
    renderDocumentationSettings();

    expect(screen.getByRole('heading', { name: /psscript training & support library/i })).toBeInTheDocument();
    expect(screen.getByText(/hosted training library/i)).toBeInTheDocument();
    expect(screen.getByText(/netlify and hosted supabase operating model/i)).toBeInTheDocument();
  });

  it('renders all five training document cards', () => {
    renderDocumentationSettings();

    const library = screen.getByLabelText(/training document library/i);
    for (const title of [
      'Script Lifecycle Suite',
      'Training Guide',
      'Screenshot Atlas',
      'Support & Operations',
      'Lab 05: Governance Support',
    ]) {
      expect(within(library).getByRole('button', { name: new RegExp(title, 'i') })).toBeInTheDocument();
    }
  });

  it('updates the reader when a different document is selected', async () => {
    const user = userEvent.setup();
    renderDocumentationSettings();

    expect(screen.getByTestId('training-reader-title')).toHaveTextContent('Script Lifecycle Suite');

    await user.click(screen.getByRole('button', { name: /support & operations/i }));

    expect(screen.getByTestId('training-reader-title')).toHaveTextContent('Support & Operations');
    expect(screen.getAllByText(/hosted netlify\/supabase support intake/i).length).toBeGreaterThan(0);
  });

  it('renders graphic reference tiles with accessible labels and links', () => {
    renderDocumentationSettings();

    for (const label of [
      'Lifecycle Map',
      'Support Suite Map',
      'Escalation Ladder',
      'Business Training Dashboard',
      'Readiness Scorecard',
      'Settings Docs Screenshot',
    ]) {
      expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: new RegExp(`${label}[\\s\\S]*view full graphic`, 'i') })).toBeInTheDocument();
    }
  });

  it('hides the Canva handout link until a final Canva URL is configured', () => {
    renderDocumentationSettings();

    expect(screen.queryByRole('link', { name: /open canva training handout/i })).not.toBeInTheDocument();
  });

  it('shows the Canva handout link when a final Canva URL is configured', () => {
    renderDocumentationSettings('https://www.canva.com/d/tUOQyjVSCvQPyqJ');

    expect(screen.getByRole('link', { name: /open canva training handout/i })).toHaveAttribute(
      'href',
      'https://www.canva.com/d/tUOQyjVSCvQPyqJ'
    );
  });
});
