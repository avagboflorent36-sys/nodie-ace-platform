import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { loginSchema } from "@/lib/validators";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Connexion — Nodie IA Academy" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Données invalides");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Connexion réussie");
    // Check role to route correctly
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate({ to: "/" }); return; }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin");
    navigate({ to: isAdmin ? "/admin" : "/etudiant" });
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden bg-primary p-12 text-primary-foreground md:flex md:flex-col md:justify-between">
        <Logo light />
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Bienvenue sur <span className="text-gold">Nodie IA Academy</span>
          </h1>
          <p className="mt-4 text-primary-foreground/70">
            Accédez à vos cohortes, ressources et progression.
          </p>
        </div>
        <div className="text-xs text-primary-foreground/40">© Nodie IA Academy</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 shadow-premium">
          <div className="md:hidden mb-6"><Logo /></div>
          <h2 className="text-2xl font-bold">Connexion</h2>
          <p className="mt-1 text-sm text-muted-foreground">Accédez à votre espace personnel.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <Link to="/forgot-password" className="text-xs text-gold hover:underline">Oublié ?</Link>
              </div>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Pas encore de compte ? <Link to="/signup" className="font-medium text-gold hover:underline">Créer un compte</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
