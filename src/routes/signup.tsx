import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { signupSchema } from "@/lib/validators";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Inscription — Nodie IA Academy" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, rolesLoaded, isAdmin } = useAuth();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  if (!authLoading && user && rolesLoaded) {
    return <Navigate to={isAdmin ? "/admin" : "/etudiant"} />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Données invalides");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/etudiant`,
        data: { first_name: parsed.data.firstName, last_name: parsed.data.lastName },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Compte créé !");
    navigate({ to: "/etudiant" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 p-6">
      <Card className="w-full max-w-md p-8 shadow-premium">
        <Logo />
        <h2 className="mt-6 text-2xl font-bold">Créer un compte</h2>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fn">Prénom</Label>
              <Input id="fn" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="ln">Nom</Label>
              <Input id="ln" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <p className="mt-1 text-xs text-muted-foreground">8 caractères minimum.</p>
          </div>
          <Button type="submit" className="w-full bg-gold text-primary hover:bg-gold/90" disabled={loading}>
            {loading ? "Création..." : "Créer mon compte"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Déjà inscrit ? <Link to="/login" className="font-medium text-gold hover:underline">Se connecter</Link>
        </p>
      </Card>
    </div>
  );
}
