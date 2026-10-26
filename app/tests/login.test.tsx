import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import Login from '@/app/login/page';

const signIn = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { email: signIn } } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it.each([
  [{ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' }, 'Invalid email or password. Please try again.'],
  [{ status: 403, code: 'INVALID_ORIGIN' }, 'Login is not configured for this web address. Please use the configured application address or contact the administrator.'],
  [{ status: 429 }, 'Too many login attempts. Please wait a moment and try again.'],
  [{ status: 500 }, 'Unable to log in. Please try again.'],
])('shows the correct feedback for authentication error %j', async (error, message) => {
  signIn.mockResolvedValue({ error });
  const user = userEvent.setup();
  render(<Login />);
  await user.type(screen.getByLabelText('Email'), 'jamie@example.test');
  await user.type(screen.getByLabelText('Password', { exact: true }), 'Haven-local-2026!');
  await user.click(screen.getByRole('button', { name: /^Log in$/ }));
  expect((await screen.findByRole('alert')).textContent).toBe(message);
});

it('toggles password visibility without changing or submitting the password', async () => {
  const user = userEvent.setup(); render(<Login />);
  const password = screen.getByLabelText('Password', { exact: true }) as HTMLInputElement;
  await user.type(password, 'Typed-password!');
  expect(password.type).toBe('password');
  await user.click(screen.getByRole('button', { name: 'Show password' }));
  expect(password.type).toBe('text'); expect(password.value).toBe('Typed-password!');
  await user.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(password.type).toBe('password'); expect(password.value).toBe('Typed-password!');
  expect(signIn).not.toHaveBeenCalled();
});
it('handles a network failure without clearing the login inputs', async () => {
  signIn.mockRejectedValue(new Error('offline'));
  const user = userEvent.setup(); render(<Login />);
  await user.type(screen.getByLabelText('Email'), 'robin@example.test');
  const password = screen.getByLabelText('Password', { exact: true }) as HTMLInputElement;
  await user.type(password, 'Typed-password!'); await user.click(screen.getByRole('button', { name: /^Log in$/ }));
  expect((await screen.findByRole('alert')).textContent).toBe('Unable to log in. Please try again.');
  expect(password.value).toBe('Typed-password!'); expect((screen.getByRole('button', { name: /^Log in$/ }) as HTMLButtonElement).disabled).toBe(false);
});
