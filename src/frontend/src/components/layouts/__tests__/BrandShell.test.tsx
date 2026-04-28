import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrandShell } from '../BrandShell';

describe('BrandShell', () => {
  beforeEach(() => {
    document.body.removeAttribute('data-surface');
    document.body.removeAttribute('data-theme');
  });
  afterEach(() => {
    document.body.removeAttribute('data-surface');
  });
  it('sets data-surface=brand on body while mounted', () => {
    const { unmount } = render(<BrandShell><div>x</div></BrandShell>);
    expect(document.body.getAttribute('data-surface')).toBe('brand');
    unmount();
    expect(document.body.getAttribute('data-surface')).not.toBe('brand');
  });
  it('renders the GradientField (aurora-glow class)', () => {
    const { container } = render(<BrandShell><div>x</div></BrandShell>);
    expect(container.querySelector('.aurora-glow')).toBeTruthy();
  });
  it('renders children', () => {
    const { getByText } = render(<BrandShell><div>hello</div></BrandShell>);
    expect(getByText('hello')).toBeInTheDocument();
  });
});
