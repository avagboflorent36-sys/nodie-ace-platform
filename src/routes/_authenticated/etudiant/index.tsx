import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, BookOpen, Video, CheckCircle2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/etudiant/")({
  component: StudentHome,
});

function StudentHome() {
  const { user } = useAuth();

  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-enrollments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("cohort_enrollments")
        .select("id, status, enrolled_at, cohortes(id, name, start_date, end_date, status, formations(title))")
        .eq("student_id", user!.id);
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["student-payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount_total, amount_paid, status, final_deadline, currency, cohortes(name)")
        .eq("student_id", user!.id);
      return data ?? [];
    },
  });

  const statusColors: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-700",
    partial: "bg-amber-500/15 text-amber-700",
    pending: "bg-blue-500/15 text-blue-700",
    overdue: "bg-red-500/15 text-red-700",
    suspended: "bg-red-600/15 text-red-800",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bienvenue 👋</h1>
        <p className="mt-1 text-muted-foreground">Voici votre espace d'apprentissage.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: BookOpen, label: "Cohortes", value: enrollments.length },
          { icon: CreditCard, label: "Paiements", value: payments.length },
          { icon: Video, label: "Séances à venir", value: "—" },
          { icon: CheckCircle2, label: "Progression", value: "—" },
        ].map((s) => (
          <Card key={s.label} className="p-5 shadow-premium">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-gold" />
            </div>
            <div className="mt-3 text-3xl font-bold">{s.value}</div>
          </Card>
        ))}
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
          <h2 className="text-lg font-semibold">Mes paiements</h2>
          <div className="mt-4 space-y-3">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun paiement enregistré.</p>
            ) : (
              payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{p.cohortes?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {Number(p.amount_paid).toLocaleString()} / {Number(p.amount_total).toLocaleString()} {p.currency}
                    </div>
                  </div>
                  <Badge className={statusColors[p.status] ?? ""}>{p.status}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
