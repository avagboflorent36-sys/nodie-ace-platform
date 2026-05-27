// Server-only Chariow API helpers. Never import from client code.
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
  phone?: string;
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
