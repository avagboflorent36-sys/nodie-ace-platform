import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { FileText, Video, Link2, BookOpen, AlertCircle, Megaphone, Calendar, ExternalLink } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/etudiant/formation")({
  component: FormationPage,
});

const ICONS: Record<string, any> = { document: FileText, video: Video, link: Link2, exercise: BookOpen };

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
      const formationIds = [...new Set(active.map((e: any) => e.cohortes?.formation_id).filter(Boolean))];

      const [{ data: modules }, { data: formationResources }, { data: annonces }] = await Promise.all([
        cohortIds.length
          ? supabase.from("modules").select("id, title, description, position, cohort_id, ressources(id, title, type, url, position, description)").in("cohort_id", cohortIds).order("position")
          : Promise.resolve({ data: [] as any[] }),
        formationIds.length
          ? supabase.from("formation_resources").select("id, formation_id, title, type, url, description, position").in("formation_id", formationIds).order("position")
          : Promise.resolve({ data: [] as any[] }),
        cohortIds.length
          ? supabase.from("annonces").select("id, cohort_id, title, content, created_at").in("cohort_id", cohortIds).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
      ]);

      return { active, restricted, modules: modules ?? [], formationResources: formationResources ?? [], annonces: annonces ?? [] };
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
          const cohortModules = (data!.modules as any[]).filter((m) => m.cohort_id === c?.id);
          const formationRes = (data!.formationResources as any[]).filter((r) => r.formation_id === c?.formation_id);
          const cohortAnnonces = (data!.annonces as any[]).filter((a) => a.cohort_id === c?.id);

          return (
            <div key={c?.id} className="space-y-4">
              <Card className="overflow-hidden">
                {f?.cover_image_url && <img src={f.cover_image_url} alt="" className="h-48 w-full object-cover" />}
                <div className="p-6">
                  <Badge variant="outline" className="mb-2">{f?.title}</Badge>
                  <h2 className="text-2xl font-bold">{c?.name}</h2>
                  {f?.description && <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>}
                  {f?.long_description && <p className="mt-3 text-sm whitespace-pre-wrap">{f.long_description}</p>}
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {c?.start_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Début : {new Date(c.start_date).toLocaleDateString()}</span>}
                    {c?.end_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Fin : {new Date(c.end_date).toLocaleDateString()}</span>}
                    {c?.zoom_link && <a href={c.zoom_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-gold hover:underline"><ExternalLink className="h-3 w-3" />Lien Zoom</a>}
                  </div>
                </div>
              </Card>

              {cohortAnnonces.length > 0 && (
                <Card className="p-6">
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <Megaphone className="h-4 w-4" /> Annonces
                  </h3>
                  <div className="mt-3 space-y-3">
                    {cohortAnnonces.map((a) => (
                      <div key={a.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{a.title}</div>
                          <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

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
