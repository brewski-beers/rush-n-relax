import { FirebaseAuth } from '@/components/FirebaseAuth';

/**
 * Login Page
 * Provides authentication for users
 */
export function Login() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Sign in</h1>
          <p className="login-subtitle">Use email or phone to continue.</p>
        </div>
        <FirebaseAuth />
      </div>
    </div>
  );
}
