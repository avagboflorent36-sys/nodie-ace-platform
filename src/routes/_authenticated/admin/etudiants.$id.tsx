import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, Send, Lock, Unlock,
  Bell, FileText, Download, CheckCircle2, XCircle, Shield, Wallet, AlertTriangle, Activity,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { sendPaymentReminders } from "@/lib/reminders.functions";

export const Route = createFileRoute("/_authenticated/admin/etudiants/$id")({
  component: StudentDetail,
});

function StudentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const sendReminders = useServerFn(sendPaymentReminders);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-student", id],
    queryFn: async () => {
      const [profile, roles, enrollments, payments, responses, progress, notifs, reminders] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", id),
        supabase.from("cohort_enrollments").select("id, status, enrolled_at, cohort_id, cohortes(id, name, formation_id, formations(title))").eq("student_id", id),
        supabase.from("payments").select("id, mode, status, amount_total, amount_paid, currency, cohort_id, created_at, final_deadline, cohortes(name), payment_installments(id, position, amount, status, due_date, submitted_at, validated_at, proof_path, rejection_reason)").eq("student_id", id),
        supabase.from("form_responses").select("id, answers, created_at, cohort_id, cohortes(name)").eq("student_id", id).order("created_at", { ascending: false }),
        supabase.from("progress_tracking").select("id, completed_at, ressource_id, ressources(title, module_id, modules(title, cohort_id, cohortes(name)))").eq("student_id", id),
        supabase.from("notifications").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(100),
        supabase.from("payment_reminders").select("id, installment_id, channel, status, sent_at, error").order("sent_at", { ascending: false }).limit(100),
      ]);
      return {
        profile: profile.data,
        roles: (roles.data ?? []).map((r: any) => r.role),
        enrollments: enrollments.data ?? [],
        payments: payments.data ?? [],
        responses: responses.data ?? [],
        progress: progress.data ?? [],
        notifs: notifs.data ?? [],
        reminders: reminders.data ?? [],
      };
    },
  });

  const toggleEnrollment = useMutation({
    mutationFn: async ({ enrollmentId, current }: { enrollmentId: string; current: string }) => {
      const next = current === "restricted" ? "active" : "restricted";
      const { error } = await supabase.from("cohort_enrollments").update({ status: next as any }).eq("id", enrollmentId);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => { toast.success(next === "restricted" ? "Accès restreint" : "Accès rétabli"); qc.invalidateQueries({ queryKey: ["admin-student", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const validateInstallment = useMutation({
    mutationFn: async ({ installmentId, action }: { installmentId: string; action: "validate" | "reject" }) => {
      const patch: any = action === "validate"
        ? { status: "validated", validated_at: new Date().toISOString() }
        : { status: "rejected", rejection_reason: "Rejeté par l'administration" };
      const { error } = await supabase.from("payment_installments").update(patch).eq("id", installmentId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(v.action === "validate" ? "Paiement validé" : "Paiement rejeté"); qc.invalidateQueries({ queryKey: ["admin-student", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remind = useMutation({
    mutationFn: async (installmentIds: string[]) => sendReminders({ data: { installmentIds } }),
    onSuccess: (r: any) => { toast.success(`${r.sent} relance(s) envoyée(s)${r.failed ? `, ${r.failed} échec(s)` : ""}`); qc.invalidateQueries({ queryKey: ["admin-student", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Chargement...</div>;
  if (!data?.profile) return <div className="p-8 text-muted-foreground">Étudiant introuvable.</div>;

  const p = data.profile;
  const initials = `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase() || "?";

  // KPIs
  const totalDue = data.payments.reduce((s: number, x: any) => s + Number(x.amount_total || 0), 0);
  const totalPaid = data.payments.reduce((s: number, x: any) => s + Number(x.amount_paid || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const allInstallments = data.payments.flatMap((pay: any) => (pay.payment_installments ?? []).map((i: any) => ({ ...i, currency: pay.currency, cohort: pay.cohortes?.name })));
  const overdueCount = allInstallments.filter((i: any) => i.status !== "validated" && i.due_date && i.due_date < today).length;
  const pendingInstallmentIds = allInstallments.filter((i: any) => i.status !== "validated" && i.status !== "rejected").map((i: any) => i.id);
  const totalRessources = data.progress.length; // simple approx
  const activeEnrollments = data.enrollments.filter((e: any) => e.status === "active").length;
  const restrictedEnrollments = data.enrollments.filter((e: any) => e.status === "restricted").length;
  const currency = data.payments[0]?.currency ?? "XOF";

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">
      <Link to="/admin/etudiants" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-3 w-3" /> Retour aux étudiants
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={p.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gold/20 text-gold text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{p.first_name} {p.last_name}</h1>
              {data.roles.map((r: string) => (
                <Badge key={r} variant={r.includes("admin") ? "default" : "outline"} className="gap-1">
                  <Shield className="h-3 w-3" /> {r}
                </Badge>
              ))}
            </div>
            <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="flex items-center gap-2"><Mail className="h-3 w-3" />{p.email}</div>
              {p.whatsapp && (
                <a href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-foreground">
                  <Phone className="h-3 w-3" />{p.whatsapp}
                </a>
              )}
              {p.country && <div className="flex items-center gap-2"><MapPin className="h-3 w-3" />{p.country}</div>}
              <div className="flex items-center gap-2"><Calendar className="h-3 w-3" />Inscrit le {new Date(p.created_at).toLocaleDateString("fr-FR")}</div>
              <div className="flex items-center gap-2 text-xs"><span className="opacity-60">ID :</span><code className="font-mono">{p.id.slice(0, 8)}…</code></div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <NotifyDialog studentId={id} />
            <Button size="sm" variant="outline" onClick={() => remind.mutate(pendingInstallmentIds)} disabled={pendingInstallmentIds.length === 0 || remind.isPending}>
              <Bell className="mr-2 h-3 w-3" /> Relancer ({pendingInstallmentIds.length})
            </Button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Activity className="h-4 w-4" />} label="Cohortes actives" value={`${activeEnrollments}${restrictedEnrollments ? ` (${restrictedEnrollments} restreintes)` : ""}`} />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Payé / Dû" value={`${totalPaid.toLocaleString()} / ${totalDue.toLocaleString()} ${currency}`} />
        <Kpi icon={<AlertTriangle className={`h-4 w-4 ${overdueCount ? "text-destructive" : ""}`} />} label="Échéances en retard" value={String(overdueCount)} accent={overdueCount > 0} />
        <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Ressources complétées" value={String(totalRessources)} />
      </div>

      <Tabs defaultValue="cohortes">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="cohortes">Cohortes ({data.enrollments.length})</TabsTrigger>
          <TabsTrigger value="paiements">Paiements ({data.payments.length})</TabsTrigger>
          <TabsTrigger value="progression">Progression ({data.progress.length})</TabsTrigger>
          <TabsTrigger value="reponses">Réponses ({data.responses.length})</TabsTrigger>
          <TabsTrigger value="notifications">Notifications ({data.notifs.length})</TabsTrigger>
          <TabsTrigger value="relances">Relances ({data.reminders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="cohortes" className="pt-4">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Cohorte</TableHead><TableHead>Formation</TableHead>
                <TableHead>Statut</TableHead><TableHead>Inscrit le</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.enrollments.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Aucune inscription.</TableCell></TableRow> :
                  data.enrollments.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell><Link to="/admin/cohortes/$id" params={{ id: e.cohort_id }} className="font-medium text-gold hover:underline">{e.cohortes?.name ?? "—"}</Link></TableCell>
                      <TableCell>{e.cohortes?.formations?.title ?? "—"}</TableCell>
                      <TableCell><Badge variant={e.status === "restricted" ? "destructive" : "default"}>{e.status}</Badge></TableCell>
                      <TableCell>{new Date(e.enrolled_at).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={e.status === "restricted" ? "default" : "outline"}
                          onClick={() => toggleEnrollment.mutate({ enrollmentId: e.id, current: e.status })}
                          disabled={toggleEnrollment.isPending}>
                          {e.status === "restricted" ? <><Unlock className="mr-1 h-3 w-3" />Rétablir</> : <><Lock className="mr-1 h-3 w-3" />Restreindre</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="paiements" className="pt-4 space-y-4">
          {data.payments.length === 0 ? <Card className="p-8 text-center text-muted-foreground">Aucun paiement.</Card> :
            data.payments.map((pay: any) => {
              const pct = pay.amount_total > 0 ? Math.min(100, (Number(pay.amount_paid) / Number(pay.amount_total)) * 100) : 0;
              return (
                <Card key={pay.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{pay.cohortes?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        Mode : {pay.mode} · {Number(pay.amount_paid).toLocaleString()}/{Number(pay.amount_total).toLocaleString()} {pay.currency}
                        {pay.final_deadline && <> · Échéance finale : {pay.final_deadline}</>}
                      </div>
                    </div>
                    <Badge variant={pay.status === "paid" ? "default" : "outline"}>{pay.status}</Badge>
                  </div>
                  <Progress value={pct} className="mt-2 h-1.5" />
                  {(pay.payment_installments ?? []).length > 0 && (
                    <Table className="mt-3">
                      <TableHeader><TableRow>
                        <TableHead>#</TableHead><TableHead>Montant</TableHead><TableHead>Échéance</TableHead>
                        <TableHead>Statut</TableHead><TableHead>Soumis</TableHead><TableHead>Preuve</TableHead><TableHead className="text-right">Actions</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {[...pay.payment_installments].sort((a: any, b: any) => a.position - b.position).map((i: any) => {
                          const overdue = i.status !== "validated" && i.due_date && i.due_date < today;
                          return (
                            <TableRow key={i.id}>
                              <TableCell>#{i.position}</TableCell>
                              <TableCell>{Number(i.amount).toLocaleString()} {pay.currency}</TableCell>
                              <TableCell className={overdue ? "text-destructive font-medium" : ""}>{i.due_date ?? "—"}</TableCell>
                              <TableCell><Badge variant={i.status === "validated" ? "default" : i.status === "rejected" ? "destructive" : "outline"}>{i.status}</Badge></TableCell>
                              <TableCell className="text-xs text-muted-foreground">{i.submitted_at ? new Date(i.submitted_at).toLocaleDateString("fr-FR") : "—"}</TableCell>
                              <TableCell>{i.proof_path ? <ProofLink path={i.proof_path} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                              <TableCell className="text-right space-x-1">
                                {i.status !== "validated" && (
                                  <Button size="sm" variant="outline" onClick={() => validateInstallment.mutate({ installmentId: i.id, action: "validate" })}>
                                    <CheckCircle2 className="mr-1 h-3 w-3" />Valider
                                  </Button>
                                )}
                                {i.status === "submitted" && (
                                  <Button size="sm" variant="ghost" onClick={() => validateInstallment.mutate({ installmentId: i.id, action: "reject" })}>
                                    <XCircle className="mr-1 h-3 w-3" />Rejeter
                                  </Button>
                                )}
                                {i.status !== "validated" && (
                                  <Button size="sm" variant="ghost" onClick={() => remind.mutate([i.id])}>
                                    <Send className="h-3 w-3" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </Card>
              );
            })}
        </TabsContent>

        <TabsContent value="progression" className="pt-4">
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Ressource</TableHead><TableHead>Module</TableHead><TableHead>Cohorte</TableHead><TableHead>Complété le</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.progress.length === 0 ? <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Aucune progression enregistrée.</TableCell></TableRow> :
                  data.progress.map((pr: any) => (
                    <TableRow key={pr.id}>
                      <TableCell className="font-medium">{pr.ressources?.title ?? "—"}</TableCell>
                      <TableCell>{pr.ressources?.modules?.title ?? "—"}</TableCell>
                      <TableCell>{pr.ressources?.modules?.cohortes?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(pr.completed_at).toLocaleString("fr-FR")}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="reponses" className="pt-4 space-y-3">
          {data.responses.length === 0 ? <Card className="p-8 text-center text-muted-foreground">Aucune réponse au formulaire.</Card> :
            data.responses.map((r: any) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{r.cohortes?.name ?? "Inscription publique"}</div>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-FR")}</span>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  {Object.entries(r.answers ?? {}).map(([k, v]: [string, any]) => (
                    <div key={k}><strong className="text-muted-foreground">{k} :</strong> {Array.isArray(v) ? v.join(", ") : String(v)}</div>
                  ))}
                </div>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="notifications" className="pt-4">
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Titre</TableHead><TableHead>Type</TableHead><TableHead>Contenu</TableHead><TableHead>Lu</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.notifs.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Aucune notification.</TableCell></TableRow> :
                  data.notifs.map((n: any) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">{n.title}</TableCell>
                      <TableCell><Badge variant="outline">{n.type}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate">{n.content}</TableCell>
                      <TableCell>{n.read ? <Badge variant="outline">Lu</Badge> : <Badge>Non lu</Badge>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("fr-FR")}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="relances" className="pt-4">
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Échéance</TableHead><TableHead>Canal</TableHead><TableHead>Statut</TableHead><TableHead>Envoyé le</TableHead><TableHead>Erreur</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.reminders.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Aucune relance envoyée.</TableCell></TableRow> :
                  data.reminders
                    .filter((r: any) => allInstallments.some((i: any) => i.id === r.installment_id))
                    .map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.installment_id.slice(0, 8)}…</TableCell>
                        <TableCell>{r.channel}</TableCell>
                        <TableCell><Badge variant={r.status === "sent" ? "default" : "destructive"}>{r.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(r.sent_at).toLocaleString("fr-FR")}</TableCell>
                        <TableCell className="text-xs text-destructive">{r.error ?? "—"}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={`p-4 ${accent ? "border-destructive/50" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </Card>
  );
}

function ProofLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 300);
    setLoading(false);
    if (error || !data?.signedUrl) return toast.error("Lien indisponible");
    window.open(data.signedUrl, "_blank");
  };
  return (
    <Button size="sm" variant="ghost" onClick={open} disabled={loading}>
      <FileText className="mr-1 h-3 w-3" /><Download className="h-3 w-3" />
    </Button>
  );
}

function NotifyDialog({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const qc = useQueryClient();
  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").insert({ user_id: studentId, type: "system" as any, title, content });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Notification envoyée"); setOpen(false); setTitle(""); setContent(""); qc.invalidateQueries({ queryKey: ["admin-student", studentId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Bell className="mr-2 h-3 w-3" />Notifier</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Envoyer une notification</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Message" value={content} onChange={(e) => setContent(e.target.value)} rows={4} />
        </div>
        <DialogFooter>
          <Button onClick={() => send.mutate()} disabled={!title.trim() || send.isPending}>Envoyer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
