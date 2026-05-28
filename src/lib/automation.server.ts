// Server-only — logique centralisée des automatisations (relances, accès, campagnes).
// Utilisée à la fois par le cron public et par le bouton "Exécuter maintenant" admin.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, wrapHtml, siteUrl } from "@/lib/email.server";

export type AutomationSummary = {
  reminders: number;
  restricted: number;
  campaigns: number;
  campaign_recipients: number;
  errors: string[];
};

// Vérifie qu'on est dans la fenêtre [time_of_day, time_of_day + 1h] aujourd'hui (UTC).
// Le cron tourne toutes les 15 min : une fenêtre d'1 h garantit qu'on déclenche une fois.
function isWithinTimeWindow(timeOfDay: string | null | undefined): boolean {
  if (!timeOfDay) return true;
  const [hh, mm] = String(timeOfDay).split(":").map((n) => Number(n) || 0);
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(hh, mm, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return now >= start && now <= end;
}

async function sendReminderForInstallment(inst: any, rule: any, summary: AutomationSummary, today: string) {
  // Dédup : 1 relance / installment / jour / règle
  const { data: existing } = await supabaseAdmin
    .from("payment_reminders")
    .select("id")
    .eq("installment_id", inst.id)
    .gte("sent_at", `${today}T00:00:00Z`)
    .limit(1);
  if (existing && existing.length > 0) return;

  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("first_name, email")
    .eq("id", (inst as any).payments.student_id)
    .maybeSingle();
  if (!prof?.email) return;

  const cohortName = (inst as any).payments?.cohortes?.name ?? "votre cohorte";
  const verb =
    rule.template_key === "reminder_overdue"
      ? "Paiement en retard"
      : rule.template_key === "reminder_due"
        ? "Échéance aujourd'hui"
        : "Rappel paiement";
  const amount = Number(inst.amount).toLocaleString();
  const currency = (inst as any).payments?.currency ?? "XOF";
  const html = wrapHtml(
    `${verb} — ${cohortName}`,
    `<p>Bonjour ${prof.first_name ?? ""},</p>
     <p>${verb} pour <strong>${cohortName}</strong>.</p>
     <p>Montant : <strong>${amount} ${currency}</strong><br/>Échéance : <strong>${inst.due_date}</strong></p>
     <p><a href="${siteUrl("/etudiant/paiements")}" style="display:inline-block;background:#c9a84c;color:#0d0d0d;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Régler maintenant</a></p>`,
  );

  try {
    await sendEmail(prof.email, `${verb} — ${cohortName}`, html);
    await supabaseAdmin
      .from("payment_reminders")
      .insert({ installment_id: inst.id, channel: "email", status: "sent" });
    summary.reminders++;
  } catch (e: any) {
    await supabaseAdmin
      .from("payment_reminders")
      .insert({
        installment_id: inst.id,
        channel: "email",
        status: "failed",
        error: String(e?.message ?? e).slice(0, 500),
      });
    summary.errors.push(`reminder ${inst.id}: ${String(e?.message ?? e).slice(0, 200)}`);
  }
}

export async function runAutomationTick(): Promise<AutomationSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const summary: AutomationSummary = {
    reminders: 0,
    restricted: 0,
    campaigns: 0,
    campaign_recipients: 0,
    errors: [],
  };

  // ---- 1. Relances paiement (par règle active) ----
  try {
    const { data: rules } = await supabaseAdmin
      .from("cohort_reminder_rules")
      .select("*")
      .eq("enabled", true);

    for (const rule of rules ?? []) {
      if (rule.channel !== "email") continue;

      // Mode absolu : run_at unique, last_run_at pour éviter répétition
      if (rule.trigger_mode === "absolute") {
        if (!rule.run_at || rule.last_run_at) continue;
        if (new Date(rule.run_at).getTime() > Date.now()) continue;

        const { data: insts } = await supabaseAdmin
          .from("payment_installments")
          .select("id, amount, due_date, payment_id, payments!inner(student_id, cohort_id, currency, cohortes(name))")
          .neq("status", "validated")
          .eq("payments.cohort_id", rule.cohort_id);

        for (const inst of insts ?? []) {
          await sendReminderForInstallment(inst, rule, summary, today);
        }
        await supabaseAdmin
          .from("cohort_reminder_rules")
          .update({ last_run_at: nowIso })
          .eq("id", rule.id);
        continue;
      }

      // Mode relatif : offset_days + time_of_day
      if (!isWithinTimeWindow(rule.time_of_day)) continue;

      const target = new Date();
      target.setDate(target.getDate() - rule.offset_days);
      const targetStr = target.toISOString().slice(0, 10);

      const { data: insts } = await supabaseAdmin
        .from("payment_installments")
        .select(
          "id, amount, due_date, payment_id, payments!inner(student_id, cohort_id, currency, cohortes(name))",
        )
        .eq("due_date", targetStr)
        .neq("status", "validated")
        .eq("payments.cohort_id", rule.cohort_id);

      for (const inst of insts ?? []) {
        await sendReminderForInstallment(inst, rule, summary, today);
      }
    }
  } catch (e: any) {
    summary.errors.push(`reminders: ${e.message}`);
  }

  // ---- 2. Règles d'accès (restrict après retard) ----
  try {
    const { data: rules } = await supabaseAdmin
      .from("cohort_access_rules")
      .select("*")
      .eq("enabled", true)
      .eq("action", "restrict_access");

    for (const rule of rules ?? []) {
      // Mode absolu : run_at unique
      if (rule.trigger_mode === "absolute") {
        if (!rule.run_at || rule.last_run_at) continue;
        if (new Date(rule.run_at).getTime() > Date.now()) continue;

        let q = supabaseAdmin
          .from("payment_installments")
          .select("id, position, payment_id, payments!inner(student_id, cohort_id)")
          .eq("payments.cohort_id", rule.cohort_id)
          .neq("status", "validated");
        if (rule.installment_position) q = q.eq("position", rule.installment_position);

        const { data: late } = await q;
        for (const inst of late ?? []) {
          const sid = (inst as any).payments.student_id;
          const { error } = await supabaseAdmin
            .from("cohort_enrollments")
            .update({ status: "restricted" })
            .eq("student_id", sid)
            .eq("cohort_id", rule.cohort_id)
            .eq("status", "active");
          if (!error) summary.restricted++;
        }
        await supabaseAdmin
          .from("cohort_access_rules")
          .update({ last_run_at: nowIso })
          .eq("id", rule.id);
        continue;
      }

      // Mode relatif : offset_days + time_of_day
      if (!isWithinTimeWindow(rule.time_of_day)) continue;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - rule.offset_days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      let q = supabaseAdmin
        .from("payment_installments")
        .select("id, position, payment_id, payments!inner(student_id, cohort_id)")
        .eq("payments.cohort_id", rule.cohort_id)
        .neq("status", "validated")
        .lte("due_date", cutoffStr);
      if (rule.installment_position) q = q.eq("position", rule.installment_position);

      const { data: late } = await q;
      for (const inst of late ?? []) {
        const sid = (inst as any).payments.student_id;
        const { error } = await supabaseAdmin
          .from("cohort_enrollments")
          .update({ status: "restricted" })
          .eq("student_id", sid)
          .eq("cohort_id", rule.cohort_id)
          .eq("status", "active");
        if (!error) summary.restricted++;
      }
    }
  } catch (e: any) {
    summary.errors.push(`access: ${e.message}`);
  }


  // ---- 3. Campagnes email programmées (échues) ----
  try {
    const { data: campaigns } = await supabaseAdmin
      .from("cohort_email_campaigns")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString());

    for (const c of campaigns ?? []) {
      const { data: claimed } = await supabaseAdmin
        .from("cohort_email_campaigns")
        .update({ status: "sending" })
        .eq("id", c.id)
        .eq("status", "scheduled")
        .select("id")
        .maybeSingle();
      if (!claimed) continue;

      const result = await sendCampaign(c.id);
      summary.campaigns++;
      summary.campaign_recipients += result.sent;
      if (result.failed > 0) {
        summary.errors.push(
          `campaign ${c.id}: ${result.failed} échec(s)${result.lastError ? ` (${result.lastError.slice(0, 120)})` : ""}`,
        );
      }
    }
  } catch (e: any) {
    summary.errors.push(`campaigns: ${e.message}`);
  }

  await supabaseAdmin.from("automation_run_log").insert({
    job_type: "automation_tick",
    status: summary.errors.length ? "partial" : "ok",
    payload: summary as any,
    error: summary.errors.length ? summary.errors.join(" | ").slice(0, 1000) : null,
  });

  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// Envoi d'une campagne (utilisé par sendCampaignNow ET par le tick).
