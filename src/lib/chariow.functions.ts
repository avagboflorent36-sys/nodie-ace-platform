import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  initCheckout,
  verifySale,
  processChariowSale,
  extractSaleId,
  isPaidChariowStatus,
} from "./chariow.server";

const SITE_URL =
  process.env.SITE_URL || "https://project--66439da9-0337-4213-a275-40cffeef22c6.lovable.app";

function normalizeChariowProductId(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  const idMatch = raw.match(/prd_[a-z0-9]+/i);
  if (idMatch) return idMatch[0];

  const withoutQuery = raw.split(/[?#]/)[0].replace(/\/+$/, "");
  return withoutQuery.split("/").pop()?.trim() || null;
}

const TRUSTED_ATTEMPT_PAID_STATUSES = new Set([
  "processed",
  "ownership_confirmed",
  "already_purchased",
]);

const DIAL_TO_ISO: Record<string, string> = {
  "221": "SN", "225": "CI", "229": "BJ", "228": "TG", "226": "BF",
  "227": "NE", "223": "ML", "224": "GN", "237": "CM", "235": "TD",
  "33": "FR", "32": "BE", "352": "LU", "41": "CH",
  "1": "US", "44": "GB",
};

function formatPhoneForChariow(raw: string): { number: string; country_code: string } {
  const rawPhone = (raw || "").trim();
  const digitsOnly = rawPhone.replace(/[^\d]/g, "");
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
  numberOnly = numberOnly.replace(/^0+/, "");
  if (!numberOnly || numberOnly.length < 6) {
    throw new Error("Numéro de téléphone invalide. Vérifiez le numéro et l'indicatif pays.");
  }
  return { number: numberOnly, country_code: isoCountry };
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
    else if (data.installment_position === 1) productId = cohort.chariow_product_id_installment_1;
    else productId = cohort.chariow_product_id_installment_2;

    // Accept full URLs or "/prd_xxx" pasted by mistake — keep only the prd_xxx id
    productId = normalizeChariowProductId(productId);

    if (!productId) {
      throw new Error("Cette cohorte n'est pas encore configurée pour ce mode de paiement.");
    }

    const origin = (data.return_origin ?? SITE_URL).replace(/\/+$/, "");

    // Create an internal attempt FIRST so we can always trace this payment
    // even if Chariow drops custom_metadata or the redirect breaks.
    const attemptToken =
      crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    const amountExpected =
      data.mode === "full" ? Number(cohort.price_full ?? 0) : Number(cohort.price_installment ?? 0);

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

    // Tranche 2 : l'utilisateur est déjà inscrit → retour direct sur son espace paiements.
    // Tranche 1 / paiement intégral : retour sur le formulaire d'inscription pour finaliser la création du compte.
    const redirect =
      data.mode === "installments_2" && data.installment_position === 2
        ? `${origin}/etudiant/paiements?paid=2&sale={sale_id}`
        : `${origin}/inscription/${cohort.slug}?attempt=${attemptToken}&sale={sale_id}`;

    const phoneE164 = formatPhoneForChariow(data.phone);

    const checkout = await initCheckout({
      product_id: productId,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: phoneE164,
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
        if (
          /(^|\/)products?(\/|$)|(^|\/)catalog(\/|$)|(^|\/)customer(\/|$)|(^|\/)portal(\/|$)|(^|\/)purchases?(\/|$)/i.test(
            path,
          )
        ) {
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
      for (const key of [
        "checkout_url",
        "checkoutUrl",
        "payment_url",
        "paymentUrl",
        "payment_link",
        "paymentLink",
        "url",
        "link",
      ]) {
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
    const message = typeof responseData?.message === "string" ? responseData.message : null;
    const url = findCheckoutUrl(checkout);

    if (!url && step === "already_purchased") {
      await supabaseAdmin
        .from("chariow_payment_attempts")
        .update({
          status: "ownership_confirmed",
          last_error: null,
          chariow_raw_response: checkout as any,
        })
        .eq("id", attempt.id);
      return {
        checkout_url: null,
        status: "ownership_confirmed",
        message:
          message ??
          `Chariow indique que cette adresse a déjà acheté le produit ${productId}. Reprise de votre inscription…`,
        attempt_token: attemptToken,
        redirect_url: `${origin}/inscription/${cohort.slug}?attempt=${attemptToken}`,
        product_id: productId,
      };
    }

    if (!url) {
      console.error(
        "[Chariow] checkout response without URL:",
        JSON.stringify(checkout).slice(0, 1500),
      );
      await supabaseAdmin
        .from("chariow_payment_attempts")
        .update({
          status: "failed",
          last_error: message ?? "Chariow n'a pas renvoyé d'URL de paiement",
          chariow_raw_response: checkout as any,
        })
        .eq("id", attempt.id);
      return {
        checkout_url: null,
        status: "missing_checkout_url",
        message:
          message ?? `Chariow n'a pas renvoyé d'URL de paiement pour le produit ${productId}.`,
        product_id: productId,
      };
    }

    const initialSaleId = extractSaleId(checkout);

    await supabaseAdmin
      .from("chariow_payment_attempts")
      .update({
        status: "redirected",
        checkout_url: url,
        chariow_sale_id: initialSaleId || null,
        chariow_raw_response: checkout as any,
      })
      .eq("id", attempt.id);

    return {
      checkout_url: url,
      status: "checkout_created",
      message: null,
      attempt_token: attemptToken,
      product_id: productId,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 1-bis. Démarrer un checkout Chariow pour la TRANCHE 2 via un token public.
// Lien partageable : /inscription/$slug/tranche-2?t=TOKEN — pas besoin de login.
// ─────────────────────────────────────────────────────────────────────────────
export const startChariowCheckoutForTranche2Token = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: z.string().trim().min(20).max(128),
        return_origin: z.string().url().max(255).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .select(
        "id, status, mode, cohort_id, student_id, chariow_customer_email, currency, amount_total, payment_installments(id, position, status, amount)",
      )
      .eq("tranche2_token", data.token)
      .maybeSingle();
    if (payErr || !payment) {
      return { checkout_url: null, status: "invalid_token", message: "Lien tranche 2 invalide." };
    }
    if (payment.mode !== "installments_2") {
      return {
        checkout_url: null,
        status: "wrong_mode",
        message: "Ce paiement n'est pas configuré en 2 tranches.",
      };
    }
    const t2 = (payment.payment_installments ?? []).find((i: any) => i.position === 2);
    if (!t2) {
      return {
        checkout_url: null,
        status: "no_installment",
        message: "La ligne de tranche 2 est introuvable pour ce paiement.",
      };
    }
    if (payment.status === "paid" || t2?.status === "validated") {
      return {
        checkout_url: null,
        status: "already_paid",
        message: "La tranche 2 est déjà réglée.",
      };
    }

    const { data: cohort } = await supabaseAdmin
      .from("cohortes")
      .select("id, slug, name, price_installment, chariow_product_id_installment_2")
      .eq("id", payment.cohort_id)
      .maybeSingle();
    if (!cohort) {
      return { checkout_url: null, status: "no_cohort", message: "Cohorte introuvable." };
    }
    const productId = normalizeChariowProductId(cohort.chariow_product_id_installment_2);
    if (!productId) {
      return {
        checkout_url: null,
        status: "no_product",
        message: "Le Product ID Chariow de la tranche 2 n'est pas configuré pour cette cohorte.",
      };
    }

    // Profil étudiant (email/nom/téléphone)
    let email = payment.chariow_customer_email ?? "";
    let firstName = "";
    let lastName = "";
    let phone = "";
    if (payment.student_id) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email, first_name, last_name, whatsapp")
        .eq("id", payment.student_id)
        .maybeSingle();
      if (prof) {
        email = prof.email || email;
        firstName = prof.first_name || "";
        lastName = prof.last_name || "";
        phone = prof.whatsapp || "";
      }
    }
    if (!email) {
      return {
        checkout_url: null,
        status: "missing_profile",
        message: "Email étudiant introuvable — connectez-vous pour finaliser.",
      };
    }

    const origin = (data.return_origin ?? SITE_URL).replace(/\/+$/, "");
    const attemptToken =
      crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const amountExpected = Number(cohort.price_installment ?? 0);

    const { data: attempt } = await supabaseAdmin
      .from("chariow_payment_attempts")
      .insert({
        token: attemptToken,
        cohort_id: cohort.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        mode: "installments_2",
        installment_position: 2,
        chariow_product_id: productId,
        amount_expected: amountExpected,
        payment_id: payment.id,
        installment_id: t2?.id ?? null,
        status: "created",
      } as any)
      .select("id")
      .single();

    // Téléphone → format Chariow
    let phoneE164: { number: string; country_code: string };
    try {
      phoneE164 = formatPhoneForChariow(phone);
    } catch {
      return {
        checkout_url: null,
        status: "invalid_phone",
        message: "Numéro de téléphone étudiant invalide. Mettez à jour votre profil.",
      };
    }

    const redirect = `${origin}/etudiant/paiements?paid=2&sale={sale_id}`;
    const checkout: any = await initCheckout({
      product_id: productId,
      email,
      first_name: firstName || "Etudiant",
      last_name: lastName || "Etudiant",
      phone: phoneE164,
      redirect_url: redirect,
      custom_metadata: {
        cohort_id: cohort.id,
        cohort_slug: cohort.slug,
        mode: "installments_2",
        installment_position: "2",
        attempt_token: attemptToken,
        payment_id: payment.id,
        installment_id: t2?.id ?? "",
      },
    });

    // Réutilise la même heuristique d'extraction d'URL que startChariowCheckout
    function isCheckoutUrl(value: string, key = "") {
      if (!/^https?:\/\//i.test(value)) return false;
      try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        const path = url.pathname.toLowerCase();
        const search = url.search.toLowerCase();
        if (
          /(^|\/)products?(\/|$)|(^|\/)catalog(\/|$)|(^|\/)customer(\/|$)|(^|\/)portal(\/|$)|(^|\/)purchases?(\/|$)/i.test(
            path,
          )
        )
          return false;
        const haystack = `${host} ${path} ${search}`;
        if (/(checkout|payment|invoice|transaction|\/pay(\/|$|\?))/.test(haystack)) return true;
        return /(checkout|payment|pay)/i.test(key) && host.includes("chariow");
      } catch {
        return false;
      }
    }
    function findCheckoutUrl(node: any, depth = 0): string | undefined {
      if (!node || depth > 6) return undefined;
      if (typeof node === "string") return isCheckoutUrl(node) ? node : undefined;
      if (typeof node !== "object") return undefined;
      for (const key of [
        "checkout_url", "checkoutUrl", "payment_url", "paymentUrl",
        "payment_link", "paymentLink", "url", "link",
      ]) {
        const v = (node as any)[key];
        if (typeof v === "string" && isCheckoutUrl(v, key)) return v;
      }
      for (const v of Object.values(node)) {
        const found = findCheckoutUrl(v, depth + 1);
        if (found) return found;
      }
      return undefined;
    }

    const responseData = checkout?.data ?? checkout;
    const step = typeof responseData?.step === "string" ? responseData.step : null;
    const message = typeof responseData?.message === "string" ? responseData.message : null;
    const url = findCheckoutUrl(checkout);

    if (!url && step === "already_purchased") {
      await supabaseAdmin
        .from("chariow_payment_attempts")
        .update({
          status: "ownership_confirmed",
          chariow_raw_response: checkout as any,
        })
        .eq("id", attempt!.id);
      return {
        checkout_url: null,
        status: "ownership_confirmed",
        message:
          message ??
          "Chariow indique que cette adresse a déjà acheté la tranche 2. Si ce n'est pas le cas, contactez le support.",
      };
    }
    if (!url) {
      await supabaseAdmin
        .from("chariow_payment_attempts")
        .update({
          status: "failed",
          last_error: message ?? "Chariow n'a pas renvoyé d'URL de paiement",
          chariow_raw_response: checkout as any,
        })
        .eq("id", attempt!.id);
      return {
        checkout_url: null,
        status: "missing_checkout_url",
        message: message ?? `Chariow n'a pas renvoyé d'URL de paiement pour ${productId}.`,
      };
    }

    const initialSaleId = extractSaleId(checkout);
    await supabaseAdmin
      .from("chariow_payment_attempts")
      .update({
        status: "redirected",
        checkout_url: url,
        chariow_sale_id: initialSaleId || null,
        chariow_raw_response: checkout as any,
      })
      .eq("id", attempt!.id);

    return { checkout_url: url, status: "checkout_created", message: null };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 1-ter. Démarrer un checkout Chariow pour la TRANCHE 2 — flux étudiant connecté.
// L'étudiant clique « Payer la tranche 2 » dans /etudiant/paiements et reçoit
// directement une URL checkout. Plus fiable que le lien tokenisé partagé.
// ─────────────────────────────────────────────────────────────────────────────
export const getMyTranche2CheckoutSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ payment_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, status, mode, cohort_id, student_id, currency, amount_total, amount_paid, payment_installments(id, position, status, amount, due_date)")
      .eq("id", data.payment_id)
      .maybeSingle();
    if (!payment || payment.student_id !== context.userId) {
      return { ok: false, status: "not_found", message: "Paiement introuvable." };
    }

    const { data: cohort } = await supabaseAdmin
      .from("cohortes")
      .select("id, name, price_installment, chariow_product_id_installment_2")
      .eq("id", payment.cohort_id)
      .maybeSingle();
    let t2 = (payment.payment_installments ?? []).find((i: any) => i.position === 2);
    // Auto-heal: if payment is in 2-tranches mode but the position=2 row is missing, create it.
    if (!t2 && payment.mode === "installments_2" && payment.status !== "paid") {
      const amt = Number(cohort?.price_installment ?? 0);
      const { data: inserted } = await supabaseAdmin
        .from("payment_installments")
        .insert({ payment_id: payment.id, position: 2, status: "pending", amount: amt })
        .select("id, position, status, amount, due_date")
        .maybeSingle();
      if (inserted) t2 = inserted as any;
    }
    const productId = normalizeChariowProductId(cohort?.chariow_product_id_installment_2);
    const ready = payment.mode === "installments_2" && payment.status !== "paid" && !!t2 && t2.status !== "validated" && !!productId;

    return {
      ok: ready,
      status: ready ? "ready" : payment.status === "paid" || t2?.status === "validated" ? "already_paid" : !productId ? "no_product" : "not_payable",
      message: ready ? null : !t2 ? "La ligne de tranche 2 est introuvable pour ce paiement." : !productId ? "Le Product ID Chariow de la tranche 2 n'est pas configuré." : "Cette tranche 2 n'est pas payable.",
      cohort_name: cohort?.name ?? "Cohorte",
      product_id: productId,
      currency: payment.currency,
      amount_total: Number(payment.amount_total ?? 0),
      amount_paid: Number(payment.amount_paid ?? 0),
      tranche2: t2 ? { id: t2.id, status: t2.status, amount: Number(t2.amount ?? cohort?.price_installment ?? 0), due_date: t2.due_date } : null,
    };
  });


export const startMyTranche2Checkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        payment_id: z.string().uuid(),
        return_origin: z.string().url().max(255).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .select(
        "id, status, mode, cohort_id, student_id, chariow_customer_email, currency, amount_total, payment_installments(id, position, status, amount)",
      )
      .eq("id", data.payment_id)
      .maybeSingle();
    if (payErr || !payment) {
      return { checkout_url: null, status: "not_found", message: "Paiement introuvable." };
    }
    if (payment.student_id !== userId) {
      return { checkout_url: null, status: "forbidden", message: "Ce paiement ne vous appartient pas." };
    }
    if (payment.mode !== "installments_2") {
      return { checkout_url: null, status: "wrong_mode", message: "Ce paiement n'est pas en 2 tranches." };
    }
    const t2 = (payment.payment_installments ?? []).find((i: any) => i.position === 2);
    if (!t2) {
      return { checkout_url: null, status: "no_installment", message: "La ligne de tranche 2 est introuvable pour ce paiement." };
    }
    if (payment.status === "paid" || t2?.status === "validated") {
      return { checkout_url: null, status: "already_paid", message: "La tranche 2 est déjà réglée." };
    }

    const { data: cohort } = await supabaseAdmin
      .from("cohortes")
      .select("id, slug, name, price_installment, chariow_product_id_installment_2")
      .eq("id", payment.cohort_id)
      .maybeSingle();
    if (!cohort) {
      return { checkout_url: null, status: "no_cohort", message: "Cohorte introuvable." };
    }
    const productId = normalizeChariowProductId(cohort.chariow_product_id_installment_2);
    if (!productId) {
      return {
        checkout_url: null,
        status: "no_product",
        message: "Le Product ID Chariow de la tranche 2 n'est pas configuré pour cette cohorte. Demandez à l'administrateur de l'ajouter.",
      };
    }

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email, first_name, last_name, whatsapp")
      .eq("id", userId)
      .maybeSingle();
    const email = prof?.email || payment.chariow_customer_email || "";
    const firstName = prof?.first_name || "";
    const lastName = prof?.last_name || "";
    const phone = prof?.whatsapp || "";
    if (!email) {
      return { checkout_url: null, status: "missing_profile", message: "Email étudiant manquant — mettez à jour votre profil." };
    }

    let phoneE164: { number: string; country_code: string };
    try {
      phoneE164 = formatPhoneForChariow(phone);
    } catch {
      return {
        checkout_url: null,
        status: "invalid_phone",
        message: "Numéro WhatsApp invalide. Corrigez-le dans votre profil avant de payer.",
      };
    }

    const origin = (data.return_origin ?? SITE_URL).replace(/\/+$/, "");
    const attemptToken =
      crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const amountExpected = Number(cohort.price_installment ?? 0);

    const { data: attempt } = await supabaseAdmin
      .from("chariow_payment_attempts")
      .insert({
        token: attemptToken,
        cohort_id: cohort.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        mode: "installments_2",
        installment_position: 2,
        chariow_product_id: productId,
        amount_expected: amountExpected,
        payment_id: payment.id,
        installment_id: t2?.id ?? null,
        status: "created",
      } as any)
      .select("id")
      .single();

    const redirect = `${origin}/etudiant/paiements?paid=2&sale={sale_id}`;
    const checkout: any = await initCheckout({
      product_id: productId,
      email,
      first_name: firstName || "Etudiant",
      last_name: lastName || "Etudiant",
      phone: phoneE164,
      redirect_url: redirect,
      custom_metadata: {
        cohort_id: cohort.id,
        cohort_slug: cohort.slug,
        mode: "installments_2",
        installment_position: "2",
        attempt_token: attemptToken,
        payment_id: payment.id,
        installment_id: t2?.id ?? "",
      },
    });

    function isCheckoutUrl(value: string, key = "") {
      if (!/^https?:\/\//i.test(value)) return false;
      try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        const path = url.pathname.toLowerCase();
        const search = url.search.toLowerCase();
        if (/(^|\/)products?(\/|$)|(^|\/)catalog(\/|$)|(^|\/)customer(\/|$)|(^|\/)portal(\/|$)|(^|\/)purchases?(\/|$)/i.test(path)) return false;
        const haystack = `${host} ${path} ${search}`;
        if (/(checkout|payment|invoice|transaction|\/pay(\/|$|\?))/.test(haystack)) return true;
        return /(checkout|payment|pay)/i.test(key) && host.includes("chariow");
      } catch { return false; }
    }
    function findCheckoutUrl(node: any, depth = 0): string | undefined {
      if (!node || depth > 6) return undefined;
      if (typeof node === "string") return isCheckoutUrl(node) ? node : undefined;
      if (typeof node !== "object") return undefined;
      for (const key of ["checkout_url","checkoutUrl","payment_url","paymentUrl","payment_link","paymentLink","url","link"]) {
        const v = (node as any)[key];
        if (typeof v === "string" && isCheckoutUrl(v, key)) return v;
      }
      for (const v of Object.values(node)) {
        const found = findCheckoutUrl(v, depth + 1);
        if (found) return found;
      }
      return undefined;
    }

    const responseData = checkout?.data ?? checkout;
    const step = typeof responseData?.step === "string" ? responseData.step : null;
    const message = typeof responseData?.message === "string" ? responseData.message : null;
    const url = findCheckoutUrl(checkout);

    if (!url && step === "already_purchased") {
      await supabaseAdmin.from("chariow_payment_attempts")
        .update({ status: "ownership_confirmed", chariow_raw_response: checkout })
        .eq("id", attempt!.id);
      return { checkout_url: null, status: "ownership_confirmed", message: message ?? "Chariow indique que cette adresse a déjà acheté la tranche 2. Contactez le support pour validation manuelle." };
    }
    if (!url) {
      await supabaseAdmin.from("chariow_payment_attempts")
        .update({ status: "failed", last_error: message ?? "Pas d'URL Chariow", chariow_raw_response: checkout })
        .eq("id", attempt!.id);
      return { checkout_url: null, status: "missing_checkout_url", message: message ?? `Chariow n'a pas renvoyé d'URL de paiement pour ${productId}.` };
    }

    const initialSaleId = extractSaleId(checkout);
    await supabaseAdmin.from("chariow_payment_attempts")
      .update({ status: "redirected", checkout_url: url, chariow_sale_id: initialSaleId || null, chariow_raw_response: checkout })
      .eq("id", attempt!.id);

    return { checkout_url: url, status: "checkout_created", message: null };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Vérifier une tentative interne par token (public) — utilisé au retour de paiement
// ─────────────────────────────────────────────────────────────────────────────
export const checkAttemptByToken = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(20).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { data: attempt } = await supabaseAdmin
      .from("chariow_payment_attempts")
      .select("id, token, status, chariow_sale_id, cohort_id, last_error, chariow_raw_response")
      .eq("token", data.token)
      .maybeSingle();
    if (!attempt) return { found: false, status: "unknown" as const };

    const saleId = attempt.chariow_sale_id || extractSaleId(attempt.chariow_raw_response);

    if (saleId && !attempt.chariow_sale_id) {
      await supabaseAdmin
        .from("chariow_payment_attempts")
        .update({ chariow_sale_id: saleId })
        .eq("id", attempt.id);
    }

    // If we have a sale id, double-check Chariow directly and process it when paid.
    // If Chariow answers "already purchased" at checkout, the email/product pair
    // is confirmed by Chariow but no sale id is returned; keep it eligible for the
    // account-creation step, where it will be attached to the authenticated user.
    let paid = TRUSTED_ATTEMPT_PAID_STATUSES.has(attempt.status);
    let saleStatus: string | null = null;
    if (!paid && saleId) {
      try {
        const sale: any = await verifySale(saleId);
        const s =
          sale?.sale ??
          sale?.data?.sale ??
          sale?.data?.purchase ??
          sale?.purchase ??
          sale?.data ??
          sale ??
          {};
        saleStatus = s.status ?? s.payment?.status ?? null;
        paid = isPaidChariowStatus(s.status) || isPaidChariowStatus(s.payment?.status);
        if (paid && attempt.status !== "processed") {
          const result = await processChariowSale(saleId, sale, {
            attempt_token: attempt.token,
            cohort_id_override: attempt.cohort_id,
          });
          paid = result.ok || result.status === "processed";
        }
        if (!paid) {
          await supabaseAdmin
            .from("chariow_payment_attempts")
            .update({
              last_error: `Paiement non confirmé côté Chariow (${saleStatus ?? "unknown"})`,
            })
            .eq("id", attempt.id);
        }
      } catch (e: any) {
        await supabaseAdmin
          .from("chariow_payment_attempts")
          .update({ last_error: String(e?.message ?? e).slice(0, 500) })
          .eq("id", attempt.id);
      }
    }
    return {
      found: true,
      status: attempt.status,
      paid,
      sale_status: saleStatus,
      sale_id: saleId || null,
      cohort_id: attempt.cohort_id,
      last_error: attempt.last_error,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 2. Vérifier le statut d'une vente (public, info minimale)
// ─────────────────────────────────────────────────────────────────────────────
export const fetchSaleStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ sale_id: z.string().min(3).max(255) }).parse(input))
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
  .inputValidator((input) => z.object({ claim_token: z.string().min(10).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: pending, error } = await supabaseAdmin
      .from("pending_enrollments")
      .select("*")
      .eq("claim_token", data.claim_token)
      .maybeSingle();
    if (error || !pending) throw new Error("Lien d'inscription invalide.");
    if (pending.claimed_at) throw new Error("Ce lien a déjà été utilisé.");
    if (new Date(pending.expires_at).getTime() < Date.now()) throw new Error("Ce lien a expiré.");

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
      .upsert({ student_id: userId, cohort_id: pending.cohort_id, status: "active" }, {
        onConflict: "student_id,cohort_id",
      } as any);

    await supabaseAdmin
      .from("pending_enrollments")
      .update({ claimed_at: new Date().toISOString(), claimed_by: userId })
      .eq("id", pending.id);

    return { ok: true, cohort_id: pending.cohort_id };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 3-bis. Réclamer une tentative par attempt_token (auth — appelé au signup
// quand l'étudiant est arrivé via ?attempt=TOKEN après paiement Chariow).
// Garantit que l'utilisateur nouvellement créé est bien lié au paiement,
// à la cohorte, et reçoit un payment + installment validés.
// ─────────────────────────────────────────────────────────────────────────────
export const claimAttemptByToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(20).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: attempt } = await supabaseAdmin
      .from("chariow_payment_attempts")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (!attempt) throw new Error("Tentative introuvable.");
    if (!attempt.cohort_id) throw new Error("Cohorte manquante sur la tentative.");

    // Re-vérifier la vente côté Chariow si on a un sale_id. Pour les retours
    // "already purchased", Chariow a déjà confirmé que cet email possède ce
    // produit; on permet alors seulement au détenteur de cet email de réclamer
    // l'accès à la cohorte correspondante.
    const attemptEmail = String(attempt.email ?? "")
      .trim()
      .toLowerCase();
    const userEmail = String((context.claims as any)?.email ?? "")
      .trim()
      .toLowerCase();
    let paid = TRUSTED_ATTEMPT_PAID_STATUSES.has(attempt.status);
    if (!paid && attempt.chariow_sale_id) {
      try {
        const sale: any = await verifySale(attempt.chariow_sale_id);
        const s = sale?.sale ?? sale?.data ?? sale ?? {};
        paid = isPaidChariowStatus(s.status) || isPaidChariowStatus(s.payment?.status);
      } catch {}
    }
    if (!paid) {
      throw new Error("Paiement non confirmé — accès non débloqué.");
    }
    if (!attempt.chariow_sale_id && (!attemptEmail || attemptEmail !== userEmail)) {
      throw new Error(
        "Utilisez la même adresse email que celle confirmée par Chariow pour débloquer l'accès.",
      );
    }

    const cohortId = attempt.cohort_id as string;
    const saleId = attempt.chariow_sale_id as string | null;
    const mode = (attempt.mode === "installments_2" ? "installments_2" : "full") as
      | "full"
      | "installments_2";
    const position = Number(attempt.installment_position ?? 1) || 1;

    const { data: cohort } = await supabaseAdmin
      .from("cohortes")
      .select("id, price_full, price_installment")
      .eq("id", cohortId)
      .maybeSingle();
    if (!cohort) throw new Error("Cohorte introuvable.");

    const installmentAmount = Number(cohort.price_installment ?? attempt.amount_expected ?? 0);
    const total =
      mode === "full"
        ? Number(cohort.price_full ?? attempt.amount_expected ?? 0)
        : installmentAmount * 2;
    const instAmount = mode === "full" ? total : installmentAmount;

    // Récupérer/créer le payment de cet utilisateur sur cette cohorte
    let { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("student_id", userId)
      .eq("cohort_id", cohortId)
      .maybeSingle();

    // Tenter de récupérer un "ghost payment" déjà créé par webhook (student_id null)
    if (!payment && saleId) {
      const { data: ghost } = await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("chariow_sale_id", saleId)
        .is("student_id", null)
        .maybeSingle();
      if (ghost) {
        await supabaseAdmin
          .from("payments")
          .update({ student_id: userId, cohort_id: cohortId })
          .eq("id", ghost.id);
        payment = ghost;
      }
    }

    if (!payment) {
      const { data: created } = await supabaseAdmin
        .from("payments")
        .insert({
          student_id: userId,
          cohort_id: cohortId,
          amount_total: total,
          amount_paid: 0,
          currency: attempt.currency ?? "XOF",
          mode,
          status: "pending",
          source: "chariow",
          chariow_sale_id: mode === "full" ? saleId : null,
          chariow_customer_email: attempt.email,
        })
        .select("id")
        .single();
      payment = created;
    }

    if (payment) {
      const { data: existingInst } = await supabaseAdmin
        .from("payment_installments")
        .select("id")
        .eq("payment_id", payment.id)
        .eq("position", position)
        .maybeSingle();
      if (existingInst) {
        await supabaseAdmin
          .from("payment_installments")
          .update({
            status: "validated",
            amount: instAmount,
            chariow_sale_id: saleId,
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
          submitted_at: new Date().toISOString(),
          validated_at: new Date().toISOString(),
        });
      }
    }

    // Inscription cohorte active
    await supabaseAdmin
      .from("cohort_enrollments")
      .upsert({ student_id: userId, cohort_id: cohortId, status: "active" }, {
        onConflict: "student_id,cohort_id",
      } as any);

    // Marquer la tentative comme traitée
    await supabaseAdmin
      .from("chariow_payment_attempts")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", attempt.id);

    // Réclamer un éventuel pending_enrollment lié au même sale_id
    if (saleId) {
      await supabaseAdmin
        .from("pending_enrollments")
        .update({ claimed_at: new Date().toISOString(), claimed_by: userId })
        .eq("chariow_sale_id", saleId)
        .is("claimed_at", null);
    }

    return { ok: true, cohort_id: cohortId, payment_id: payment?.id };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 4. Resync manuel d'une vente (admin)
// ─────────────────────────────────────────────────────────────────────────────
export const syncChariowSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ sale_id: z.string().trim().min(3).max(255) }).parse(input))
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
        error: result.ok ? null : (result.message ?? result.status),
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
        chariow_product_id_installment_1: z.string().trim().max(255).nullable().optional(),
        chariow_product_id_installment_2: z.string().trim().max(255).nullable().optional(),
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

    const full = normalizeChariowProductId(data.chariow_product_id_full);
    const inst1 = normalizeChariowProductId(data.chariow_product_id_installment_1);
    const inst2 = normalizeChariowProductId(data.chariow_product_id_installment_2);

    // Validation : la tranche 2 DOIT être un produit Chariow distinct de la tranche 1
    // et du paiement intégral — sinon Chariow ouvre le même checkout/produit pour tout.
    if (inst1 && inst2 && inst1 === inst2) {
      throw new Error(
        "Le Product ID 'Tranche 2' doit être différent du Product ID 'Tranche 1'. Créez un produit Chariow dédié à la tranche 2.",
      );
    }
    if (full && inst2 && full === inst2) {
      throw new Error(
        "Le Product ID 'Tranche 2' doit être différent du Product ID 'Paiement intégral'.",
      );
    }
    if (full && inst1 && full === inst1) {
      throw new Error(
        "Le Product ID 'Tranche 1' doit être différent du Product ID 'Paiement intégral'.",
      );
    }

    const { error } = await supabaseAdmin
      .from("cohortes")
      .update({
        chariow_product_id_full: full,
        chariow_product_id_installment_1: inst1,
        chariow_product_id_installment_2: inst2,
      })
      .eq("id", data.cohort_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Admin : lister les tentatives Chariow récentes
// ─────────────────────────────────────────────────────────────────────────────
async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!roles?.some((r: any) => r.role === "admin" || r.role === "super_admin"))
    throw new Error("Admin only");
}

export const listChariowAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await supabaseAdmin
      .from("chariow_payment_attempts")
      .select(
        "id, token, cohort_id, payment_id, installment_id, email, first_name, last_name, mode, installment_position, chariow_product_id, amount_expected, currency, chariow_sale_id, checkout_url, status, last_error, created_at, processed_at, cohortes(name, slug)",
      )
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
    z
      .object({
        attempt_id: z.string().uuid(),
        sale_id: z.string().trim().min(3).max(255).optional(),
        cohort_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const update: any = {};
    if (data.sale_id) update.chariow_sale_id = data.sale_id;
    if (data.cohort_id) update.cohort_id = data.cohort_id;
    if (Object.keys(update).length > 0) {
      await supabaseAdmin.from("chariow_payment_attempts").update(update).eq("id", data.attempt_id);
    }

    const { data: a } = await supabaseAdmin
      .from("chariow_payment_attempts")
      .select("token, chariow_sale_id, cohort_id")
      .eq("id", data.attempt_id)
      .maybeSingle();
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
      error: result.ok ? null : (result.message ?? result.status),
    });

    return result;
  });

