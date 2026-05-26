import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/formations")({
  component: FormationsAdmin,
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function FormationsAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", price: "", duration: "" });

  const { data: formations = [] } = useQuery({
    queryKey: ["admin-formations"],
    queryFn: async () => {
      const { data } = await supabase.from("formations").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = async () => {
    if (!form.title.trim()) return;
    const { error } = await supabase.from("formations").insert({
      title: form.title.trim(),
      slug: slugify(form.title),
      description: form.description.trim() || null,
      price_amount: Number(form.price || 0),
      duration_weeks: form.duration ? Number(form.duration) : null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Formation créée");
    setOpen(false);
    setForm({ title: "", description: "", price: "", duration: "" });
    qc.invalidateQueries({ queryKey: ["admin-formations"] });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Formations</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gold text-primary hover:bg-gold/90"><Plus className="mr-1 h-4 w-4" /> Nouvelle formation</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle formation</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Titre</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prix (XOF)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                <div><Label>Durée (semaines)</Label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
              </div>
              <Button className="w-full" onClick={create}>Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {formations.length === 0 ? (
          <Card className="col-span-full p-12 text-center text-muted-foreground">Aucune formation.</Card>
        ) : (
          formations.map((f: any) => (
            <Card key={f.id} className="p-6">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{f.description}</p>
              <div className="mt-4 text-sm font-medium text-gold">{Number(f.price_amount).toLocaleString()} {f.currency}</div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
