import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { BookOpen, AlertCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ResourceRow, PlaylistProvider, type ResourceItem } from "@/components/ResourceViewer";

export const Route = createFileRoute("/_authenticated/etudiant/formation")({
  component: FormationPage,
});

function FormationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["student-formation", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from("cohort_enrollments")
        .select("status, cohort_id, cohortes(id, name, start_date, end_date, zoom_link, formation_id, formations(id, title, description, long_description, cover_image_url))")
        .eq("student_id", user!.id);

      const active = (enrollments ?? []).filter((e: any) => e.status === "active");
      const restricted = (enrollments ?? []).filter((e: any) => e.status === "restricted");
      const cohortIds = active.map((e: any) => e.cohort_id);
      const formationIds = [...new Set(active.map((e: any) => e.cohortes?.formation_id).filter(Boolean))] as string[];

      const [cohortModulesRes, formationModulesRes, formationResourcesRes, annoncesRes] = await Promise.all([
        cohortIds.length
          ? supabase.from("modules").select("id, title, description, position, cohort_id, ressources(id, title, type, url, position, description)").in("cohort_id", cohortIds).order("position")
          : Promise.resolve({ data: [] as any[] }),
        formationIds.length
          ? supabase.from("formation_modules").select("id, formation_id, title, description, position").in("formation_id", formationIds).order("position")
          : Promise.resolve({ data: [] as any[] }),
        formationIds.length
          ? supabase.from("formation_resources").select("id, formation_id, module_id, title, type, url, description, position").in("formation_id", formationIds).order("position")
          : Promise.resolve({ data: [] as any[] }),
        cohortIds.length
          ? supabase.from("annonces").select("id, cohort_id, title, content, created_at").in("cohort_id", cohortIds).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
      ]);

      return {
        active,
        restricted,
        cohortModules: cohortModulesRes.data ?? [],
        formationModules: formationModulesRes.data ?? [],
        formationResources: formationResourcesRes.data ?? [],
        annonces: annoncesRes.data ?? [],
      };
    },
  });

  const cohortIds = (data?.active ?? []).map((e: any) => e.cohort_id);

  useEffect(() => {
    if (cohortIds.length === 0) return;
    const channel = supabase
      .channel("formation-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "annonces" }, () => {
        queryClient.invalidateQueries({ queryKey: ["student-formation", user?.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "modules" }, () => {
        queryClient.invalidateQueries({ queryKey: ["student-formation", user?.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ressources" }, () => {
        queryClient.invalidateQueries({ queryKey: ["student-formation", user?.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "formation_modules" }, () => {
        queryClient.invalidateQueries({ queryKey: ["student-formation", user?.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "formation_resources" }, () => {
        queryClient.invalidateQueries({ queryKey: ["student-formation", user?.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cohortIds.join(","), user?.id, queryClient]);

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;

  const hasActive = (data?.active ?? []).length > 0;
  const hasRestricted = (data?.restricted ?? []).length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ma formation</h1>
        <p className="mt-1 text-muted-foreground">Tout le contenu de vos cohortes, en temps réel.</p>
      </div>

      {hasRestricted && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Accès suspendu pour {data!.restricted.length} cohorte(s)</p>
            <p className="text-xs text-muted-foreground mt-1">Régularisez votre paiement pour retrouver l'accès.</p>
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
          const c = enr.cohortes;
          const f = c?.formations;
          const formationId = c?.formation_id;
          const fModules = (data!.formationModules as any[]).filter((m) => m.formation_id === formationId);
          const fResources = (data!.formationResources as any[]).filter((r) => r.formation_id === formationId);
          const fGlobalResources = fResources.filter((r) => !r.module_id);
          const cohortModules = (data!.cohortModules as any[]).filter((m) => m.cohort_id === c?.id);
          const cohortAnnonces = (data!.annonces as any[]).filter((a) => a.cohort_id === c?.id);

          const hasAnyContent =
            fModules.length > 0 || fGlobalResources.length > 0 || cohortModules.length > 0;

          return (
            <div key={c?.id} className="space-y-4">
              <PlaylistProvider playlist={buildPlaylist(fModules, fResources, fGlobalResources, cohortModules)}>
                {fModules.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Programme de la formation</h3>
                    {fModules.map((m: any) => {
                      const lessons = fResources
                        .filter((r) => r.module_id === m.id)
                        .slice()
                        .sort((a: any, b: any) => a.position - b.position);
                      return (
                        <Card key={m.id} className="p-6">
                          <h4 className="font-semibold">{m.title}</h4>
                          {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                          {lessons.length > 0 ? (
                            <div className="mt-4 divide-y rounded-lg border">
                              {lessons.map((r: any) => <ResourceRow key={r.id} r={r} />)}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-muted-foreground">Aucune leçon dans ce module.</p>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}

                {fGlobalResources.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ressources de la formation</h3>
                    <div className="mt-3 divide-y rounded-lg border">
                      {fGlobalResources
                        .slice()
                        .sort((a: any, b: any) => a.position - b.position)
                        .map((r: any) => <ResourceRow key={r.id} r={r} />)}
                    </div>
                  </Card>
                )}

                {cohortModules.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contenu spécifique à cette cohorte</h3>
                    {cohortModules.map((m: any) => (
                      <Card key={m.id} className="p-6">
                        <h4 className="font-semibold">{m.title}</h4>
                        {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                        {(m.ressources ?? []).length > 0 && (
                          <div className="mt-4 divide-y rounded-lg border">
                            {m.ressources.slice().sort((a: any, b: any) => a.position - b.position).map((r: any) => <ResourceRow key={r.id} r={r} />)}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}

                {!hasAnyContent && (
                  <Card className="p-12 text-center text-muted-foreground text-sm">
                    Aucun contenu pédagogique n'a encore été publié pour cette formation.
                  </Card>
                )}
              </PlaylistProvider>
            </div>
          );
        })
      )}
    </div>
  );
}

function buildPlaylist(
  fModules: any[],
  fResources: any[],
  fGlobalResources: any[],
  cohortModules: any[],
): ResourceItem[] {
  const out: ResourceItem[] = [];
  for (const m of fModules) {
    const lessons = fResources.filter((r) => r.module_id === m.id).slice().sort((a, b) => a.position - b.position);
    for (const r of lessons) out.push({ id: r.id, title: r.title, type: r.type, url: r.url, description: r.description });
  }
  for (const r of fGlobalResources.slice().sort((a, b) => a.position - b.position)) {
    out.push({ id: r.id, title: r.title, type: r.type, url: r.url, description: r.description });
  }
  for (const m of cohortModules) {
    const lessons = (m.ressources ?? []).slice().sort((a: any, b: any) => a.position - b.position);
    for (const r of lessons) out.push({ id: r.id, title: r.title, type: r.type, url: r.url, description: r.description });
  }
  return out;
}




