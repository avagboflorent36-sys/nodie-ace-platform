import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, AlertCircle, CheckCircle2, Clock, Wallet, CreditCard } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/etudiant/paiements")({
  component: StudentPayments,
});

function StudentPayments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("paid") === "2") {
      toast.success("Paiement de la tranche 2 enregistré. Validation sous peu.");
      url.searchParams.delete("paid");
      url.searchParams.delete("sale");
      window.history.replaceState({}, "", url.toString());
      if (user) qc.invalidateQueries({ queryKey: ["student-payments", user.id] });
    }
  }, [user, qc]);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["student-payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, mode, status, source, amount_total, amount_paid, currency, final_deadline, cohort_id, cohortes(name, slug, formations(title)), payment_installments(id, position, amount, status, due_date, submitted_at, validated_at, proof_path, rejection_reason, chariow_sale_id)")
        .eq("student_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const uploadProof = async (installmentId: string, file: File) => {
    if (!user) return;
    setUploading(installmentId);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${user.id}/${installmentId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error } = await supabase
        .from("payment_installments")
        .update({ proof_path: path, status: "submitted", submitted_at: new Date().toISOString(), student_confirmed_at: new Date().toISOString() })
        .eq("id", installmentId);
      if (error) throw error;
      toast.success("Preuve envoyée — en attente de validation");
      qc.invalidateQueries({ queryKey: ["student-payments", user.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Échec de l'envoi");
    } finally {
      setUploading(null);
    }
  };

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;

  const today = new Date().toISOString().slice(0, 10);
  const lateCount = payments.flatMap((p: any) => p.payment_installments ?? [])
    .filter((i: any) => i.status !== "validated" && i.due_date && i.due_date < today).length;

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mes paiements</h1>
        <p className="mt-1 text-muted-foreground">Suivez vos paiements et téléversez vos preuves.</p>
      </div>

      {lateCount > 0 && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{lateCount} échéance(s) en retard</p>
            <p className="text-xs text-muted-foreground mt-1">Régularisez pour conserver votre accès aux formations.</p>
          </div>
        </Card>
      )}

      {payments.length === 0 ? (
        <Card className="p-12 text-center">
          <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">Aucun paiement enregistré.</p>
        </Card>
      ) : (
        payments.map((p: any) => {
          const ratio = p.amount_total > 0 ? Math.min(100, (p.amount_paid / p.amount_total) * 100) : 0;
          const insts = (p.payment_installments ?? []).slice().sort((a: any, b: any) => a.position - b.position);
          const t2 = insts.find((i: any) => i.position === 2);
          const needsTranche2 = p.mode === "installments_2" && p.status !== "paid" && t2 && t2.status !== "validated";
          return (
            <Card key={p.id} className="p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <Badge variant="outline" className="mb-1">{p.cohortes?.formations?.title ?? "—"}</Badge>
                  {p.source === "chariow" && (
                    <Badge variant="outline" className="ml-1 mb-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Payé via Chariow
                    </Badge>
                  )}
                  <h2 className="text-lg font-semibold truncate">{p.cohortes?.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Mode : {p.mode === "full" ? "Paiement intégral" : "2 tranches"} —
                    {" "}{Number(p.amount_paid).toLocaleString()} / {Number(p.amount_total).toLocaleString()} {p.currency}
                  </p>
                </div>
                <Badge
                  variant={p.status === "paid" ? "default" : "outline"}
                  className={p.status === "paid" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                >
                  {p.status}
                </Badge>
              </div>

              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gold transition-all" style={{ width: `${ratio}%` }} />
              </div>

              {needsTranche2 && (
                <Card className="p-4 bg-gold/5 border-gold/30 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Tranche 2 à régler</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Montant restant : <strong>{Number(t2.amount).toLocaleString()} {p.currency}</strong>
                      {t2.due_date ? ` — échéance ${t2.due_date}` : ""}
                    </p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className="bg-gold text-primary hover:bg-gold/90"
                  >
                    <Link to="/etudiant/tranche-2/$paymentId" params={{ paymentId: p.id }}>
                      <CreditCard className="mr-1 h-3 w-3" />
                      Payer la tranche 2
                    </Link>
                  </Button>
                </Card>
              )}

              <div className="space-y-2">
                {insts.map((i: any) => {
                  const isLate = i.status !== "validated" && i.due_date && i.due_date < today;
                  return (
                    <div key={i.id} className={`rounded-lg border p-3 flex flex-wrap items-center gap-3 min-w-0 ${isLate ? "border-destructive/40 bg-destructive/5" : ""}`}>
                      <div className="flex-1 min-w-[180px]">
                        <div className="font-medium">Tranche #{i.position} — {Number(i.amount).toLocaleString()} {p.currency}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> Échéance : {i.due_date ?? "—"}
                          {isLate && <span className="ml-2 text-destructive font-medium">En retard</span>}
                        </div>
                        {i.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">Rejet : {i.rejection_reason}</p>
                        )}
                      </div>
                      <StatusBadge status={i.status} />
                      {i.status !== "validated" && i.position === 2 && p.mode === "installments_2" ? (
                        <Button
                          asChild
                          size="sm"
                          className="bg-gold text-primary hover:bg-gold/90"
                        >
                          <Link to="/etudiant/tranche-2/$paymentId" params={{ paymentId: p.id }}>
                            <CreditCard className="mr-1 h-3 w-3" />
                            Payer
                          </Link>
                        </Button>
                      ) : i.status !== "validated" && (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            disabled={uploading === i.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadProof(i.id, f);
                              e.target.value = "";
                            }}
                          />
                          <Button asChild size="sm" variant="outline" disabled={uploading === i.id}>
                            <span><Upload className="mr-1 h-3 w-3" />{i.proof_path ? "Remplacer la preuve" : "Téléverser une preuve"}</span>
                          </Button>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    pending: { label: "À payer", cls: "border-muted-foreground/40", icon: Clock },
    submitted: { label: "En attente de validation", cls: "border-amber-500/40 text-amber-600 dark:text-amber-400", icon: Clock },
    validated: { label: "Validé", cls: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
    rejected: { label: "Rejeté", cls: "border-destructive/40 text-destructive", icon: AlertCircle },
  };
  const m = map[status] ?? map.pending;
  const Icon = m.icon;
  return <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${m.cls}`}><Icon className="h-3 w-3" />{m.label}</span>;
}
