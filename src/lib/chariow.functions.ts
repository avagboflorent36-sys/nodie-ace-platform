import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { initCheckout, verifySale, processChariowSale } from "./chariow.server";

const SITE_URL =
  process.env.SITE_URL ||
  "https://project--66439da9-0337-4213-a275-40cffeef22c6.lovable.app";

function normalizeChariowProductId(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  const idMatch = raw.match(/prd_[a-z0-9]+/i);
  if (idMatch) return idMatch[0];

  const withoutQuery = raw.split(/[?#]/)[0].replace(/\/+$/, "");
  return withoutQuery.split("/").pop()?.trim() || null;
}

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
        return_origin: z.string().url().max(255).optional(),
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

    // Accept full URLs or "/prd_xxx" pasted by mistake — keep only the prd_xxx id
    productId = normalizeChariowProductId(productId);

    if (!productId) {
      throw new Error(
        "Cette cohorte n'est pas encore configurée pour ce mode de paiement.",
      );
    }

    const origin = (data.return_origin ?? SITE_URL).replace(/\/+$/, "");

    // Create an internal attempt FIRST so we can always trace this payment
    // even if Chariow drops custom_metadata or the redirect breaks.
    const attemptToken =
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    const amountExpected =
      data.mode === "full"
        ? Number(cohort.price_full ?? 0)
        : Number(cohort.price_installment ?? 0);

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from("chariow_payment_attempts")
      .insert({
        token: attemptToken,
        cohort_id: cohort.id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        mode: data.mode,
        installment_position: data.installment_position,
        chariow_product_id: productId,
        amount_expected: amountExpected,
        status: "created",
      })
      .select("id")
      .single();
    if (attemptError || !attempt) {
      throw new Error("Impossible d'enregistrer la tentative de paiement.");
    }

    const redirect =
      `${origin}/inscription/${cohort.slug}?attempt=${attemptToken}&sale={sale_id}`;

    // Chariow expects phone as { number, country_code } where country_code
    // is the ISO 3166-1 alpha-2 country code (e.g. "SN", "FR", "US"),
    // and number is digits only WITHOUT the dial code.
    // Defaults to Senegal ("SN") for local numbers.
    const rawPhone = (data.phone || "").trim();
    const digitsOnly = rawPhone.replace(/[^\d]/g, "");
    // Map common dial codes → ISO country code (extend as needed)
    const DIAL_TO_ISO: Record<string, string> = {
      "221": "SN", // Sénégal
      "225": "CI", // Côte d'Ivoire
      "229": "BJ", // Bénin
      "228": "TG", // Togo
      "226": "BF", // Burkina Faso
      "237": "CM", // Cameroun
      "33": "FR",
      "32": "BE",
      "1": "US",
      "44": "GB",
    };
    let isoCountry = "SN";
    let numberOnly = digitsOnly;
    if (rawPhone.startsWith("+")) {
      for (const len of [3, 2, 1]) {
        const dial = digitsOnly.slice(0, len);
        if (DIAL_TO_ISO[dial]) {
          isoCountry = DIAL_TO_ISO[dial];
          numberOnly = digitsOnly.slice(len);
          break;
        }
      }
    } else if (digitsOnly.length > 9) {
      for (const len of [3, 2, 1]) {
        const dial = digitsOnly.slice(0, len);
        if (DIAL_TO_ISO[dial] && digitsOnly.length - len >= 7) {
          isoCountry = DIAL_TO_ISO[dial];
          numberOnly = digitsOnly.slice(len);
          break;
        }
      }
    }

    if (!numberOnly || numberOnly.length < 6) {
      throw new Error("Numéro de téléphone invalide.");
    }

    const checkout = await initCheckout({
      product_id: productId,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: { number: numberOnly, country_code: isoCountry },
      redirect_url: redirect,
      custom_metadata: {
        cohort_id: cohort.id,
        cohort_slug: cohort.slug,
        mode: data.mode,
        installment_position: String(data.installment_position),
        attempt_token: attemptToken,
      },
    });

    // Chariow may wrap the URL at varying nesting depths — walk the response,
    // but only accept real checkout/payment URLs. Product/store/customer portal
    // links can also contain "chariow" and must not trigger a redirect.
    function isCheckoutUrl(value: string, key = "") {
      if (!/^https?:\/\//i.test(value)) return false;
      try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        const path = url.pathname.toLowerCase();
        const search = url.search.toLowerCase();
        if (/(^|\/)products?(\/|$)|(^|\/)catalog(\/|$)|(^|\/)customer(\/|$)|(^|\/)portal(\/|$)|(^|\/)purchases?(\/|$)/i.test(path)) {
          return false;
        }
        const haystack = `${host} ${path} ${search}`;
        if (/(checkout|payment|invoice|transaction|\/pay(\/|$|\?))/.test(haystack)) {
          return true;
        }
        return /(checkout|payment|pay)/i.test(key) && host.includes("chariow");
      } catch {
        return false;
      }
    }

    function findCheckoutUrl(node: any, depth = 0): string | undefined {
      if (!node || depth > 6) return undefined;
      if (typeof node === "string") {
        return isCheckoutUrl(node) ? node : undefined;
      }
      if (typeof node !== "object") return undefined;
      for (const key of ["checkout_url", "checkoutUrl", "payment_url", "paymentUrl", "payment_link", "paymentLink", "url", "link"]) {
        const v = (node as any)[key];
        if (typeof v === "string" && isCheckoutUrl(v, key)) return v;
      }
      for (const v of Object.values(node)) {
        const found = findCheckoutUrl(v, depth + 1);
        if (found) return found;
      }
      return undefined;
    }

    const responseData = (checkout as any)?.data ?? checkout;
    const step = typeof responseData?.step === "string" ? responseData.step : null;
    const message =
      typeof responseData?.message === "string" ? responseData.message : null;
    const url = findCheckoutUrl(checkout);

    if (!url && step === "already_purchased") {
      await supabaseAdmin.from("chariow_payment_attempts").update({
        status: "already_purchased",
        last_error: message ?? "already_purchased",
        chariow_raw_response: checkout as any,
      }).eq("id", attempt.id);
      return {
        checkout_url: null,
        status: "already_purchased",
        message:
          message ??
          "Ce produit est déjà associé à cette adresse email sur Chariow.",
      };
    }

    if (!url) {
      console.error(
        "[Chariow] checkout response without URL:",
        JSON.stringify(checkout).slice(0, 1500),
      );
      await supabaseAdmin.from("chariow_payment_attempts").update({
        status: "failed",
        last_error: "Chariow n'a pas renvoyé d'URL de paiement",
        chariow_raw_response: checkout as any,
      }).eq("id", attempt.id);
      return {
        checkout_url: null,
        status: "missing_checkout_url",
        message: "Chariow n'a pas renvoyé d'URL de paiement.",
      };
    }

    await supabaseAdmin.from("chariow_payment_attempts").update({
      status: "redirected",
      checkout_url: url,
      chariow_raw_response: checkout as any,
    }).eq("id", attempt.id);

    return {
      checkout_url: url,
      status: "checkout_created",
      message: null,
      attempt_token: attemptToken,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Vérifier une tentative interne par token (public) — utilisé au retour de paiement
// ─────────────────────────────────────────────────────────────────────────────
export const checkAttemptByToken = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ token: z.string().min(20).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: attempt } = await supabaseAdmin
      .from("chariow_payment_attempts")
      .select("id, status, chariow_sale_id, cohort_id, last_error")
      .eq("token", data.token)
      .maybeSingle();
    if (!attempt) return { found: false, status: "unknown" as const };

    // If we have a sale id, double-check Chariow directly
    let paid = false;
    let saleStatus: string | null = null;
    if (attempt.chariow_sale_id) {
      try {
        const sale: any = await verifySale(attempt.chariow_sale_id);
        const s = sale?.sale ?? sale?.data ?? sale ?? {};
        saleStatus = s.status ?? null;
        paid = ["paid", "success", "successful", "completed", "validated"].includes(
          String(s.status ?? "").toLowerCase(),
        );
      } catch {}
    }
    return {
      found: true,
      status: attempt.status,
      paid: paid || attempt.status === "processed",
      sale_status: saleStatus,
      sale_id: attempt.chariow_sale_id,
      cohort_id: attempt.cohort_id,
      last_error: attempt.last_error,
    };
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
    if (pending.chariow_sale_id) {
      await supabaseAdmin
        .from("payments")
        .update({ student_id: userId })
        .eq("chariow_sale_id", pending.chariow_sale_id);
    }

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
    z.object({ sale_id: z.string().trim().min(3).max(255) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin" || r.role === "super_admin"))
      throw new Error("Admin only");

    try {
      const result = await processChariowSale(data.sale_id);
      // Log a synthetic webhook event so it appears in the admin list
      await supabaseAdmin.from("chariow_webhook_events").insert({
        event_type: "admin.resync",
        sale_id: data.sale_id,
        payload: { source: "admin_resync", result } as any,
        processed_at: new Date().toISOString(),
        error: result.ok ? null : result.message ?? result.status,
      });
      return result;
    } catch (e: any) {
      const msg = String(e?.message ?? e).slice(0, 500);
      await supabaseAdmin.from("chariow_webhook_events").insert({
        event_type: "admin.resync",
        sale_id: data.sale_id,
        payload: { source: "admin_resync", error: msg } as any,
        processed_at: new Date().toISOString(),
        error: msg,
      });
      throw new Error(msg);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// 6. Liste des derniers webhook events Chariow (admin)
// ─────────────────────────────────────────────────────────────────────────────
export const listChariowWebhookEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin" || r.role === "super_admin"))
      throw new Error("Admin only");

    const { data } = await supabaseAdmin
      .from("chariow_webhook_events")
      .select("id, event_type, sale_id, received_at, processed_at, error")
      .order("received_at", { ascending: false })
      .limit(30);
    return { events: data ?? [] };
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
        chariow_product_id_full: normalizeChariowProductId(data.chariow_product_id_full),
        chariow_product_id_installment_1:
          normalizeChariowProductId(data.chariow_product_id_installment_1),
        chariow_product_id_installment_2:
          normalizeChariowProductId(data.chariow_product_id_installment_2),
      })
      .eq("id", data.cohort_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Admin : lister les tentatives Chariow récentes
// ─────────────────────────────────────────────────────────────────────────────
async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase
    .from("user_roles").select("role").eq("user_id", userId);
  if (!roles?.some((r: any) => r.role === "admin" || r.role === "super_admin"))
    throw new Error("Admin only");
}

export const listChariowAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await supabaseAdmin
      .from("chariow_payment_attempts")
      .select("id, token, cohort_id, email, first_name, last_name, mode, installment_position, chariow_product_id, amount_expected, currency, chariow_sale_id, status, last_error, created_at, processed_at, cohortes(name, slug)")
      .order("created_at", { ascending: false })
      .limit(50);
    return { attempts: data ?? [] };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Admin : associer manuellement une tentative à une cohorte / sale_id et la traiter
// ─────────────────────────────────────────────────────────────────────────────
export const reconcileAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      attempt_id: z.string().uuid(),
      sale_id: z.string().trim().min(3).max(255).optional(),
      cohort_id: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const update: any = {};
    if (data.sale_id) update.chariow_sale_id = data.sale_id;
    if (data.cohort_id) update.cohort_id = data.cohort_id;
    if (Object.keys(update).length > 0) {
      await supabaseAdmin
        .from("chariow_payment_attempts").update(update).eq("id", data.attempt_id);
    }

    const { data: a } = await supabaseAdmin
      .from("chariow_payment_attempts")
      .select("token, chariow_sale_id, cohort_id")
      .eq("id", data.attempt_id).maybeSingle();
    if (!a?.chariow_sale_id) {
      throw new Error("Aucun Sale ID Chariow associé à cette tentative.");
    }

    const result = await processChariowSale(a.chariow_sale_id, undefined, {
      attempt_token: a.token,
      cohort_id_override: a.cohort_id ?? undefined,
    });

    await supabaseAdmin.from("chariow_webhook_events").insert({
      event_type: "admin.reconcile",
      sale_id: a.chariow_sale_id,
      payload: { source: "admin_reconcile", attempt_id: data.attempt_id, result } as any,
      processed_at: new Date().toISOString(),
      error: result.ok ? null : result.message ?? result.status,
    });

    return result;
  });
