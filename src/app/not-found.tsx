import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="not-found container">
      <span className="eyebrow">404 / OFF FREQUENCY</span>
      <h1>Signal lost.</h1>
      <p>This page isn’t here. Your next sound is.</p>
      <Link className="button button-primary" href="/beats">
        Explore beats <ArrowUpRight size={18} />
      </Link>
    </div>
  );
}
