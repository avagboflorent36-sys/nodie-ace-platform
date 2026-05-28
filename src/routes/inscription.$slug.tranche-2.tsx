import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { startChariowCheckoutForTranche2Token } from "@/lib/chariow.functions";

type SearchParams = { t?: string };

export const Route = createFileRoute("/inscription/$slug/tranche-2")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    t: typeof s.t === "string" ? s.t : undefined,
  }),
  component: TrancheDeuxPage,
});

function TrancheDeuxPage() {
  const { t: token } = useSearch({ from: "/inscription/$slug/tranche-2" }) as SearchParams;
  const startCheckout = useServerFn(startChariowCheckoutForTranche2Token);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;

    if (!token) {
      setError(
        "Ce lien tranche 2 est invalide. Demandez à votre administrateur (ou ouvrez le lien depuis votre espace 'Mes paiements') de vous renvoyer le bon lien.",
      );
      return;
    }
    (async () => {
      try {
        const r = await startCheckout({
          data: { token, return_origin: window.location.origin },
        });
        if (r.checkout_url) {
          window.location.href = r.checkout_url;
          return;
        }
        setStatus(r.status ?? null);
        setError(r.message ?? "Impossible d'ouvrir le paiement Chariow.");
      } catch (e: any) {
        setError(e?.message ?? "Erreur inattendue.");
      }
    })();
  }, [token, startCheckout]);

  return (
    <div className="min-h-screen bg-secondary/30 py-10">
      <div className="container mx-auto max-w-xl px-4">
        <div className="mb-8 text-center">
          <Logo />
        </div>
        <Card className="p-8 shadow-premium text-center space-y-4">
          {!error ? (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold" />
              <h1 className="text-xl font-semibold">Redirection vers le paiement…</h1>
              <p className="text-sm text-muted-foreground">
                Nous vous envoyons sur la page de paiement Chariow pour finaliser votre tranche 2.
              </p>
            </>
          ) : status === "already_paid" ? (
            <>
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <h1 className="text-xl font-semibold">Tranche 2 déjà réglée</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button asChild variant="outline">
                <Link to="/etudiant/paiements">Voir mes paiements</Link>
              </Button>
            </>
          ) : (
            <>
              <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
              <h1 className="text-xl font-semibold">Paiement tranche 2 indisponible</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline">
                  <Link to="/etudiant/paiements">Mes paiements</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/login">Se connecter</Link>
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
