import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ScriptCard from '../ScriptCard';

// Helper to render with Router (includes future flags to avoid deprecation warnings)
const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {component}
    </BrowserRouter>
  );
};

describe('ScriptCard Component', () => {
  const mockScript = {
    id: '1',
    title: 'Test Script',
    description: 'A test PowerShell script',
    content: '# PowerShell script content',
    author: 'testuser',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category_id: 1,
    category_name: 'System Admin',
    tags: ['test', 'admin'],
    is_public: false,
    version: 1,
    security_score: 9.0,
    quality_score: 8.5,
    views: 42,
    executions: 10
  };

  it('renders script title', () => {
    renderWithRouter(<ScriptCard script={mockScript} />);
    expect(screen.getByText('Test Script')).toBeInTheDocument();
  });

  it('renders script description', () => {
    renderWithRouter(<ScriptCard script={mockScript} />);
    expect(screen.getByText('A test PowerShell script')).toBeInTheDocument();
  });

  it('renders category name', () => {
    renderWithRouter(<ScriptCard script={mockScript} />);
    expect(screen.getByText('System Admin')).toBeInTheDocument();
  });

  it('renders tags', () => {
    renderWithRouter(<ScriptCard script={mockScript} />);
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('displays quality score when available', () => {
    renderWithRouter(<ScriptCard script={mockScript} />);
    // Quality score is displayed as "8.5"
    expect(screen.getByText('8.5')).toBeInTheDocument();
  });

  it('displays security score when available', () => {
    renderWithRouter(<ScriptCard script={mockScript} />);
    // Security score is displayed as "9.0"
    expect(screen.getByText('9.0')).toBeInTheDocument();
  });

  it('displays visibility status', () => {
    renderWithRouter(<ScriptCard script={mockScript} />);
    expect(screen.getByText('Private')).toBeInTheDocument();
  });
});
