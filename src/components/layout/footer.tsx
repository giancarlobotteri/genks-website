import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { site } from "@/config/site";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-bottom container">
        <Link className="brand-mark footer-brand" href="/" aria-label="GENKS home">
          <Image src="/icon.svg" width={54} height={54} alt="" style={{ width: "100%", height: "100%" }} />
          <span className="sr-only">GENKS</span>
        </Link>
        <p>Independent sound. Made in Italy.</p>
        <div className="footer-socials">
          <a href={site.instagram} target="_blank" rel="noreferrer">
            Instagram <ArrowUpRight size={14} />
          </a>
          <a href={site.tiktok} target="_blank" rel="noreferrer">
            TikTok <ArrowUpRight size={14} />
          </a>
          <a href={site.youtube} target="_blank" rel="noreferrer">YouTube <ArrowUpRight size={14} /></a>
        </div>
        <div className="footer-socials"><Link href="/legal/privacy">Privacy</Link><Link href="/legal/cookies">Cookies</Link><Link href="/legal/terms">Terms</Link><Link href="/legal/licensing">Licensing</Link></div>
        <span className="copyright">© {new Date().getFullYear()} GENKS</span>
      </div>
    </footer>
  );
}
