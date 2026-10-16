# GENKS email identity

Every GENKS email uses blue backgrounds and pure white text. Blue is reserved for surfaces, borders and decoration. Do not introduce grey text, grey borders or grey backgrounds. Keep the layout readable on small screens and use email-compatible tables and inline styles.

Gmail on iOS can invert inline white text to near black while preserving a blue gradient, destroying contrast. `protectMailColours` locks solid blue surfaces with a same-colour gradient and wraps visible text with Gmail-specific screen/difference blend layers, selected using Gmail's injected `u + .genks-email` element. Preserve both layers and the body class. Standard dark-mode media queries or `!important` alone do not fix this Gmail behaviour. The fallback for other email clients remains white text on blue. Verify the normal rendering and a Gmail full-inversion simulation; a browser preview alone is not proof of actual iPhone rendering.

`src/lib/email-design.ts` is the shared design for operational mail, order confirmations, support replies and the Supabase authentication templates. Escape customer content before rendering it; the authentication renderer accepts only reviewed template source from this repository.

Run `node --experimental-strip-types scripts/render-auth-emails.mjs` to regenerate the 13 authentication templates from `supabase/email-templates/source.json`. The script checks that authentication links and Go template placeholders remain unchanged. Apply those generated HTML files in Supabase → Authentication → Emails. Deploying the website alone does not update Supabase email templates. Preserve security-notification enable/disable settings while editing their appearance.

Do not store real access tokens, magic links, API keys or SMTP credentials in these files. The `{{ ... }}` values in the templates are placeholders, not real credentials.
