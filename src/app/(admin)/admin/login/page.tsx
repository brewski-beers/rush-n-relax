'use client';

import { useState, useTransition } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { initializeApp } from '@/firebase';

const CLAIMS_UPDATED_RETRY_CODE = 'CLAIMS_UPDATED_RETRY';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGoogleSignIn() {
    setError(null);
    startTransition(async () => {
      try {
        const { auth } = initializeApp();
        if (!auth) throw new Error('Auth not initialized.');

        const provider = new GoogleAuthProvider();
        const credential = await signInWithPopup(auth, provider);
        const idToken = await credential.user.getIdToken();

        let response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });

        if (response.status === 409) {
          const body = (await response.json()) as { code?: unknown };
          if (body.code === CLAIMS_UPDATED_RETRY_CODE) {
            const refreshedToken = await credential.user.getIdToken(true);
            response = await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: refreshedToken }),
            });
          }
        }

        if (!response.ok) {
          throw new Error(
            'Unable to establish admin session. Please try again.'
          );
        }

        // Hard navigation so the browser commits the Set-Cookie before the
        // middleware auth check runs (soft router.push fires too fast).
        window.location.assign('/admin/dashboard');
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Sign-in failed. Please try again.';
        setError(message);
      }
    });
  }

  return (
    <div className="admin-login-wrap">
      <h1>Admin Login</h1>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isPending}
        className="admin-submit"
      >
        {isPending ? 'Signing in…' : 'Sign in with Google'}
      </button>
    </div>
  );
}
