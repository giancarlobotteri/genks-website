import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email";

type Message = Parameters<typeof sendTransactionalEmail>[0];

export async function queueNotification(key: string, input: Message) {
  const db = createSupabaseAdminClient();
  const { error } = await db.from("notification_outbox").upsert({
    dedupe_key: key, recipient: input.to, subject: input.subject, heading: input.heading,
    body: input.body, action_url: input.actionUrl ?? null, action_label: input.actionLabel ?? null,
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw new Error("Impossibile registrare la notifica da inviare.");
}

export async function deliverNotification(id: string) {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.rpc("claim_notification", { p_id: id });
  if (error) throw new Error("Impossibile riservare la notifica.");
  const message = data?.[0];
  if (!message) return;
  try {
    await sendTransactionalEmail({
      to: message.recipient, subject: message.subject, heading: message.heading, body: message.body,
      actionUrl: message.action_url ?? undefined, actionLabel: message.action_label ?? undefined,
      idempotencyKey: `notification-${message.id}`, serviceRequest: true,
    });
    const saved = await db.from("notification_outbox").update({ sent_at: new Date().toISOString(), locked_until: null, last_error: null }).eq("id", id);
    if (saved.error) throw new Error("Invio completato, salvataggio della conferma da ripetere.");
  } catch {
    await db.from("notification_outbox").update({ locked_until: null, last_error: "Invio non confermato. Controlla Resend e riprova dal pannello." }).eq("id", id);
    throw new Error("Una notifica è in attesa di invio.");
  }
}

export async function flushNotifications(options: { prefix?: string; limit?: number; throwOnFailure?: boolean } = {}) {
  const db = createSupabaseAdminClient();
  const query = db.from("notification_outbox").select("id").is("sent_at", null).is("cancelled_at",null).order("created_at").limit(options.limit ?? 20);
  if (options.prefix) query.like("dedupe_key", `${options.prefix}%`);
  const { data, error } = await query;
  if (error) throw new Error("Impossibile leggere la coda delle notifiche.");
  let failures = 0;
  for (const item of data ?? []) {
    try { await deliverNotification(item.id); } catch { failures++; }
    if((data?.length??0)>1)await new Promise(resolve=>setTimeout(resolve,550));
  }
  if (failures && options.throwOnFailure) throw new Error("Notifiche da ritentare.");
  return { attempted: data?.length ?? 0, failures };
}
