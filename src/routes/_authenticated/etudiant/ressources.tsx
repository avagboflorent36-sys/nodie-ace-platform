import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Video, Link2, BookOpen, AlertCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/etudiant/ressources")({
  component: RessourcesPage,
});

const ICONS: Record<string, any> = { document: FileText, video: Video, link: Link2, exercise: BookOpen };

function RessourcesPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["student-all-resources", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Active enrollments only (RLS filters automatically, but we need cohort/formation list)
      const { data: enrollments } = await supabase
        .from("cohort_enrollments")
        .select("status, cohort_id, cohortes(id, name, formation_id, formations(id, title))")
        .eq("student_id", user!.id);

      const active = (enrollments ?? []).filter((e: any) => e.status === "active");
      const restricted = (enrollments ?? []).filter((e: any) => e.status === "restricted");

      const cohortIds = active.map((e: any) => e.cohort_id);
      const formationIds = [...new Set(active.map((e: any) => e.cohortes?.formation_id).filter(Boolean))];

      const [{ data: modules }, { data: formationResources }] = await Promise.all([
        cohortIds.length > 0
          ? supabase.from("modules").select("id, title, description, position, cohort_id, ressources(id, title, type, url, position, description)").in("cohort_id", cohortIds).order("position")
          : Promise.resolve({ data: [] as any[] }),
        formationIds.length > 0
          ? supabase.from("formation_resources").select("id, formation_id, title, type, url, description, position").in("formation_id", formationIds).order("position")
          : Promise.resolve({ data: [] as any[] }),
      ]);

      return { active, restricted, modules: modules ?? [], formationResources: formationResources ?? [] };
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;

  const hasActive = (data?.active ?? []).length > 0;
  const hasRestricted = (data?.restricted ?? []).length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ressources</h1>
        <p className="mt-1 text-muted-foreground">Contenu pédagogique de vos cohortes.</p>
      </div>

      {hasRestricted && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Accès suspendu pour {data!.restricted.length} cohorte(s)</p>
            <p className="text-xs text-muted-foreground mt-1">Régularisez votre paiement pour retrouver l'accès aux ressources.</p>
          </div>
        </Card>
      )}

      {!hasActive && !hasRestricted ? (
        <Card className="p-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">Aucune inscription active.</p>
        </Card>
      ) : (
        (data!.active as any[]).map((enr) => {
          const cohortId = enr.cohort_id;
          const formationId = enr.cohortes?.formation_id;
          const cohortModules = (data!.modules as any[]).filter((m) => m.cohort_id === cohortId);
          const formationRes = (data!.formationResources as any[]).filter((r) => r.formation_id === formationId);
          return (
            <div key={cohortId} className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{enr.cohortes?.name}</h2>
                <Badge variant="outline">{enr.cohortes?.formations?.title}</Badge>
              </div>

              {formationRes.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ressources de la formation</h3>
                  <div className="mt-3 divide-y rounded-lg border">
                    {formationRes.map((r) => <ResourceRow key={r.id} r={r} />)}
                  </div>
                </Card>
              )}

              {cohortModules.length === 0 ? (
                <Card className="p-6 text-center text-muted-foreground text-sm">Aucun module pour cette cohorte.</Card>
              ) : (
                cohortModules.map((m) => (
                  <Card key={m.id} className="p-6">
                    <h3 className="font-semibold">{m.title}</h3>
                    {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                    {(m.ressources ?? []).length > 0 && (
                      <div className="mt-4 divide-y rounded-lg border">
                        {m.ressources.slice().sort((a: any, b: any) => a.position - b.position).map((r: any) => <ResourceRow key={r.id} r={r} />)}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function ResourceRow({ r }: { r: any }) {
  const Icon = ICONS[r.type] ?? BookOpen;
  return (
    <a href={r.url ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 transition hover:bg-accent/30">
      <Icon className="h-4 w-4 text-gold" />
      <div className="flex-1">
        <div className="text-sm font-medium">{r.title}</div>
        {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
      </div>
      <span className="text-xs uppercase text-muted-foreground">{r.type}</span>
    </a>
  );
}
