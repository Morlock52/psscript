// src/frontend/src/components/primitives/__tests__/Tabs.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from '../Tabs';

describe('Tabs', () => {
  it('renders the supplied items and marks the active one', () => {
    render(
      <Tabs
        items={[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }]}
        active="b"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
  });
  it('fires onChange with the clicked id', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        items={[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }]}
        active="a"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
  it('arrow keys navigate', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }]}
        active="a"
        onChange={onChange}
      />,
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: 'A' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
