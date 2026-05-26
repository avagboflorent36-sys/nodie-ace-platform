import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, wrapHtml, siteUrl } from "@/lib/email.server";

/** Notify all admins of a new support request (in-app + email). */
export const sendSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      subject: z.string().min(2).max(200),
      message: z.string().min(5).max(5000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("first_name,last_name,email").eq("id", userId).maybeSingle();
    const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Étudiant";

    const { data: admins } = await supabaseAdmin
      .from("user_roles").select("user_id").in("role", ["admin", "super_admin"]);
    const adminIds = [...new Set((admins ?? []).map((r) => r.user_id))];

    if (adminIds.length > 0) {
      await supabaseAdmin.from("notifications").insert(
        adminIds.map((id) => ({
          user_id: id, type: "announcement" as const,
          title: `Support — ${fullName}`,
          content: `${data.subject}\n\n${data.message}\n\n— ${profile?.email ?? ""}`,
          link: `/admin/etudiants/${userId}`,
        })),
      );
    }

    const { data: adminProfiles } = await supabaseAdmin
      .from("profiles").select("email").in("id", adminIds);
    const html = wrapHtml(
      `Nouvelle demande de support`,
      `<p><strong>De :</strong> ${fullName} (${profile?.email ?? "—"})</p>
       <p><strong>Sujet :</strong> ${data.subject}</p>
       <p style="white-space:pre-wrap;background:#f7f7f7;padding:12px;border-radius:8px">${data.message}</p>
       <p><a href="${siteUrl(`/admin/etudiants/${userId}`)}">Voir l'étudiant</a></p>`,
    );
    await Promise.allSettled(
      (adminProfiles ?? []).filter((p) => p.email).map((p) =>
        sendEmail(p.email, `[Support] ${data.subject}`, html),
      ),
    );
    return { ok: true };
  });

/** Send enrollment confirmation to a student. */
export const sendEnrollmentConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ cohortId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const [{ data: profile }, { data: cohort }] = await Promise.all([
      supabaseAdmin.from("profiles").select("first_name,email").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("cohortes").select("name,start_date,formations(title)").eq("id", data.cohortId).maybeSingle(),
    ]);
    if (!profile?.email || !cohort) return { ok: false };
    const formationTitle = (cohort as any).formations?.title ?? "votre formation";
    const html = wrapHtml(
      `Inscription confirmée 🎉`,
      `<p>Bonjour ${profile.first_name ?? ""},</p>
       <p>Votre inscription à la cohorte <strong>${cohort.name}</strong> (${formationTitle}) est confirmée.</p>
       ${cohort.start_date ? `<p>Démarrage : <strong>${new Date(cohort.start_date).toLocaleDateString("fr-FR")}</strong></p>` : ""}
       <p><a href="${siteUrl("/etudiant")}" style="display:inline-block;background:#c9a84c;color:#0d0d0d;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Accéder à mon espace</a></p>`,
    );
    await sendEmail(profile.email, `Inscription confirmée — ${cohort.name}`, html);
    return { ok: true };
  });
