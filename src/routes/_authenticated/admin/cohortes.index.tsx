import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, ExternalLink, ArrowRight, ArrowLeft, Trash2, GripVertical, Copy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/cohortes/")({
  component: CohortesAdmin,
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type FieldType = "short_text" | "long_text" | "email" | "phone" | "single_choice" | "multiple_choice" | "number" | "date";
interface DraftField { label: string; field_type: FieldType; required: boolean; options: string[]; }

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Texte court", long_text: "Texte long", email: "Email", phone: "Téléphone",
  single_choice: "Choix unique", multiple_choice: "Choix multiples", number: "Nombre", date: "Date",
};

function CohortesAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    formationId: "", name: "", startDate: "", endDate: "", zoomLink: "",
    priceFull: "", priceInstall: "",
    inst1Days: "15", inst2Days: "45",
    reminders: "7,3,1",
  });
  const [fields, setFields] = useState<DraftField[]>([
    { label: "Quelle est votre motivation ?", field_type: "long_text", required: true, options: [] },
  ]);

  const { data: formations = [] } = useQuery({
    queryKey: ["admin-formations-light"],
    queryFn: async () => (await supabase.from("formations").select("id, title")).data ?? [],
  });

  const { data: cohortes = [] } = useQuery({
    queryKey: ["admin-cohortes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cohortes")
        .select("*, formations(title), cohort_enrollments(count)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const reset = () => {
    setStep(1);
    setForm({ formationId: "", name: "", startDate: "", endDate: "", zoomLink: "", priceFull: "", priceInstall: "", inst1Days: "15", inst2Days: "45", reminders: "7,3,1" });
    setFields([{ label: "Quelle est votre motivation ?", field_type: "long_text", required: true, options: [] }]);
  };

  const create = async () => {
    if (!form.formationId || !form.name.trim()) return;
    const reminderDays = form.reminders.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    const slug = slugify(form.name) + "-" + Date.now().toString(36);
    const { data: cohort, error } = await supabase.from("cohortes").insert({
      formation_id: form.formationId,
      name: form.name.trim(),
      slug,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      zoom_link: form.zoomLink || null,
      price_full: form.priceFull ? Number(form.priceFull) : null,
      price_installment: form.priceInstall ? Number(form.priceInstall) : null,
      installment_1_deadline_days: Number(form.inst1Days) || 15,
      installment_2_deadline_days: Number(form.inst2Days) || 45,
      reminder_days_before: reminderDays.length ? reminderDays : [7, 3, 1],
    }).select().single();
    if (error || !cohort) { toast.error(error?.message ?? "Erreur"); return; }

    if (fields.length > 0) {
      const toInsert = fields.map((f, i) => ({
        cohort_id: cohort.id, label: f.label, field_type: f.field_type, required: f.required,
        options: f.options, position: i,
      }));
      await supabase.from("form_fields").insert(toInsert);
    }

    toast.success("Cohorte créée");
    setOpen(false);
    reset();
    qc.invalidateQueries({ queryKey: ["admin-cohortes"] });
  };

  const addField = () => setFields([...fields, { label: "Nouveau champ", field_type: "short_text", required: false, options: [] }]);
  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i));
  const updateField = (i: number, patch: Partial<DraftField>) => setFields(fields.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const moveField = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const copy = [...fields]; [copy[i], copy[j]] = [copy[j], copy[i]]; setFields(copy);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cohortes</h1>
          <p className="mt-1 text-muted-foreground">Créez et gérez vos cohortes, contenu et formulaires.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button className="bg-gold text-primary hover:bg-gold/90"><Plus className="mr-1 h-4 w-4" /> Nouvelle cohorte</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nouvelle cohorte — étape {step}/4</DialogTitle></DialogHeader>
            <Progress value={step * 25} className="h-1" />

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label>Formation associée</Label>
                  <Select value={form.formationId} onValueChange={(v) => setForm({ ...form, formationId: v })}>
                    <SelectTrigger><SelectValue placeholder="Choisir une formation" /></SelectTrigger>
                    <SelectContent>
                      {formations.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Nom de la cohorte</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Promo Janvier 2026" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date de début</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
                  <div><Label>Date de fin</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
                </div>
                <div><Label>Lien Zoom (sessions live)</Label><Input value={form.zoomLink} onChange={(e) => setForm({ ...form, zoomLink: e.target.value })} placeholder="https://zoom.us/..." /></div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Prix paiement complet (1x)</Label><Input type="number" value={form.priceFull} onChange={(e) => setForm({ ...form, priceFull: e.target.value })} /></div>
                  <div><Label>Prix paiement en 2x (total)</Label><Input type="number" value={form.priceInstall} onChange={(e) => setForm({ ...form, priceInstall: e.target.value })} /></div>
                </div>
                <div className="rounded-lg border bg-secondary/30 p-4 space-y-3">
                  <p className="text-sm font-medium">Échéances paiement en 2 fois</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Tranche 1 — payer sous (jours)</Label><Input type="number" value={form.inst1Days} onChange={(e) => setForm({ ...form, inst1Days: e.target.value })} /></div>
                    <div><Label className="text-xs">Tranche 2 — payer sous (jours)</Label><Input type="number" value={form.inst2Days} onChange={(e) => setForm({ ...form, inst2Days: e.target.value })} /></div>
                  </div>
                </div>
                <div>
                  <Label>Relances automatiques avant échéance (jours, séparés par virgule)</Label>
                  <Input value={form.reminders} onChange={(e) => setForm({ ...form, reminders: e.target.value })} placeholder="7,3,1" />
                  <p className="mt-1 text-xs text-muted-foreground">Un email sera envoyé X jours avant chaque échéance.</p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Personnalisez les champs du formulaire d'inscription (en plus de Prénom, Nom, Email, WhatsApp imposés).</p>
                {fields.map((f, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Libellé" className="flex-1" />
                      <Select value={f.field_type} onValueChange={(v) => updateField(i, { field_type: v as FieldType })}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => moveField(i, -1)}><ArrowLeft className="h-3 w-3 rotate-90" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => moveField(i, 1)}><ArrowRight className="h-3 w-3 rotate-90" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => removeField(i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                    <div className="flex items-center gap-3 pl-6">
                      <div className="flex items-center gap-2"><Switch checked={f.required} onCheckedChange={(v) => updateField(i, { required: v })} /><span className="text-xs">Obligatoire</span></div>
                      {(f.field_type === "single_choice" || f.field_type === "multiple_choice") && (
                        <Input value={f.options.join(", ")} onChange={(e) => updateField(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Option 1, Option 2, ..." className="flex-1" />
                      )}
                    </div>
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={addField}><Plus className="mr-1 h-3 w-3" /> Ajouter un champ</Button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <p className="text-sm">Récapitulatif</p>
                <Card className="p-4 text-sm space-y-1">
                  <div><strong>Formation :</strong> {formations.find((f: any) => f.id === form.formationId)?.title ?? "—"}</div>
                  <div><strong>Cohorte :</strong> {form.name}</div>
                  <div><strong>Dates :</strong> {form.startDate || "?"} → {form.endDate || "?"}</div>
                  <div><strong>Prix 1x :</strong> {form.priceFull || "—"} / <strong>2x :</strong> {form.priceInstall || "—"}</div>
                  <div><strong>Échéances :</strong> J+{form.inst1Days} / J+{form.inst2Days}</div>
                  <div><strong>Relances :</strong> {form.reminders} jours avant</div>
                  <div><strong>Champs formulaire :</strong> {4 + fields.length} (4 imposés + {fields.length} personnalisés)</div>
                </Card>
                <p className="text-xs text-muted-foreground">Le lien d'inscription sera généré automatiquement après création.</p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" disabled={step === 1} onClick={() => setStep(step - 1)}><ArrowLeft className="mr-1 h-3 w-3" /> Précédent</Button>
              {step < 4 ? (
                <Button onClick={() => setStep(step + 1)} className="bg-gold text-primary hover:bg-gold/90">Suivant <ArrowRight className="ml-1 h-3 w-3" /></Button>
              ) : (
                <Button onClick={create} className="bg-gold text-primary hover:bg-gold/90">Créer la cohorte</Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cohortes.length === 0 ? (
          <Card className="col-span-full p-12 text-center text-muted-foreground">Aucune cohorte. Créez la première !</Card>
        ) : (
          cohortes.map((c: any) => {
            const inscriptionUrl = `${window.location.origin}/inscription/${c.slug}`;
            return (
              <Card key={c.id} className="p-6 transition hover:shadow-premium">
                <div className="text-xs uppercase text-muted-foreground">{c.formations?.title}</div>
                <h3 className="mt-1 font-semibold">{c.name}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline">{c.status}</Badge>
                  <span className="text-xs text-muted-foreground">{c.cohort_enrollments?.[0]?.count ?? 0} inscrits</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/admin/cohortes/$id" params={{ id: c.id }}>
                    <Button size="sm" className="bg-gold text-primary hover:bg-gold/90">Gérer</Button>
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(inscriptionUrl); toast.success("Lien copié"); }}>
                    <Copy className="mr-1 h-3 w-3" /> Lien
                  </Button>
                  <a href={inscriptionUrl} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost"><ExternalLink className="h-3 w-3" /></Button>
                  </a>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
