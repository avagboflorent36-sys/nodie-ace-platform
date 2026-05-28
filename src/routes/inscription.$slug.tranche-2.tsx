import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2, CheckCircle2, LogIn } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { startChariowCheckout } from "@/lib/chariow.functions";

export const Route = createFileRoute("/inscription/$slug/tranche-2")({
  component: TrancheDeuxPage,
});

function TrancheDeuxPage() {
  const { slug } = Route.useParams();
  const { user, loading: authLoading } = useAuth();

  const { data: cohort, isLoading: cohortLoading } = useQuery({
    queryKey: ["cohort-by-slug-t2", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("cohortes")
        .select(
          "id, name, slug, status, price_installment, chariow_product_id_full, chariow_product_id_installment_1, chariow_product_id_installment_2, formations(title, currency, cover_image_url)",
        )
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
  });


  if (cohortLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (!cohort) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cohorte introuvable.
      </div>
    );
  }

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
          <h1 className="mt-1 text-2xl font-bold">
            Finalisation — {cohort.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Réglez la seconde tranche de votre formation pour conserver votre
            accès complet.
          </p>

          <div className="mt-6">
            {!user ? (
              <NotLoggedIn slug={slug} />
            ) : (
              <FinalizeStep cohort={cohort} userId={user.id} />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function NotLoggedIn({ slug }: { slug: string }) {
  const next = `/inscription/${slug}/tranche-2`;
  return (
    <Card className="p-6 space-y-4 bg-secondary/40 border-dashed">
      <p className="text-sm">
        Connectez-vous avec le compte utilisé lors de votre inscription pour
        finaliser votre tranche 2.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="bg-gold text-primary hover:bg-gold/90">
          <Link to="/login" search={{ next } as any}>
            <LogIn className="mr-1 h-4 w-4" /> Se connecter
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/signup" search={{ next } as any}>
            Créer un compte
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function FinalizeStep({ cohort, userId }: { cohort: any; userId: string }) {
  const [loading, setLoading] = useState(false);
  const startCheckout = useServerFn(startChariowCheckout);

  const { data: payment, isLoading } = useQuery({
    queryKey: ["t2-payment", cohort.id, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select(
          "id, status, mode, payment_installments(id, position, status)",
        )
        .eq("cohort_id", cohort.id)
        .eq("student_id", userId)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (!payment) {
    return (
      <Card className="p-6 space-y-3 bg-secondary/40 border-dashed">
        <p className="text-sm">
          Aucune inscription trouvée pour ce compte sur cette cohorte.
        </p>
        <Button asChild variant="outline">
          <Link to="/inscription/$slug" params={{ slug: cohort.slug }}>
            Aller au formulaire d'inscription
          </Link>
        </Button>
      </Card>
    );
  }

  const t2 = (payment.payment_installments ?? []).find((i: any) => i.position === 2);

  if (payment.status === "paid" || t2?.status === "validated") {
    return (
      <Card className="p-6 space-y-3 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300/40">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
          <p className="text-sm font-medium">Paiement déjà finalisé.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/etudiant/paiements">Voir mes paiements</Link>
        </Button>
      </Card>
    );
  }

  if (payment.mode !== "installments_2") {
    return (
      <Card className="p-6 space-y-3 bg-secondary/40 border-dashed">
        <p className="text-sm">
          Votre inscription n'est pas configurée en 2 tranches. Contactez le
          support si nécessaire.
        </p>
        <Button asChild variant="outline">
          <Link to="/etudiant/paiements">Voir mes paiements</Link>
        </Button>
      </Card>
    );
  }

  const handlePay = async () => {
    setLoading(true);
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, whatsapp")
        .eq("id", userId)
        .maybeSingle();
      const r = await startCheckout({
        data: {
          cohort_id: cohort.id,
          mode: "installments_2",
          installment_position: 2,
          email: prof?.email ?? "",
          first_name: prof?.first_name ?? "",
          last_name: prof?.last_name ?? "",
          phone: prof?.whatsapp ?? "",
          return_origin: window.location.origin,
        },
      });
      if (r.checkout_url) {
        window.location.href = r.checkout_url;
        return;
      }
      toast.error(r.message ?? "Impossible de créer le paiement");
      setLoading(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
      setLoading(false);
    }
  };

  const t2Id = cohort.chariow_product_id_installment_2;
  const t1Id = cohort.chariow_product_id_installment_1;
  const fullId = cohort.chariow_product_id_full;
  const collision = t2Id && ((t1Id && t2Id === t1Id) || (fullId && t2Id === fullId));

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-secondary/40">
        <p className="text-sm">
          Montant tranche 2 :{" "}
          <span className="font-semibold">
            {Number(cohort.price_installment ?? 0).toLocaleString()}{" "}
            {(cohort as any).formations?.currency ?? "XOF"}
          </span>
        </p>
      </Card>
      {collision ? (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <p className="text-sm font-medium text-destructive">Paiement tranche 2 indisponible</p>
          <p className="text-xs text-muted-foreground mt-1">
            Le Product ID Chariow de la tranche 2 est identique à un autre mode de paiement sur cette cohorte. Contactez l'administrateur pour configurer un produit Chariow distinct pour la tranche 2.
          </p>
        </Card>
      ) : !t2Id ? (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <p className="text-sm font-medium text-destructive">Paiement tranche 2 non configuré</p>
          <p className="text-xs text-muted-foreground mt-1">
            Le Product ID Chariow pour la tranche 2 n'a pas encore été défini. Contactez l'administrateur.
          </p>
        </Card>
      ) : (
        <Button
          onClick={handlePay}
          disabled={loading}
          className="w-full bg-gold text-primary hover:bg-gold/90"
          size="lg"
        >
          {loading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="mr-1 h-4 w-4" />
          )}
          Finaliser ma tranche 2
        </Button>
      )}
    </div>
  );
}
