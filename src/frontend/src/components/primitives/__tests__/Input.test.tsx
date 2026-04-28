// src/frontend/src/components/primitives/__tests__/Input.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../Input';

describe('Input', () => {
  it('renders with label and forwards ref', () => {
    render(<Input label="Email" name="email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
  it('forwards onChange', () => {
    const onChange = vi.fn();
    render(<Input label="x" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('x'), { target: { value: 'hi' } });
    expect(onChange).toHaveBeenCalled();
  });
  it('renders error helper text and aria-invalid', () => {
    render(<Input label="x" error="required" />);
    expect(screen.getByText('required')).toBeInTheDocument();
    expect(screen.getByLabelText('x')).toHaveAttribute('aria-invalid', 'true');
  });
});
