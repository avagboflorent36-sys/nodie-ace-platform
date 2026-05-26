import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, CreditCard, Layers, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [students, payments, cohortes, pendingPayments] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("amount_paid"),
        supabase.from("cohortes").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("id", { count: "exact", head: true }).in("status", ["pending", "partial", "overdue"]),
      ]);
      const revenue = (payments.data ?? []).reduce((s: number, p: any) => s + Number(p.amount_paid), 0);
      return {
        students: students.count ?? 0,
        cohortes: cohortes.count ?? 0,
        revenue,
        pending: pendingPayments.count ?? 0,
      };
    },
  });

  const { data: paymentsByStatus = [] } = useQuery({
    queryKey: ["admin-pay-chart"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("status");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((p: any) => { counts[p.status] = (counts[p.status] ?? 0) + 1; });
      return Object.entries(counts).map(([status, count]) => ({ status, count }));
    },
  });

  const kpis = [
    { icon: Users, label: "Étudiants", value: stats?.students ?? 0 },
    { icon: Layers, label: "Cohortes", value: stats?.cohortes ?? 0 },
    { icon: CreditCard, label: "Revenus", value: (stats?.revenue ?? 0).toLocaleString() + " XOF" },
    { icon: Award, label: "Paiements en attente", value: stats?.pending ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Vue d'ensemble</h1>
        <p className="mt-1 text-muted-foreground">Pilotez votre académie en un coup d'œil.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((s) => (
          <Card key={s.label} className="p-5 shadow-premium">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-gold" />
            </div>
            <div className="mt-3 text-3xl font-bold">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Paiements par statut</h2>
        <div className="mt-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={paymentsByStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="status" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" />
              <Tooltip />
              <Bar dataKey="count" fill="var(--gold)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
