import { createFileRoute } from "@tanstack/react-router";
import { runAutomationTick } from "@/lib/automation.server";

export const Route = createFileRoute("/api/public/hooks/automation-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: anon/publishable key passed by pg_cron in `apikey` header
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("Authorization")?.replace("Bearer ", "");
        if (!apiKey || apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const summary = await runAutomationTick();
          return Response.json(summary);
        } catch (e: any) {
          return new Response(
            JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
