import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const sendOne = async (to: string, subject: string, html: string) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: "Nodie IA Academy <onboarding@resend.dev>", to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
};

export const sendPaymentReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ installmentIds: z.array(z.string().uuid()).min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("payment_installments")
      .select("id, amount, due_date, payments(student_id, cohort_id, currency, cohortes(name))")
      .in("id", data.installmentIds);
    if (error) throw new Error(error.message);

    const studentIds = [...new Set((rows ?? []).map((r: any) => r.payments?.student_id).filter(Boolean))];
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, first_name, email").in("id", studentIds);
    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const r of rows ?? []) {
      const p: any = pmap.get((r as any).payments?.student_id);
      if (!p?.email) { results.push({ id: r.id, ok: false, error: "no email" }); continue; }
      const cohortName = (r as any).payments?.cohortes?.name ?? "votre cohorte";
      const due = (r as any).due_date ?? "—";
      const amount = Number((r as any).amount).toLocaleString();
      const currency = (r as any).payments?.currency ?? "XOF";
      const html = `<div style="font-family:sans-serif;max-width:560px"><h2>Bonjour ${p.first_name ?? ""},</h2><p>Un rappel concernant votre paiement pour <strong>${cohortName}</strong>.</p><p>Montant : <strong>${amount} ${currency}</strong><br/>Échéance : <strong>${due}</strong></p><p>Connectez-vous à votre espace pour régler : <a href="https://project--66439da9-0337-4213-a275-40cffeef22c6.lovable.app/etudiant/paiements">Accéder</a></p><p>L'équipe Nodie IA Academy</p></div>`;
      try {
        await sendOne(p.email, `Rappel paiement — ${cohortName}`, html);
        await supabaseAdmin.from("payment_reminders").insert({ installment_id: r.id, channel: "email", status: "sent" });
        results.push({ id: r.id, ok: true });
      } catch (e: any) {
        await supabaseAdmin.from("payment_reminders").insert({ installment_id: r.id, channel: "email", status: "failed", error: e.message });
        results.push({ id: r.id, ok: false, error: e.message });
      }
    }
    return { sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  });
