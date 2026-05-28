import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Internal helper — uses service role to bypass RLS for the cron worker.
function adminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: "Nodie IA Academy <onboarding@resend.dev>",
      to: [to], subject, html,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

const SITE = "https://project--66439da9-0337-4213-a275-40cffeef22c6.lovable.app";

export const Route = createFileRoute("/api/public/hooks/automation-tick")({
  server: {
    handlers: {
      POST: async () => {
        const supabase = adminClient();
        const today = new Date().toISOString().slice(0, 10);
        const summary: any = { reminders: 0, restricted: 0, campaigns: 0, errors: [] };

        // ---- 1. Relances paiement ----
        try {
          const { data: rules } = await supabase
            .from("cohort_reminder_rules")
            .select("id, cohort_id, offset_days, channel, template_key, enabled")
            .eq("enabled", true);

          for (const rule of rules ?? []) {
            if (rule.channel !== "email") continue;
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - rule.offset_days);
            const targetStr = targetDate.toISOString().slice(0, 10);

            const { data: insts } = await supabase
              .from("payment_installments")
              .select("id, amount, due_date, payment_id, payments!inner(student_id, cohort_id, currency, cohortes(name))")
              .eq("due_date", targetStr)
              .neq("status", "validated")
              .eq("payments.cohort_id", rule.cohort_id);

            for (const inst of insts ?? []) {
              // Dédupliquer : 1 relance par règle/installment/jour
              const { data: existing } = await supabase
                .from("payment_reminders")
                .select("id")
                .eq("installment_id", inst.id)
                .gte("sent_at", `${today}T00:00:00Z`)
                .limit(1);
              if (existing && existing.length > 0) continue;

              const { data: prof } = await supabase
                .from("profiles")
                .select("first_name, email")
                .eq("id", (inst as any).payments.student_id)
                .maybeSingle();
              if (!prof?.email) continue;

              const cohortName = (inst as any).payments?.cohortes?.name ?? "votre cohorte";
              const verb = rule.offset_days >= 0 ? "Rappel" : "Échéance proche";
              const html = `<div style="font-family:sans-serif;max-width:560px"><h2>Bonjour ${prof.first_name ?? ""},</h2><p>${verb} — paiement pour <strong>${cohortName}</strong>.</p><p>Montant : <strong>${Number(inst.amount).toLocaleString()} ${(inst as any).payments?.currency ?? "XOF"}</strong><br/>Échéance : <strong>${inst.due_date}</strong></p><p><a href="${SITE}/etudiant/paiements">Accéder à mes paiements</a></p></div>`;
              try {
                await sendEmail(prof.email, `${verb} paiement — ${cohortName}`, html);
                await supabase.from("payment_reminders").insert({ installment_id: inst.id, channel: "email", status: "sent" });
                summary.reminders++;
              } catch (e: any) {
                await supabase.from("payment_reminders").insert({ installment_id: inst.id, channel: "email", status: "failed", error: e.message });
                summary.errors.push(`reminder ${inst.id}: ${e.message}`);
              }
            }
          }
        } catch (e: any) { summary.errors.push(`reminders: ${e.message}`); }

        // ---- 2. Règles d'accès (restrict après retard) ----
        try {
          const { data: rules } = await supabase
            .from("cohort_access_rules")
            .select("*")
            .eq("enabled", true)
            .eq("action", "restrict_access");

          for (const rule of rules ?? []) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - rule.offset_days);
            const cutoffStr = cutoff.toISOString().slice(0, 10);

            let q = supabase
              .from("payment_installments")
              .select("id, position, payment_id, payments!inner(student_id, cohort_id)")
              .eq("payments.cohort_id", rule.cohort_id)
              .neq("status", "validated")
              .lte("due_date", cutoffStr);
            if (rule.installment_position) q = q.eq("position", rule.installment_position);

            const { data: late } = await q;
            for (const inst of late ?? []) {
              const sid = (inst as any).payments.student_id;
              const { error } = await supabase
                .from("cohort_enrollments")
                .update({ status: "restricted" })
                .eq("student_id", sid)
                .eq("cohort_id", rule.cohort_id)
                .eq("status", "active");
              if (!error) summary.restricted++;
            }
          }
        } catch (e: any) { summary.errors.push(`access: ${e.message}`); }

        // ---- 3. Campagnes email programmées ----
        try {
          const { data: campaigns } = await supabase
            .from("cohort_email_campaigns")
            .select("*")
            .eq("status", "scheduled")
            .lte("scheduled_at", new Date().toISOString());

          for (const c of campaigns ?? []) {
            // Mark sending to avoid double dispatch on overlapping ticks
            const { data: claimed } = await supabase
              .from("cohort_email_campaigns")
              .update({ status: "sending" })
              .eq("id", c.id)
              .eq("status", "scheduled")
              .select("id")
              .maybeSingle();
            if (!claimed) continue;

            const { data: enrollments } = await supabase
              .from("cohort_enrollments").select("student_id, status").eq("cohort_id", c.cohort_id);
            const ids = (enrollments ?? []).map((e: any) => e.student_id);
            const [{ data: profiles }, { data: pays }] = await Promise.all([
              supabase.from("profiles").select("id, first_name, email").in("id", ids),
              supabase.from("payments").select("student_id, status").eq("cohort_id", c.cohort_id).in("student_id", ids),
            ]);
            const pmap = new Map((pays ?? []).map((p: any) => [p.student_id, p]));
            const emap = new Map((enrollments ?? []).map((e: any) => [e.student_id, e.status]));
            const matched = (profiles ?? []).filter((p: any) => {
              const pay: any = pmap.get(p.id); const enr = emap.get(p.id);
              switch (c.audience) {
                case "paid_full": return pay?.status === "paid";
                case "paid_partial": return pay?.status === "partial";
                case "unpaid": return !pay || pay.status === "pending";
                case "restricted": return enr === "restricted";
                default: return true;
              }
            });
            let ok = 0;
            for (const r of matched) {
              if (!r.email) continue;
              try {
                const html = c.body_html.replace(/\{\{first_name\}\}/g, r.first_name ?? "");
                await sendEmail(r.email, c.subject, html);
                ok++;
              } catch {/* swallow per-recipient */}
            }
            await supabase.from("cohort_email_campaigns")
              .update({ status: "sent", sent_at: new Date().toISOString(), recipient_count: ok })
              .eq("id", c.id);
            summary.campaigns++;
          }
        } catch (e: any) { summary.errors.push(`campaigns: ${e.message}`); }

        await supabase.from("automation_run_log").insert({
          job_type: "automation_tick",
          status: summary.errors.length ? "partial" : "ok",
          payload: summary,
        });

        return new Response(JSON.stringify(summary), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
