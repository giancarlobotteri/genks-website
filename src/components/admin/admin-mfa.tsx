"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AdminMfa() {
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const client = createSupabaseBrowserClient();
    void Promise.all([client.auth.mfa.listFactors(), client.auth.mfa.getAuthenticatorAssuranceLevel()]).then(([factors, assurance]) => {
      if (!active) return;
      if (factors.error || assurance.error) { setError("Verifica non disponibile. Ricarica la pagina e riprova."); return; }
      if (assurance.data.currentLevel === "aal2") { window.location.replace("/admin"); return; }
      setFactorId(factors.data.totp.find(factor => factor.status === "verified")?.id ?? "");
      setReady(true);
    }).catch(() => { if (active) setError("Connessione non disponibile. Ricarica la pagina."); });
    return () => { active = false; };
  }, []);

  async function enroll() {
    setBusy(true); setError("");
    try {
      const client = createSupabaseBrowserClient();
      const factors = await client.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const verified = factors.data.totp.find(factor => factor.status === "verified");
      if (verified) { setFactorId(verified.id); return; }
      // Remove only abandoned, unverified enrollments belonging to this session's user.
      for (const factor of factors.data.all.filter(f => f.factor_type === "totp" && f.status === "unverified")) {
        const removed = await client.auth.mfa.unenroll({ factorId: factor.id });
        if (removed.error) throw removed.error;
      }
      const result = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "GENKS amministratore", issuer: "GENKS" });
      if (result.error) throw result.error;
      setFactorId(result.data.id);
      setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.data.totp.qr_code)}`);
    } catch { setError("Non è stato possibile configurare l’app. Riprova tra poco."); }
    finally { setBusy(false); }
  }
  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await createSupabaseBrowserClient().auth.mfa.challengeAndVerify({ factorId, code });
      if (result.error) throw result.error;
      setCode(""); setQr(""); window.location.replace("/admin");
    } catch { setError("Codice non valido o scaduto. Inserisci il codice attuale della tua app."); setBusy(false); }
  }
  return <section className="admin-form-card" aria-busy={busy}>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!ready ? <p role="status">Verifica della protezione…</p> : !factorId ? <>
      <h2>Proteggi il tuo pannello.</h2>
      <p>Apri Google Authenticator, Microsoft Authenticator o un’app equivalente sul telefono. Premi il pulsante, scansiona il QR e conferma con il codice a sei cifre. Conserva l’accesso alla tua app: servirà ai prossimi accessi.</p>
      <button className="button button-primary" type="button" onClick={enroll} disabled={busy}>Configura l’app di autenticazione</button>
    </> : <form onSubmit={verify} className="premium-form">
      {qr && <><p>Scansiona questo QR nella tua app. Non condividerlo.</p>{/* Local SVG from Supabase; never sent to an external image service. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} width={240} height={240} alt="QR riservato per configurare l’autenticazione GENKS" /></>}
      <label>Codice dell’app<input name="code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label>
      <button className="button button-primary" disabled={busy || code.length !== 6}>{busy ? "Verifica in corso…" : "Verifica e accedi"}</button>
    </form>}
  </section>;
}
