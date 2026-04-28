import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperatorShell } from '../OperatorShell';

describe('OperatorShell', () => {
  beforeEach(() => {
    document.body.removeAttribute('data-surface');
    document.body.removeAttribute('data-theme');
  });
  afterEach(() => {
    document.body.removeAttribute('data-surface');
    document.body.removeAttribute('data-theme');
  });
  it('sets data-surface=operator and data-theme=dark by default', () => {
    render(
      <MemoryRouter>
        <OperatorShell><div>x</div></OperatorShell>
      </MemoryRouter>,
    );
    expect(document.body.getAttribute('data-surface')).toBe('operator');
    expect(document.body.getAttribute('data-theme')).toBe('dark');
  });
  it('honors theme="light"', () => {
    render(
      <MemoryRouter>
        <OperatorShell theme="light"><div>x</div></OperatorShell>
      </MemoryRouter>,
    );
    expect(document.body.getAttribute('data-theme')).toBe('light');
  });
  it('renders the children', () => {
    const { getByText } = render(
      <MemoryRouter>
        <OperatorShell><div>hi</div></OperatorShell>
      </MemoryRouter>,
    );
    expect(getByText('hi')).toBeInTheDocument();
  });
});
