import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/etudiant/support")({
  component: () => (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Support</h1>
      <Card className="mt-6 p-8 space-y-2 text-sm text-muted-foreground">
        <p>Besoin d'aide ? Contactez-nous par email à <span className="text-foreground font-medium">support@nodie.academy</span>.</p>
      </Card>
    </div>
  ),
});
