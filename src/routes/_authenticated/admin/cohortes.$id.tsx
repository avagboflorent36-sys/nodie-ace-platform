import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, FileText, Video, Link2, BookOpen, Copy, Save, AlertCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { setCohortChariowProducts } from "@/lib/chariow.functions";
// Automations UI removed per request — cron + tables conservés en backend.

export const Route = createFileRoute("/_authenticated/admin/cohortes/$id")({
  component: CohortDetail,
});

const ICONS: Record<string, any> = { document: FileText, video: Video, link: Link2, exercise: BookOpen };
type FieldType = "short_text" | "long_text" | "email" | "phone" | "single_choice" | "multiple_choice" | "number" | "date";
const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Texte court", long_text: "Texte long", email: "Email", phone: "Téléphone",
  single_choice: "Choix unique", multiple_choice: "Choix multiples", number: "Nombre", date: "Date",
};

function CohortDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");

  const { data: cohort, refetch: refetchCohort } = useQuery({
    queryKey: ["cohort", id],
    queryFn: async () => (await supabase.from("cohortes").select("*, formations(id, title, currency)").eq("id", id).maybeSingle()).data,
  });

  if (!cohort) return <div className="p-8 text-muted-foreground">Chargement...</div>;

  const inscriptionUrl = `${window.location.origin}/inscription/${cohort.slug}`;
  // Les liens tranche 2 sont désormais des liens sécurisés vers l'espace étudiant.

  const inst1 = cohort.chariow_product_id_installment_1;
  const inst2 = cohort.chariow_product_id_installment_2;
  const full = cohort.chariow_product_id_full;
  const productCollision =
    (inst1 && inst2 && inst1 === inst2) ||
    (full && inst2 && full === inst2) ||
    (full && inst1 && full === inst1);

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6 animate-fade-up">
      <div className="min-w-0">
        <Link to="/admin/cohortes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-3 w-3" /> Retour aux cohortes
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <div className="text-xs uppercase text-muted-foreground">{cohort.formations?.title}</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight truncate">{cohort.name}</h1>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{cohort.status}</Badge>
              <span className="text-xs text-muted-foreground">{cohort.start_date ?? "?"} → {cohort.end_date ?? "?"}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 max-w-full">
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(inscriptionUrl); toast.success("Lien copié"); }}>
              <Copy className="mr-1 h-3 w-3" /> Copier le lien d'inscription
            </Button>
            <span className="text-[11px] text-muted-foreground text-right max-w-[280px]">
              Les étudiants paient la tranche 2 directement depuis « Mes paiements ». L'onglet « Étudiants » fournit aussi un lien de secours.
            </span>
          </div>
        </div>
      </div>

      {productCollision && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm min-w-0">
            <p className="font-medium text-destructive">Configuration Chariow invalide</p>
            <p className="text-muted-foreground mt-1">
              Plusieurs modes de paiement utilisent le même Product ID Chariow. La page tranche 2 ouvrira le même produit que la tranche 1 / paiement intégral. Allez dans <strong>Paramètres → Intégration Chariow</strong> et assignez un Product ID distinct à chaque mode.
            </p>
          </div>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <div className="-mx-1 overflow-x-auto">
          <TabsList className="inline-flex h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="students">Étudiants</TabsTrigger>
            <TabsTrigger value="content">Contenu</TabsTrigger>
            <TabsTrigger value="annonces">Annonces</TabsTrigger>
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="form">Formulaire</TabsTrigger>
            <TabsTrigger value="automations">Automatisations</TabsTrigger>
            <TabsTrigger value="responses">Réponses</TabsTrigger>
            <TabsTrigger value="settings">Paramètres</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4 pt-4"><OverviewTab cohortId={id} /></TabsContent>
        <TabsContent value="students" className="space-y-4 pt-4"><StudentsTab cohortId={id} tranche2ProductId={cohort.chariow_product_id_installment_2} /></TabsContent>
        <TabsContent value="content" className="space-y-4 pt-4"><ContentTab cohortId={id} /></TabsContent>
        <TabsContent value="annonces" className="space-y-4 pt-4"><AnnoncesTab cohortId={id} /></TabsContent>
        <TabsContent value="live" className="space-y-4 pt-4"><LiveTab cohortId={id} /></TabsContent>
        <TabsContent value="form" className="space-y-4 pt-4"><FormBuilderTab cohortId={id} inscriptionUrl={inscriptionUrl} /></TabsContent>
        <TabsContent value="automations" className="space-y-4 pt-4"><AutomationsTab cohortId={id} /></TabsContent>
        <TabsContent value="responses" className="space-y-4 pt-4"><ResponsesTab cohortId={id} /></TabsContent>
        <TabsContent value="settings" className="space-y-4 pt-4"><SettingsTab cohort={cohort} onSaved={() => { refetchCohort(); qc.invalidateQueries({ queryKey: ["admin-cohortes"] }); }} /></TabsContent>
      </Tabs>
    </div>
  );
}

