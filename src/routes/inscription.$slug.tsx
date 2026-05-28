import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  startChariowCheckout,
  fetchSaleStatus,
  checkAttemptByToken,
  claimPendingEnrollment,
  claimAttemptByToken,
} from "@/lib/chariow.functions";

type SearchParams = { sale?: string; claim?: string; attempt?: string };

export const Route = createFileRoute("/inscription/$slug")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    sale: typeof s.sale === "string" ? s.sale : undefined,
    claim: typeof s.claim === "string" ? s.claim : undefined,
    attempt: typeof s.attempt === "string" ? s.attempt : undefined,
  }),
  component: InscriptionPage,
});

function InscriptionPage() {
  const { slug } = Route.useParams();
  const search = useSearch({ from: "/inscription/$slug" }) as SearchParams;
  const saleId = search.sale;
  const claimToken = search.claim;
  const attemptToken = search.attempt;

  const { data: cohort, isLoading } = useQuery({
    queryKey: ["cohort-by-slug", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("cohortes")
        .select(
          "id, name, status, price_full, price_installment, chariow_product_id_full, chariow_product_id_installment_1, formations(title, currency, description, cover_image_url)",
        )
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    );
  if (!cohort)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cohorte introuvable.
      </div>
    );

  return (
    <div className="min-h-screen bg-secondary/30 py-10">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <Logo />
        </div>
        <Card className="p-8 shadow-premium">
          {(cohort as any).formations?.cover_image_url && (
            <img
              src={(cohort as any).formations.cover_image_url}
              alt=""
              className="mb-4 h-40 w-full rounded object-cover"
            />
          )}
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {(cohort as any).formations?.title}
          </div>
          <h1 className="mt-1 text-2xl font-bold">Inscription — {cohort.name}</h1>
          {(cohort as any).formations?.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {(cohort as any).formations.description}
            </p>
          )}

          {saleId || claimToken || attemptToken ? (
            <PostPaymentStep
              cohort={cohort}
              saleId={saleId}
              claimToken={claimToken}
              attemptToken={attemptToken}
              slug={slug}
            />
          ) : (
            <CheckoutStep cohort={cohort} />
          )}
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 1 : choix mode + form minimal → redirection Chariow
// ─────────────────────────────────────────────────────────────────────────────
function CheckoutStep({ cohort }: { cohort: any }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mode: "full" as "full" | "installments_2",
  });
  const startCheckout = useServerFn(startChariowCheckout);

  const canFull = !!cohort.chariow_product_id_full;
  const canInst = !!cohort.chariow_product_id_installment_1;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.phone) {
      toast.error("Tous les champs sont requis");
      return;
    }
    if (form.mode === "full" && !canFull) {
      toast.error("Paiement 1x non disponible pour cette cohorte");
      return;
    }
    if (form.mode === "installments_2" && !canInst) {
      toast.error("Paiement 2x non disponible pour cette cohorte");
      return;
    }
    setLoading(true);
    try {
      const r = await startCheckout({
        data: {
          cohort_id: cohort.id,
          mode: form.mode,
          installment_position: 1,
          email: form.email.trim().toLowerCase(),
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          phone: form.phone.trim(),
          return_origin: window.location.origin,
        },
      });
      if (r.checkout_url) {
        window.location.href = r.checkout_url;
        return;
      }
      if (r.redirect_url) {
        window.location.href = r.redirect_url;
        return;
      }
      toast.error(r.message ?? "Impossible de créer le paiement Chariow");
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      toast.error(e?.message ?? "Erreur lors de la création du paiement");
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Prénom *</Label>
          <Input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Nom *</Label>
          <Input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
        </div>
      </div>
      <div>
        <Label>Email *</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
      </div>
      <div>
        <Label>WhatsApp *</Label>
        <Input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
        />
      </div>

      <div>
        <Label>Mode de paiement *</Label>
        <RadioGroup
          value={form.mode}
          onValueChange={(v) => setForm({ ...form, mode: v as any })}
          className="mt-2 grid grid-cols-2 gap-2"
        >
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${!canFull ? "opacity-50" : ""}`}
          >
            <RadioGroupItem value="full" id="full" disabled={!canFull} />
            <div>
              <div className="text-sm font-medium">En une fois</div>
              <div className="text-xs text-muted-foreground">
                {Number(cohort.price_full ?? 0).toLocaleString()}{" "}
                {(cohort as any).formations?.currency ?? "XOF"}
              </div>
            </div>
          </label>
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${!canInst ? "opacity-50" : ""}`}
          >
            <RadioGroupItem value="installments_2" id="install" disabled={!canInst} />
            <div>
              <div className="text-sm font-medium">En 2 fois</div>
              <div className="text-xs text-muted-foreground">
                {Number(cohort.price_installment ?? 0).toLocaleString()}{" "}
                {(cohort as any).formations?.currency ?? "XOF"} / tranche
              </div>
            </div>
          </label>
        </RadioGroup>
        {!canFull && !canInst && (
          <p className="mt-2 text-xs text-destructive">
            Cette cohorte n'est pas encore configurée pour accepter des paiements. Contactez
            l'équipe.
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={loading || (!canFull && !canInst)}
        className="w-full bg-gold text-primary hover:bg-gold/90"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirection vers le paiement...
          </>
        ) : (
          "Payer via Chariow"
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Vous serez redirigé vers la plateforme de paiement sécurisée Chariow.
      </p>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 2 : retour après paiement — formulaire complet + signup
// ─────────────────────────────────────────────────────────────────────────────
function PostPaymentStep({
  cohort,
  saleId,
  claimToken,
  attemptToken,
  slug,
}: {
  cohort: any;
  saleId?: string;
  claimToken?: string;
  attemptToken?: string;
  slug: string;
}) {
  const navigate = useNavigate();
  const fetchStatus = useServerFn(fetchSaleStatus);
  const checkAttempt = useServerFn(checkAttemptByToken);
  const claim = useServerFn(claimPendingEnrollment);
  const claimAttempt = useServerFn(claimAttemptByToken);

  const hasRemoteCheck = !!(saleId || attemptToken);
  const [verifying, setVerifying] = useState(hasRemoteCheck);
  const [verified, setVerified] = useState(!hasRemoteCheck);
  const [paid, setPaid] = useState(false);
  const [manualChecking, setManualChecking] = useState(false);

  useEffect(() => {
    if (!hasRemoteCheck) {
      setVerified(true);
      setPaid(true);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 12;
    const poll = async () => {
      while (!cancelled && attempts < MAX_ATTEMPTS) {
        attempts++;
        try {
          if (attemptToken) {
            const r = await checkAttempt({ data: { token: attemptToken } });
            if (cancelled) return;
            if (r.found && r.paid) {
              setPaid(true);
              setVerified(true);
              setVerifying(false);
              return;
            }
          } else if (saleId) {
            const r = await fetchStatus({ data: { sale_id: saleId } });
            if (cancelled) return;
            if (r.paid) {
              setPaid(true);
              setVerified(true);
              setVerifying(false);
              return;
            }
          }
        } catch {}
        await new Promise((res) => setTimeout(res, 3000));
      }
      if (!cancelled) {
        setVerified(true);
        setVerifying(false);
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [saleId, attemptToken, hasRemoteCheck, fetchStatus, checkAttempt]);

  const manualRecheck = async () => {
    setManualChecking(true);
    try {
      if (attemptToken) {
        const r = await checkAttempt({ data: { token: attemptToken } });
        if (r.found && r.paid) {
          setPaid(true);
          setVerified(true);
          setVerifying(false);
          toast.success("Paiement confirmé, vous pouvez compléter le formulaire.");
          return;
        }
      } else if (saleId) {
        const r = await fetchStatus({ data: { sale_id: saleId } });
        if (r.paid) {
          setPaid(true);
          setVerified(true);
          setVerifying(false);
          toast.success("Paiement confirmé, vous pouvez compléter le formulaire.");
          return;
        }
      }
      toast.error("Paiement pas encore confirmé. Réessayez dans quelques instants.");
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de vérifier le paiement maintenant.");
    } finally {
      setManualChecking(false);
    }
  };

  const { data: customFields = [] } = useQuery({
    queryKey: ["cohort-form-fields", cohort?.id],
    enabled: !!cohort?.id,
    queryFn: async () =>
      (await supabase.from("form_fields").select("*").eq("cohort_id", cohort.id).order("position"))
        .data ?? [],
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    whatsapp: "",
    country: "",
    password: "",
  });
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.whatsapp || !form.country) {
      toast.error("Tous les champs sont requis");
      return;
    }
    if (!form.password || form.password.length < 8) {
      toast.error("Mot de passe : 8 caractères min");
      return;
    }
    for (const f of customFields as any[]) {
      if (f.required && !answers[f.label]) {
        toast.error(`Champ requis : ${f.label}`);
        return;
      }
    }
    setLoading(true);

    const { data: signed, error: suErr } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/etudiant`,
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          whatsapp: form.whatsapp,
          country: form.country,
        },
      },
    });
    if (suErr || !signed.user) {
      setLoading(false);
      const alreadyExists = /already|registered|exists|inscrit|existe/i.test(suErr?.message ?? "");
      if (alreadyExists && attemptToken) {
        toast.error("Ce compte existe déjà. Connectez-vous pour lier votre paiement.");
        navigate({ to: "/login", search: { attempt: attemptToken } as any });
        return;
      }
      toast.error(suErr?.message ?? "Erreur lors de la création du compte");
      return;
    }

    // Ensure session is active so server-fn middleware sees auth.uid()
    let hasSession = !!signed.session;
    if (!hasSession) {
      const { error: siErr } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      hasSession = !siErr;
    }

    // Lier le paiement au nouveau compte (3 chemins possibles)
    if (hasSession) {
      try {
        if (attemptToken) {
          await claimAttempt({ data: { token: attemptToken } });
        } else if (claimToken) {
          await claim({ data: { claim_token: claimToken } });
        }
      } catch (e: any) {
        console.error("claim failed", e);
        toast.error(
          e?.message ??
            "Compte créé, mais le paiement n'a pas pu être lié automatiquement. Contactez le support.",
        );
      }
    }

    if (customFields.length > 0) {
      await supabase.from("form_responses").insert({
        cohort_id: cohort.id,
        student_id: signed.user.id,
        answers,
      });
    }

    setLoading(false);
    if (hasSession) {
      toast.success("Bienvenue ! Votre espace étudiant est prêt.");
      navigate({ to: "/etudiant" });
    } else {
      toast.success(
        "Compte créé ! Vérifiez votre email puis connectez-vous pour accéder à votre espace.",
      );
      navigate({
        to: "/login",
        search: attemptToken ? ({ attempt: attemptToken } as any) : undefined,
      });
    }
  };

  const renderField = (f: any) => {
    const val = answers[f.label];
    const set = (v: any) => setAnswers({ ...answers, [f.label]: v });
    switch (f.field_type) {
      case "long_text":
        return (
          <Textarea value={val ?? ""} onChange={(e) => set(e.target.value)} required={f.required} />
        );
      case "email":
        return (
          <Input
            type="email"
            value={val ?? ""}
            onChange={(e) => set(e.target.value)}
            required={f.required}
          />
        );
      case "phone":
        return (
          <Input
            type="tel"
            value={val ?? ""}
            onChange={(e) => set(e.target.value)}
            required={f.required}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={val ?? ""}
            onChange={(e) => set(e.target.value)}
            required={f.required}
          />
        );
      case "date":
        return (
          <Input
            type="date"
            value={val ?? ""}
            onChange={(e) => set(e.target.value)}
            required={f.required}
          />
        );
      case "single_choice":
        return (
          <RadioGroup value={val ?? ""} onValueChange={set} className="space-y-1">
            {(f.options ?? []).map((o: string) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={o} />
                {o}
              </label>
            ))}
          </RadioGroup>
        );
      case "multiple_choice":
        return (
          <div className="space-y-1">
            {(f.options ?? []).map((o: string) => {
              const arr = Array.isArray(val) ? val : [];
              return (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={arr.includes(o)}
                    onCheckedChange={(c) =>
                      set(c ? [...arr, o] : arr.filter((x: string) => x !== o))
                    }
                  />
                  {o}
                </label>
              );
            })}
          </div>
        );
      default:
        return (
          <Input value={val ?? ""} onChange={(e) => set(e.target.value)} required={f.required} />
        );
    }
  };

  if (verifying) {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Vérification du paiement...
      </div>
    );
  }

  if (verified && !paid && (saleId || attemptToken)) {
    return (
      <div className="mt-6 space-y-3">
        <Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <p className="text-sm">
            Nous n'avons pas encore reçu la confirmation de votre paiement. Recharger cette page
            dans quelques instants — si le problème persiste, contactez-nous.
          </p>
        </Card>
        <Button
          onClick={manualRecheck}
          disabled={manualChecking}
          className="w-full bg-gold text-primary hover:bg-gold/90"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${manualChecking ? "animate-spin" : ""}`} />
          {manualChecking ? "Vérification..." : "J'ai payé, revérifier maintenant"}
        </Button>
        <Button
          onClick={() => navigate({ to: "/inscription/$slug", params: { slug } })}
          variant="outline"
          className="w-full"
        >
          Retour
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        <div>
          <p className="text-sm font-medium">Paiement confirmé</p>
          <p className="text-xs text-muted-foreground">
            Créez votre compte pour accéder à votre espace étudiant.
          </p>
        </div>
        <Badge variant="outline" className="ml-auto">
          Chariow
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Prénom *</Label>
          <Input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Nom *</Label>
          <Input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
        </div>
      </div>
      <div>
        <Label>Email *</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Utilisez la même adresse que celle du paiement pour lier automatiquement votre compte.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>WhatsApp *</Label>
          <Input
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Pays *</Label>
          <Input
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            required
          />
        </div>
      </div>
      <div>
        <Label>Mot de passe *</Label>
        <Input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
      </div>

      {customFields.length > 0 && (
        <div className="space-y-4 rounded-lg border bg-secondary/20 p-4">
          {(customFields as any[]).map((f) => (
            <div key={f.id}>
              <Label>
                {f.label}
                {f.required && " *"}
              </Label>
              <div className="mt-1">{renderField(f)}</div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-gold text-primary hover:bg-gold/90"
      >
        {loading ? "Création du compte..." : "Créer mon compte"}
      </Button>
    </form>
  );
}
