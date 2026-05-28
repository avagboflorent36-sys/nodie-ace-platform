import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, CheckCircle2, CreditCard, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMyTranche2CheckoutSummary, startMyTranche2Checkout } from "@/lib/chariow.functions";

export const Route = createFileRoute("/_authenticated/etudiant/paiements/tranche-2/$paymentId")({
  component: Tranche2CheckoutPage,
});

function Tranche2CheckoutPage() {
  const { paymentId } = Route.useParams();
  const getSummary = useServerFn(getMyTranche2CheckoutSummary);
  const startCheckout = useServerFn(startMyTranche2Checkout);
  const [starting, setStarting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-tranche-2-checkout-summary", paymentId],
    queryFn: () => getSummary({ data: { payment_id: paymentId } }),
  });

  const pay = async () => {
    setStarting(true);
    try {
      const result = await startCheckout({ data: { payment_id: paymentId, return_origin: window.location.origin } });
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      toast.error(result.message ?? "Impossible de démarrer le paiement Chariow.", { duration: 8000 });
      refetch();
    } catch (error: any) {
      toast.error(error?.message ?? "Erreur inattendue lors du démarrage du paiement.");
    } finally {
      setStarting(false);
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Chargement...</p>;
  }

  const amount = Number(data?.tranche2?.amount ?? 0).toLocaleString();
  const currency = data?.currency ?? "XOF";

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-6 animate-fade-up">
      <Button asChild variant="ghost" size="sm">
        <Link to="/etudiant/paiements">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour aux paiements
        </Link>
      </Button>

      <Card className="p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge variant="outline">Tranche 2</Badge>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">Paiement de la deuxième tranche</h1>
            <p className="mt-1 text-sm text-muted-foreground">{data?.cohort_name ?? "Cohorte"}</p>
          </div>
          {data?.status === "ready" ? (
            <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Prêt</Badge>
          ) : (
            <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> À vérifier</Badge>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Montant tranche 2" value={`${amount} ${currency}`} />
          <Info label="Statut tranche 2" value={data?.tranche2?.status ?? "Introuvable"} />
          <Info label="Échéance" value={data?.tranche2?.due_date ?? "Non définie"} />
          <Info label="Product ID Chariow" value={data?.product_id ?? "Non configuré"} mono />
        </div>

        {data?.message && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {data.message}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <p className="text-xs text-muted-foreground">
            Un checkout neuf sera créé avec le Product ID Tranche 2 uniquement.
          </p>
          <Button disabled={!data?.ok || starting} onClick={pay} className="bg-gold text-primary hover:bg-gold/90">
            {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            {starting ? "Redirection…" : "Continuer vers Chariow"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}