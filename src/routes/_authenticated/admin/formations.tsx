import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, FileText, Video, Link2, BookOpen } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/formations")({
  component: FormationsAdmin,
});

const ICONS: Record<string, any> = { document: FileText, video: Video, link: Link2, exercise: BookOpen };

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function FormationsAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", longDescription: "", price: "", duration: "", coverImageUrl: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: formations = [], refetch } = useQuery({
    queryKey: ["admin-formations"],
    queryFn: async () => (await supabase.from("formations").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const openCreate = () => {
    setEditId(null);
    setForm({ title: "", description: "", longDescription: "", price: "", duration: "", coverImageUrl: "" });
    setOpen(true);
  };
  const openEdit = (f: any) => {
    setEditId(f.id);
    setForm({ title: f.title, description: f.description ?? "", longDescription: f.long_description ?? "", price: String(f.price_amount ?? ""), duration: String(f.duration_weeks ?? ""), coverImageUrl: f.cover_image_url ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      slug: slugify(form.title),
      description: form.description.trim() || null,
      long_description: form.longDescription.trim() || null,
      price_amount: Number(form.price || 0),
      duration_weeks: form.duration ? Number(form.duration) : null,
      cover_image_url: form.coverImageUrl.trim() || null,
    };
    const { error } = editId
      ? await supabase.from("formations").update(payload).eq("id", editId)
      : await supabase.from("formations").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? "Formation mise à jour" : "Formation créée");
    setOpen(false); refetch();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Formations</h1>
          <p className="mt-1 text-muted-foreground">Catalogue éditorial et ressources globales.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openCreate} className="bg-gold text-primary hover:bg-gold/90"><Plus className="mr-1 h-4 w-4" /> Nouvelle formation</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{editId ? "Modifier la formation" : "Nouvelle formation"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titre</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Description courte</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div><Label>Description longue (programme, objectifs)</Label><Textarea value={form.longDescription} onChange={(e) => setForm({ ...form, longDescription: e.target.value })} rows={5} /></div>
              <div><Label>Image de couverture (URL)</Label><Input value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} placeholder="https://..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prix (XOF)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                <div><Label>Durée (semaines)</Label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
              </div>
              <Button className="w-full" onClick={save}>{editId ? "Enregistrer" : "Créer"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1 space-y-3">
          {formations.length === 0 ? <Card className="p-6 text-center text-muted-foreground">Aucune formation.</Card> :
            formations.map((f: any) => (
              <Card key={f.id} className={`p-4 cursor-pointer transition ${selectedId === f.id ? "ring-2 ring-gold" : "hover:bg-accent/30"}`} onClick={() => setSelectedId(f.id)}>
                {f.cover_image_url && <img src={f.cover_image_url} alt={f.title} className="mb-2 h-32 w-full rounded object-cover" />}
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{f.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gold">{Number(f.price_amount).toLocaleString()} {f.currency}</span>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(f); }}><Pencil className="h-3 w-3" /></Button>
                </div>
              </Card>
            ))}
        </div>
        <div className="md:col-span-2 space-y-4">
          {selectedId ? (
            <>
              <FormationStats formationId={selectedId} />
              <FormationDetail formationId={selectedId} />
            </>
          ) : <Card className="p-12 text-center text-muted-foreground">Sélectionnez une formation pour gérer son contenu et voir les statistiques.</Card>}
        </div>
      </div>
    </div>
  );
}

function FormationStats({ formationId }: { formationId: string }) {
  const { data } = useQuery({
    queryKey: ["formation-stats", formationId],
    queryFn: async () => {
      const { data: cohorts } = await supabase.from("cohortes").select("id, name, currency").eq("formation_id", formationId);
      const cohortIds = (cohorts ?? []).map((c: any) => c.id);
      if (cohortIds.length === 0) return { cohorts: [], totals: { enrolled: 0, active: 0, restricted: 0, revenue: 0, expected: 0 } };

      const [enrollments, payments, modules] = await Promise.all([
        supabase.from("cohort_enrollments").select("cohort_id, status, student_id").in("cohort_id", cohortIds),
        supabase.from("payments").select("cohort_id, amount_total, amount_paid").in("cohort_id", cohortIds),
        supabase.from("modules").select("id, cohort_id, ressources(id)").in("cohort_id", cohortIds),
      ]);

      const ressourceIdsByCohort = new Map<string, string[]>();
      for (const m of modules.data ?? []) {
        const arr = ressourceIdsByCohort.get((m as any).cohort_id) ?? [];
        for (const r of (m as any).ressources ?? []) arr.push(r.id);
        ressourceIdsByCohort.set((m as any).cohort_id, arr);
      }

      const allRessIds = Array.from(ressourceIdsByCohort.values()).flat();
      const { data: progress } = allRessIds.length
        ? await supabase.from("progress_tracking").select("ressource_id, student_id").in("ressource_id", allRessIds)
        : { data: [] as any[] };

      const rows = (cohorts ?? []).map((c: any) => {
        const enr = (enrollments.data ?? []).filter((e: any) => e.cohort_id === c.id);
        const pays = (payments.data ?? []).filter((p: any) => p.cohort_id === c.id);
        const ressIds = ressourceIdsByCohort.get(c.id) ?? [];
        const studentIds = new Set(enr.filter((e: any) => e.status === "active").map((e: any) => e.student_id));
        let avgCompletion = 0;
        if (ressIds.length > 0 && studentIds.size > 0) {
          let total = 0;
          for (const sid of studentIds) {
            const done = (progress ?? []).filter((p: any) => p.student_id === sid && ressIds.includes(p.ressource_id)).length;
            total += done / ressIds.length;
          }
          avgCompletion = (total / studentIds.size) * 100;
        }
        const expected = pays.reduce((s: number, p: any) => s + Number(p.amount_total || 0), 0);
        const revenue = pays.reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0);
        return {
          id: c.id, name: c.name, currency: c.currency ?? "XOF",
          enrolled: enr.length,
          active: enr.filter((e: any) => e.status === "active").length,
          restricted: enr.filter((e: any) => e.status === "restricted").length,
          revenue, expected,
          paymentRate: expected > 0 ? (revenue / expected) * 100 : 0,
          completion: avgCompletion,
        };
      });

      const totals = rows.reduce((acc, r) => ({
        enrolled: acc.enrolled + r.enrolled, active: acc.active + r.active, restricted: acc.restricted + r.restricted,
        revenue: acc.revenue + r.revenue, expected: acc.expected + r.expected,
      }), { enrolled: 0, active: 0, restricted: 0, revenue: 0, expected: 0 });

      return { cohorts: rows, totals };
    },
  });

  if (!data) return null;
  const t = data.totals;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Statistiques par cohorte</h2>
      <p className="mt-1 text-xs text-muted-foreground">Agrégation de tous les étudiants suivant cette formation.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Inscrits", value: t.enrolled },
          { label: "Actifs", value: t.active },
          { label: "Restreints", value: t.restricted },
          { label: "Encaissé / Attendu", value: `${t.revenue.toLocaleString()} / ${t.expected.toLocaleString()}` },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border p-3">
            <div className="text-xs uppercase text-muted-foreground">{k.label}</div>
            <div className="mt-1 text-xl font-bold text-gold">{k.value}</div>
          </div>
        ))}
      </div>
      {data.cohorts.length > 0 && (
        <Table className="mt-4">
          <TableHeader><TableRow><TableHead>Cohorte</TableHead><TableHead>Inscrits</TableHead><TableHead>Actifs</TableHead><TableHead>% Paiement</TableHead><TableHead>% Progression</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.cohorts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.enrolled}</TableCell>
                <TableCell>{c.active}</TableCell>
                <TableCell>{c.paymentRate.toFixed(0)}%</TableCell>
                <TableCell>{c.completion.toFixed(0)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function FormationDetail({ formationId }: { formationId: string }) {
  const [modOpen, setModOpen] = useState(false);
  const [modForm, setModForm] = useState({ title: "", description: "" });
  const [lessonOpenForModule, setLessonOpenForModule] = useState<string | null>(null);
  const [globalOpen, setGlobalOpen] = useState(false);
  const [lessonForm, setLessonForm] = useState({ title: "", type: "video", url: "", description: "" });

  const { data: modules = [], refetch: refetchModules } = useQuery({
    queryKey: ["formation-modules", formationId],
    queryFn: async () => (await supabase.from("formation_modules").select("*").eq("formation_id", formationId).order("position")).data ?? [],
  });
  const { data: resources = [], refetch: refetchRes } = useQuery({
    queryKey: ["formation-resources", formationId],
    queryFn: async () => (await supabase.from("formation_resources").select("*").eq("formation_id", formationId).order("position")).data ?? [],
  });

  const addModule = async () => {
    if (!modForm.title.trim()) return;
    const { error } = await supabase.from("formation_modules").insert({
      formation_id: formationId, title: modForm.title.trim(),
      description: modForm.description.trim() || null, position: modules.length,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Module créé"); setModOpen(false); setModForm({ title: "", description: "" }); refetchModules();
  };
  const delModule = async (id: string) => {
    if (!confirm("Supprimer ce module et ses leçons ?")) return;
    await supabase.from("formation_resources").delete().eq("module_id", id);
    await supabase.from("formation_modules").delete().eq("id", id);
    refetchModules(); refetchRes();
  };

  const addLesson = async (moduleId: string | null) => {
    if (!lessonForm.title.trim()) return;
    const sameScope = resources.filter((r: any) => r.module_id === moduleId);
    const { error } = await supabase.from("formation_resources").insert({
      formation_id: formationId, module_id: moduleId,
      title: lessonForm.title.trim(), type: lessonForm.type as any,
      url: lessonForm.url.trim() || null, description: lessonForm.description.trim() || null,
      position: sameScope.length,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Leçon ajoutée");
    setLessonOpenForModule(null); setGlobalOpen(false);
    setLessonForm({ title: "", type: "video", url: "", description: "" });
    refetchRes();
  };
  const delLesson = async (id: string) => { await supabase.from("formation_resources").delete().eq("id", id); refetchRes(); };

  const globalResources = resources.filter((r: any) => !r.module_id);

  const LessonDialog = ({ open, onOpenChange, onSubmit, title }: any) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Titre</Label><Input value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} /></div>
          <div><Label>Type</Label>
            <Select value={lessonForm.type} onValueChange={(v) => setLessonForm({ ...lessonForm, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Vidéo / Replay</SelectItem>
                <SelectItem value="link">Playlist / Lien</SelectItem>
                <SelectItem value="document">Document PDF</SelectItem>
                <SelectItem value="exercise">Exercice</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>URL</Label><Input value={lessonForm.url} onChange={(e) => setLessonForm({ ...lessonForm, url: e.target.value })} placeholder="https://..." /></div>
          <div><Label>Description</Label><Textarea value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} /></div>
          <Button className="w-full" onClick={onSubmit}>Ajouter</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Programme de la formation</h2>
          <p className="mt-1 text-xs text-muted-foreground">Modules et leçons partagés entre toutes les cohortes de cette formation. Visible par tous les étudiants inscrits et actifs.</p>
        </div>
        <Dialog open={modOpen} onOpenChange={setModOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-gold text-primary hover:bg-gold/90"><Plus className="mr-1 h-3 w-3" /> Module</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau module</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titre</Label><Input value={modForm.title} onChange={(e) => setModForm({ ...modForm, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={modForm.description} onChange={(e) => setModForm({ ...modForm, description: e.target.value })} rows={3} /></div>
              <Button className="w-full" onClick={addModule}>Créer le module</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 space-y-3">
        {modules.length === 0 && <p className="text-sm text-muted-foreground">Aucun module. Créez-en un pour structurer le contenu.</p>}
        {modules.map((m: any, idx: number) => {
          const lessons = resources.filter((r: any) => r.module_id === m.id);
          return (
            <div key={m.id} className="rounded-lg border">
              <div className="flex items-start justify-between gap-2 border-b bg-accent/30 px-3 py-2">
                <div className="flex-1">
                  <div className="text-sm font-semibold">Module {idx + 1} · {m.title}</div>
                  {m.description && <div className="text-xs text-muted-foreground">{m.description}</div>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setLessonForm({ title: "", type: "video", url: "", description: "" }); setLessonOpenForModule(m.id); }}>
                    <Plus className="mr-1 h-3 w-3" /> Leçon
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => delModule(m.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
              <div className="space-y-1 p-2">
                {lessons.length === 0 ? <p className="px-2 py-1 text-xs text-muted-foreground">Aucune leçon.</p> :
                  lessons.map((r: any) => {
                    const Icon = ICONS[r.type] ?? BookOpen;
                    return (
                      <div key={r.id} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-accent/30">
                        <Icon className="h-4 w-4 text-gold" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{r.title}</div>
                          {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                        </div>
                        {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline">Ouvrir</a>}
                        <Button size="sm" variant="ghost" onClick={() => delLesson(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Ressources globales</h3>
            <p className="text-xs text-muted-foreground">Indépendantes des modules.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setLessonForm({ title: "", type: "video", url: "", description: "" }); setGlobalOpen(true); }}>
            <Plus className="mr-1 h-3 w-3" /> Ajouter
          </Button>
        </div>
        <div className="mt-2 space-y-1">
          {globalResources.length === 0 ? <p className="text-xs text-muted-foreground">Aucune ressource globale.</p> :
            globalResources.map((r: any) => {
              const Icon = ICONS[r.type] ?? BookOpen;
              return (
                <div key={r.id} className="flex items-center gap-3 rounded border px-3 py-2">
                  <Icon className="h-4 w-4 text-gold" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{r.title}</div>
                    {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                  </div>
                  {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline">Ouvrir</a>}
                  <Button size="sm" variant="ghost" onClick={() => delLesson(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              );
            })}
        </div>
      </div>

      <LessonDialog
        open={!!lessonOpenForModule}
        onOpenChange={(o: boolean) => !o && setLessonOpenForModule(null)}
        onSubmit={() => addLesson(lessonOpenForModule)}
        title="Nouvelle leçon"
      />
      <LessonDialog
        open={globalOpen}
        onOpenChange={setGlobalOpen}
        onSubmit={() => addLesson(null)}
        title="Nouvelle ressource globale"
      />
    </Card>
  );
}
