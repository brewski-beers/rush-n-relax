'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error-container error-fallback">
      <h1>Something went wrong</h1>
      <p>{error.message || 'An unknown error occurred'}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
