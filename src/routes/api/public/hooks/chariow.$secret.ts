import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  timingSafeEqualStr,
  webhookUrlSecret,
  extractSaleId,
  extractEventType,
  processChariowSale,
} from "@/lib/chariow.server";

export const Route = createFileRoute("/api/public/hooks/chariow/$secret")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        // 1. URL secret (constant time)
        try {
          const expected = webhookUrlSecret();
          if (!params.secret || !timingSafeEqualStr(params.secret, expected)) {
            return new Response("Forbidden", { status: 403 });
          }
        } catch {
          return new Response("Server misconfigured", { status: 500 });
        }

        // 2. Parse body (very tolerant — log everything even on bad JSON)
        const bodyText = await request.text();
        let raw: any = null;
        let parseError: string | null = null;
        try {
          raw = bodyText ? JSON.parse(bodyText) : {};
        } catch (e: any) {
          parseError = `JSON parse error: ${String(e?.message ?? e).slice(0, 200)}`;
          raw = { __raw_body: bodyText.slice(0, 4000) };
        }

        const eventType = extractEventType(raw);
        const saleId = extractSaleId(raw);

        // 3. Always insert a webhook_events row so admin can see what arrived
        const { data: eventRow } = await supabaseAdmin
          .from("chariow_webhook_events")
          .insert({
            event_type: eventType,
            sale_id: saleId || `unknown-${Date.now()}`,
            payload: raw,
            error: parseError ?? (!saleId ? "Could not find sale id in payload" : null),
          })
          .select("id")
          .maybeSingle();
        const eventRowId = eventRow?.id ?? "";

        if (parseError || !saleId) {
          // Acknowledge so Chariow does not retry forever; admin can resync manually
          return new Response("OK (no sale id)", { status: 200 });
        }

        // 4. Only process events that look successful
        const lower = eventType.toLowerCase();
        const looksSuccess =
          lower.includes("success") ||
          lower.includes("paid") ||
          lower.includes("completed") ||
          lower.includes("validated") ||
          lower === "unknown"; // some providers send empty/typeless on success

        if (!looksSuccess) {
          if (eventRowId) {
            await supabaseAdmin
              .from("chariow_webhook_events")
              .update({ processed_at: new Date().toISOString() })
              .eq("id", eventRowId);
          }
          return new Response("OK (ignored event)", { status: 200 });
        }

        try {
          const result = await processChariowSale(saleId, raw);
          if (eventRowId) {
            await supabaseAdmin
              .from("chariow_webhook_events")
              .update({
                processed_at: new Date().toISOString(),
                error: result.ok ? null : result.message ?? result.status,
              })
              .eq("id", eventRowId);
          }
          return new Response("OK", { status: 200 });
        } catch (e: any) {
          if (eventRowId) {
            await supabaseAdmin
              .from("chariow_webhook_events")
              .update({
                processed_at: new Date().toISOString(),
                error: String(e?.message ?? e).slice(0, 1000),
              })
              .eq("id", eventRowId);
          }
          console.error("chariow webhook error", e);
          return new Response("Processed with error", { status: 200 });
        }
      },
    },
  },
});
