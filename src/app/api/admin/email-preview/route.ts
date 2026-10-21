import { requireAdmin } from "@/lib/auth";
import { renderGenksStudioEmail } from "@/lib/email-design";
export const dynamic="force-dynamic";
export async function GET() {
  await requireAdmin();
  const html=renderGenksStudioEmail({subject:"GENKS · ANTEPRIMA · BKG-ANTEPRIMA",heading:"Hai una nuova prenotazione",body:"Questa è un’anteprima grafica. Nessuna prenotazione reale è stata creata.\nCliente: Artista di esempio\nServizio: Registrazione in studio\nAppuntamento: Sabato 24 ottobre 2026 · 19:30 – 21:30\nDurata: 2 ore\nTotale: 40,00 €\nPagamento: Contanti presso lo studio\nEmail cliente: artista@example.invalid\nRiferimento: BKG-ANTEPRIMA\nNon serve approvare la prenotazione. Registra il pagamento dopo aver ricevuto i contanti.",actionUrl:"https://www.prodbygenks.com/admin/bookings",actionLabel:"Apri le prenotazioni"});
  return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow, noarchive","X-Content-Type-Options":"nosniff"}});
}

