import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ path: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => state.path }));
vi.mock('@/components/logout', () => ({ Logout: () => <button>Log out</button> }));
import { Shell } from '@/components/shell';
afterEach(() => { cleanup(); state.path = '/'; });
it('shows student navigation and the signed-in name without admin controls', () => {
  render(<Shell name="Robin Chen" role="STUDENT"><p>Page content</p></Shell>);
  const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
  expect(nav.getByRole('link', { name: /Dashboard/ }).getAttribute('aria-current')).toBe('page');
  expect(nav.getByRole('link', { name: /My subjects/ })).toBeTruthy();
  expect(nav.queryByRole('link', { name: /Course management/ })).toBeNull();
  expect(screen.getByText('Robin Chen')).toBeTruthy(); expect(screen.getByText('Page content')).toBeTruthy();
});
it('shows the administrator tab and marks course management active', () => {
  state.path = '/admin'; render(<Shell name="Alex Morgan" role="ADMIN"><p>Editor</p></Shell>);
  const nav = within(screen.getByRole('navigation'));
  expect(nav.getByRole('link', { name: /Course management/ }).getAttribute('aria-current')).toBe('page');
  expect(nav.getByRole('link', { name: /Dashboard/ }).getAttribute('aria-current')).toBeNull();
  expect(nav.queryByRole('link', { name: /My subjects/ })).toBeNull();
  expect(screen.getByText('Administrator')).toBeTruthy();
});