// Marque sent/failed correctement et n'écrit "sent" QUE si au moins 1 mail est parti.
// ─────────────────────────────────────────────────────────────────────────────
export async function sendCampaign(
  campaignId: string,
): Promise<{ sent: number; failed: number; lastError?: string }> {
  const { data: c, error } = await supabaseAdmin
    .from("cohort_email_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error || !c) throw new Error("Campagne introuvable");

  const recipients = await resolveAudience(c.cohort_id, c.audience);
  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (const r of recipients) {
    if (!r.email) continue;
    try {
      const personalized = c.body_html.replace(/\{\{first_name\}\}/g, r.first_name ?? "");
      await sendEmail(r.email, c.subject, personalized);
      sent++;
    } catch (e: any) {
      failed++;
      lastError = String(e?.message ?? e);
      await supabaseAdmin.from("automation_run_log").insert({
        job_type: "campaign_send",
        status: "error",
        error: lastError.slice(0, 1000),
        payload: { campaign_id: c.id, email: r.email } as any,
      });
    }
  }

  const finalStatus = sent > 0 ? "sent" : "failed";
  await supabaseAdmin
    .from("cohort_email_campaigns")
    .update({
      status: finalStatus,
      sent_at: sent > 0 ? new Date().toISOString() : null,
      recipient_count: sent,
    })
    .eq("id", c.id);

  await supabaseAdmin.from("automation_run_log").insert({
    job_type: "campaign_send",
    status: failed === 0 ? "ok" : sent === 0 ? "error" : "partial",
    error: lastError ? lastError.slice(0, 1000) : null,
    payload: {
      campaign_id: c.id,
      sent,
      failed,
      audience: c.audience,
      total_audience: recipients.length,
    } as any,
  });

  return { sent, failed, lastError };
}

export async function resolveAudience(cohortId: string, audience: string) {
  const { data: enrollments } = await supabaseAdmin
    .from("cohort_enrollments")
    .select("student_id, status")
    .eq("cohort_id", cohortId);

  const studentIds = (enrollments ?? []).map((e: any) => e.student_id);
  if (studentIds.length === 0) return [];

  const [{ data: profiles }, { data: payments }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", studentIds),
    supabaseAdmin
      .from("payments")
      .select("student_id, status")
      .eq("cohort_id", cohortId)
      .in("student_id", studentIds),
  ]);

  const pmap = new Map((payments ?? []).map((p: any) => [p.student_id, p]));
  const emap = new Map((enrollments ?? []).map((e: any) => [e.student_id, e.status]));

  return (profiles ?? []).filter((p: any) => {
    const pay: any = pmap.get(p.id);
    const enr = emap.get(p.id);
    switch (audience) {
      case "paid_full":
        return pay?.status === "paid";
      case "paid_partial":
        return pay?.status === "partial";
      case "unpaid":
        return !pay || pay.status === "pending";
      case "restricted":
        return enr === "restricted";
      case "all":
      default:
        return true;
    }
  });
}
