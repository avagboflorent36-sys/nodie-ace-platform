import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/etudiant/certificat")({
  component: () => (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Certificat</h1>
      <Card className="mt-6 p-12 text-center text-muted-foreground">
        Disponible une fois votre formation terminée.
      </Card>
    </div>
  ),
});
