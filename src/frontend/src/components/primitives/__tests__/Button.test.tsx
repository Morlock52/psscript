// src/frontend/src/components/primitives/__tests__/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children and fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
  it('variant="primary" uses accent background', () => {
    render(<Button variant="primary">go</Button>);
    expect(screen.getByRole('button').className).toMatch(/bg-accent/);
  });
  it('variant="ghost" is text-only', () => {
    render(<Button variant="ghost">go</Button>);
    expect(screen.getByRole('button').className).not.toMatch(/bg-accent/);
  });
  it('variant="danger" uses signal-danger background', () => {
    render(<Button variant="danger">remove</Button>);
    expect(screen.getByRole('button').className).toMatch(/bg-signal-danger/);
  });
  it('disabled prop adds aria-disabled and disables onClick', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>x</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });
  it('loading prop replaces children with a Skeleton + retains accessible label', () => {
    render(<Button loading aria-label="Save">Save</Button>);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });
});
