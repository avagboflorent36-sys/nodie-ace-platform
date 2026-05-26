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
        <div className="md:col-span-2">
          {selectedId ? <FormationDetail formationId={selectedId} /> : <Card className="p-12 text-center text-muted-foreground">Sélectionnez une formation pour gérer son contenu pédagogique global.</Card>}
        </div>
      </div>
    </div>
  );
}

function FormationDetail({ formationId }: { formationId: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "video", url: "", description: "" });

  const { data: resources = [], refetch } = useQuery({
    queryKey: ["formation-resources", formationId],
    queryFn: async () => (await supabase.from("formation_resources").select("*").eq("formation_id", formationId).order("position")).data ?? [],
  });

  const add = async () => {
    if (!form.title.trim()) return;
    const { error } = await supabase.from("formation_resources").insert({
      formation_id: formationId,
      title: form.title.trim(), type: form.type as any, url: form.url.trim() || null,
      description: form.description.trim() || null, position: resources.length,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Ressource ajoutée"); setOpen(false); setForm({ title: "", type: "video", url: "", description: "" }); refetch();
  };
  const del = async (id: string) => { await supabase.from("formation_resources").delete().eq("id", id); refetch(); };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contenu pédagogique global</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-gold text-primary hover:bg-gold/90"><Plus className="mr-1 h-3 w-3" /> Ajouter</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle ressource de formation</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titre</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Vidéo / Replay</SelectItem>
                    <SelectItem value="link">Playlist / Lien</SelectItem>
                    <SelectItem value="document">Document PDF</SelectItem>
                    <SelectItem value="exercise">Exercice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://youtube.com/..." /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button className="w-full" onClick={add}>Ajouter</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Visible par tous les étudiants inscrits à une cohorte de cette formation.</p>
      <div className="mt-4 space-y-2">
        {resources.length === 0 ? <p className="text-sm text-muted-foreground">Aucune ressource globale.</p> :
          resources.map((r: any) => {
            const Icon = ICONS[r.type] ?? BookOpen;
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Icon className="h-4 w-4 text-gold" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{r.title}</div>
                  {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                </div>
                {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline">Ouvrir</a>}
                <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            );
          })}
      </div>
    </Card>
  );
}
