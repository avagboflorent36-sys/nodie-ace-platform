import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, wrapHtml, siteUrl } from "@/lib/email.server";

export const Route = createFileRoute("/api/public/hooks/payment-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: anon/publishable key passed by pg_cron in `apikey` header
        const apiKey = request.headers.get("apikey") ?? request.headers.get("Authorization")?.replace("Bearer ", "");
        if (!apiKey || apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const today = new Date();
        const todayIso = today.toISOString().slice(0, 10);

        // Load enabled email rules across all cohorts
        const { data: rules } = await supabaseAdmin
          .from("cohort_reminder_rules")
          .select("id, cohort_id, offset_days, template_key, enabled, channel")
          .eq("enabled", true)
          .eq("channel", "email");

        if (!rules || rules.length === 0) {
          return Response.json({ ok: true, sent: 0, skipped: 0, message: "No active rules" });
        }

        // For each rule, compute target due_date and fetch matching installments
        const send: Array<{ ruleId: string; installmentId: string; templateKey: string }> = [];

        for (const rule of rules) {
          const target = new Date(today);
          target.setDate(target.getDate() - rule.offset_days);
          const targetIso = target.toISOString().slice(0, 10);

          const { data: insts } = await supabaseAdmin
            .from("payment_installments")
            .select("id, payment_id, due_date, payments!inner(cohort_id, student_id)")
            .eq("due_date", targetIso)
            .neq("status", "validated")
            .neq("status", "rejected");

          for (const i of insts ?? []) {
            if ((i as any).payments?.cohort_id !== rule.cohort_id) continue;
            send.push({ ruleId: rule.id, installmentId: i.id, templateKey: rule.template_key });
          }
        }

        if (send.length === 0) {
          return Response.json({ ok: true, sent: 0, skipped: 0 });
        }

        // Idempotency: skip installments already reminded today
        const { data: already } = await supabaseAdmin
          .from("payment_reminders")
          .select("installment_id")
          .gte("sent_at", `${todayIso}T00:00:00Z`)
          .in("installment_id", send.map((s) => s.installmentId));
        const sentToday = new Set((already ?? []).map((a) => a.installment_id));

        const toSend = send.filter((s) => !sentToday.has(s.installmentId));

        // Hydrate data needed for emails
        const { data: rows } = await supabaseAdmin
          .from("payment_installments")
          .select("id, amount, due_date, payments(student_id, currency, cohortes(name))")
          .in("id", toSend.map((s) => s.installmentId));

        const studentIds = [...new Set((rows ?? []).map((r: any) => r.payments?.student_id).filter(Boolean))];
        const { data: profiles } = await supabaseAdmin
          .from("profiles").select("id, first_name, email").in("id", studentIds);
        const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        const rmap = new Map((rows ?? []).map((r) => [r.id, r]));

        let sent = 0, failed = 0;
        for (const item of toSend) {
          const r: any = rmap.get(item.installmentId);
          if (!r) continue;
          const p: any = pmap.get(r.payments?.student_id);
          if (!p?.email) { failed++; continue; }
          const cohortName = r.payments?.cohortes?.name ?? "votre cohorte";
          const amount = Number(r.amount).toLocaleString();
          const currency = r.payments?.currency ?? "XOF";
          const due = r.due_date ?? "—";

          const subject = item.templateKey === "reminder_overdue"
            ? `Paiement en retard — ${cohortName}`
            : item.templateKey === "reminder_due"
            ? `Échéance aujourd'hui — ${cohortName}`
            : `Rappel paiement — ${cohortName}`;

          const intro = item.templateKey === "reminder_overdue"
            ? `Votre paiement pour <strong>${cohortName}</strong> est en retard.`
            : item.templateKey === "reminder_due"
            ? `Votre échéance pour <strong>${cohortName}</strong> est aujourd'hui.`
            : `Petit rappel concernant votre prochaine échéance pour <strong>${cohortName}</strong>.`;

          const html = wrapHtml(subject,
            `<p>Bonjour ${p.first_name ?? ""},</p>
             <p>${intro}</p>
             <p>Montant : <strong>${amount} ${currency}</strong><br/>Échéance : <strong>${due}</strong></p>
             <p><a href="${siteUrl("/etudiant/paiements")}" style="display:inline-block;background:#c9a84c;color:#0d0d0d;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Régler maintenant</a></p>`,
          );

          try {
            await sendEmail(p.email, subject, html);
            await supabaseAdmin.from("payment_reminders").insert({ installment_id: item.installmentId, channel: "email", status: "sent" });
            sent++;
          } catch (e: any) {
            await supabaseAdmin.from("payment_reminders").insert({ installment_id: item.installmentId, channel: "email", status: "failed", error: e.message });
            failed++;
          }
        }

        return Response.json({ ok: true, sent, failed, skipped: sentToday.size });
      },
    },
  },
});