// Pré-remplissage du formulaire post-paiement : récupère prénom / nom / email / téléphone
// déjà saisis lors du checkout, sans authentification (l'étudiant n'a pas encore de compte).
export const getPrefillFromToken = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        attemptToken: z.string().min(8).max(200).optional(),
        claimToken: z.string().min(8).max(200).optional(),
        saleId: z.string().min(1).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const empty = { first_name: "", last_name: "", email: "", phone: "" };

    if (data.attemptToken) {
      const { data: a } = await supabaseAdmin
        .from("chariow_payment_attempts")
        .select("first_name, last_name, email, phone")
        .eq("token", data.attemptToken)
        .maybeSingle();
      if (a) return { first_name: a.first_name ?? "", last_name: a.last_name ?? "", email: a.email ?? "", phone: a.phone ?? "" };
    }

    if (data.claimToken) {
      const { data: p } = await supabaseAdmin
        .from("pending_enrollments")
        .select("first_name, last_name, email, phone")
        .eq("claim_token", data.claimToken)
        .maybeSingle();
      if (p) return { first_name: p.first_name ?? "", last_name: p.last_name ?? "", email: p.email ?? "", phone: p.phone ?? "" };
    }

    if (data.saleId) {
      const { data: a } = await supabaseAdmin
        .from("chariow_payment_attempts")
        .select("first_name, last_name, email, phone")
        .eq("chariow_sale_id", data.saleId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (a) return { first_name: a.first_name ?? "", last_name: a.last_name ?? "", email: a.email ?? "", phone: a.phone ?? "" };
    }

    return empty;
  });
