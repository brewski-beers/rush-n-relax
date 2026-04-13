'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
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

/** Basic E.164 format validation: +<country code><number>, 7–15 digits total */
function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
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
  const [tab, setTab] = useState<'google' | 'phone'>('google');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function handleSendOtp() {
    if (!isValidE164(phone)) {
      setError(
        'Enter a valid phone number in E.164 format (e.g. +12345678900).'
      );
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
          phone,
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

      <div className="admin-login-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'google'}
          onClick={() => {
            setTab('google');
            setError(null);
          }}
          className={`admin-login-tab${tab === 'google' ? ' active' : ''}`}
        >
          Google
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'phone'}
          onClick={() => {
            setTab('phone');
            setError(null);
          }}
          className={`admin-login-tab${tab === 'phone' ? ' active' : ''}`}
        >
          Phone
        </button>
      </div>

      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}

      {tab === 'google' && (
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isPending}
          className="admin-submit"
        >
          {isPending ? 'Signing in…' : 'Sign in with Google'}
        </button>
      )}

      {tab === 'phone' && !otpStep && (
        <div className="admin-phone-form">
          <label htmlFor="phone-input" className="admin-label">
            Phone number (E.164 format)
          </label>
          <input
            id="phone-input"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+12345678900"
            className="admin-input"
            disabled={isPending}
            autoComplete="tel"
          />
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={isPending || phone.length === 0}
            className="admin-submit"
          >
            {isPending ? 'Sending…' : 'Send OTP'}
          </button>
        </div>
      )}

      {tab === 'phone' && otpStep && (
        <div className="admin-phone-form">
          <p className="admin-label">
            Enter the code sent to <strong>{phone}</strong>
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
            disabled={isPending}
            autoComplete="one-time-code"
          />
          <button
            type="button"
            onClick={handleConfirmOtp}
            disabled={isPending || otp.length === 0}
            className="admin-submit"
          >
            {isPending ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={() => {
              setOtpStep(false);
              setOtp('');
              setError(null);
              recaptchaRef.current?.clear();
              recaptchaRef.current = null;
            }}
            className="admin-link-btn"
            disabled={isPending}
          >
            Back
          </button>
        </div>
      )}

      {/* Invisible reCAPTCHA anchor — always rendered so the verifier can attach */}
      <div id="recaptcha-container" />
    </div>
  );
}
