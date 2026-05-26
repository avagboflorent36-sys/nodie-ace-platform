import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: NotifsAdmin,
});

function NotifsAdmin() {
  const { user } = useAuth();
  const { data: notifs = [] } = useQuery({
    queryKey: ["admin-notifs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 animate-fade-up">
      <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
      {notifs.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Aucune notification.</Card>
      ) : (
        notifs.map((n: any) => (
          <Card key={n.id} className="p-4">
            <div className="font-medium">{n.title}</div>
            <div className="text-sm text-muted-foreground">{n.content}</div>
            <div className="mt-2 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("fr-FR")}</div>
          </Card>
        ))
      )}
    </div>
  );
}
