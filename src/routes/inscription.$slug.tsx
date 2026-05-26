import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { inscriptionSchema } from "@/lib/validators";

export const Route = createFileRoute("/inscription/$slug")({
  component: InscriptionPage,
});

function InscriptionPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", whatsapp: "", country: "",
    paymentMode: "full" as "full" | "installments_2",
    password: "",
  });
  const [proof, setProof] = useState<File | null>(null);

  const { data: cohort, isLoading } = useQuery({
    queryKey: ["cohort-by-slug", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("cohortes")
        .select("id, name, status, price_full, price_installment, installment_deadline_days, formations(title, currency)")
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement...</div>;
  if (!cohort) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cohorte introuvable.</div>;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = inscriptionSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!form.password || form.password.length < 8) { toast.error("Mot de passe : 8 caractères min"); return; }
    if (!proof) { toast.error("Preuve de paiement requise"); return; }
    setLoading(true);

    // 1. signUp
    const { data: signed, error: suErr } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/etudiant`,
        data: {
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          whatsapp: parsed.data.whatsapp,
          country: parsed.data.country,
        },
      },
    });
    if (suErr || !signed.user) { setLoading(false); toast.error(suErr?.message ?? "Erreur"); return; }
    const userId = signed.user.id;

    // 2. enrollment
    await supabase.from("cohort_enrollments").insert({ student_id: userId, cohort_id: cohort.id });

    // 3. payment + installments
    const total = parsed.data.paymentMode === "full"
      ? Number(cohort.price_full ?? 0)
      : Number(cohort.price_installment ?? cohort.price_full ?? 0);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (cohort.installment_deadline_days ?? 30));
    const { data: payment } = await supabase.from("payments").insert({
      student_id: userId,
      cohort_id: cohort.id,
      amount_total: total,
      mode: parsed.data.paymentMode,
      status: "pending",
      final_deadline: deadline.toISOString().slice(0, 10),
    }).select().single();

    if (payment) {
      const installments = parsed.data.paymentMode === "full"
        ? [{ payment_id: payment.id, position: 1, amount: total, due_date: deadline.toISOString().slice(0, 10) }]
        : [
            { payment_id: payment.id, position: 1, amount: total / 2 },
            { payment_id: payment.id, position: 2, amount: total / 2, due_date: deadline.toISOString().slice(0, 10) },
          ];
      const { data: created } = await supabase.from("payment_installments").insert(installments).select();

      // Upload proof for installment 1
      if (created && created.length > 0 && proof) {
        const first = created.find((x: any) => x.position === 1);
        if (first) {
          const path = `${userId}/${first.id}-${Date.now()}-${proof.name}`;
          await supabase.storage.from("payment-proofs").upload(path, proof);
          await supabase
            .from("payment_installments")
            .update({ proof_path: path, status: "submitted", submitted_at: new Date().toISOString() })
            .eq("id", first.id);
        }
      }
    }

    setLoading(false);
    toast.success("Inscription réussie !");
    navigate({ to: "/etudiant" });
  };

  return (
    <div className="min-h-screen bg-secondary/30 py-10">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center"><Logo /></div>
        <Card className="p-8 shadow-premium">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{cohort.formations?.title}</div>
          <h1 className="mt-1 text-2xl font-bold">Inscription — {cohort.name}</h1>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prénom</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
              <div><Label>Nom</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
            </div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} required /></div>
              <div><Label>Pays</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required /></div>
            </div>
            <div><Label>Mot de passe (pour accéder à votre espace)</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            <div>
              <Label>Mode de paiement</Label>
              <RadioGroup value={form.paymentMode} onValueChange={(v) => setForm({ ...form, paymentMode: v as any })} className="mt-2 grid grid-cols-2 gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3">
                  <RadioGroupItem value="full" id="full" />
                  <div>
                    <div className="text-sm font-medium">En une fois</div>
                    <div className="text-xs text-muted-foreground">{Number(cohort.price_full ?? 0).toLocaleString()} {cohort.formations?.currency ?? "XOF"}</div>
                  </div>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3">
                  <RadioGroupItem value="installments_2" id="install" />
                  <div>
                    <div className="text-sm font-medium">En 2 fois</div>
                    <div className="text-xs text-muted-foreground">{Number(cohort.price_installment ?? 0).toLocaleString()} {cohort.formations?.currency ?? "XOF"}</div>
                  </div>
                </label>
              </RadioGroup>
            </div>
            <div>
              <Label>Preuve de paiement (1ère tranche)</Label>
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
