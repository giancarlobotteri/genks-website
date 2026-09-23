import { sendMagicLink } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <div className="portal-shell narrow-shell">
    <span className="eyebrow">GENKS ACCOUNT</span>
    <h1>Enter your Library.</h1>
    <p className="muted">Use the same email used at checkout. We’ll send a secure one-time link—no password needed.</p>
    {query.sent && <p className="notice success" role="status">Check your inbox. The link expires shortly.</p>}
    {query.error && <p className="notice error" role="alert">We couldn’t send the link. Try again.</p>}
    <form action={sendMagicLink} className="premium-form">
      <input type="hidden" name="next" value={typeof query.next === "string" ? query.next : "/account/library"} />
      <label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
      <button className="button button-primary" type="submit">SEND MAGIC LINK</button>
    </form>
  </div>;
}
