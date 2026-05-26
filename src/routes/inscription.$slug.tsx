import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/inscription/$slug")({
  component: InscriptionPage,
});

function InscriptionPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [base, setBase] = useState({
    firstName: "", lastName: "", email: "", whatsapp: "", country: "", password: "",
    paymentMode: "full" as "full" | "installments_2",
  });
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});
  const [proof, setProof] = useState<File | null>(null);

  const { data: cohort, isLoading } = useQuery({
    queryKey: ["cohort-by-slug", slug],
    queryFn: async () => {
      const { data } = await supabase.from("cohortes").select("id, name, status, price_full, price_installment, installment_1_deadline_days, installment_2_deadline_days, formations(title, currency, description, long_description, cover_image_url)").eq("slug", slug).maybeSingle();
      return data;
    },
  });

  const { data: customFields = [] } = useQuery({
    queryKey: ["cohort-form-fields", cohort?.id],
    enabled: !!cohort?.id,
    queryFn: async () => (await supabase.from("form_fields").select("*").eq("cohort_id", cohort!.id).order("position")).data ?? [],
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement...</div>;
  if (!cohort) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cohorte introuvable.</div>;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!base.firstName || !base.lastName || !base.email || !base.whatsapp || !base.country) { toast.error("Tous les champs sont requis"); return; }
    if (!base.password || base.password.length < 8) { toast.error("Mot de passe : 8 caractères min"); return; }
    if (!proof) { toast.error("Preuve de paiement requise"); return; }
    for (const f of customFields as any[]) {
      if (f.required && !customAnswers[f.label]) { toast.error(`Champ requis : ${f.label}`); return; }
    }
    setLoading(true);

    const { data: signed, error: suErr } = await supabase.auth.signUp({
      email: base.email, password: base.password,
      options: { emailRedirectTo: `${window.location.origin}/etudiant`, data: { first_name: base.firstName, last_name: base.lastName, whatsapp: base.whatsapp, country: base.country } },
    });
    if (suErr || !signed.user) { setLoading(false); toast.error(suErr?.message ?? "Erreur"); return; }
    const userId = signed.user.id;

    await supabase.from("cohort_enrollments").insert({ student_id: userId, cohort_id: cohort.id });
    if (customFields.length > 0) {
      await supabase.from("form_responses").insert({ cohort_id: cohort.id, student_id: userId, answers: customAnswers });
    }

    const total = base.paymentMode === "full" ? Number(cohort.price_full ?? 0) : Number(cohort.price_installment ?? cohort.price_full ?? 0);
    const today = new Date();
    const d1 = new Date(today); d1.setDate(d1.getDate() + (cohort.installment_1_deadline_days ?? 15));
    const d2 = new Date(today); d2.setDate(d2.getDate() + (cohort.installment_2_deadline_days ?? 45));

    const { data: payment } = await supabase.from("payments").insert({
      student_id: userId, cohort_id: cohort.id, amount_total: total, mode: base.paymentMode,
      status: "pending", final_deadline: (base.paymentMode === "full" ? d1 : d2).toISOString().slice(0, 10),
    }).select().single();

    if (payment) {
      const installments = base.paymentMode === "full"
        ? [{ payment_id: payment.id, position: 1, amount: total, due_date: d1.toISOString().slice(0, 10) }]
        : [
            { payment_id: payment.id, position: 1, amount: total / 2, due_date: d1.toISOString().slice(0, 10) },
            { payment_id: payment.id, position: 2, amount: total / 2, due_date: d2.toISOString().slice(0, 10) },
          ];
      const { data: created } = await supabase.from("payment_installments").insert(installments).select();
      if (created && created.length > 0 && proof) {
        const first = created.find((x: any) => x.position === 1);
        if (first) {
          const path = `${userId}/${first.id}-${Date.now()}-${proof.name}`;
          await supabase.storage.from("payment-proofs").upload(path, proof);
          await supabase.from("payment_installments").update({ proof_path: path, status: "submitted", submitted_at: new Date().toISOString() }).eq("id", first.id);
        }
      }
    }

    setLoading(false);
    toast.success("Inscription réussie ! Connectez-vous pour accéder à votre espace.");
    navigate({ to: "/login" });
  };

  const renderField = (f: any) => {
    const val = customAnswers[f.label];
    const set = (v: any) => setCustomAnswers({ ...customAnswers, [f.label]: v });
    switch (f.field_type) {
      case "long_text": return <Textarea value={val ?? ""} onChange={(e) => set(e.target.value)} required={f.required} />;
      case "email": return <Input type="email" value={val ?? ""} onChange={(e) => set(e.target.value)} required={f.required} />;
      case "phone": return <Input type="tel" value={val ?? ""} onChange={(e) => set(e.target.value)} required={f.required} />;
      case "number": return <Input type="number" value={val ?? ""} onChange={(e) => set(e.target.value)} required={f.required} />;
      case "date": return <Input type="date" value={val ?? ""} onChange={(e) => set(e.target.value)} required={f.required} />;
      case "single_choice":
        return <RadioGroup value={val ?? ""} onValueChange={set} className="space-y-1">
          {(f.options ?? []).map((o: string) => <label key={o} className="flex items-center gap-2 text-sm"><RadioGroupItem value={o} />{o}</label>)}
        </RadioGroup>;
      case "multiple_choice":
        return <div className="space-y-1">{(f.options ?? []).map((o: string) => {
          const arr = Array.isArray(val) ? val : [];
          return <label key={o} className="flex items-center gap-2 text-sm">
            <Checkbox checked={arr.includes(o)} onCheckedChange={(c) => set(c ? [...arr, o] : arr.filter((x: string) => x !== o))} />{o}
          </label>;
        })}</div>;
      default: return <Input value={val ?? ""} onChange={(e) => set(e.target.value)} required={f.required} />;
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30 py-10">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center"><Logo /></div>
        <Card className="p-8 shadow-premium">
          {cohort.formations?.cover_image_url && <img src={cohort.formations.cover_image_url} alt="" className="mb-4 h-40 w-full rounded object-cover" />}
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{cohort.formations?.title}</div>
          <h1 className="mt-1 text-2xl font-bold">Inscription — {cohort.name}</h1>
          {cohort.formations?.description && <p className="mt-2 text-sm text-muted-foreground">{cohort.formations.description}</p>}
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prénom *</Label><Input value={base.firstName} onChange={(e) => setBase({ ...base, firstName: e.target.value })} required /></div>
              <div><Label>Nom *</Label><Input value={base.lastName} onChange={(e) => setBase({ ...base, lastName: e.target.value })} required /></div>
            </div>
            <div><Label>Email *</Label><Input type="email" value={base.email} onChange={(e) => setBase({ ...base, email: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>WhatsApp *</Label><Input value={base.whatsapp} onChange={(e) => setBase({ ...base, whatsapp: e.target.value })} required /></div>
              <div><Label>Pays *</Label><Input value={base.country} onChange={(e) => setBase({ ...base, country: e.target.value })} required /></div>
            </div>
            <div><Label>Mot de passe *</Label><Input type="password" value={base.password} onChange={(e) => setBase({ ...base, password: e.target.value })} required /></div>

            {customFields.length > 0 && (
              <div className="space-y-4 rounded-lg border bg-secondary/20 p-4">
                {(customFields as any[]).map((f) => (
                  <div key={f.id}>
                    <Label>{f.label}{f.required && " *"}</Label>
                    <div className="mt-1">{renderField(f)}</div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label>Mode de paiement *</Label>
              <RadioGroup value={base.paymentMode} onValueChange={(v) => setBase({ ...base, paymentMode: v as any })} className="mt-2 grid grid-cols-2 gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3">
                  <RadioGroupItem value="full" id="full" />
                  <div><div className="text-sm font-medium">En une fois</div><div className="text-xs text-muted-foreground">{Number(cohort.price_full ?? 0).toLocaleString()} {cohort.formations?.currency ?? "XOF"}</div></div>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3">
                  <RadioGroupItem value="installments_2" id="install" />
                  <div><div className="text-sm font-medium">En 2 fois</div><div className="text-xs text-muted-foreground">{Number(cohort.price_installment ?? 0).toLocaleString()} {cohort.formations?.currency ?? "XOF"}</div></div>
                </label>
              </RadioGroup>
            </div>
            <div>
              <Label>Preuve de paiement (1ère tranche) *</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setProof(e.target.files?.[0] ?? null)} required />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gold text-primary hover:bg-gold/90">
              {loading ? "Inscription..." : "Finaliser mon inscription"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