function AutomationsTab({ cohortId }: { cohortId: string }) {
  const qc = useQueryClient();
  const runNow = useServerFn(runAutomationsNow);
  const fetchRuns = useServerFn(listAutomationRuns);
  const [running, setRunning] = useState(false);

  const { data: runs } = useQuery({
    queryKey: ["automation-runs"],
    queryFn: async () => (await fetchRuns({ data: undefined as any })).runs,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });


  const execute = async () => {
    setRunning(true);
    try {
      const r = await runNow({ data: undefined as any });
      toast.success(
        `Exécuté — ${r.reminders} relance(s), ${r.restricted} accès bloqué(s), ${r.campaigns} campagne(s) (${r.campaign_recipients} destinataire(s))${r.errors.length ? `, ${r.errors.length} erreur(s)` : ""}`,
      );
      qc.invalidateQueries({ queryKey: ["automation-runs"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Échec");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Automatisations</h2>
          <p className="text-sm text-muted-foreground">
            Programmez les règles d'accès, blocages et relances automatiques. Le moteur tourne automatiquement toutes les 15 minutes.
          </p>
        </div>
        <Button size="sm" disabled={running} onClick={execute} className="bg-gold text-primary hover:bg-gold/90">
          {running ? "Exécution…" : "Exécuter maintenant"}
        </Button>
      </div>

      <Card className="p-4 bg-secondary/30">
        <p className="text-sm font-medium mb-2">Dernières exécutions</p>
        {!runs || runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune exécution enregistrée pour le moment.</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {runs.map((r: any) => (
              <div key={r.id} className="text-xs flex items-start gap-2 border-b pb-1.5 last:border-b-0">
                <Badge
                  variant="outline"
                  className={
                    r.status === "ok"
                      ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                      : r.status === "error"
                        ? "border-destructive/40 text-destructive"
                        : "border-amber-500/40 text-amber-700 dark:text-amber-400"
                  }
                >
                  {r.status}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {new Date(r.run_at).toLocaleString("fr-FR")} — {r.job_type}
                  </div>
                  {r.payload && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      {JSON.stringify(r.payload)}
                    </div>
                  )}
                  {r.error && (
                    <div className="text-[11px] text-destructive truncate">{r.error}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ReminderRulesEditor cohortId={cohortId} />
      <div className="pt-6 border-t">
        <AccessRulesEditor cohortId={cohortId} />
      </div>
      <div className="pt-6 border-t">
        <EmailCampaignsEditor cohortId={cohortId} />
      </div>
    </Card>
  );
}

function OverviewTab({ cohortId }: { cohortId: string }) {
  const { data } = useQuery({
    queryKey: ["cohort-overview", cohortId],
    queryFn: async () => {
      const [enr, payFull, payInst, restricted] = await Promise.all([
        supabase.from("cohort_enrollments").select("id", { count: "exact", head: true }).eq("cohort_id", cohortId),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("cohort_id", cohortId).eq("status", "paid"),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("cohort_id", cohortId).eq("status", "partial"),
        supabase.from("cohort_enrollments").select("id", { count: "exact", head: true }).eq("cohort_id", cohortId).eq("status", "restricted"),
      ]);
      return { enr: enr.count ?? 0, paid: payFull.count ?? 0, partial: payInst.count ?? 0, restricted: restricted.count ?? 0 };
    },
  });
  const kpis = [
    { label: "Inscrits", value: data?.enr ?? 0 },
    { label: "Payé intégral", value: data?.paid ?? 0 },
    { label: "Paiement partiel", value: data?.partial ?? 0 },
    { label: "Accès restreints", value: data?.restricted ?? 0 },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((k) => (
        <Card key={k.label} className="p-6">
          <div className="text-xs uppercase text-muted-foreground">{k.label}</div>
          <div className="mt-2 text-3xl font-bold text-gold">{k.value}</div>
        </Card>
      ))}
    </div>
  );
}

function StudentsTab({ cohortId, tranche2ProductId }: { cohortId: string; tranche2ProductId?: string | null }) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["cohort-students", cohortId],
    queryFn: async () => {
      const { data: enrollments } = await supabase.from("cohort_enrollments").select("id, status, enrolled_at, student_id").eq("cohort_id", cohortId);
      const ids = (enrollments ?? []).map((e) => e.student_id);
      if (ids.length === 0) return [];
      const [{ data: profiles }, { data: payments }] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name, email").in("id", ids),
        supabase.from("payments").select("id, student_id, status, mode, amount_total, amount_paid, payment_installments(id, position, status)").eq("cohort_id", cohortId).in("student_id", ids),
      ]);
      const paymentIds = (payments ?? []).map((p) => p.id);
      const { data: attempts } = paymentIds.length
        ? await supabase.from("chariow_payment_attempts").select("id, payment_id, status, chariow_product_id, checkout_url, created_at").in("payment_id", paymentIds).eq("installment_position", 2).order("created_at", { ascending: false })
        : { data: [] as any[] };
      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const amap = new Map((attempts ?? []).map((a) => [a.payment_id, a]));
      const paymap = new Map((payments ?? []).map((p) => [p.student_id, { ...p, lastT2Attempt: amap.get(p.id) }]));
      return (enrollments ?? []).map((e) => ({ ...e, profile: pmap.get(e.student_id), payment: paymap.get(e.student_id) }));
    },
  });

  const toggleAccess = async (enrollmentId: string, current: string) => {
    const next = current === "restricted" ? "active" : "restricted";
    const { error } = await supabase.from("cohort_enrollments").update({ status: next }).eq("id", enrollmentId);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "restricted" ? "Accès restreint" : "Accès rétabli");
    qc.invalidateQueries({ queryKey: ["cohort-students", cohortId] });
  };

  return (
    <Card>
      <Table>
        <TableHeader><TableRow><TableHead>Étudiant</TableHead><TableHead>Email</TableHead><TableHead>Paiement</TableHead><TableHead>Lien tranche 2</TableHead><TableHead>Accès</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">Aucun étudiant inscrit.</TableCell></TableRow> :
            rows.map((r: any) => {
              const needsT2 = r.payment?.mode === "installments_2" && r.payment?.status !== "paid";
              const t2 = (r.payment?.payment_installments ?? []).find((i: any) => i.position === 2);
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : "—"}</TableCell>
                  <TableCell>{r.profile?.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.payment?.status ?? "—"}</Badge>{r.payment ? ` ${Number(r.payment.amount_paid).toLocaleString()}/${Number(r.payment.amount_total).toLocaleString()}` : ""}
                    {t2 && <div className="mt-1 text-[11px] text-muted-foreground">T2: {t2.status}</div>}
                    {r.payment?.lastT2Attempt && <div className="mt-1 text-[11px] text-muted-foreground">Dernier essai: {r.payment.lastT2Attempt.status}</div>}
                  </TableCell>
                  <TableCell>
                    {needsT2 ? (
                      <div className="space-y-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          const url = `${window.location.origin}/etudiant/tranche-2/${r.payment.id}`;
                          navigator.clipboard.writeText(url);
                          toast.success("Lien sécurisé tranche 2 copié");
                        }}>
                          <Copy className="mr-1 h-3 w-3" /> Copier
                        </Button>
                        <div className="font-mono text-[11px] text-muted-foreground">Produit T2: {tranche2ProductId ?? "—"}</div>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell><Badge variant={r.status === "restricted" ? "destructive" : "default"}>{r.status}</Badge></TableCell>
                  <TableCell>
                    <Button size="sm" variant={r.status === "restricted" ? "default" : "outline"} onClick={() => toggleAccess(r.id, r.status)}>
                      {r.status === "restricted" ? "Rétablir" : "Restreindre"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </Card>
  );
}

function ContentTab({ cohortId }: { cohortId: string }) {
  const [moduleOpen, setModuleOpen] = useState(false);
  const [resOpenFor, setResOpenFor] = useState<string | null>(null);
  const [mForm, setMForm] = useState({ title: "", description: "" });
  const [rForm, setRForm] = useState({ title: "", type: "document", url: "", description: "" });

  const { data: modules = [], refetch } = useQuery({
    queryKey: ["cohort-modules", cohortId],
    queryFn: async () => (await supabase.from("modules").select("id, title, description, position, ressources(id, title, type, url, position)").eq("cohort_id", cohortId).order("position")).data ?? [],
  });

  const createModule = async () => {
    if (!mForm.title.trim()) return;
    const { error } = await supabase.from("modules").insert({ cohort_id: cohortId, title: mForm.title.trim(), description: mForm.description.trim() || null, position: modules.length });
    if (error) { toast.error(error.message); return; }
    toast.success("Module créé"); setModuleOpen(false); setMForm({ title: "", description: "" }); refetch();
  };
  const deleteModule = async (mid: string) => {
    if (!confirm("Supprimer ce module et ses ressources ?")) return;
    await supabase.from("ressources").delete().eq("module_id", mid);
    await supabase.from("modules").delete().eq("id", mid);
    refetch();
  };
  const createRessource = async (moduleId: string) => {
    if (!rForm.title.trim()) { toast.error("Le titre est requis."); return; }
    const url = rForm.url.trim();
    const needsUrl = rForm.type === "video" || rForm.type === "document" || rForm.type === "link";
    if (needsUrl && !url) { toast.error("Une URL est requise pour ce type de contenu."); return; }
    if (url) { try { new URL(url); } catch { toast.error("URL invalide."); return; } }
    if (rForm.type === "exercise" && !url && !rForm.description.trim()) {
      toast.error("Ajoutez une consigne ou une URL pour l'exercice."); return;
    }
    const { error } = await supabase.from("ressources").insert({ module_id: moduleId, title: rForm.title.trim(), type: rForm.type as any, url: url || null, description: rForm.description.trim() || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Ressource ajoutée"); setResOpenFor(null); setRForm({ title: "", type: "document", url: "", description: "" }); refetch();
  };
  const deleteRessource = async (rid: string) => { await supabase.from("ressources").delete().eq("id", rid); refetch(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Modules & ressources</h2>
        <Dialog open={moduleOpen} onOpenChange={setModuleOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-gold text-primary hover:bg-gold/90"><Plus className="mr-1 h-3 w-3" /> Module</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau module</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titre</Label><Input value={mForm.title} onChange={(e) => setMForm({ ...mForm, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={mForm.description} onChange={(e) => setMForm({ ...mForm, description: e.target.value })} /></div>
              <Button className="w-full" onClick={createModule}>Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {modules.length === 0 ? <Card className="p-12 text-center text-muted-foreground">Aucun module.</Card> :
        modules.map((m: any) => (
          <Card key={m.id} className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{m.title}</h3>
                {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
              </div>
              <div className="flex gap-2">
                <Dialog open={resOpenFor === m.id} onOpenChange={(o) => setResOpenFor(o ? m.id : null)}>
                  <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" /> Ressource</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nouvelle ressource</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Titre</Label><Input value={rForm.title} onChange={(e) => setRForm({ ...rForm, title: e.target.value })} /></div>
                      <div><Label>Type</Label>
                        <Select value={rForm.type} onValueChange={(v) => setRForm({ ...rForm, type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="document">Document</SelectItem>
                            <SelectItem value="video">Vidéo</SelectItem>
                            <SelectItem value="link">Lien</SelectItem>
                            <SelectItem value="exercise">Exercice</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>URL</Label><Input value={rForm.url} onChange={(e) => setRForm({ ...rForm, url: e.target.value })} placeholder="https://..." /></div>
                      <div><Label>Description</Label><Textarea value={rForm.description} onChange={(e) => setRForm({ ...rForm, description: e.target.value })} /></div>
                      <Button className="w-full" onClick={() => createRessource(m.id)}>Ajouter</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button size="sm" variant="ghost" onClick={() => deleteModule(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
            {(m.ressources ?? []).length > 0 && (
              <div className="mt-4 divide-y rounded-lg border">
                {m.ressources.map((r: any) => {
                  const Icon = ICONS[r.type] ?? BookOpen;
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-3">
                      <Icon className="h-4 w-4 text-gold" />
                      <span className="text-sm font-medium">{r.title}</span>
                      <span className="text-xs uppercase text-muted-foreground">{r.type}</span>
                      {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline">Ouvrir</a>}
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => deleteRessource(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
    </div>
  );
}

function FormBuilderTab({ cohortId, inscriptionUrl }: { cohortId: string; inscriptionUrl: string }) {
  const { data: fields = [], refetch } = useQuery({
    queryKey: ["cohort-fields", cohortId],
    queryFn: async () => (await supabase.from("form_fields").select("*").eq("cohort_id", cohortId).order("position")).data ?? [],
  });

  const addField = async () => {
    await supabase.from("form_fields").insert({ cohort_id: cohortId, label: "Nouveau champ", field_type: "short_text", required: false, position: fields.length });
    refetch();
  };
  const update = async (id: string, patch: any) => { await supabase.from("form_fields").update(patch).eq("id", id); refetch(); };
  const del = async (id: string) => { await supabase.from("form_fields").delete().eq("id", id); refetch(); };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-secondary/30 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Lien d'inscription public</p>
            <p className="text-xs text-muted-foreground break-all">{inscriptionUrl}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(inscriptionUrl); toast.success("Copié"); }}>
            <Copy className="mr-1 h-3 w-3" /> Copier
          </Button>
        </div>
        <div className="pt-3 border-t">
          <p className="text-sm font-medium">Lien finalisation tranche 2</p>
          <p className="text-xs text-muted-foreground mt-1">
            Chaque étudiant inscrit en 2 tranches a son propre lien personnalisé (jeton unique). Allez dans l'onglet <strong>Étudiants</strong> et cliquez sur « Copier » à côté de l'étudiant concerné pour récupérer son lien tranche 2 — il ouvre directement le checkout Chariow.
          </p>
        </div>
      </Card>

      <p className="text-sm text-muted-foreground">Champs imposés : Prénom, Nom, Email, WhatsApp, Pays, Mode de paiement.</p>
      <div className="space-y-2">
        {fields.map((f: any) => (
          <Card key={f.id} className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input defaultValue={f.label} onBlur={(e) => update(f.id, { label: e.target.value })} className="flex-1" />
              <Select value={f.field_type} onValueChange={(v) => update(f.id, { field_type: v })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => del(f.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
            <div className="flex items-center gap-3 pl-1">
              <div className="flex items-center gap-2"><Switch checked={f.required} onCheckedChange={(v) => update(f.id, { required: v })} /><span className="text-xs">Obligatoire</span></div>
              {(f.field_type === "single_choice" || f.field_type === "multiple_choice") && (
                <Input defaultValue={(f.options ?? []).join(", ")} onBlur={(e) => update(f.id, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Option 1, Option 2, ..." className="flex-1" />
              )}
            </div>
          </Card>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={addField}><Plus className="mr-1 h-3 w-3" /> Ajouter un champ</Button>
    </div>
  );
}

function ResponsesTab({ cohortId }: { cohortId: string }) {
  const { data: responses = [] } = useQuery({
    queryKey: ["cohort-responses", cohortId],
    queryFn: async () => {
      const { data } = await supabase.from("form_responses").select("id, answers, created_at, student_id").eq("cohort_id", cohortId).order("created_at", { ascending: false });
      const ids = (data ?? []).map((r) => r.student_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", ids);
      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((r) => ({ ...r, profile: pmap.get(r.student_id) }));
    },
  });
  return (
    <div className="space-y-3">
      {responses.length === 0 ? <Card className="p-12 text-center text-muted-foreground">Aucune réponse pour le moment.</Card> :
        responses.map((r: any) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">{r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : "—"} <span className="text-xs text-muted-foreground">({r.profile?.email})</span></div>
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <div className="mt-2 space-y-1 text-sm">
              {Object.entries(r.answers ?? {}).map(([k, v]: [string, any]) => (
                <div key={k}><strong className="text-muted-foreground">{k} :</strong> {Array.isArray(v) ? v.join(", ") : String(v)}</div>
              ))}
            </div>
          </Card>
        ))}
    </div>
  );
}

function SettingsTab({ cohort, onSaved }: { cohort: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: cohort.name, status: cohort.status, startDate: cohort.start_date ?? "", endDate: cohort.end_date ?? "",
    zoomLink: cohort.zoom_link ?? "", priceFull: cohort.price_full ?? "", priceInstall: cohort.price_installment ?? "",
    inst1Days: cohort.installment_1_deadline_days ?? 15, inst2Days: cohort.installment_2_deadline_days ?? 45,
    reminders: (cohort.reminder_days_before ?? [7, 3, 1]).join(","),
  });
  const save = async () => {
    const reminderDays = String(form.reminders).split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    const { error } = await supabase.from("cohortes").update({
      name: form.name, status: form.status as any, start_date: form.startDate || null, end_date: form.endDate || null,
      zoom_link: form.zoomLink || null, price_full: form.priceFull ? Number(form.priceFull) : null, price_installment: form.priceInstall ? Number(form.priceInstall) : null,
      installment_1_deadline_days: Number(form.inst1Days), installment_2_deadline_days: Number(form.inst2Days),
      reminder_days_before: reminderDays,
    }).eq("id", cohort.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Enregistré"); onSaved();
  };
  return (
    <Card className="p-6 space-y-4 max-w-2xl">
      <div><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>Statut</Label>
        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="inscription_open">Inscriptions ouvertes</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="completed">Terminée</SelectItem>
            <SelectItem value="archived">Archivée</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Début</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
        <div><Label>Fin</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
      </div>
      <div><Label>Lien Zoom</Label><Input value={form.zoomLink} onChange={(e) => setForm({ ...form, zoomLink: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Prix 1x</Label><Input type="number" value={form.priceFull} onChange={(e) => setForm({ ...form, priceFull: e.target.value })} /></div>
        <div><Label>Prix 2x</Label><Input type="number" value={form.priceInstall} onChange={(e) => setForm({ ...form, priceInstall: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Tranche 1 (jours)</Label><Input type="number" value={form.inst1Days} onChange={(e) => setForm({ ...form, inst1Days: e.target.value as any })} /></div>
        <div><Label>Tranche 2 (jours)</Label><Input type="number" value={form.inst2Days} onChange={(e) => setForm({ ...form, inst2Days: e.target.value as any })} /></div>
      </div>
      <div><Label>Relances (jours avant échéance — legacy)</Label><Input value={form.reminders} onChange={(e) => setForm({ ...form, reminders: e.target.value })} placeholder="7,3,1" /></div>
      <Button onClick={save} className="bg-gold text-primary hover:bg-gold/90"><Save className="mr-1 h-4 w-4" /> Enregistrer</Button>

      <div className="pt-6 border-t">
        <PaymentScheduleEditor cohortId={cohort.id} />
      </div>
      <div className="pt-6 border-t">
        <ChariowSection cohort={cohort} onSaved={onSaved} />
      </div>
    </Card>
  );
}

function ChariowSection({ cohort, onSaved }: { cohort: any; onSaved: () => void }) {
  const saveChariowProducts = useServerFn(setCohortChariowProducts);
  const [form, setForm] = useState({
    full: cohort.chariow_product_id_full ?? "",
    inst1: cohort.chariow_product_id_installment_1 ?? "",
    inst2: cohort.chariow_product_id_installment_2 ?? "",
  });
  const webhookUrl = `${window.location.origin}/api/public/hooks/chariow/<VOTRE_SECRET>`;
  const save = async () => {
    try {
      await saveChariowProducts({
        data: {
          cohort_id: cohort.id,
          chariow_product_id_full: form.full,
          chariow_product_id_installment_1: form.inst1,
          chariow_product_id_installment_2: form.inst2,
        },
      });
      toast.success("Configuration Chariow enregistrée"); onSaved();
    } catch (error: any) {
      toast.error(error?.message ?? "Impossible d'enregistrer Chariow");
    }
  };
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold">Intégration Chariow</h3>
        <p className="text-xs text-muted-foreground">Collez les Product IDs Chariow pour activer le paiement automatique.</p>
      </div>
      <div><Label>Product ID — Paiement 1x</Label><Input value={form.full} onChange={(e) => setForm({ ...form, full: e.target.value })} placeholder="prd_..." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Product ID — Tranche 1 (2x)</Label><Input value={form.inst1} onChange={(e) => setForm({ ...form, inst1: e.target.value })} placeholder="prd_..." /></div>
        <div><Label>Product ID — Tranche 2 (2x)</Label><Input value={form.inst2} onChange={(e) => setForm({ ...form, inst2: e.target.value })} placeholder="prd_..." /></div>
      </div>
      <Button onClick={save} className="bg-gold text-primary hover:bg-gold/90"><Save className="mr-1 h-4 w-4" /> Enregistrer Chariow</Button>
      <Card className="p-3 bg-secondary/40 mt-3">
        <p className="text-xs font-medium">URL Webhook à coller dans Chariow (Pulse — événement <code>successful.sale</code>)</p>
        <p className="text-xs text-muted-foreground break-all mt-1">{webhookUrl}</p>
        <p className="text-[11px] text-muted-foreground mt-2">Remplacez <code>&lt;VOTRE_SECRET&gt;</code> par la valeur du secret <code>CHARIOW_WEBHOOK_URL_SECRET</code> configuré côté serveur.</p>
      </Card>
      <RecentChariowAttempts cohortId={cohort.id} />
    </div>
  );
}

function RecentChariowAttempts({ cohortId }: { cohortId: string }) {
  const { data: attempts = [], refetch, isLoading } = useQuery({
    queryKey: ["chariow-attempts", cohortId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("chariow_payment_attempts")
        .select("created_at, email, mode, installment_position, chariow_product_id, status, last_error")
        .eq("cohort_id", cohortId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });
  return (
    <Card className="p-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium">Dernières tentatives Chariow (10)</p>
        <Button size="sm" variant="ghost" onClick={() => refetch()}>Rafraîchir</Button>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : attempts.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune tentative enregistrée.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Email</th>
                <th className="py-1 pr-2">Mode</th>
                <th className="py-1 pr-2">Pos.</th>
                <th className="py-1 pr-2">Product ID</th>
                <th className="py-1 pr-2">Statut</th>
                <th className="py-1 pr-2">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a: any, i: number) => (
                <tr key={i} className="border-t border-border/40 align-top">
                  <td className="py-1 pr-2 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="py-1 pr-2 break-all">{a.email}</td>
                  <td className="py-1 pr-2">{a.mode}</td>
                  <td className="py-1 pr-2">{a.installment_position}</td>
                  <td className="py-1 pr-2 font-mono">{a.chariow_product_id}</td>
                  <td className="py-1 pr-2">{a.status}</td>
                  <td className="py-1 pr-2 text-destructive">{a.last_error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function PaymentScheduleEditor({ cohortId }: { cohortId: string }) {
  const { data: rows = [], refetch } = useQuery({
    queryKey: ["cohort-payment-schedule", cohortId],
    queryFn: async () => (await (supabase as any).from("cohort_payment_schedule").select("*").eq("cohort_id", cohortId).order("position")).data ?? [],
  });

  const add = async () => {
    await (supabase as any).from("cohort_payment_schedule").insert({
      cohort_id: cohortId, position: rows.length + 1, label: `Tranche ${rows.length + 1}`,
      percent: null, amount: null, due_offset_days: 30,
    });
    refetch();
  };
  const update = async (id: string, patch: any) => { await (supabase as any).from("cohort_payment_schedule").update(patch).eq("id", id); refetch(); };
  const del = async (id: string) => { await (supabase as any).from("cohort_payment_schedule").delete().eq("id", id); refetch(); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Plan de paiement</h3>
          <p className="text-xs text-muted-foreground">Définissez les tranches (en % ou montant fixe) et leurs échéances en jours après inscription.</p>
        </div>
        <Button size="sm" variant="outline" onClick={add}><Plus className="mr-1 h-3 w-3" /> Tranche</Button>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucune tranche personnalisée — les tranches legacy seront utilisées.</p> :
        rows.map((r: any) => (
          <div key={r.id} className="grid grid-cols-12 gap-2 items-center">
            <Input className="col-span-1" type="number" defaultValue={r.position} onBlur={(e) => update(r.id, { position: Number(e.target.value) })} />
            <Input className="col-span-3" defaultValue={r.label ?? ""} placeholder="Libellé" onBlur={(e) => update(r.id, { label: e.target.value })} />
            <Input className="col-span-2" type="number" step="0.01" defaultValue={r.percent ?? ""} placeholder="% (ou vide)" onBlur={(e) => update(r.id, { percent: e.target.value ? Number(e.target.value) : null })} />
            <Input className="col-span-2" type="number" defaultValue={r.amount ?? ""} placeholder="Montant" onBlur={(e) => update(r.id, { amount: e.target.value ? Number(e.target.value) : null })} />
            <Input className="col-span-3" type="number" defaultValue={r.due_offset_days} placeholder="Jours" onBlur={(e) => update(r.id, { due_offset_days: Number(e.target.value) })} />
            <Button size="icon" variant="ghost" className="col-span-1" onClick={() => del(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </div>
        ))}
    </div>
  );
}

function ReminderRulesEditor({ cohortId }: { cohortId: string }) {
  const { data: rows = [], refetch } = useQuery({
    queryKey: ["cohort-reminder-rules", cohortId],
    queryFn: async () => (await (supabase as any).from("cohort_reminder_rules").select("*").eq("cohort_id", cohortId).order("offset_days")).data ?? [],
  });

  const add = async () => {
    await (supabase as any).from("cohort_reminder_rules").insert({
      cohort_id: cohortId, offset_days: -7, channel: "email", template_key: "reminder_before",
      enabled: true, trigger_mode: "relative", time_of_day: "09:00",
    });
    refetch();
  };
  const update = async (id: string, patch: any) => { await (supabase as any).from("cohort_reminder_rules").update(patch).eq("id", id); refetch(); };
  const del = async (id: string) => { await (supabase as any).from("cohort_reminder_rules").delete().eq("id", id); refetch(); };

  const toLocal = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Relances automatiques</h3>
          <p className="text-xs text-muted-foreground">Relatif : J± par rapport à l'échéance + heure. Absolu : date et heure exactes (une seule exécution).</p>
        </div>
        <Button size="sm" variant="outline" onClick={add}><Plus className="mr-1 h-3 w-3" /> Règle</Button>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucune règle. Ajoutez J-7 / J-3 / J+1 pour relancer automatiquement.</p> :
        rows.map((r: any) => (
          <Card key={r.id} className="p-3 bg-secondary/20">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={r.enabled} onCheckedChange={(v) => update(r.id, { enabled: v })} />
                <span className="text-xs">{r.enabled ? "Actif" : "Off"}</span>
              </div>
              <div className="min-w-[180px]">
                <Label className="text-[11px]">Déclencheur</Label>
                <Select value={r.trigger_mode ?? "relative"} onValueChange={(v) => update(r.id, { trigger_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relative">Relatif à l'échéance</SelectItem>
                    <SelectItem value="absolute">Date & heure exactes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(r.trigger_mode ?? "relative") === "relative" ? (
                <>
                  <div className="w-[110px]">
                    <Label className="text-[11px]">Jours (J±)</Label>
                    <Input type="number" defaultValue={r.offset_days} onBlur={(e) => update(r.id, { offset_days: Number(e.target.value) })} placeholder="ex -7" />
                  </div>
                  <div className="w-[120px]">
                    <Label className="text-[11px]">Heure</Label>
                    <Input type="time" defaultValue={(r.time_of_day ?? "09:00").slice(0, 5)} onBlur={(e) => update(r.id, { time_of_day: e.target.value })} />
                  </div>
                </>
              ) : (
                <div className="min-w-[220px]">
                  <Label className="text-[11px]">Date & heure</Label>
                  <Input type="datetime-local" defaultValue={toLocal(r.run_at)} onBlur={(e) => update(r.id, { run_at: e.target.value ? new Date(e.target.value).toISOString() : null, last_run_at: null })} />
                </div>
              )}
              <div className="min-w-[150px]">
                <Label className="text-[11px]">Canal</Label>
                <Select value={r.channel} onValueChange={(v) => update(r.id, { channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[200px]">
                <Label className="text-[11px]">Modèle</Label>
                <Select value={r.template_key} onValueChange={(v) => update(r.id, { template_key: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reminder_before">Avant échéance</SelectItem>
                    <SelectItem value="reminder_due">Le jour J</SelectItem>
                    <SelectItem value="reminder_overdue">Après échéance (retard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
            {r.trigger_mode === "absolute" && r.last_run_at && (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Exécutée le {new Date(r.last_run_at).toLocaleString("fr-FR")}</span>
                <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => update(r.id, { last_run_at: null })}>Réinitialiser</Button>
              </div>
            )}
          </Card>
        ))}
    </div>
  );
}

function AccessRulesEditor({ cohortId }: { cohortId: string }) {
  const { data: rows = [], refetch } = useQuery({
    queryKey: ["cohort-access-rules", cohortId],
    queryFn: async () => (await (supabase as any).from("cohort_access_rules").select("*").eq("cohort_id", cohortId).order("offset_days")).data ?? [],
  });
  const add = async () => {
    await (supabase as any).from("cohort_access_rules").insert({
      cohort_id: cohortId, trigger_type: "installment_overdue",
      installment_position: 2, offset_days: 7, action: "restrict_access",
      enabled: true, trigger_mode: "relative", time_of_day: "09:00",
    });
    refetch();
  };
  const update = async (id: string, patch: any) => { await (supabase as any).from("cohort_access_rules").update(patch).eq("id", id); refetch(); };
  const del = async (id: string) => { await (supabase as any).from("cohort_access_rules").delete().eq("id", id); refetch(); };

  const toLocal = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Règles d'accès automatique</h3>
          <p className="text-xs text-muted-foreground">Bloquer l'accès des étudiants en retard. Le déblocage est automatique dès la validation du paiement.</p>
        </div>
        <Button size="sm" variant="outline" onClick={add}><Plus className="mr-1 h-3 w-3" /> Règle</Button>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucune règle. Exemple : Tranche 2 — J+7 → bloquer.</p> :
        rows.map((r: any) => (
          <Card key={r.id} className="p-3 bg-secondary/20">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={r.enabled} onCheckedChange={(v) => update(r.id, { enabled: v })} />
                <span className="text-xs">{r.enabled ? "Actif" : "Off"}</span>
              </div>
              <div className="min-w-[160px]">
                <Label className="text-[11px]">Tranche</Label>
                <Select value={String(r.installment_position ?? "any")} onValueChange={(v) => update(r.id, { installment_position: v === "any" ? null : Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Toute tranche</SelectItem>
                    <SelectItem value="1">Tranche 1</SelectItem>
                    <SelectItem value="2">Tranche 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[180px]">
                <Label className="text-[11px]">Déclencheur</Label>
                <Select value={r.trigger_mode ?? "relative"} onValueChange={(v) => update(r.id, { trigger_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relative">Relatif (J+ après échéance)</SelectItem>
                    <SelectItem value="absolute">Date & heure exactes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(r.trigger_mode ?? "relative") === "relative" ? (
                <>
                  <div className="w-[110px]">
                    <Label className="text-[11px]">J+ (jours)</Label>
                    <Input type="number" defaultValue={r.offset_days} onBlur={(e) => update(r.id, { offset_days: Number(e.target.value) })} />
                  </div>
                  <div className="w-[120px]">
                    <Label className="text-[11px]">Heure</Label>
                    <Input type="time" defaultValue={(r.time_of_day ?? "09:00").slice(0, 5)} onBlur={(e) => update(r.id, { time_of_day: e.target.value })} />
                  </div>
                </>
              ) : (
                <div className="min-w-[220px]">
                  <Label className="text-[11px]">Date & heure</Label>
                  <Input type="datetime-local" defaultValue={toLocal(r.run_at)} onBlur={(e) => update(r.id, { run_at: e.target.value ? new Date(e.target.value).toISOString() : null, last_run_at: null })} />
                </div>
              )}
              <div className="min-w-[180px]">
                <Label className="text-[11px]">Action</Label>
                <Select value={r.action} onValueChange={(v) => update(r.id, { action: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restrict_access">Bloquer l'accès</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
            {r.trigger_mode === "absolute" && r.last_run_at && (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Exécutée le {new Date(r.last_run_at).toLocaleString("fr-FR")}</span>
                <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => update(r.id, { last_run_at: null })}>Réinitialiser</Button>
              </div>
            )}
          </Card>
        ))}
      <p className="text-[11px] text-muted-foreground">Déblocage automatique : dès qu'un étudiant règle sa tranche manquante, son accès est rétabli instantanément.</p>
    </div>
  );
}


function EmailCampaignsEditor({ cohortId }: { cohortId: string }) {
  const qc = useQueryClient();
  const sendNow = useServerFn(sendCampaignNow);
  const previewAudience = useServerFn(previewCampaignAudience);
  const [draft, setDraft] = useState({ subject: "", body_html: "", audience: "all", scheduled_at: "" });
  const [audCount, setAudCount] = useState<number | null>(null);

  const { data: rows = [], refetch } = useQuery({
    queryKey: ["cohort-email-campaigns", cohortId],
    queryFn: async () => (await (supabase as any).from("cohort_email_campaigns").select("*").eq("cohort_id", cohortId).order("created_at", { ascending: false })).data ?? [],
  });

  const checkAud = async (audience: string) => {
    try {
      const r = await previewAudience({ data: { cohort_id: cohortId, audience: audience as any } });
      setAudCount(r.count);
    } catch { setAudCount(null); }
  };

  const create = async (status: "draft" | "scheduled" | "send_now") => {
    if (!draft.subject.trim() || !draft.body_html.trim()) return toast.error("Sujet et contenu requis");
    if (status === "scheduled" && !draft.scheduled_at) return toast.error("Date de programmation requise");

    const insertStatus = status === "send_now" ? "scheduled" : status;
    const { data, error } = await (supabase as any).from("cohort_email_campaigns").insert({
      cohort_id: cohortId, subject: draft.subject, body_html: draft.body_html,
      audience: draft.audience, status: insertStatus,
      scheduled_at: status === "scheduled" ? draft.scheduled_at : null,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }

    if (status === "send_now") {
      try {
        const r = await sendNow({ data: { campaign_id: data.id } });
        if (r.sent === 0) {
          toast.error(
            `Aucun email envoyé (${r.failed} échec(s))${r.lastError ? ` — ${r.lastError.slice(0, 140)}` : ""}`,
            { duration: 8000 },
          );
        } else {
          toast.success(`Envoyé à ${r.sent} destinataire(s)${r.failed ? `, ${r.failed} échec(s)` : ""}`);
        }
      } catch (e: any) { toast.error(e.message); }
    } else {
      toast.success(status === "scheduled" ? "Programmé" : "Brouillon enregistré");
    }

    setDraft({ subject: "", body_html: "", audience: "all", scheduled_at: "" });
    setAudCount(null);
    refetch(); qc.invalidateQueries({ queryKey: ["cohort-email-campaigns", cohortId] });
  };

  const del = async (id: string) => {
    await (supabase as any).from("cohort_email_campaigns").delete().eq("id", id);
    refetch();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Campagnes email</h3>
        <p className="text-xs text-muted-foreground">Envoyez un email à toute la cohorte ou à un segment (payeurs, retardataires, bloqués…).</p>
      </div>

      <Card className="p-4 space-y-3 bg-secondary/30">
        <div><Label>Sujet</Label><Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Ex: Démarrage de la cohorte" /></div>
        <div><Label>Contenu HTML</Label><Textarea rows={6} value={draft.body_html} onChange={(e) => setDraft({ ...draft, body_html: e.target.value })} placeholder="<p>Bonjour {{first_name}},</p>..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Audience</Label>
            <Select value={draft.audience} onValueChange={(v) => { setDraft({ ...draft, audience: v }); checkAud(v); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les étudiants</SelectItem>
                <SelectItem value="paid_full">Paiement complet</SelectItem>
                <SelectItem value="paid_partial">Paiement partiel (T1 OK)</SelectItem>
                <SelectItem value="unpaid">Aucun paiement validé</SelectItem>
                <SelectItem value="restricted">Comptes bloqués</SelectItem>
              </SelectContent>
            </Select>
            {audCount !== null && <p className="text-[11px] text-muted-foreground mt-1">≈ {audCount} destinataire(s)</p>}
          </div>
          <div>
            <Label>Programmer (optionnel)</Label>
            <Input type="datetime-local" value={draft.scheduled_at} onChange={(e) => setDraft({ ...draft, scheduled_at: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => create("draft")}>Brouillon</Button>
          <Button size="sm" variant="outline" onClick={() => create("scheduled")} disabled={!draft.scheduled_at}>Programmer</Button>
          <Button size="sm" className="bg-gold text-primary hover:bg-gold/90" onClick={() => create("send_now")}>Envoyer maintenant</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Variable disponible dans le contenu : <code>{`{{first_name}}`}</code></p>
      </Card>

      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucune campagne.</p> : (
        <div className="space-y-2">
          {rows.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between gap-2 border rounded-md p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.status}</Badge>
                  <span className="text-xs text-muted-foreground">{r.audience}</span>
                  {r.sent_at && <span className="text-xs text-muted-foreground">— {r.recipient_count} env.</span>}
                </div>
                <div className="font-medium text-sm mt-1 truncate">{r.subject}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.scheduled_at ? `Programmé : ${new Date(r.scheduled_at).toLocaleString()}` : `Créé : ${new Date(r.created_at).toLocaleString()}`}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function AnnoncesTab({ cohortId }: { cohortId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", content: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["cohort-annonces", cohortId],
    queryFn: async () => (await supabase.from("annonces").select("id, title, content, created_at").eq("cohort_id", cohortId).order("created_at", { ascending: false })).data ?? [],
  });

  const create = async () => {
    if (!form.title.trim() || !form.content.trim()) return toast.error("Titre et contenu requis");
    const { data: ann, error } = await supabase.from("annonces").insert({ cohort_id: cohortId, title: form.title.trim(), content: form.content.trim() }).select("id").single();
    if (error) return toast.error(error.message);
    // Notifications in-app pour chaque étudiant inscrit
    const { data: enrollments } = await supabase.from("cohort_enrollments").select("student_id").eq("cohort_id", cohortId);
    if (enrollments && enrollments.length > 0) {
      await supabase.from("notifications").insert(enrollments.map((e: any) => ({
        user_id: e.student_id, type: "announcement", title: form.title.trim(), content: form.content.trim().slice(0, 200), link: "/etudiant/formation",
      })));
    }
    toast.success("Annonce publiée"); setForm({ title: "", content: "" });
    qc.invalidateQueries({ queryKey: ["cohort-annonces", cohortId] });
    void ann;
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer cette annonce ?")) return;
    await supabase.from("annonces").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["cohort-annonces", cohortId] });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div><Label>Titre</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Contenu</Label><Textarea rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
        <Button onClick={create} className="bg-gold text-primary hover:bg-gold/90"><Plus className="mr-1 h-3 w-3" /> Publier</Button>
      </Card>
      {rows.length === 0 ? <Card className="p-8 text-center text-muted-foreground">Aucune annonce.</Card> :
        rows.map((a: any) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="font-medium">{a.title}</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{a.content}</p>
                <p className="text-xs text-muted-foreground mt-2">{new Date(a.created_at).toLocaleString("fr-FR")}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </Card>
        ))}
    </div>
  );
}

function LiveTab({ cohortId }: { cohortId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", scheduled_at: "", meeting_link: "", description: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["cohort-live", cohortId],
    queryFn: async () => (await supabase.from("live_sessions").select("*").eq("cohort_id", cohortId).order("scheduled_at", { ascending: false })).data ?? [],
  });

  const create = async () => {
    if (!form.title.trim() || !form.scheduled_at) return toast.error("Titre et date requis");
    const { error } = await supabase.from("live_sessions").insert({
      cohort_id: cohortId, title: form.title.trim(), scheduled_at: new Date(form.scheduled_at).toISOString(),
      meeting_link: form.meeting_link.trim() || null, description: form.description.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Séance créée"); setForm({ title: "", scheduled_at: "", meeting_link: "", description: "" });
    qc.invalidateQueries({ queryKey: ["cohort-live", cohortId] });
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer cette séance ?")) return;
    await supabase.from("live_sessions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["cohort-live", cohortId] });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Titre</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Date & heure</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
        </div>
        <div><Label>Lien Zoom / Meet</Label><Input value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} placeholder="https://..." /></div>
        <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <Button onClick={create} className="bg-gold text-primary hover:bg-gold/90"><Plus className="mr-1 h-3 w-3" /> Créer la séance</Button>
      </Card>
      {rows.length === 0 ? <Card className="p-8 text-center text-muted-foreground">Aucune séance.</Card> :
        rows.map((s: any) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{new Date(s.scheduled_at).toLocaleString("fr-FR")}</div>
                {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                {s.meeting_link && <a href={s.meeting_link} target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline mt-1 inline-block">{s.meeting_link}</a>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => del(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </Card>
        ))}
    </div>
  );
}
