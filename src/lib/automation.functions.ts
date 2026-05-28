import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runAutomationTick, sendCampaign, resolveAudience } from "./automation.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!roles?.some((r: any) => r.role === "admin" || r.role === "super_admin"))
    throw new Error("Admin only");
}

const AUDIENCES = ["all", "paid_full", "paid_partial", "unpaid", "restricted"] as const;

export const sendCampaignNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ campaign_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: c } = await supabaseAdmin
      .from("cohort_email_campaigns")
      .select("id, sent_at")
      .eq("id", data.campaign_id)
      .maybeSingle();
    if (!c) throw new Error("Campagne introuvable");
    if (c.sent_at) throw new Error("Campagne déjà envoyée");

    const r = await sendCampaign(data.campaign_id);
    return r;
  });

export const previewCampaignAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        cohort_id: z.string().uuid(),
        audience: z.enum(AUDIENCES),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const recipients = await resolveAudience(data.cohort_id, data.audience);
    return {
      count: recipients.length,
      sample: recipients.slice(0, 5).map((r: any) => r.email),
    };
  });

// Admin : exécuter manuellement le tick d'automatisation (relances + accès + campagnes).
export const runAutomationsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const summary = await runAutomationTick();
    return summary;
  });

// Admin : lister les dernières exécutions d'automatisations
export const listAutomationRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await supabaseAdmin
      .from("automation_run_log")
      .select("id, run_at, job_type, status, error, payload")
      .order("run_at", { ascending: false })
      .limit(20);
    return { runs: data ?? [] };
  });
