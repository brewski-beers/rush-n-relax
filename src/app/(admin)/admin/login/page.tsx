'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { initializeApp } from '@/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);

    try {
      const { auth } = initializeApp();
      if (!auth) throw new Error('Auth not initialized.');

      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();

      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      router.push('/admin/dashboard');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Sign-in failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
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
        onClick={() => {
          void handleGoogleSignIn();
        }}
        disabled={loading}
        className="admin-submit"
      >
        {loading ? 'Signing in…' : 'Sign in with Google'}
      </button>
    </div>
  );
}
