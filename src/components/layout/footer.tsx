import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { site } from "@/config/site";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-bottom container">
        <Link className="brand-mark footer-brand" href="/#home" aria-label="Pagina iniziale GENKS">
          <Image src="/brand/genks-logo.jpeg" width={54} height={54} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <span className="sr-only">GENKS</span>
        </Link>
        <p>Suono indipendente. Nato in Italia.</p>
        <div className="footer-socials">
          <a href={site.instagram} target="_blank" rel="noreferrer">
            Instagram <ArrowUpRight size={14} />
          </a>
          <a href={site.tiktok} target="_blank" rel="noreferrer">
            TikTok <ArrowUpRight size={14} />
          </a>
          <a href={site.youtube} target="_blank" rel="noreferrer">YouTube <ArrowUpRight size={14} /></a>
        </div>
        <div className="footer-socials"><Link href="/account/library">I miei acquisti</Link><Link href="/carrello">Carrello</Link><Link href="/legal/privacy">Riservatezza</Link><Link href="/legal/cookies">Cookie</Link><Link href="/legal/terms">Condizioni</Link><Link href="/legal/licensing">Licenze</Link></div>
        <span className="copyright">© {new Date().getFullYear()} GENKS</span>
      </div>
    </footer>
  );
}
