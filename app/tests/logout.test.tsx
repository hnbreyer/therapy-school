import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
const signOut = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut } }));
import { Logout } from '@/components/logout';
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it.each(['server', 'network'])('shows a recoverable error when logout encounters a %s failure', async failure => {
  if (failure === 'server') signOut.mockResolvedValue({ error: { message: 'Cannot revoke session' } });
  else signOut.mockRejectedValue(new Error('offline'));
  render(<Logout />); await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Could not log out. Please try again.');
  expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
});
