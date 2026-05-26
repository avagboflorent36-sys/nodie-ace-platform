import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Download, Lock } from "lucide-react";
import jsPDF from "jspdf";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/etudiant/certificat")({
  component: CertificatPage,
});

function CertificatPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["student-certificat", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile }, { data: enrollments }] = await Promise.all([
        supabase.from("profiles").select("first_name,last_name").eq("id", user!.id).maybeSingle(),
        supabase.from("cohort_enrollments")
          .select("cohort_id, cohortes(id, name, end_date, formations(title))")
          .eq("student_id", user!.id),
      ]);
      const cohortIds = (enrollments ?? []).map((e: any) => e.cohort_id);
      if (cohortIds.length === 0) return { profile, items: [] };

      const [{ data: payments }, { data: modules }, { data: progress }] = await Promise.all([
        supabase.from("payments").select("cohort_id,status").eq("student_id", user!.id).in("cohort_id", cohortIds),
        supabase.from("modules").select("id, cohort_id, ressources(id)").in("cohort_id", cohortIds),
        supabase.from("progress_tracking").select("ressource_id").eq("student_id", user!.id),
      ]);
      const paid = new Set((payments ?? []).filter((p: any) => p.status === "paid").map((p: any) => p.cohort_id));
      const doneSet = new Set((progress ?? []).map((p: any) => p.ressource_id));

      const items = (enrollments ?? []).map((e: any) => {
        const cohortMods = (modules ?? []).filter((m: any) => m.cohort_id === e.cohort_id);
        const allRes = cohortMods.flatMap((m: any) => m.ressources ?? []);
        const total = allRes.length;
        const done = allRes.filter((r: any) => doneSet.has(r.id)).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return {
          cohortId: e.cohort_id,
          cohortName: e.cohortes?.name,
          formationTitle: e.cohortes?.formations?.title,
          endDate: e.cohortes?.end_date,
          paid: paid.has(e.cohort_id),
          total, done, pct,
          eligible: paid.has(e.cohort_id) && total > 0 && done === total,
        };
      });
      return { profile, items };
    },
  });

  const downloadPdf = (it: any) => {
    const name = `${data?.profile?.first_name ?? ""} ${data?.profile?.last_name ?? ""}`.trim();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    doc.setFillColor(13, 13, 13);
    doc.rect(0, 0, w, h, "F");
    doc.setDrawColor(201, 168, 76);
    doc.setLineWidth(3);
    doc.rect(20, 20, w - 40, h - 40);

    doc.setTextColor(201, 168, 76);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("NODIE IA ACADEMY", w / 2, 70, { align: "center" });

    doc.setFontSize(36);
    doc.text("CERTIFICAT DE RÉUSSITE", w / 2, 140, { align: "center" });

    doc.setTextColor(245, 240, 224);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text("Décerné à", w / 2, 200, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(30);
    doc.setTextColor(255, 255, 255);
    doc.text(name || "Étudiant", w / 2, 250, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(245, 240, 224);
    doc.text("pour avoir complété avec succès la formation", w / 2, 295, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(201, 168, 76);
    doc.text(`${it.formationTitle} — ${it.cohortName}`, w / 2, 340, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(180, 180, 180);
    doc.text(`Délivré le ${new Date().toLocaleDateString("fr-FR")}`, w / 2, h - 80, { align: "center" });

    doc.save(`certificat-${(it.cohortName || "cohorte").replace(/\s+/g, "-")}.pdf`);
  };

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;
  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mes certificats</h1>
        <p className="mt-1 text-muted-foreground">Téléchargez vos certificats une fois la formation terminée.</p>
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Award className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4">Aucune cohorte. Inscrivez-vous à une formation pour commencer.</p>
        </Card>
      ) : (
        items.map((it: any) => (
          <Card key={it.cohortId} className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge variant="outline" className="mb-1">{it.formationTitle}</Badge>
                <h2 className="text-lg font-semibold">{it.cohortName}</h2>
              </div>
              {it.eligible ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-700"><Award className="h-3 w-3 mr-1" /> Éligible</Badge>
              ) : (
                <Badge variant="outline"><Lock className="h-3 w-3 mr-1" /> Non disponible</Badge>
              )}
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-medium">{it.done}/{it.total} ressources ({it.pct}%)</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gold transition-all" style={{ width: `${it.pct}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Paiement intégral</span>
                <span className={it.paid ? "text-emerald-600" : "text-muted-foreground"}>{it.paid ? "Validé" : "En cours"}</span>
              </div>
            </div>

            {it.eligible && (
              <Button onClick={() => downloadPdf(it)} className="mt-5 bg-gold text-primary hover:bg-gold/90">
                <Download className="mr-1 h-4 w-4" /> Télécharger le certificat
              </Button>
            )}
            {!it.eligible && (
              <p className="mt-4 text-xs text-muted-foreground">
                Pour obtenir votre certificat : terminer toutes les ressources et avoir un paiement intégralement validé.
              </p>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
