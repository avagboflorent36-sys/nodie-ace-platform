import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Send, Lock, Unlock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { sendPaymentReminders } from "@/lib/reminders.functions";

export const Route = createFileRoute("/_authenticated/admin/etudiants/$id")({
  component: StudentDetail,
});

function StudentDetail() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-student", id],
    queryFn: async () => {
      const [profile, enrollments, payments, responses, progress] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("cohort_enrollments").select("id, status, enrolled_at, cohort_id, cohortes(id, name, formation_id, formations(title))").eq("student_id", id),
        supabase.from("payments").select("id, mode, status, amount_total, amount_paid, currency, cohort_id, created_at, cohortes(name), payment_installments(id, position, amount, status, due_date, submitted_at, validated_at, proof_path)").eq("student_id", id),
        supabase.from("form_responses").select("id, answers, created_at, cohort_id, cohortes(name)").eq("student_id", id).order("created_at", { ascending: false }),
        supabase.from("progress_tracking").select("id, completed_at, ressource_id, ressources(title, module_id, modules(title, cohort_id, cohortes(name)))").eq("student_id", id),
      ]);
      return {
        profile: profile.data,
        enrollments: enrollments.data ?? [],
        payments: payments.data ?? [],
        responses: responses.data ?? [],
        progress: progress.data ?? [],
      };
    },
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Chargement...</div>;
  if (!data?.profile) return <div className="p-8 text-muted-foreground">Étudiant introuvable.</div>;

  const p = data.profile;
  const initials = `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase() || "?";

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
            <h1 className="text-2xl font-bold tracking-tight">{p.first_name} {p.last_name}</h1>
            <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="flex items-center gap-2"><Mail className="h-3 w-3" />{p.email}</div>
              {p.whatsapp && <div className="flex items-center gap-2"><Phone className="h-3 w-3" />{p.whatsapp}</div>}
              {p.country && <div className="flex items-center gap-2"><MapPin className="h-3 w-3" />{p.country}</div>}
              <div className="flex items-center gap-2"><Calendar className="h-3 w-3" />Inscrit le {new Date(p.created_at).toLocaleDateString("fr-FR")}</div>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="cohortes">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="cohortes">Cohortes ({data.enrollments.length})</TabsTrigger>
          <TabsTrigger value="paiements">Paiements ({data.payments.length})</TabsTrigger>
          <TabsTrigger value="progression">Progression ({data.progress.length})</TabsTrigger>
          <TabsTrigger value="reponses">Réponses ({data.responses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="cohortes" className="pt-4">
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Cohorte</TableHead><TableHead>Formation</TableHead><TableHead>Statut</TableHead><TableHead>Inscrit le</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.enrollments.length === 0 ? <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Aucune inscription.</TableCell></TableRow> :
                  data.enrollments.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell><Link to="/admin/cohortes/$id" params={{ id: e.cohort_id }} className="font-medium text-gold hover:underline">{e.cohortes?.name ?? "—"}</Link></TableCell>
                      <TableCell>{e.cohortes?.formations?.title ?? "—"}</TableCell>
                      <TableCell><Badge variant={e.status === "restricted" ? "destructive" : "default"}>{e.status}</Badge></TableCell>
                      <TableCell>{new Date(e.enrolled_at).toLocaleDateString("fr-FR")}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="paiements" className="pt-4 space-y-4">
          {data.payments.length === 0 ? <Card className="p-8 text-center text-muted-foreground">Aucun paiement.</Card> :
            data.payments.map((pay: any) => (
              <Card key={pay.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{pay.cohortes?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">Mode : {pay.mode} · {Number(pay.amount_paid).toLocaleString()}/{Number(pay.amount_total).toLocaleString()} {pay.currency}</div>
                  </div>
                  <Badge variant={pay.status === "paid" ? "default" : "outline"}>{pay.status}</Badge>
                </div>
                {(pay.payment_installments ?? []).length > 0 && (
                  <Table className="mt-3">
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Montant</TableHead><TableHead>Échéance</TableHead><TableHead>Statut</TableHead><TableHead>Soumis le</TableHead><TableHead>Validé le</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {pay.payment_installments.sort((a: any, b: any) => a.position - b.position).map((i: any) => (
                        <TableRow key={i.id}>
                          <TableCell>#{i.position}</TableCell>
                          <TableCell>{Number(i.amount).toLocaleString()} {pay.currency}</TableCell>
                          <TableCell>{i.due_date ?? "—"}</TableCell>
                          <TableCell><Badge variant={i.status === "validated" ? "default" : "outline"}>{i.status}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{i.submitted_at ? new Date(i.submitted_at).toLocaleDateString("fr-FR") : "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{i.validated_at ? new Date(i.validated_at).toLocaleDateString("fr-FR") : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            ))}
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
                  <div className="font-medium">{r.cohortes?.name ?? "—"}</div>
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
      </Tabs>
    </div>
  );
}
