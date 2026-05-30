import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROJECT_ID = "66439da9-0337-4213-a275-40cffeef22c6";

export const getChariowWebhookUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isAdmin = (roles ?? []).some(
      (r) => r.role === "admin" || r.role === "super_admin",
    );
    if (!isAdmin) {
      throw new Error("Unauthorized");
    }

    const secret = process.env.CHARIOW_WEBHOOK_URL_SECRET;
    if (!secret) {
      throw new Error("CHARIOW_WEBHOOK_URL_SECRET missing");
    }

    const path = `/api/public/hooks/chariow/${secret}`;
    return {
      previewUrl: `https://project--${PROJECT_ID}-dev.lovable.app${path}`,
      productionUrl: `https://futuretalents.me${path}`,
    };
  });

