"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="not-found container">
      <span className="eyebrow">SEGNALE INTERROTTO</span>
      <h1>Riproviamo.</h1>
      <p>Non è stato possibile caricare un contenuto. Il lettore e la navigazione restano disponibili.</p>
      <button className="button button-primary" type="button" onClick={reset}>
        Riprova
      </button>
    </div>
  );
}
