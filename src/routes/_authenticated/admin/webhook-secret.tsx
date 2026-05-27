import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Copy, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChariowWebhookUrls } from "@/lib/admin-secrets.functions";

export const Route = createFileRoute("/_authenticated/admin/webhook-secret")({
  component: WebhookSecretPage,
});

function WebhookSecretPage() {
  const fetchUrls = useServerFn(getChariowWebhookUrls);
  const [urls, setUrls] = useState<{ previewUrl: string; productionUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Page temporaire</p>
          <p className="text-destructive/80">
            Cette page affiche le secret du webhook Chariow. Après avoir copié l'URL
            et configuré Chariow, demande-moi de la supprimer.
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
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  URL preview (pour tester maintenant) :
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-xs break-all">
                    {urls.previewUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copy(urls.previewUrl, "URL preview")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  URL production (après publication) :
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-xs break-all">
                    {urls.productionUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copy(urls.productionUrl, "URL production")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Étapes :</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Copier l'URL preview</li>
                  <li>Coller dans Chariow comme URL de webhook</li>
                  <li>Faire un paiement test</li>
                  <li>Vérifier dans /admin/paiements</li>
                </ol>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
