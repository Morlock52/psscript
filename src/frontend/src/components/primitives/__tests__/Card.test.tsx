// src/frontend/src/components/primitives/__tests__/Card.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card data-testid="c">x</Card>);
    expect(screen.getByTestId('c')).toHaveTextContent('x');
  });
  it('hoverable adds the hover class', () => {
    render(<Card hoverable data-testid="c">x</Card>);
    expect(screen.getByTestId('c').className).toMatch(/hover:-translate-y-/);
  });
  it('density="dense" → tighter padding', () => {
    render(<Card density="dense" data-testid="c">x</Card>);
    expect(screen.getByTestId('c').className).toMatch(/p-3/);
  });
  it('default density is comfortable (p-5)', () => {
    render(<Card data-testid="c">x</Card>);
    expect(screen.getByTestId('c').className).toMatch(/p-5/);
  });
});
