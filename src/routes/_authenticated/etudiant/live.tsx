import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Video, ExternalLink, Calendar } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/etudiant/live")({
  component: LivePage,
});

function LivePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: sessions = [] } = useQuery({
    queryKey: ["student-live-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("id, title, description, scheduled_at, meeting_link, cohort_id, cohortes(name)")
        .order("scheduled_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("live-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" },
        () => qc.invalidateQueries({ queryKey: ["student-live-all", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc, user]);

  const now = new Date();
  const upcoming = sessions.filter((s: any) => new Date(s.scheduled_at) >= now)
    .sort((a: any, b: any) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  const past = sessions.filter((s: any) => new Date(s.scheduled_at) < now);

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Séances live</h1>
        <p className="mt-1 text-muted-foreground">Vos sessions en direct, mises à jour en temps réel.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">À venir</h2>
        {upcoming.length === 0 ? (
          <Card className="p-12 text-center">
            <Video className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">Aucune séance à venir.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((s: any) => <SessionCard key={s.id} s={s} upcoming />)}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Passées</h2>
          <div className="space-y-3">
            {past.slice(0, 10).map((s: any) => <SessionCard key={s.id} s={s} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function SessionCard({ s, upcoming }: { s: any; upcoming?: boolean }) {
  return (
    <Card className={`flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between ${upcoming ? "" : "opacity-70"}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{s.cohortes?.name ?? "—"}</Badge>
          {upcoming && <Badge className="bg-gold text-primary hover:bg-gold/90">À venir</Badge>}
        </div>
        <div className="mt-2 font-semibold">{s.title}</div>
        {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
          <Calendar className="h-3 w-3" />{new Date(s.scheduled_at).toLocaleString("fr-FR")}
        </div>
      </div>
      {s.meeting_link && upcoming && (
        <a href={s.meeting_link} target="_blank" rel="noreferrer">
          <Button className="bg-gold text-primary hover:bg-gold/90">
            Rejoindre <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        </a>
      )}
    </Card>
  );
}
