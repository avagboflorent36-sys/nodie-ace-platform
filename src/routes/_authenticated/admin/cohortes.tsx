import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, ExternalLink } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/cohortes")({
  component: CohortesAdmin,
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function CohortesAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ formationId: "", name: "", startDate: "", endDate: "", priceFull: "", priceInstall: "" });

  const { data: formations = [] } = useQuery({
    queryKey: ["admin-formations-light"],
    queryFn: async () => (await supabase.from("formations").select("id, title")).data ?? [],
  });

  const { data: cohortes = [] } = useQuery({
    queryKey: ["admin-cohortes"],
    queryFn: async () => {
      const { data } = await supabase.from("cohortes").select("*, formations(title)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = async () => {
    if (!form.formationId || !form.name.trim()) return;
    const { error } = await supabase.from("cohortes").insert({
      formation_id: form.formationId,
      name: form.name.trim(),
      slug: slugify(form.name) + "-" + Date.now().toString(36),
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      price_full: form.priceFull ? Number(form.priceFull) : null,
      price_installment: form.priceInstall ? Number(form.priceInstall) : null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Cohorte créée");
    setOpen(false);
    setForm({ formationId: "", name: "", startDate: "", endDate: "", priceFull: "", priceInstall: "" });
    qc.invalidateQueries({ queryKey: ["admin-cohortes"] });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Cohortes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gold text-primary hover:bg-gold/90"><Plus className="mr-1 h-4 w-4" /> Nouvelle cohorte</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle cohorte</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Formation</Label>
                <Select value={form.formationId} onValueChange={(v) => setForm({ ...form, formationId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir une formation" /></SelectTrigger>
                  <SelectContent>
                    {formations.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Nom de la cohorte</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Début</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
                <div><Label>Fin</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prix complet</Label><Input type="number" value={form.priceFull} onChange={(e) => setForm({ ...form, priceFull: e.target.value })} /></div>
                <div><Label>Prix 2x</Label><Input type="number" value={form.priceInstall} onChange={(e) => setForm({ ...form, priceInstall: e.target.value })} /></div>
              </div>
              <Button className="w-full" onClick={create}>Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cohortes.length === 0 ? (
          <Card className="col-span-full p-12 text-center text-muted-foreground">Aucune cohorte.</Card>
        ) : (
          cohortes.map((c: any) => (
            <Card key={c.id} className="p-6">
              <div className="text-xs uppercase text-muted-foreground">{c.formations?.title}</div>
              <h3 className="mt-1 font-semibold">{c.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">Statut : {c.status}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">/{c.slug}</span>
                <Link to="/inscription/$slug" params={{ slug: c.slug }} target="_blank">
                  <Button variant="ghost" size="sm">Lien d'inscription <ExternalLink className="ml-1 h-3 w-3" /></Button>
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
