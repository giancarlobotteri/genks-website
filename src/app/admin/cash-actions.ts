"use server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { studioCashOnly } from "@/lib/studio-payment-mode";
import { expireServiceQuotes } from "@/lib/service-payments";
import { flushNotifications } from "@/lib/notifications";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function setBookingExtraTime(form: FormData) {
  const admin = await requireAdmin();
  const parsed = z.object({ id: z.uuid(), minutes: z.coerce.number().int().min(0).max(1440), expectedMinutes: z.coerce.number().int().min(0).max(1440), confirm: z.literal("on") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/admin/bookings?notice=extra_time_error");
  let notice = "extra_time_saved";
  try {
    const result = await createSupabaseAdminClient().rpc("set_booking_extra_time", { p_id: parsed.data.id, p_admin: admin.id, p_minutes: parsed.data.minutes, p_expected_minutes: parsed.data.expectedMinutes });
    if (result.error) throw new Error("Aggiornamento non riuscito.");
    if (result.data) {
      const sent = await flushNotifications({ prefix: `reservation-extra-${result.data}` });
      if (sent.failures) notice = "email_pending";
    }
  } catch { notice = "extra_time_error"; }
  for (const path of ["/admin/bookings", "/admin/analytics", "/account/bookings"]) revalidatePath(path);
  redirect(`/admin/bookings?notice=${notice}`);
}

export async function manageCashService(form: FormData) {
  const admin = await requireAdmin();
  const parsed = z.object({ type: z.enum(["booking", "project"]), id: z.uuid(), action: z.enum(["agree", "receive", "refund"]), confirm: z.literal("on") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/admin?notice=cash_error");
  const input = parsed.data;
  const path = input.type === "booking" ? "/admin/bookings" : "/admin/projects";
  const details = z.object({ amount: z.coerce.number().min(0.5).max(100000), details: z.string().trim().min(10).max(2000), revisions: z.coerce.number().int().min(0).max(50), deadline: z.union([z.literal(""), z.iso.date()]) }).safeParse(Object.fromEntries(form));
  if (input.action === "agree" && (!studioCashOnly || !details.success || input.type === "project" && !details.data.deadline)) redirect(`${path}?notice=cash_error`);
  const expectedAmount = z.coerce.number().int().min(50).max(10000000).safeParse(form.get("expectedAmount"));
  if (input.action === "receive" && !expectedAmount.success) redirect(`${path}?notice=cash_error`);
  let notice = "cash_saved";
  try {
    if (input.action === "agree") await expireServiceQuotes(input.type, input.id);
    const result = await createSupabaseAdminClient().rpc("manage_studio_cash_service", {
      p_action: input.action, p_type: input.type, p_id: input.id, p_admin: admin.id,
      ...(input.action === "agree" && details.success ? { p_amount: Math.round(details.data.amount * 100), p_details: details.data.details, p_revisions: details.data.revisions, p_deadline: details.data.deadline || null } : {}),
      ...(input.action === "receive" && expectedAmount.success ? { p_amount: expectedAmount.data } : {}),
    });
    if (result.error || !result.data) throw new Error("Registrazione contanti non riuscita.");
    const sent = await flushNotifications({ prefix: `cash-${input.action}-${result.data}` });
    if (sent.failures) notice = "email_pending";
  } catch { notice = "cash_error"; }
  for (const target of [path, "/admin", "/admin/analytics", "/account/bookings", "/account/projects"]) revalidatePath(target);
  redirect(`${path}?notice=${notice}`);
}
