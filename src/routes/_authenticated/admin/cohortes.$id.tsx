import { createFileRoute, Link } from "@tanstack/react-router";
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">
      <div>
        <Link to="/admin/cohortes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-3 w-3" /> Retour aux cohortes
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase text-muted-foreground">{cohort.formations?.title}</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{cohort.name}</h1>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline">{cohort.status}</Badge>
              <span className="text-xs text-muted-foreground">{cohort.start_date ?? "?"} → {cohort.end_date ?? "?"}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(inscriptionUrl); toast.success("Lien copié"); }}>
            <Copy className="mr-1 h-3 w-3" /> Copier le lien d'inscription
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="students">Étudiants</TabsTrigger>
          <TabsTrigger value="content">Contenu</TabsTrigger>
          <TabsTrigger value="form">Formulaire</TabsTrigger>
          <TabsTrigger value="responses">Réponses</TabsTrigger>
          <TabsTrigger value="settings">Paramètres</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4"><OverviewTab cohortId={id} /></TabsContent>
        <TabsContent value="students" className="space-y-4 pt-4"><StudentsTab cohortId={id} /></TabsContent>
        <TabsContent value="content" className="space-y-4 pt-4"><ContentTab cohortId={id} /></TabsContent>
        <TabsContent value="form" className="space-y-4 pt-4"><FormBuilderTab cohortId={id} inscriptionUrl={inscriptionUrl} /></TabsContent>
        <TabsContent value="responses" className="space-y-4 pt-4"><ResponsesTab cohortId={id} /></TabsContent>
        <TabsContent value="settings" className="space-y-4 pt-4"><SettingsTab cohort={cohort} onSaved={() => { refetchCohort(); qc.invalidateQueries({ queryKey: ["admin-cohortes"] }); }} /></TabsContent>
      </Tabs>
    </div>
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

function StudentsTab({ cohortId }: { cohortId: string }) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["cohort-students", cohortId],
    queryFn: async () => {
      const { data: enrollments } = await supabase.from("cohort_enrollments").select("id, status, enrolled_at, student_id").eq("cohort_id", cohortId);
      const ids = (enrollments ?? []).map((e) => e.student_id);
      if (ids.length === 0) return [];
      const [{ data: profiles }, { data: payments }] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name, email").in("id", ids),
        supabase.from("payments").select("id, student_id, status, amount_total, amount_paid").eq("cohort_id", cohortId).in("student_id", ids),
      ]);
      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const paymap = new Map((payments ?? []).map((p) => [p.student_id, p]));
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
        <TableHeader><TableRow><TableHead>Étudiant</TableHead><TableHead>Email</TableHead><TableHead>Paiement</TableHead><TableHead>Accès</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">Aucun étudiant inscrit.</TableCell></TableRow> :
            rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : "—"}</TableCell>
                <TableCell>{r.profile?.email ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{r.payment?.status ?? "—"}</Badge>{r.payment ? ` ${Number(r.payment.amount_paid).toLocaleString()}/${Number(r.payment.amount_total).toLocaleString()}` : ""}</TableCell>
                <TableCell><Badge variant={r.status === "restricted" ? "destructive" : "default"}>{r.status}</Badge></TableCell>
                <TableCell>
                  <Button size="sm" variant={r.status === "restricted" ? "default" : "outline"} onClick={() => toggleAccess(r.id, r.status)}>
                    {r.status === "restricted" ? "Rétablir" : "Restreindre"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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
    if (!rForm.title.trim()) return;
    const { error } = await supabase.from("ressources").insert({ module_id: moduleId, title: rForm.title.trim(), type: rForm.type as any, url: rForm.url.trim() || null, description: rForm.description.trim() || null });
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
      <Card className="p-4 bg-secondary/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Lien d'inscription public</p>
            <p className="text-xs text-muted-foreground break-all">{inscriptionUrl}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(inscriptionUrl); toast.success("Copié"); }}>
            <Copy className="mr-1 h-3 w-3" /> Copier
          </Button>
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
      <div><Label>Relances (jours avant échéance)</Label><Input value={form.reminders} onChange={(e) => setForm({ ...form, reminders: e.target.value })} placeholder="7,3,1" /></div>
      <Button onClick={save} className="bg-gold text-primary hover:bg-gold/90"><Save className="mr-1 h-4 w-4" /> Enregistrer</Button>
    </Card>
  );
}
