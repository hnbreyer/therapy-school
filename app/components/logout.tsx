 'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
export function Logout() {
  const [error, setError] = useState('');
  return <><button onClick={async () => {
    try {
      const result = await authClient.signOut();
      if (result.error) setError('Could not log out. Please try again.');
      else window.location.assign(new URL('/login', window.location.origin).href);
    } catch { setError('Could not log out. Please try again.'); }
  }}>Log out</button>{error && <p role="alert">{error}</p>}</>;
}
