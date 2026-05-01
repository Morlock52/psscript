import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import StatCard from '../StatCard';

function renderWithRouter(component: React.ReactElement) {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
}

describe('StatCard', () => {
  it('renders as a link when a destination is provided', () => {
    renderWithRouter(
      <StatCard
        title="Total Scripts"
        value={42}
        icon="script"
        to="/scripts"
        ariaLabel="View all scripts"
      />
    );

    expect(screen.getByRole('link', { name: /view all scripts/i })).toHaveAttribute('href', '/scripts');
    expect(screen.getByText('Total Scripts')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('keeps non-linked stat cards as static content', () => {
    render(<StatCard title="Total Users" value={3} icon="user" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Total Users')).toBeInTheDocument();
  });
});
