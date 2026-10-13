import { getCurrentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getCurrentUser();
  return Response.json({ owner: user?.id ?? "guest" }, { headers: { "Cache-Control": "private, no-store" } });
}
