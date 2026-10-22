"use client";
import { usePathname } from "next/navigation";
export function SiteAtmosphere(){const path=usePathname();if(path.startsWith("/admin"))return null;return <div className="site-atmosphere" aria-hidden="true"><i/><i/><i/></div>;}
