import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, X, Send, Lock, Unlock, Download } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { sendPaymentReminders } from "@/lib/reminders.functions";

const DEFAULT_SUBJECT_SELECTION = "Rappel paiement — {{cohorte}}";
const DEFAULT_BODY_SELECTION = `Bonjour {{prenom}},

Petit rappel concernant votre paiement pour {{cohorte}}.
Montant : {{montant}} {{devise}} — Échéance : {{echeance}}.

Réglez votre 2e tranche ici : {{lien_paiement}}

L'équipe Nodie IA Academy`;

const DEFAULT_SUBJECT_LATE = "Paiement en retard — {{cohorte}}";
const DEFAULT_BODY_LATE = `Bonjour {{prenom}},

Votre échéance pour {{cohorte}} est dépassée (échéance prévue le {{echeance}}).
Montant restant : {{montant}} {{devise}}.

Merci de régler votre 2e tranche au plus vite via ce lien :
{{lien_paiement}}

Sans régularisation rapide, votre accès à la cohorte peut être restreint.

L'équipe Nodie IA Academy`;

export const Route = createFileRoute("/_authenticated/admin/paiements")({
  component: PaymentsAdmin,
});

function PaymentsAdmin() {
  const qc = useQueryClient();
  const sendRem = useServerFn(sendPaymentReminders);
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: rows = [], isLoading: rowsLoading, error: rowsError } = useQuery({
    queryKey: ["admin-installments-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_installments")
        .select("id, amount, position, status, proof_path, submitted_at, due_date, payment_id, payments(student_id, currency, mode, status, amount_total, amount_paid, cohort_id, cohortes(name))")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      const clean = (data ?? []).filter((r: any) => r.payments); // drop orphans (jointure manquante)
      const studentIds = [...new Set(clean.map((r: any) => r.payments?.student_id).filter(Boolean))];
      const { data: profiles } = studentIds.length
        ? await supabase.from("profiles").select("id, first_name, last_name, email").in("id", studentIds)
        : { data: [] as any[] };
      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return clean.map((r: any) => ({ ...r, _student: pmap.get(r.payments?.student_id) }));
    },
  });

  useEffect(() => {
    if (rowsError) toast.error((rowsError as any).message ?? "Erreur de chargement des paiements");
  }, [rowsError]);

  const { data: enrollments = [] } = useQuery({
    queryKey: ["admin-enrollments-all"],
    queryFn: async () => {
      const { data } = await supabase.from("cohort_enrollments").select("student_id, cohort_id, status");
      return data ?? [];
    },
  });
  const enrollMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of enrollments as any[]) m.set(`${e.student_id}:${e.cohort_id}`, e.status);
    return m;
  }, [enrollments]);

  // Pour chaque (student:cohort), trouver l'échéance la plus ancienne en retard non validée
  // afin d'expliquer pourquoi l'accès est restreint.
  const todayStr = new Date().toISOString().slice(0, 10);
  const restrictionInfoMap = useMemo(() => {
    const m = new Map<string, { position: number; due_date: string }>();
    for (const r of rows as any[]) {
      const sid = r.payments?.student_id;
      const cid = r.payments?.cohort_id;
      if (!sid || !cid) continue;
      if (r.status === "validated") continue;
      if (!r.due_date || r.due_date >= todayStr) continue;
      const key = `${sid}:${cid}`;
      const cur = m.get(key);
      if (!cur || r.due_date < cur.due_date) {
        m.set(key, { position: r.position, due_date: r.due_date });
      }
    }
    return m;
  }, [rows, todayStr]);


  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    switch (tab) {
      case "full": return rows.filter((r: any) => r.payments?.mode === "full");
      case "install_ontime": return rows.filter((r: any) => r.payments?.mode === "installments_2" && r.status !== "validated" && (!r.due_date || r.due_date >= today));
      case "install_late": return rows.filter((r: any) => r.payments?.mode === "installments_2" && r.status !== "validated" && r.due_date && r.due_date < today);
      case "to_validate": return rows.filter((r: any) => r.status === "submitted");
      default: return rows;
    }
  }, [rows, tab, today]);

  const lateIds = useMemo(() => rows.filter((r: any) => r.status !== "validated" && r.due_date && r.due_date < today).map((r: any) => r.id), [rows, today]);

  const validate = async (id: string, action: "validated" | "rejected") => {
    const { error } = await supabase.from("payment_installments").update({ status: action, validated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(action === "validated" ? "Validé" : "Rejeté");
    qc.invalidateQueries({ queryKey: ["admin-installments-all"] });
  };

  const viewProof = async (path: string) => {
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const toggleAccess = async (studentId: string, cohortId: string, restrict: boolean) => {
    const { error } = await supabase.from("cohort_enrollments").update({ status: restrict ? "restricted" : "active" }).eq("student_id", studentId).eq("cohort_id", cohortId);
    if (error) { toast.error(error.message); return; }
    toast.success(restrict ? "Accès restreint" : "Accès rétabli");
    qc.invalidateQueries({ queryKey: ["admin-installments-all"] });
    qc.invalidateQueries({ queryKey: ["admin-enrollments-all"] });
  };

  const [dialogState, setDialogState] = useState<{ open: boolean; ids: string[]; subject: string; body: string; sending: boolean }>({
    open: false, ids: [], subject: "", body: "", sending: false,
  });

  const recipients = useMemo(() => {
    if (!dialogState.open) return [] as Array<{ id: string; name: string; email: string }>;
    const setIds = new Set(dialogState.ids);
    const seen = new Set<string>();
    const list: Array<{ id: string; name: string; email: string }> = [];
    for (const r of rows as any[]) {
      if (!setIds.has(r.id)) continue;
      const sid = r._student?.id;
      if (!sid || seen.has(sid)) continue;
      seen.add(sid);
      list.push({
        id: sid,
        name: `${r._student?.first_name ?? ""} ${r._student?.last_name ?? ""}`.trim() || "—",
        email: r._student?.email ?? "—",
      });
    }
    return list;
  }, [dialogState.open, dialogState.ids, rows]);

  const openSelectionDialog = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) { toast.error("Sélectionnez au moins une ligne"); return; }
    setDialogState({ open: true, ids, subject: DEFAULT_SUBJECT_SELECTION, body: DEFAULT_BODY_SELECTION, sending: false });
  };

  const openLateDialog = () => {
    if (lateIds.length === 0) { toast.error("Aucun retard"); return; }
    setDialogState({ open: true, ids: lateIds, subject: DEFAULT_SUBJECT_LATE, body: DEFAULT_BODY_LATE, sending: false });
  };

  const confirmSend = async () => {
    if (dialogState.ids.length === 0) return;
    if (dialogState.subject.trim().length < 2 || dialogState.body.trim().length < 5) {
      toast.error("Objet et contenu requis"); return;
    }
    setDialogState((s) => ({ ...s, sending: true }));
    try {
      const r = await sendRem({ data: { installmentIds: dialogState.ids, subject: dialogState.subject, bodyTemplate: dialogState.body } });
      toast.success(`Relances envoyées : ${r.sent} ok, ${r.failed} échec`);
      setSelected(new Set());
      setDialogState({ open: false, ids: [], subject: "", body: "", sending: false });
    } catch (e: any) {
      toast.error(e.message);
      setDialogState((s) => ({ ...s, sending: false }));
    }
  };


  const toggleSel = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };

  const exportCsv = () => {
    const head = ["Étudiant", "Email", "Cohorte", "Mode", "Tranche", "Montant", "Devise", "Échéance", "Statut"];
    const lines = filtered.map((r: any) => [
      r._student ? `${r._student.first_name} ${r._student.last_name}` : "",
      r._student?.email ?? "", r.payments?.cohortes?.name ?? "",
      r.payments?.mode === "full" ? "1x" : "2x", `#${r.position}`,
      r.amount, r.payments?.currency ?? "", r.due_date ?? "", r.status,
    ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [head.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `paiements-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Paiements</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-1 h-3 w-3" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={openSelectionDialog} disabled={selected.size === 0}><Send className="mr-1 h-3 w-3" /> Relancer sélection ({selected.size})</Button>
          <Button size="sm" className="bg-gold text-primary hover:bg-gold/90" onClick={openLateDialog}><Send className="mr-1 h-3 w-3" /> Relancer tous les retards</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="full">Payé 1x</TabsTrigger>
          <TabsTrigger value="install_ontime">2x — à jour</TabsTrigger>
          <TabsTrigger value="install_late">2x — en retard</TabsTrigger>
          <TabsTrigger value="to_validate">À valider</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="pt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Étudiant</TableHead>
                  <TableHead>Cohorte</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Tranche</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">Aucune ligne.</TableCell></TableRow>
                ) : filtered.map((i: any) => {
                  const isLate = i.due_date && i.due_date < today && i.status !== "validated";
                  return (
                    <TableRow key={i.id} className={isLate ? "bg-destructive/5" : ""}>
                      <TableCell><Checkbox checked={selected.has(i.id)} onCheckedChange={() => toggleSel(i.id)} /></TableCell>
                      <TableCell>{i._student ? `${i._student.first_name} ${i._student.last_name}` : "—"}</TableCell>
                      <TableCell>{i.payments?.cohortes?.name ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{i.payments?.mode === "full" ? "1x" : "2x"}</Badge></TableCell>
                      <TableCell>#{i.position}</TableCell>
                      <TableCell>{Number(i.amount).toLocaleString()} {i.payments?.currency}</TableCell>
                      <TableCell className={isLate ? "text-destructive font-medium" : ""}>{i.due_date ?? "—"}</TableCell>
                      <TableCell><Badge variant={i.status === "validated" ? "default" : "outline"}>{i.status}</Badge></TableCell>
                      <TableCell className="flex gap-1 flex-wrap">
                        {i.proof_path && <Button size="sm" variant="outline" onClick={() => viewProof(i.proof_path)}>Preuve</Button>}
                        {i.status === "submitted" && (
                          <>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => validate(i.id, "validated")}><Check className="h-4 w-4" /></Button>
                            <Button size="sm" variant="destructive" onClick={() => validate(i.id, "rejected")}><X className="h-4 w-4" /></Button>
                          </>
                        )}
                        {i.payments?.student_id && i.payments?.cohort_id && (() => {
                          const key = `${i.payments.student_id}:${i.payments.cohort_id}`;
                          const st = enrollMap.get(key);
                          const isRestricted = st === "restricted";
                          const info = restrictionInfoMap.get(key);
                          return (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className={isRestricted
                                    ? "border-destructive/40 text-destructive"
                                    : "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"}
                                >
                                  {isRestricted ? (<><Lock className="mr-1 h-3 w-3" /> Accès restreint</>) : (<><Unlock className="mr-1 h-3 w-3" /> Accès actif</>)}
                                </Badge>
                                {isRestricted ? (
                                  <Button size="sm" variant="ghost" onClick={() => toggleAccess(i.payments.student_id, i.payments.cohort_id, false)} title="Rétablir l'accès">
                                    <Unlock className="h-3 w-3" />
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="ghost" onClick={() => toggleAccess(i.payments.student_id, i.payments.cohort_id, true)} title="Restreindre l'accès">
                                    <Lock className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                              {isRestricted && info && (
                                <span className="text-[10px] leading-tight text-destructive/80">
                                  Impayé tranche #{info.position} — échéance {info.due_date}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogState.open} onOpenChange={(o) => !dialogState.sending && setDialogState((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Composer l'email de relance</DialogTitle>
            <DialogDescription>
              {recipients.length} destinataire(s). Variables disponibles : <code>{"{{prenom}}"}</code>, <code>{"{{cohorte}}"}</code>, <code>{"{{montant}}"}</code>, <code>{"{{devise}}"}</code>, <code>{"{{echeance}}"}</code>, <code>{"{{lien_paiement}}"}</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="rem-subject">Objet</Label>
              <Input id="rem-subject" value={dialogState.subject} onChange={(e) => setDialogState((s) => ({ ...s, subject: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="rem-body">Contenu</Label>
              <Textarea id="rem-body" rows={12} className="font-mono text-sm" value={dialogState.body} onChange={(e) => setDialogState((s) => ({ ...s, body: e.target.value }))} />
            </div>
            <div className="max-h-32 overflow-y-auto rounded border p-2 text-xs text-muted-foreground">
              <div className="font-medium mb-1">Destinataires :</div>
              {recipients.map((r) => (
                <div key={r.id}>{r.name} — {r.email}</div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogState((s) => ({ ...s, open: false }))} disabled={dialogState.sending}>Annuler</Button>
            <Button onClick={confirmSend} disabled={dialogState.sending} className="bg-gold text-primary hover:bg-gold/90">
              <Send className="mr-1 h-3 w-3" /> {dialogState.sending ? "Envoi…" : `Envoyer (${dialogState.ids.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
