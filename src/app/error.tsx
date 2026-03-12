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
      {/* error.message is stripped by Next.js in production; show it only in dev */}
      <p>
        {process.env.NODE_ENV === 'development'
          ? error.message
          : 'An unknown error occurred. Please try again.'}
      </p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
