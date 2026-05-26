import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Send, Mail, MessageCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendSupportRequest } from "@/lib/email.functions";

export const Route = createFileRoute("/_authenticated/etudiant/support")({
  component: SupportPage,
});

function SupportPage() {
  const send = useServerFn(sendSupportRequest);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.subject.trim().length < 2 || form.message.trim().length < 5) {
      return toast.error("Sujet et message requis");
    }
    setSending(true);
    try {
      await send({ data: { subject: form.subject.trim(), message: form.message.trim() } });
      toast.success("Demande envoyée — nous revenons vers vous rapidement");
      setForm({ subject: "", message: "" });
    } catch (err: any) {
      toast.error(err.message ?? "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Support</h1>
        <p className="mt-1 text-muted-foreground">Une question ? Notre équipe vous répond sous 24h ouvrées.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Sujet</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Ex : Problème de connexion Zoom" />
          </div>
          <div>
            <Label>Votre message</Label>
            <Textarea rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Décrivez votre demande en détail..." />
          </div>
          <Button type="submit" disabled={sending} className="bg-gold text-primary hover:bg-gold/90">
            <Send className="mr-1 h-4 w-4" /> {sending ? "Envoi..." : "Envoyer"}
          </Button>
        </form>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">Autres moyens de nous joindre</h2>
        <div className="space-y-2 text-sm">
          <a href="mailto:support@nodie.academy" className="flex items-center gap-2 hover:text-gold">
            <Mail className="h-4 w-4" /> support@nodie.academy
          </a>
          <a href="https://wa.me/221770000000" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-gold">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>
      </Card>
    </div>
  );
}
