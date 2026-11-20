import { CommerceCheckout } from "./commerce-checkout.tsx";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "./styles/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { SitePage, sitePageFor } from "./site-pages.tsx";
import { PaymentNotice } from "./payment-notice.tsx";

const page = sitePageFor(location.pathname);
createRoot(document.getElementById("root")!).render(
  <StrictMode>{page ? <SitePage page={page} /> : <><App /><CommerceCheckout /><PaymentNotice /></>}</StrictMode>,
);
