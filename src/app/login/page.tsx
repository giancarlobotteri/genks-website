import { sendMagicLink, signInWithPassword } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <div className="portal-shell narrow-shell">
    <span className="eyebrow">AREA CLIENTE GENKS</span>
    <h1>Accedi alla tua raccolta.</h1>
    <p className="muted">Accedi con la password oppure usa un collegamento sicuro monouso per entrare nella tua raccolta.</p>
    {query.sent && <p className="notice success" role="status">Controlla la posta. Il collegamento ha una validità limitata.</p>}
    {query.error && <p className="notice error" role="alert">Non è stato possibile completare l’accesso o inviare il collegamento. Riprova.</p>}
    <form action={signInWithPassword} className="premium-form">
      <input type="hidden" name="next" value={typeof query.next === "string" ? query.next : "/account/library"} />
      <label>Email<input name="email" type="email" autoComplete="email" required placeholder="nome@esempio.it" /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
      <button className="button button-primary magnetic-cta" type="submit">ACCEDI</button>
    </form>
    <div className="login-divider"><span>OPPURE</span></div>
    <form action={sendMagicLink} className="premium-form compact-form">
      <input type="hidden" name="next" value={typeof query.next === "string" ? query.next : "/account/library"} />
      <label>Email per il collegamento di accesso<input name="email" type="email" autoComplete="email" required placeholder="nome@esempio.it" /></label>
      <button className="button button-primary" type="submit">INVIA COLLEGAMENTO DI ACCESSO</button>
    </form>
  </div>;
}
