import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "./email.server";

const AUDIENCES = ["all", "paid_full", "paid_partial", "unpaid", "restricted"] as const;

async function resolveAudience(cohortId: string, audience: string) {
  // All enrolled students in the cohort, with their profile + payment summary
  const { data: enrollments } = await supabaseAdmin
    .from("cohort_enrollments")
    .select("student_id, status")
    .eq("cohort_id", cohortId);

  const studentIds = (enrollments ?? []).map((e: any) => e.student_id);
  if (studentIds.length === 0) return [];

  const [{ data: profiles }, { data: payments }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, first_name, last_name, email").in("id", studentIds),
    supabaseAdmin.from("payments").select("student_id, status, amount_paid, amount_total").eq("cohort_id", cohortId).in("student_id", studentIds),
  ]);

  const pmap = new Map((payments ?? []).map((p: any) => [p.student_id, p]));
  const emap = new Map((enrollments ?? []).map((e: any) => [e.student_id, e.status]));

  return (profiles ?? []).filter((p: any) => {
    const pay: any = pmap.get(p.id);
    const enr = emap.get(p.id);
    switch (audience) {
      case "paid_full": return pay?.status === "paid";
      case "paid_partial": return pay?.status === "partial";
      case "unpaid": return !pay || pay.status === "pending";
      case "restricted": return enr === "restricted";
      case "all":
      default: return true;
    }
  });
}

export const sendCampaignNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ campaign_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: c, error } = await supabaseAdmin
      .from("cohort_email_campaigns")
      .select("*")
      .eq("id", data.campaign_id)
      .maybeSingle();
    if (error || !c) throw new Error("Campagne introuvable");
    if (c.sent_at) throw new Error("Campagne déjà envoyée");

    const recipients = await resolveAudience(c.cohort_id, c.audience);
    let sent = 0, failed = 0;
    for (const r of recipients) {
      if (!r.email) continue;
      try {
        const personalized = c.body_html.replace(/\{\{first_name\}\}/g, r.first_name ?? "");
        await sendEmail(r.email, c.subject, personalized);
        sent++;
      } catch (e: any) {
        failed++;
        await supabaseAdmin.from("automation_run_log").insert({
          job_type: "campaign_send", status: "error", error: e.message,
          payload: { campaign_id: c.id, email: r.email },
        });
      }
    }

    await supabaseAdmin
      .from("cohort_email_campaigns")
      .update({ sent_at: new Date().toISOString(), status: "sent", recipient_count: sent })
      .eq("id", c.id);

    await supabaseAdmin.from("automation_run_log").insert({
      job_type: "campaign_send", status: "ok",
      payload: { campaign_id: c.id, sent, failed, audience: c.audience },
    });

    return { sent, failed };
  });

export const previewCampaignAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      cohort_id: z.string().uuid(),
      audience: z.enum(AUDIENCES),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const recipients = await resolveAudience(data.cohort_id, data.audience);
    return { count: recipients.length, sample: recipients.slice(0, 5).map((r: any) => r.email) };
  });
