"use client";
export default function AdminError({reset}:{reset:()=>void}) {
  return <div className="empty-state"><span className="eyebrow">GENKS ADMIN</span><h2>Non è stato possibile completare l’operazione.</h2><p>Riprova. Se l’errore continua, ricarica la pagina o accedi nuovamente.</p><button className="button button-primary" onClick={reset}>Riprova</button></div>;
}
