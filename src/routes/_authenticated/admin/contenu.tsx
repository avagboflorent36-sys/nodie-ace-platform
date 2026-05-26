import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, FileText, Video, Link2, BookOpen } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/contenu")({
  component: ContenuAdmin,
});

const ICONS: Record<string, any> = { document: FileText, video: Video, link: Link2, other: BookOpen };

function ContenuAdmin() {
  const qc = useQueryClient();
  const [cohortId, setCohortId] = useState<string>("");
  const [moduleOpen, setModuleOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const [resModuleId, setResModuleId] = useState<string>("");
  const [mForm, setMForm] = useState({ title: "", description: "", position: "0" });
  const [rForm, setRForm] = useState({ title: "", type: "document", url: "", description: "", position: "0" });

  const { data: cohortes = [] } = useQuery({
    queryKey: ["admin-cohortes-light"],
    queryFn: async () => (await supabase.from("cohortes").select("id, name, formations(title)").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: modules = [], refetch } = useQuery({
    queryKey: ["admin-modules", cohortId],
    enabled: !!cohortId,
    queryFn: async () => {
      const { data } = await supabase
        .from("modules")
        .select("id, title, description, position, ressources(id, title, type, url, position)")
        .eq("cohort_id", cohortId)
        .order("position");
      return data ?? [];
    },
  });

  const createModule = async () => {
    if (!cohortId || !mForm.title.trim()) return;
    const { error } = await supabase.from("modules").insert({
      cohort_id: cohortId,
      title: mForm.title.trim(),
      description: mForm.description.trim() || null,
      position: Number(mForm.position) || 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Module créé");
    setModuleOpen(false);
    setMForm({ title: "", description: "", position: "0" });
    refetch();
  };

  const deleteModule = async (id: string) => {
    if (!confirm("Supprimer ce module et ses ressources ?")) return;
    await supabase.from("ressources").delete().eq("module_id", id);
    const { error } = await supabase.from("modules").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refetch();
  };

  const createRessource = async () => {
    if (!resModuleId || !rForm.title.trim()) return;
    const { error } = await supabase.from("ressources").insert({
      module_id: resModuleId,
      title: rForm.title.trim(),
      type: rForm.type as any,
      url: rForm.url.trim() || null,
      description: rForm.description.trim() || null,
      position: Number(rForm.position) || 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Ressource ajoutée");
    setResOpen(false);
    setRForm({ title: "", type: "document", url: "", description: "", position: "0" });
    refetch();
  };

  const deleteRessource = async (id: string) => {
    const { error } = await supabase.from("ressources").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refetch();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contenu pédagogique</h1>
        <p className="mt-1 text-muted-foreground">Gérez les modules et ressources d'une cohorte.</p>
      </div>

      <Card className="p-6">
        <Label>Cohorte</Label>
        <Select value={cohortId} onValueChange={setCohortId}>
          <SelectTrigger className="mt-2 max-w-md"><SelectValue placeholder="Choisir une cohorte" /></SelectTrigger>
          <SelectContent>
            {cohortes.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.formations?.title} — {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {cohortId && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Modules</h2>
            <Dialog open={moduleOpen} onOpenChange={setModuleOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gold text-primary hover:bg-gold/90"><Plus className="mr-1 h-4 w-4" /> Module</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouveau module</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Titre</Label><Input value={mForm.title} onChange={(e) => setMForm({ ...mForm, title: e.target.value })} /></div>
                  <div><Label>Description</Label><Textarea value={mForm.description} onChange={(e) => setMForm({ ...mForm, description: e.target.value })} /></div>
                  <div><Label>Position</Label><Input type="number" value={mForm.position} onChange={(e) => setMForm({ ...mForm, position: e.target.value })} /></div>
                  <Button className="w-full" onClick={createModule}>Créer</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {modules.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">Aucun module pour cette cohorte.</Card>
          ) : (
            modules.map((m: any) => (
              <Card key={m.id} className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">#{m.position}</div>
                    <h3 className="mt-1 text-lg font-semibold">{m.title}</h3>
                    {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={resOpen && resModuleId === m.id} onOpenChange={(o) => { setResOpen(o); if (o) setResModuleId(m.id); }}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => setResModuleId(m.id)}><Plus className="mr-1 h-3 w-3" /> Ressource</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Nouvelle ressource</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                          <div><Label>Titre</Label><Input value={rForm.title} onChange={(e) => setRForm({ ...rForm, title: e.target.value })} /></div>
                          <div>
                            <Label>Type</Label>
                            <Select value={rForm.type} onValueChange={(v) => setRForm({ ...rForm, type: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="document">Document</SelectItem>
                                <SelectItem value="video">Vidéo</SelectItem>
                                <SelectItem value="link">Lien</SelectItem>
                                <SelectItem value="other">Autre</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div><Label>URL</Label><Input value={rForm.url} onChange={(e) => setRForm({ ...rForm, url: e.target.value })} placeholder="https://..." /></div>
                          <div><Label>Description</Label><Textarea value={rForm.description} onChange={(e) => setRForm({ ...rForm, description: e.target.value })} /></div>
                          <div><Label>Position</Label><Input type="number" value={rForm.position} onChange={(e) => setRForm({ ...rForm, position: e.target.value })} /></div>
                          <Button className="w-full" onClick={createRessource}>Ajouter</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="ghost" onClick={() => deleteModule(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                {(m.ressources ?? []).length > 0 && (
                  <div className="mt-4 divide-y rounded-lg border">
                    {m.ressources
                      .slice()
                      .sort((a: any, b: any) => a.position - b.position)
                      .map((r: any) => {
                        const Icon = ICONS[r.type] ?? BookOpen;
                        return (
                          <div key={r.id} className="flex items-center gap-3 p-3">
                            <Icon className="h-4 w-4 text-gold" />
                            <span className="text-sm font-medium">{r.title}</span>
                            <span className="text-xs uppercase text-muted-foreground">{r.type}</span>
                            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => deleteRessource(r.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </Card>
            ))
          )}
        </>
      )}
    </div>
  );
}
