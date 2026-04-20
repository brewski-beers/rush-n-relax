'use client';

export default function LogoutButton() {
  async function handleLogout() {
    await fetch('/api/auth/session', { method: 'DELETE' });
    window.location.assign('/admin/login');
  }

  return (
    <button
      type="button"
      onClick={() => {
        void handleLogout();
      }}
      className="admin-logout-btn"
    >
      Logout
    </button>
  );
}
