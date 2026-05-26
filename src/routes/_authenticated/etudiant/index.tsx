import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { BookOpen, Video, Megaphone } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/etudiant/")({
  component: StudentHome,
});

function StudentHome() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-enrollments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("cohort_enrollments")
        .select("id, status, cohort_id, cohortes(id, name, start_date, end_date, formations(title))")
        .eq("student_id", user!.id);
      return data ?? [];
    },
  });

  const cohortIds = enrollments.map((e: any) => e.cohort_id);

  const { data: liveSessions = [] } = useQuery({
    queryKey: ["student-live-upcoming", cohortIds.join(",")],
    enabled: cohortIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("id, title, scheduled_at, cohort_id, cohortes(name)")
        .in("cohort_id", cohortIds)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at")
        .limit(5);
      return data ?? [];
    },
  });

  const { data: annonces = [] } = useQuery({
    queryKey: ["student-annonces-recent", cohortIds.join(",")],
    enabled: cohortIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("annonces")
        .select("id, title, content, created_at, cohort_id, cohortes(name)")
        .in("cohort_id", cohortIds)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (cohortIds.length === 0) return;
    const channel = supabase
      .channel("home-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "annonces" }, () => {
        queryClient.invalidateQueries({ queryKey: ["student-annonces-recent"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["student-live-upcoming"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cohortIds.join(","), queryClient]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bienvenue 👋</h1>
        <p className="mt-1 text-muted-foreground">Voici votre espace d'apprentissage.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 shadow-premium">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cohortes</span>
            <BookOpen className="h-4 w-4 text-gold" />
          </div>
          <div className="mt-3 text-3xl font-bold">{enrollments.length}</div>
        </Card>
        <Card className="p-5 shadow-premium">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Séances à venir</span>
            <Video className="h-4 w-4 text-gold" />
          </div>
          <div className="mt-3 text-3xl font-bold">{liveSessions.length}</div>
        </Card>
        <Card className="p-5 shadow-premium">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Annonces récentes</span>
            <Megaphone className="h-4 w-4 text-gold" />
          </div>
          <div className="mt-3 text-3xl font-bold">{annonces.length}</div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Mes cohortes</h2>
          <div className="mt-4 space-y-3">
            {enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune cohorte pour l'instant.</p>
            ) : (
              enrollments.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{e.cohortes?.formations?.title ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">Cohorte : {e.cohortes?.name}</div>
                  </div>
                  <Badge variant="outline">{e.status}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Dernières annonces</h2>
          <div className="mt-4 space-y-3">
            {annonces.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune annonce pour le moment.</p>
            ) : (
              annonces.map((a: any) => (
                <div key={a.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{a.title}</div>
                    <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{a.content}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
