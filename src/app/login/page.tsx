import { sendMagicLink, signInWithPassword } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <div className="portal-shell narrow-shell">
    <span className="eyebrow">GENKS ACCOUNT</span>
    <h1>Enter your Library.</h1>
    <p className="muted">Sign in with your password, or use a secure one-time link for your customer Library.</p>
    {query.sent && <p className="notice success" role="status">Check your inbox. The link expires shortly.</p>}
    {query.error && <p className="notice error" role="alert">We couldn’t send the link. Try again.</p>}
    <form action={signInWithPassword} className="premium-form">
      <input type="hidden" name="next" value={typeof query.next === "string" ? query.next : "/account/library"} />
      <label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
      <button className="button button-primary magnetic-cta" type="submit">SIGN IN</button>
    </form>
    <div className="login-divider"><span>OR</span></div>
    <form action={sendMagicLink} className="premium-form compact-form">
      <input type="hidden" name="next" value={typeof query.next === "string" ? query.next : "/account/library"} />
      <label>Email for magic link<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
      <button className="button button-primary" type="submit">SEND MAGIC LINK</button>
    </form>
  </div>;
}
