"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="not-found container">
      <span className="eyebrow">SIGNAL INTERRUPTED</span>
      <h1>Let’s try that again.</h1>
      <p>Something couldn’t load. Your player and navigation are still here.</p>
      <button className="button button-primary" type="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
