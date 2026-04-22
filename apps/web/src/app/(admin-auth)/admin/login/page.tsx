'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type ConfirmationResult,
  type Auth,
} from 'firebase/auth';
import { initializeApp } from '@/firebase';

const CLAIMS_UPDATED_RETRY_CODE = 'CLAIMS_UPDATED_RETRY';

/** Validates a raw 10-digit US phone number */
function isValidUsPhone(phone: string): boolean {
  return /^\d{10}$/.test(phone);
}

/** Converts a 10-digit input to E.164 US format */
function toE164(phone: string): string {
  return `+1${phone}`;
}

async function exchangeTokenForSession(
  idToken: string,
  user: { getIdToken: (force: boolean) => Promise<string> }
): Promise<Response> {
  let response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (response.status === 409) {
    const body = (await response.json()) as { code?: unknown };
    if (body.code === CLAIMS_UPDATED_RETRY_CODE) {
      const refreshedToken = await user.getIdToken(true);
      response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: refreshedToken }),
      });
    }
  }

  return response;
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'google' | 'phone' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  // Phone flow state
  const [phone, setPhone] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const authRef = useRef<Auth | null>(null);

  // Clean up reCAPTCHA on unmount
  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
    };
  }, []);

  function handleGoogleSignIn() {
    setError(null);
    startTransition(async () => {
      try {
        const { auth } = initializeApp();
        if (!auth) throw new Error('Auth not initialized.');

        const provider = new GoogleAuthProvider();
        const credential = await signInWithPopup(auth, provider);
        const idToken = await credential.user.getIdToken();

        const response = await exchangeTokenForSession(
          idToken,
          credential.user
        );

        if (!response.ok) {
          throw new Error(
            'Unable to establish admin session. Please try again.'
          );
        }

        router.replace('/admin/dashboard');
        router.refresh();
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Sign-in failed. Please try again.';
        setError(message);
      }
    });
  }

  function handleSendOtp() {
    if (!isValidUsPhone(phone)) {
      setError('Enter a valid 10-digit US phone number (e.g. 6155550123).');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const { auth } = initializeApp();
        if (!auth) throw new Error('Auth not initialized.');
        authRef.current = auth;

        // Re-use existing verifier or create a new one
        if (!recaptchaRef.current) {
          recaptchaRef.current = new RecaptchaVerifier(
            auth,
            'recaptcha-container',
            { size: 'invisible' }
          );
        }

        const result = await signInWithPhoneNumber(
          auth,
          toE164(phone),
          recaptchaRef.current
        );
        confirmationRef.current = result;
        setOtpStep(true);
      } catch (err: unknown) {
        recaptchaRef.current?.clear();
        recaptchaRef.current = null;
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to send OTP. Please try again.';
        setError(message);
      }
    });
  }

  function handleConfirmOtp() {
    setError(null);
    startTransition(async () => {
      try {
        const confirmation = confirmationRef.current;
        if (!confirmation) throw new Error('No OTP session. Please resend.');

        const credential = await confirmation.confirm(otp);
        const idToken = await credential.user.getIdToken();

        const response = await exchangeTokenForSession(
          idToken,
          credential.user
        );

        if (response.status === 403) {
          setError('You are not authorized to access this panel.');
          return;
        }

        if (!response.ok) {
          throw new Error(
            'Unable to establish admin session. Please try again.'
          );
        }

        router.replace('/admin/dashboard');
        router.refresh();
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
    <div className="staff-entry-shell">
      <div className="staff-entry-card admin-login-wrap">
        <h1 className="staff-entry-card-title">
          Sign in to <em>admin</em>
        </h1>

        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}

        {tab === null && (
          <div className="admin-login-methods">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="admin-submit"
            >
              {busy ? 'Signing in…' : 'Sign in with Google'}
            </button>
            <button
              type="button"
              onClick={() => setTab('phone')}
              className="admin-submit"
            >
              Sign in with Phone
            </button>
          </div>
        )}

        {tab === 'phone' && !otpStep && (
          <div className="admin-phone-form">
            <label htmlFor="phone-input" className="admin-label">
              Phone number
            </label>
            <div className="admin-input-prefix-wrap">
              <span className="admin-input-prefix">+1</span>
              <input
                id="phone-input"
                type="tel"
                value={phone}
                onChange={e =>
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                }
                placeholder="6155550123"
                className="admin-input"
                disabled={busy}
                autoComplete="tel-national"
                maxLength={10}
                inputMode="numeric"
              />
            </div>
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={busy || phone.length !== 10}
              className="admin-submit"
            >
              {busy ? 'Sending…' : 'Send OTP'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab(null);
                setPhone('');
                setError(null);
              }}
              className="admin-link-btn"
              disabled={busy}
            >
              Back
            </button>
          </div>
        )}

        {tab === 'phone' && otpStep && (
          <div className="admin-phone-form">
            <p className="admin-label">
              Enter the code sent to <strong>+1 {phone}</strong>
            </p>
            <label htmlFor="otp-input" className="admin-label">
              One-time code
            </label>
            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              placeholder="123456"
              className="admin-input"
              disabled={busy}
              autoComplete="one-time-code"
            />
            <button
              type="button"
              onClick={handleConfirmOtp}
              disabled={busy || otp.length === 0}
              className="admin-submit"
            >
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab(null);
                setOtpStep(false);
                setOtp('');
                setError(null);
                recaptchaRef.current?.clear();
                recaptchaRef.current = null;
              }}
              className="admin-link-btn"
              disabled={busy}
            >
              Back
            </button>
          </div>
        )}

        {/* Invisible reCAPTCHA anchor — always rendered so the verifier can attach */}
        <div id="recaptcha-container" />
      </div>
    </div>
  );
}
