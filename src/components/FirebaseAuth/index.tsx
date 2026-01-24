import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as firebaseui from 'firebaseui';
import { EmailAuthProvider, PhoneAuthProvider } from 'firebase/auth';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebaseui/dist/firebaseui.css';
import { initializeApp, firebaseConfig } from '@/firebase';

/**
 * FirebaseAuth renders FirebaseUI for email/password and phone sign-in.
 * Uses popup flow to avoid page reloads and navigates to the redirect param or home on success.
 */
export function FirebaseAuth() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [uiReady, setUiReady] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    // Ensure modular Firebase is initialized for the rest of the app
    initializeApp();

    // Create/lookup a compat app for FirebaseUI (expects compat auth)
    const compatApp = firebase.apps.length
      ? firebase.app()
      : firebase.initializeApp(firebaseConfig);
    const compatAuth = compatApp.auth();
    
    // Only connect to emulator if in dev AND not already connected
    if (import.meta.env.DEV && !compatAuth.emulatorConfig) {
      try {
        compatAuth.useEmulator('http://localhost:9099');
      } catch (error) {
        console.warn('[FirebaseAuth] Emulator already connected or unavailable:', error);
      }
    }

    const redirectTo = searchParams.get('redirect') || '/';
    const ui =
      firebaseui.auth.AuthUI.getInstance() ||
      new firebaseui.auth.AuthUI(compatAuth);

    const uiConfig: firebaseui.auth.Config = {
      signInFlow: 'popup',
      signInOptions: [
        {
          provider: EmailAuthProvider.PROVIDER_ID,
          requireDisplayName: true,
        },
        {
          provider: PhoneAuthProvider.PROVIDER_ID,
          defaultCountry: 'US',
        },
      ],
      callbacks: {
        signInSuccessWithAuthResult: () => {
          navigate(redirectTo, { replace: true });
          return false; // Prevent FirebaseUI redirect
        },
        uiShown: () => setUiReady(true),
      },
      credentialHelper: firebaseui.auth.CredentialHelper.NONE,
    };

    try {
      if (containerRef.current) {
        ui.start(containerRef.current, uiConfig);
      }
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to load sign-in UI');
    }

    return () => {
      ui.reset();
      ui.delete().catch(() => undefined);
    };
  }, [navigate, searchParams]);

  return (
    <div className="firebase-auth">
      <div ref={containerRef} />
      {!uiReady && !uiError && (
        <div className="auth-loading">Loading sign-in options...</div>
      )}
      {uiError && <div className="error-message">{uiError}</div>}
    </div>
  );
}
