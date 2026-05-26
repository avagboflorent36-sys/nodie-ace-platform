import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/etudiant/paiements")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);

  const { data: payments = [] } = useQuery({
    queryKey: ["student-pay-detail", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount_total, amount_paid, status, currency, final_deadline, cohortes(name), payment_installments(id, position, amount, due_date, status, proof_path)")
        .eq("student_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const uploadProof = async (installmentId: string, file: File) => {
    if (!user) return;
    setUploading(installmentId);
    const path = `${user.id}/${installmentId}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file, { upsert: true });
    if (upErr) { toast.error(upErr.message); setUploading(null); return; }
    const { error: updErr } = await supabase
      .from("payment_installments")
      .update({ proof_path: path, status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", installmentId);
    if (updErr) { toast.error(updErr.message); setUploading(null); return; }
    toast.success("Preuve envoyée. En attente de validation.");
    qc.invalidateQueries({ queryKey: ["student-pay-detail"] });
    setUploading(null);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paiements</h1>
        <p className="mt-1 text-muted-foreground">Suivez vos paiements et envoyez vos preuves.</p>
      </div>
      {payments.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Aucun paiement.</Card>
      ) : (
        payments.map((p: any) => (
          <Card key={p.id} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{p.cohortes?.name}</div>
                <div className="text-sm text-muted-foreground">
                  {Number(p.amount_paid).toLocaleString()} / {Number(p.amount_total).toLocaleString()} {p.currency}
                </div>
              </div>
              <Badge variant="outline">{p.status}</Badge>
            </div>
            <div className="mt-4 divide-y rounded-lg border">
              {(p.payment_installments ?? []).sort((a: any, b: any) => a.position - b.position).map((i: any) => (
                <div key={i.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">Tranche #{i.position}</div>
                    <div className="text-xs text-muted-foreground">
                      {Number(i.amount).toLocaleString()} {p.currency}
                      {i.due_date && <> • à régler avant {new Date(i.due_date).toLocaleDateString("fr-FR")}</>}
                    </div>
                  </div>
                  <Badge variant="outline">{i.status}</Badge>
                  {i.status !== "validated" && (
                    <label className="text-xs">
                      <Input
                        type="file"
                        accept="image/*,application/pdf"
                        className="h-8 w-48 text-xs"
                        disabled={uploading === i.id}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadProof(i.id, f);
                        }}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
