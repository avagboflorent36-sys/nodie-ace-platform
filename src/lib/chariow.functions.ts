import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { initCheckout, verifySale } from "./chariow.server";

const SITE_URL =
  process.env.SITE_URL ||
  "https://project--66439da9-0337-4213-a275-40cffeef22c6.lovable.app";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Démarrer un checkout Chariow (public — paiement avant compte)
// ─────────────────────────────────────────────────────────────────────────────
export const startChariowCheckout = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        cohort_id: z.string().uuid(),
        mode: z.enum(["full", "installments_2"]),
        installment_position: z.number().int().min(1).max(2).default(1),
        email: z.string().email().max(255),
        first_name: z.string().trim().min(1).max(100),
        last_name: z.string().trim().min(1).max(100),
        phone: z.string().trim().min(3).max(40),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: cohort, error } = await supabaseAdmin
      .from("cohortes")
      .select(
        "id, slug, name, price_full, price_installment, chariow_product_id_full, chariow_product_id_installment_1, chariow_product_id_installment_2",
      )
      .eq("id", data.cohort_id)
      .maybeSingle();
    if (error || !cohort) throw new Error("Cohorte introuvable");

    let productId: string | null = null;
    if (data.mode === "full") productId = cohort.chariow_product_id_full;
    else if (data.installment_position === 1)
      productId = cohort.chariow_product_id_installment_1;
    else productId = cohort.chariow_product_id_installment_2;

    if (!productId) {
      throw new Error(
        "Cette cohorte n'est pas encore configurée pour ce mode de paiement.",
      );
    }

    const redirect = `${SITE_URL}/inscription/${cohort.slug}?sale={sale_id}`;
    const checkout = await initCheckout({
      product_id: productId,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      redirect_url: redirect,
      custom_metadata: {
        cohort_id: cohort.id,
        cohort_slug: cohort.slug,
        mode: data.mode,
        installment_position: String(data.installment_position),
      },
    });

    const url: string | undefined =
      (checkout && typeof checkout === "object" && (checkout as any).checkout_url) ||
      (checkout && typeof checkout === "object" && (checkout as any).url) ||
      (checkout && typeof checkout === "object" && (checkout as any).data?.checkout_url);

    if (!url) {
      throw new Error("Chariow n'a pas renvoyé d'URL de paiement.");
    }
    return { checkout_url: url };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 2. Vérifier le statut d'une vente (public, info minimale)
// ─────────────────────────────────────────────────────────────────────────────
export const fetchSaleStatus = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ sale_id: z.string().min(3).max(255) }).parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const sale: any = await verifySale(data.sale_id);
      const s = sale?.sale ?? sale?.data ?? sale ?? {};
      return {
        status: s.status ?? "unknown",
        amount: s.amount ?? null,
        currency: s.currency ?? null,
        paid: ["paid", "success", "successful", "completed", "validated"].includes(
          String(s.status ?? "").toLowerCase(),
        ),
      };
    } catch (e: any) {
      return { status: "error", amount: null, currency: null, paid: false };
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// 3. Réclamer une inscription en attente (auth — appelé au signup)
// ─────────────────────────────────────────────────────────────────────────────
export const claimPendingEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ claim_token: z.string().min(10).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: pending, error } = await supabaseAdmin
      .from("pending_enrollments")
      .select("*")
      .eq("claim_token", data.claim_token)
      .maybeSingle();
    if (error || !pending) throw new Error("Lien d'inscription invalide.");
    if (pending.claimed_at) throw new Error("Ce lien a déjà été utilisé.");
    if (new Date(pending.expires_at).getTime() < Date.now())
      throw new Error("Ce lien a expiré.");

    // Lie le payment à cet utilisateur
    await supabaseAdmin
      .from("payments")
      .update({ student_id: userId })
      .eq("chariow_sale_id", pending.chariow_sale_id);

    // Crée l'inscription cohorte
    await supabaseAdmin
      .from("cohort_enrollments")
      .upsert(
        { student_id: userId, cohort_id: pending.cohort_id, status: "active" },
        { onConflict: "student_id,cohort_id" } as any,
      );

    await supabaseAdmin
      .from("pending_enrollments")
      .update({ claimed_at: new Date().toISOString(), claimed_by: userId })
      .eq("id", pending.id);

    return { ok: true, cohort_id: pending.cohort_id };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 4. Resync manuel d'une vente (admin)
// ─────────────────────────────────────────────────────────────────────────────
export const syncChariowSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ sale_id: z.string().min(3).max(255) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin" || r.role === "super_admin"))
      throw new Error("Admin only");

    const sale: any = await verifySale(data.sale_id);
    return { ok: true, sale };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 5. Configurer les Product IDs d'une cohorte (admin)
// ─────────────────────────────────────────────────────────────────────────────
export const setCohortChariowProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        cohort_id: z.string().uuid(),
        chariow_product_id_full: z.string().trim().max(255).nullable().optional(),
        chariow_product_id_installment_1: z
          .string()
          .trim()
          .max(255)
          .nullable()
          .optional(),
        chariow_product_id_installment_2: z
          .string()
          .trim()
          .max(255)
          .nullable()
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin" || r.role === "super_admin"))
      throw new Error("Admin only");

    const { error } = await supabaseAdmin
      .from("cohortes")
      .update({
        chariow_product_id_full: data.chariow_product_id_full || null,
        chariow_product_id_installment_1:
          data.chariow_product_id_installment_1 || null,
        chariow_product_id_installment_2:
          data.chariow_product_id_installment_2 || null,
      })
      .eq("id", data.cohort_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
