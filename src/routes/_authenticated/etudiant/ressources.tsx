import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Video, Link2, BookOpen } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/etudiant/ressources")({
  component: RessourcesPage,
});

function RessourcesPage() {
  const { user } = useAuth();

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["student-modules", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // RLS already filters to active enrollments only
      const { data } = await supabase
        .from("modules")
        .select("id, title, description, position, cohortes(name), ressources(id, title, type, url, position)")
        .order("position");
      return data ?? [];
    },
  });

  const iconOf = (t: string) =>
    t === "video" ? Video : t === "document" ? FileText : t === "link" ? Link2 : BookOpen;

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ressources</h1>
        <p className="mt-1 text-muted-foreground">Vos modules et ressources pédagogiques.</p>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : modules.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">
            Aucune ressource accessible. Si votre paiement est en retard, l'accès est temporairement suspendu.
          </p>
        </Card>
      ) : (
        modules.map((m: any) => (
          <Card key={m.id} className="p-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.cohortes?.name}</div>
            <h2 className="mt-1 text-xl font-semibold">{m.title}</h2>
            {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
            <div className="mt-4 divide-y rounded-lg border">
              {(m.ressources ?? []).map((r: any) => {
                const Icon = iconOf(r.type);
                return (
                  <a
                    key={r.id}
                    href={r.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 transition hover:bg-accent/30"
                  >
                    <Icon className="h-4 w-4 text-gold" />
                    <span className="text-sm font-medium">{r.title}</span>
                    <span className="ml-auto text-xs uppercase text-muted-foreground">{r.type}</span>
                  </a>
                );
              })}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
