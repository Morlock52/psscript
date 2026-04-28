// src/frontend/src/components/primitives/__tests__/Badge.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('default tone uses ink-secondary', () => {
    render(<Badge>label</Badge>);
    expect(screen.getByText('label').className).toMatch(/text-ink-secondary/);
  });
  it.each(['critical', 'high', 'medium', 'low'] as const)('severity %s renders', (sev) => {
    render(<Badge severity={sev}>{sev}</Badge>);
    expect(screen.getByText(sev)).toBeInTheDocument();
  });
});
