// src/frontend/src/components/primitives/__tests__/Dialog.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from '../Dialog';

describe('Dialog', () => {
  it('does not render when open=false', () => {
    render(<Dialog open={false} title="t" onClose={() => {}}>x</Dialog>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('renders title and content when open', () => {
    render(<Dialog open title="Confirm" onClose={() => {}}>Body</Dialog>);
    expect(screen.getByRole('dialog')).toHaveTextContent('Confirm');
    expect(screen.getByRole('dialog')).toHaveTextContent('Body');
  });
  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    render(<Dialog open title="t" onClose={onClose}>x</Dialog>);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
  it('clicking the scrim calls onClose', () => {
    const onClose = vi.fn();
    render(<Dialog open title="t" onClose={onClose}>x</Dialog>);
    fireEvent.click(screen.getByTestId('dialog-scrim'));
    expect(onClose).toHaveBeenCalled();
  });
});
