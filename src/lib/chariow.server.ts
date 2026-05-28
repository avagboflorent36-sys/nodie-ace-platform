// Server-only Chariow API helpers. Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, wrapHtml, siteUrl } from "@/lib/email.server";

const CHARIOW_BASE = process.env.CHARIOW_API_BASE || "https://api.chariow.com/v1";

function apiKey() {
  const k = process.env.CHARIOW_API_KEY;
  if (!k) throw new Error("CHARIOW_API_KEY missing");
  return k;
}

export async function chariowFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${CHARIOW_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Chariow ${res.status} ${path}: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export interface CheckoutInput {
  product_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: { number: string; country_code: string };
  custom_metadata?: Record<string, string>;
  redirect_url?: string;
}

export async function initCheckout(input: CheckoutInput) {
  return chariowFetch("/checkout", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function verifySale(saleId: string) {
  return chariowFetch(`/sales/${encodeURIComponent(saleId)}`, { method: "GET" });
}

export function timingSafeEqualStr(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function webhookUrlSecret() {
  const s = process.env.CHARIOW_WEBHOOK_URL_SECRET;
  if (!s) throw new Error("CHARIOW_WEBHOOK_URL_SECRET missing");
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract a sale id from many shapes of payloads / verification responses
// ─────────────────────────────────────────────────────────────────────────────
export function extractSaleId(payload: any): string {
  if (!payload || typeof payload !== "object") return "";
  const candidates = [
    payload?.sale?.id,
    payload?.data?.sale?.id,
    payload?.data?.id,
    payload?.sale_id,
    payload?.saleId,
    payload?.id,
    payload?.transaction?.id,
    payload?.transaction_id,
    payload?.payment?.id,
    payload?.payment_id,
    payload?.order?.id,
    payload?.order_id,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (typeof c === "number") return String(c);
  }
  return "";
}

function extractEventType(payload: any): string {
  return (
    payload?.event ??
    payload?.type ??
    payload?.event_type ??
    payload?.data?.event ??
    payload?.data?.type ??
    "unknown"
  ).toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: take a sale_id, verify with Chariow, persist payment/enrollment.
// Used both by the webhook and by admin "resync".
// ─────────────────────────────────────────────────────────────────────────────
export async function processChariowSale(
  saleId: string,
  rawPayload?: any,
  hints?: { attempt_token?: string; cohort_id_override?: string },
): Promise<{
  ok: boolean;
  status: "processed" | "not_paid" | "missing_cohort" | "error";
  message?: string;
  payment_id?: string;
  pending_enrollment_id?: string;
  attempt_id?: string;
}> {
  const verified: any = await verifySale(saleId);
  const s = verified?.sale ?? verified?.data ?? verified ?? {};
  const c = verified?.customer ?? rawPayload?.customer ?? {};
  const meta = s.custom_metadata ?? rawPayload?.sale?.custom_metadata ?? {};

  const saleStatus = String(s.status ?? "").toLowerCase();
  const paid = ["paid", "success", "successful", "completed", "validated"].includes(saleStatus);
  if (!paid) {
    return { ok: false, status: "not_paid", message: `Sale status: ${saleStatus || "unknown"}` };
  }

  // Resolve cohort/mode/student data with priority:
  //  1. attempt token (from redirect URL / metadata)
  //  2. existing attempt linked by sale_id
  //  3. Chariow custom_metadata
  //  4. fallback: most recent attempt for same email + product (last 24h)
  const customerEmail = String(c.email ?? rawPayload?.customer?.email ?? "").toLowerCase();
  const productId: string | undefined =
    s.product_id ?? s.product?.id ?? rawPayload?.sale?.product_id;
  const tokenFromMeta: string | undefined = meta.attempt_token ?? hints?.attempt_token;

  let attempt: any = null;
  if (tokenFromMeta) {
    const { data } = await supabaseAdmin
      .from("chariow_payment_attempts")
      .select("*").eq("token", tokenFromMeta).maybeSingle();
    attempt = data;
  }
  if (!attempt) {
    const { data } = await supabaseAdmin
      .from("chariow_payment_attempts")
      .select("*").eq("chariow_sale_id", saleId).maybeSingle();
    attempt = data;
  }
  if (!attempt && customerEmail && productId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from("chariow_payment_attempts")
      .select("*")
      .ilike("email", customerEmail)
      .eq("chariow_product_id", productId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    attempt = data;
  }

  const cohortId: string | undefined =
    hints?.cohort_id_override ?? meta.cohort_id ?? attempt?.cohort_id;
  const mode: "full" | "installments_2" =
    (meta.mode ?? attempt?.mode) === "installments_2" ? "installments_2" : "full";
  const position = Number(meta.installment_position ?? attempt?.installment_position ?? 1) || 1;
  const cohortSlug: string = meta.cohort_slug ?? "";

  if (!cohortId) {
    if (attempt) {
      await supabaseAdmin.from("chariow_payment_attempts").update({
        status: "needs_review",
        chariow_sale_id: saleId,
        last_error: "Cohorte introuvable (ni metadata Chariow ni tentative)",
      }).eq("id", attempt.id);
    }
    return {
      ok: false,
      status: "missing_cohort",
      message:
        "Aucune cohorte associée. Associez ce paiement manuellement dans la page Réconciliation.",
      attempt_id: attempt?.id,
    };
  }

  const email = customerEmail || String(attempt?.email ?? "").toLowerCase();
  const firstName = c.first_name ?? rawPayload?.customer?.first_name ?? attempt?.first_name ?? "";
  const lastName = c.last_name ?? rawPayload?.customer?.last_name ?? attempt?.last_name ?? "";
  const phone = c.phone ?? rawPayload?.customer?.phone ?? attempt?.phone ?? "";
  const amount = Number(s.amount ?? rawPayload?.sale?.amount ?? 0);
  const currency = s.currency ?? rawPayload?.sale?.currency ?? attempt?.currency ?? "XOF";

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

  if (!cohort) return { ok: false, status: "missing_cohort", message: "Cohorte introuvable" };

  const studentId: string | null = profile?.id ?? null;
  const total =
    mode === "full"
      ? Number(cohort.price_full ?? amount)
      : Number(cohort.price_installment ?? amount);

  // Existing profile → payment + installment
  if (studentId) {
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
            chariow_raw_payload: (rawPayload ?? verified) as any,
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
          chariow_raw_payload: (rawPayload ?? verified) as any,
          submitted_at: new Date().toISOString(),
          validated_at: new Date().toISOString(),
        });
      }
    }

    await supabaseAdmin
      .from("cohort_enrollments")
      .upsert(
        { student_id: studentId, cohort_id: cohortId, status: "active" },
        { onConflict: "student_id,cohort_id" } as any,
      );

    if (attempt) {
      await supabaseAdmin.from("chariow_payment_attempts").update({
        status: "processed",
        chariow_sale_id: saleId,
        processed_at: new Date().toISOString(),
        chariow_raw_response: (rawPayload ?? verified) as any,
        last_error: null,
      }).eq("id", attempt.id);
    }

    return { ok: true, status: "processed", payment_id: payment?.id, attempt_id: attempt?.id };
  }


  // No profile → pending_enrollment + claim email
  // Reuse existing pending_enrollment if one already exists for the sale
  const { data: existingPending } = await supabaseAdmin
    .from("pending_enrollments")
    .select("id, claim_token")
    .eq("chariow_sale_id", saleId)
    .maybeSingle();

  let pendingId = existingPending?.id;
  let claimToken = existingPending?.claim_token;

  if (!existingPending) {
    claimToken =
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
    pendingId = pe?.id;
    claimToken = pe?.claim_token ?? claimToken;
  }

  // Ghost payment (no student yet) — only if not already created for this sale
  const { data: existingGhost } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("chariow_sale_id", saleId)
    .maybeSingle();
  if (!existingGhost) {
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
  }

  if (email && claimToken) {
    const link = siteUrl(`/inscription/${cohortSlug}?claim=${claimToken}`);
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

  return { ok: true, status: "processed", pending_enrollment_id: pendingId };
}

export { extractEventType };
