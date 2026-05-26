import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Mot de passe oublié — Nodie IA Academy" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 p-6">
      <Card className="w-full max-w-md p-8 shadow-premium">
        <Logo />
        <h2 className="mt-6 text-2xl font-bold">Mot de passe oublié</h2>
        {sent ? (
          <p className="mt-4 text-sm text-muted-foreground">Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé.</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Envoi..." : "Envoyer le lien"}
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-gold hover:underline">Retour à la connexion</Link>
        </p>
      </Card>
    </div>
  );
}
