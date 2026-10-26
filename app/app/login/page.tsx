'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
export default function Login() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  return <main className="auth-panel"><h1>Welcome to Haven</h1><p>Log in to your learning space.</p><form onSubmit={async event => {
    event.preventDefault(); setPending(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({ email: String(data.get('email')), password: String(data.get('password')) });
      if (result.error) {
        if (result.error.status === 429) setError('Too many login attempts. Please wait a moment and try again.');
        else if (result.error.code === 'INVALID_ORIGIN') setError('Login is not configured for this web address. Please use the configured application address or contact the administrator.');
        else if (result.error.status === 401 || result.error.code === 'INVALID_EMAIL_OR_PASSWORD') setError('Invalid email or password. Please try again.');
        else setError('Unable to log in. Please try again.');
      }
      else window.location.assign(new URL('/', window.location.origin).href);
    } catch { setError('Unable to log in. Please try again.'); }
    finally { setPending(false); }
  }}><label>Email<input name="email" type="email" autoComplete="username" required /></label><label htmlFor="password">Password</label><div className="password-field"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required /><button className="password-toggle" type="button" aria-controls="password" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(visible => !visible)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg></button></div><button disabled={pending}>{pending ? 'Logging in…' : 'Log in'}</button>{error && <p role="alert">{error}</p>}</form></main>;
}
