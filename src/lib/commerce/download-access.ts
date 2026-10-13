export type PremiumAssetKind = "mp3" | "wav" | "stems";

type Grant = {
  customer_id: string | null;
  beat_id: string | null;
  license_type_id: string | null;
  order_item_id: string;
  revoked_at: string | null;
};
type PurchasedItem = {
  id: string;
  order_id: string;
  beat_id: string | null;
  license_type_id: string | null;
  license_terms_snapshot: unknown;
};
type PaidOrder = {
  id: string;
  customer_id: string | null;
  status: string;
  paid_at: string | null;
  refunded_at: string | null;
};

export function allowedDownloadKinds(grant: Grant, item: PurchasedItem, order: PaidOrder, customerId: string): PremiumAssetKind[] {
  if (
    grant.customer_id !== customerId || order.customer_id !== customerId ||
    grant.revoked_at !== null || order.status !== "paid" || !order.paid_at || order.refunded_at !== null ||
    !grant.beat_id || !grant.license_type_id ||
    grant.order_item_id !== item.id || item.order_id !== order.id ||
    grant.beat_id !== item.beat_id || grant.license_type_id !== item.license_type_id
  ) return [];
  const snapshot = item.license_terms_snapshot;
  if (!snapshot || typeof snapshot !== "object" || !("includedAssets" in snapshot)) return [];
  const assets = snapshot.includedAssets;
  if (!Array.isArray(assets)) return [];
  return [...new Set(assets.filter((kind): kind is PremiumAssetKind => kind === "mp3" || kind === "wav" || kind === "stems"))];
}
