import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="error-container">
      <h1>Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <Link href="/" className="btn">
        Back to Home
      </Link>
    </main>
  );
}
