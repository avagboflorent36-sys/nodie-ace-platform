import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/etudiant/profil")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ first_name: "", last_name: "", whatsapp: "", country: "" });
  const [uploading, setUploading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  useEffect(() => {
    if (profile) setForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      whatsapp: profile.whatsapp ?? "",
      country: profile.country ?? "",
    });
  }, [profile]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Profil enregistré");
    qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      toast.success("Avatar mis à jour");
      qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Échec de l'envoi");
    } finally {
      setUploading(false);
    }
  };

  const initials = `${form.first_name?.[0] ?? ""}${form.last_name?.[0] ?? ""}`.toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mon profil</h1>
        <p className="mt-1 text-muted-foreground">Mettez à jour vos informations personnelles.</p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gold/20 text-gold text-xl">{initials}</AvatarFallback>
          </Avatar>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }} />
            <Button asChild variant="outline" disabled={uploading}>
              <span><Upload className="mr-1 h-3 w-3" />{uploading ? "Envoi..." : "Changer la photo"}</span>
            </Button>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Prénom</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
          <div><Label>Nom</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
          <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+221..." /></div>
          <div><Label>Pays</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Email</Label><Input value={profile?.email ?? ""} disabled /></div>
        </div>

        <Button onClick={save} className="bg-gold text-primary hover:bg-gold/90"><Save className="mr-1 h-4 w-4" /> Enregistrer</Button>
      </Card>
    </div>
  );
}
