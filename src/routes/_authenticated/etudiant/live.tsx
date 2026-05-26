import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Video, ExternalLink } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/etudiant/live")({
  component: LivePage,
});

function LivePage() {
  const { data: sessions = [] } = useQuery({
    queryKey: ["student-live"],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("id, title, description, scheduled_at, meeting_link, cohortes(name)")
        .order("scheduled_at");
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Séances live</h1>
        <p className="mt-1 text-muted-foreground">Vos prochaines sessions en direct.</p>
      </div>
      {sessions.length === 0 ? (
        <Card className="p-12 text-center">
          <Video className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">Aucune séance à venir.</p>
        </Card>
      ) : (
        sessions.map((s: any) => (
          <Card key={s.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase text-muted-foreground">{s.cohortes?.name}</div>
              <div className="mt-1 font-semibold">{s.title}</div>
              <div className="text-sm text-muted-foreground">
                {new Date(s.scheduled_at).toLocaleString("fr-FR")}
              </div>
            </div>
            {s.meeting_link && (
              <a href={s.meeting_link} target="_blank" rel="noreferrer">
                <Button className="bg-gold text-primary hover:bg-gold/90">
                  Rejoindre <ExternalLink className="ml-2 h-3 w-3" />
                </Button>
              </a>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
