import type { ReactNode } from "react";
import "./design-motion.css";

export default function Template({ children }: { children: ReactNode }) {
  return <div className="customer-page-entry">{children}</div>;
}
