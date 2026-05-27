import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  verifySale,
  timingSafeEqualStr,
  webhookUrlSecret,
} from "@/lib/chariow.server";
import { sendEmail, wrapHtml, siteUrl } from "@/lib/email.server";

const WebhookSchema = z.object({
  event: z.string().min(1).max(64).optional(),
  type: z.string().min(1).max(64).optional(),
  sale: z
    .object({
      id: z.string().min(1).max(255).optional(),
      amount: z.number().or(z.string()).optional(),
      currency: z.string().max(16).optional(),
      status: z.string().max(64).optional(),
      custom_metadata: z.record(z.any()).optional(),
    })
    .optional()
    .nullable(),
  customer: z
    .object({
      email: z.string().email().max(255).optional(),
      first_name: z.string().max(255).optional(),
      last_name: z.string().max(255).optional(),
      phone: z.string().max(64).optional(),
      country: z.string().max(64).optional(),
    })
    .optional()
    .nullable(),
  product: z.object({ id: z.string().max(255).optional() }).optional().nullable(),
});

export const Route = createFileRoute("/api/public/hooks/chariow/$secret")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        // 1. Verify URL secret (constant time)
        try {
          const expected = webhookUrlSecret();
          if (!params.secret || !timingSafeEqualStr(params.secret, expected)) {
            return new Response("Forbidden", { status: 403 });
          }
        } catch {
          return new Response("Server misconfigured", { status: 500 });
        }

        // 2. Parse body
        const bodyText = await request.text();
        let raw: unknown;
        try {
          raw = JSON.parse(bodyText);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = WebhookSchema.safeParse(raw);
        if (!parsed.success) {
          return new Response("Invalid payload", { status: 400 });
        }
        const payload = parsed.data;
        const eventType = (payload.event ?? payload.type ?? "unknown").toString();
        const saleId = payload.sale?.id ?? "";

        if (!saleId) {
          return new Response("Missing sale.id", { status: 400 });
        }

        // 3. Idempotence: insert webhook event row (UNIQUE(event_type, sale_id))
        const { data: eventRow, error: insertErr } = await supabaseAdmin
          .from("chariow_webhook_events")
          .insert({
            event_type: eventType,
            sale_id: saleId,
            payload: raw as any,
          })
          .select("id")
          .maybeSingle();

        if (insertErr) {
          // Duplicate → already processed
          return new Response("Already processed", { status: 200 });
        }
        const eventRowId = eventRow?.id;

        // 4. Only process successful sale events
        const lower = eventType.toLowerCase();
        if (!lower.includes("success")) {
          await supabaseAdmin
            .from("chariow_webhook_events")
            .update({ processed_at: new Date().toISOString() })
            .eq("id", eventRowId);
          return new Response("OK", { status: 200 });
        }

        try {
          // 5. Re-verify with Chariow
          const verified: any = await verifySale(saleId);
          const s = verified?.sale ?? verified?.data ?? verified ?? {};
          const c = verified?.customer ?? payload.customer ?? {};
          const meta = s.custom_metadata ?? payload.sale?.custom_metadata ?? {};

          const cohortId: string | undefined = meta.cohort_id;
          const mode: "full" | "installments_2" =
            meta.mode === "installments_2" ? "installments_2" : "full";
          const position = Number(meta.installment_position ?? 1) || 1;
          const cohortSlug: string = meta.cohort_slug ?? "";

          if (!cohortId) {
            throw new Error("Missing cohort_id in custom_metadata");
          }

          const email = (c.email ?? payload.customer?.email ?? "").toLowerCase();
          const firstName = c.first_name ?? payload.customer?.first_name ?? "";
          const lastName = c.last_name ?? payload.customer?.last_name ?? "";
          const phone = c.phone ?? payload.customer?.phone ?? "";
          const amount = Number(s.amount ?? payload.sale?.amount ?? 0);
          const currency = s.currency ?? payload.sale?.currency ?? "XOF";

          // 6. Look up cohort & profile
          const [{ data: cohort }, { data: profile }] = await Promise.all([
            supabaseAdmin
              .from("cohortes")
              .select("id, slug, name, price_full, price_installment")
              .eq("id", cohortId)
              .maybeSingle(),
            email
              ? supabaseAdmin
                  .from("profiles")
                  .select("id, email")
                  .ilike("email", email)
                  .maybeSingle()
              : Promise.resolve({ data: null as any }),
          ]);

          if (!cohort) throw new Error("Cohorte introuvable");

          const studentId: string | null = profile?.id ?? null;
          const total =
            mode === "full"
              ? Number(cohort.price_full ?? amount)
              : Number(cohort.price_installment ?? amount);

          // 7a. If existing profile → create/update payment + installment
          if (studentId) {
            // Find or create payment for this student+cohort
            let { data: payment } = await supabaseAdmin
              .from("payments")
              .select("id")
              .eq("student_id", studentId)
              .eq("cohort_id", cohortId)
              .maybeSingle();

            if (!payment) {
              const { data: created } = await supabaseAdmin
                .from("payments")
                .insert({
                  student_id: studentId,
                  cohort_id: cohortId,
                  amount_total: total,
                  amount_paid: 0,
                  currency,
                  mode,
                  status: "pending",
                  source: "chariow",
                  chariow_sale_id: mode === "full" ? saleId : null,
                  chariow_customer_email: email,
                })
                .select("id")
                .single();
              payment = created;
            } else {
              await supabaseAdmin
                .from("payments")
                .update({
                  source: "chariow",
                  chariow_customer_email: email,
                  ...(mode === "full" ? { chariow_sale_id: saleId } : {}),
                })
                .eq("id", payment.id);
            }

            if (payment) {
              // Upsert the installment row
              const { data: existingInst } = await supabaseAdmin
                .from("payment_installments")
                .select("id")
                .eq("payment_id", payment.id)
                .eq("position", position)
                .maybeSingle();

              const instAmount = mode === "full" ? total : Math.round(total / 2);
              if (existingInst) {
                await supabaseAdmin
                  .from("payment_installments")
                  .update({
                    status: "validated",
                    amount: instAmount,
                    chariow_sale_id: saleId,
                    chariow_raw_payload: raw as any,
                    submitted_at: new Date().toISOString(),
                    validated_at: new Date().toISOString(),
                  })
                  .eq("id", existingInst.id);
              } else {
                await supabaseAdmin.from("payment_installments").insert({
                  payment_id: payment.id,
                  position,
                  amount: instAmount,
                  status: "validated",
                  chariow_sale_id: saleId,
                  chariow_raw_payload: raw as any,
                  submitted_at: new Date().toISOString(),
                  validated_at: new Date().toISOString(),
                });
              }
            }

            // Ensure enrollment exists
            await supabaseAdmin
              .from("cohort_enrollments")
              .upsert(
                { student_id: studentId, cohort_id: cohortId, status: "active" },
                { onConflict: "student_id,cohort_id" } as any,
              );
          } else {
            // 7b. No profile → pending_enrollment + email "claim"
            const claimToken =
              crypto.randomUUID().replace(/-/g, "") +
              crypto.randomUUID().replace(/-/g, "");

            const { data: pe } = await supabaseAdmin
              .from("pending_enrollments")
              .insert({
                cohort_id: cohortId,
                email,
                first_name: firstName,
                last_name: lastName,
                phone,
                chariow_sale_id: saleId,
                mode,
                installment_position: position,
                claim_token: claimToken,
              })
              .select("id, claim_token")
              .maybeSingle();

            // Also create a "ghost" payment row not linked to a student yet,
            // so admin paiements page can see it.
            await supabaseAdmin.from("payments").insert({
              student_id: null as any,
              cohort_id: cohortId,
              amount_total: total,
              amount_paid: mode === "full" ? total : Math.round(total / 2),
              currency,
              mode,
              status: mode === "full" ? "paid" : "partial",
              source: "chariow",
              chariow_sale_id: saleId,
              chariow_customer_email: email,
            } as any);

            // Send claim email
            if (email && pe?.claim_token) {
              const link = siteUrl(
                `/inscription/${cohortSlug}?claim=${pe.claim_token}`,
              );
              try {
                await sendEmail(
                  email,
                  "Finalisez votre inscription à Nodie IA Academy",
                  wrapHtml(
                    "Paiement reçu — créez votre accès",
                    `<p>Bonjour ${firstName || ""},</p>
                     <p>Nous avons bien reçu votre paiement pour la cohorte <strong>${cohort.name}</strong>.</p>
                     <p>Pour activer votre espace étudiant, créez votre compte en cliquant ici :</p>
                     <p><a href="${link}" style="display:inline-block;background:#c9a84c;color:#0d0d0d;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">Finaliser mon inscription</a></p>
                     <p style="font-size:12px;color:#888">Ou copiez ce lien : ${link}<br/>Lien valable 30 jours.</p>`,
                  ),
                );
              } catch (e) {
                console.error("claim email failed", e);
              }
            }
          }

          await supabaseAdmin
            .from("chariow_webhook_events")
            .update({ processed_at: new Date().toISOString() })
            .eq("id", eventRowId);

          return new Response("OK", { status: 200 });
        } catch (e: any) {
          await supabaseAdmin
            .from("chariow_webhook_events")
            .update({
              processed_at: new Date().toISOString(),
              error: String(e?.message ?? e).slice(0, 1000),
            })
            .eq("id", eventRowId);
          console.error("chariow webhook error", e);
          return new Response("Processed with error", { status: 200 });
        }
      },
    },
  },
});
