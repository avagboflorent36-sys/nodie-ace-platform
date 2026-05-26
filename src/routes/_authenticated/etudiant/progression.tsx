import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/etudiant/progression")({
  component: () => (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Progression</h1>
      <Card className="mt-6 p-12 text-center text-muted-foreground">Bientôt disponible.</Card>
    </div>
  ),
});
