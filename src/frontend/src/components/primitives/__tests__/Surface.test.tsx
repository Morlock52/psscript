// src/frontend/src/components/primitives/__tests__/Surface.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Surface } from '../Surface';

describe('Surface', () => {
  it('renders children', () => {
    render(<Surface data-testid="s">hi</Surface>);
    expect(screen.getByTestId('s')).toHaveTextContent('hi');
  });
  it('applies elevation="raised" → bg-surface-raised class', () => {
    render(<Surface elevation="raised" data-testid="s" />);
    expect(screen.getByTestId('s').className).toMatch(/bg-surface-raised/);
  });
  it('applies elevation="overlay" → bg-surface-overlay class', () => {
    render(<Surface elevation="overlay" data-testid="s" />);
    expect(screen.getByTestId('s').className).toMatch(/bg-surface-overlay/);
  });
  it('default elevation is base', () => {
    render(<Surface data-testid="s" />);
    expect(screen.getByTestId('s').className).toMatch(/bg-surface-base/);
  });
});
