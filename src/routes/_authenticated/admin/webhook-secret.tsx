import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Copy, Eye, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getChariowWebhookUrls } from "@/lib/admin-secrets.functions";
import {
  syncChariowSale,
  listChariowWebhookEvents,
  listChariowAttempts,
  reconcileAttempt,
} from "@/lib/chariow.functions";

export const Route = createFileRoute("/_authenticated/admin/webhook-secret")({
  component: WebhookSecretPage,
});

function WebhookSecretPage() {
  const fetchUrls = useServerFn(getChariowWebhookUrls);
  const resync = useServerFn(syncChariowSale);
  const listEvents = useServerFn(listChariowWebhookEvents);
  const listAttempts = useServerFn(listChariowAttempts);
  const reconcile = useServerFn(reconcileAttempt);

  const [urls, setUrls] = useState<{ previewUrl: string; productionUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saleId, setSaleId] = useState("");
  const [resyncing, setResyncing] = useState(false);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);

  const eventsQ = useQuery({
    queryKey: ["chariow-webhook-events"],
    queryFn: () => listEvents({ data: undefined as any }),
    refetchInterval: 10000,
  });

  const attemptsQ = useQuery({
    queryKey: ["chariow-payment-attempts"],
    queryFn: () => listAttempts({ data: undefined as any }),
    refetchInterval: 10000,
  });

  const reveal = async () => {
    setLoading(true);
    try {
      const data = await fetchUrls({ data: undefined as any });
      setUrls(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiée`);
  };

  const doResync = async () => {
    const id = saleId.trim();
    if (id.length < 3) {
      toast.error("ID de vente invalide");
      return;
    }
    setResyncing(true);
    try {
      const r = await resync({ data: { sale_id: id } });
      if (r.ok) {
        toast.success("Paiement resynchronisé");
        setSaleId("");
        eventsQ.refetch();
      } else {
        toast.error(r.message ?? `Statut: ${r.status}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Échec du resync");
    } finally {
      setResyncing(false);
    }
  };

  const doReconcileAttempt = async (attempt: any) => {
    if (!attempt.chariow_sale_id) {
      toast.error("Aucun ID de vente Chariow sur cette tentative");
      return;
    }
    setReconcilingId(attempt.id);
    try {
      const r = await reconcile({ data: { attempt_id: attempt.id } });
      if (r.ok) toast.success("Tentative réconciliée");
      else toast.error(r.message ?? `Statut: ${r.status}`);
      attemptsQ.refetch();
      eventsQ.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de la réconciliation");
    } finally {
      setReconcilingId(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Page interne</p>
          <p className="text-destructive/80">
            Configuration du webhook Chariow, resync manuel d'une vente et historique des événements reçus.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>URL du webhook Chariow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!urls ? (
            <Button onClick={reveal} disabled={loading}>
              <Eye className="h-4 w-4 mr-2" />
              {loading ? "Chargement..." : "Révéler le secret"}
            </Button>
          ) : (
            <div className="space-y-4">
              <UrlRow label="URL preview" url={urls.previewUrl} onCopy={copy} />
              <UrlRow label="URL production" url={urls.productionUrl} onCopy={copy} />
              <div className="rounded border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Étapes :</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Copier l'URL production</li>
                  <li>Coller dans Chariow comme URL de webhook</li>
                  <li>Faire un paiement test</li>
                  <li>Vérifier ci-dessous dans "Événements reçus"</li>
                </ol>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resynchroniser une vente Chariow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Si un étudiant a payé mais n'a pas été redirigé / n'apparait pas, colle ici
            l'ID de vente Chariow (visible dans le dashboard Chariow) pour relancer le traitement.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="sale_xxx ou ID Chariow"
              value={saleId}
              onChange={(e) => setSaleId(e.target.value)}
            />
            <Button onClick={doResync} disabled={resyncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${resyncing ? "animate-spin" : ""}`} />
              Resync
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Tentatives de paiement récentes</span>
            <Button size="sm" variant="ghost" onClick={() => attemptsQ.refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attemptsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : (attemptsQ.data?.attempts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune tentative enregistrée.</p>
          ) : (
            <div className="space-y-2">
              {attemptsQ.data!.attempts.map((a: any) => (
                <div key={a.id} className="rounded border border-border p-3 text-xs space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={a.status === "processed" ? "default" : "outline"}>{a.status}</Badge>
                    <span className="font-medium">{a.cohortes?.name ?? "Cohorte inconnue"}</span>
                    <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  <div className="grid gap-1 text-muted-foreground">
                    <span>Email : <span className="text-foreground">{a.email}</span></span>
                    <span>Produit : <span className="font-mono text-foreground">{a.chariow_product_id ?? "—"}</span></span>
                    <span>Vente : <span className="font-mono text-foreground break-all">{a.chariow_sale_id ?? "non reçue"}</span></span>
                    {a.last_error && <span className="text-destructive break-all">Erreur : {a.last_error}</span>}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => doReconcileAttempt(a)}
                      disabled={!a.chariow_sale_id || reconcilingId === a.id}
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${reconcilingId === a.id ? "animate-spin" : ""}`} />
                      Revérifier
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Événements reçus (30 derniers)</span>
            <Button size="sm" variant="ghost" onClick={() => eventsQ.refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : (eventsQ.data?.events ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun événement reçu pour le moment.
            </p>
          ) : (
            <div className="space-y-2">
              {eventsQ.data!.events.map((e: any) => (
                <div
                  key={e.id}
                  className="rounded border border-border p-3 text-xs flex items-start gap-3"
                >
                  {e.error ? (
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{e.event_type}</Badge>
                      <span className="font-mono break-all">{e.sale_id}</span>
                    </div>
                    <p className="text-muted-foreground">
                      Reçu : {new Date(e.received_at).toLocaleString()}
                      {e.processed_at
                        ? ` · Traité : ${new Date(e.processed_at).toLocaleString()}`
                        : " · Non traité"}
                    </p>
                    {e.error && (
                      <p className="text-destructive break-all">Erreur : {e.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UrlRow({
  label,
  url,
  onCopy,
}: {
  label: string;
  url: string;
  onCopy: (t: string, l: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label} :</p>
      <div className="flex gap-2">
        <code className="flex-1 rounded bg-muted px-3 py-2 text-xs break-all">{url}</code>
        <Button size="sm" variant="outline" onClick={() => onCopy(url, label)}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
