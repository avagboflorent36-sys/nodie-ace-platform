import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/paiements")({
  component: PaymentsAdmin,
});

function PaymentsAdmin() {
  const qc = useQueryClient();

  const { data: installments = [] } = useQuery({
    queryKey: ["admin-installments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_installments")
        .select("id, amount, position, status, proof_path, submitted_at, payments(currency, student_id, cohortes(name), payments_student:student_id)")
        .order("submitted_at", { ascending: false, nullsFirst: false });
      // load student names
      const result = data ?? [];
      const studentIds = [...new Set(result.map((r: any) => r.payments?.student_id).filter(Boolean))];
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", studentIds);
      const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return result.map((r: any) => ({ ...r, _student: profMap.get(r.payments?.student_id) }));
    },
  });

  const validate = async (id: string, action: "validated" | "rejected") => {
    const { error } = await supabase
      .from("payment_installments")
      .update({ status: action, validated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(action === "validated" ? "Paiement validé" : "Paiement rejeté");
    qc.invalidateQueries({ queryKey: ["admin-installments"] });
  };

  const viewProof = async (path: string) => {
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">
      <h1 className="text-3xl font-bold tracking-tight">Paiements</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Étudiant</TableHead>
              <TableHead>Cohorte</TableHead>
              <TableHead>Tranche</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">Aucune tranche.</TableCell></TableRow>
            ) : (
              installments.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell>{i._student ? `${i._student.first_name} ${i._student.last_name}` : "—"}</TableCell>
                  <TableCell>{i.payments?.cohortes?.name ?? "—"}</TableCell>
                  <TableCell>#{i.position}</TableCell>
                  <TableCell>{Number(i.amount).toLocaleString()} {i.payments?.currency}</TableCell>
                  <TableCell><Badge variant="outline">{i.status}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    {i.proof_path && (
                      <Button size="sm" variant="outline" onClick={() => viewProof(i.proof_path)}>Preuve</Button>
                    )}
                    {i.status === "submitted" && (
                      <>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => validate(i.id, "validated")}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => validate(i.id, "rejected")}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
