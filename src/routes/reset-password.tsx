import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nouveau mot de passe — Nodie IA Academy" }] }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("8 caractères minimum"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Mot de passe mis à jour");
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 p-6">
      <Card className="w-full max-w-md p-8 shadow-premium">
        <Logo />
        <h2 className="mt-6 text-2xl font-bold">Définir un nouveau mot de passe</h2>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="pwd">Nouveau mot de passe</Label>
            <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Mise à jour..." : "Mettre à jour"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
