import { requireAdmin } from "@/lib/auth";
import PublicOffersPage from "@/components/admin/public-offers-page";
export default async function Promotions(props:Parameters<typeof PublicOffersPage>[0]) {
 await requireAdmin();
 return <PublicOffersPage {...props}/>;
}
