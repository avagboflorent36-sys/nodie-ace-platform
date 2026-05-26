import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Users, Award, Sparkles, CheckCircle2, MessageSquare } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nodie IA Academy — Maîtrisez l'intelligence artificielle" },
      { name: "description", content: "Cohortes premium, mentorat, ressources pédagogiques et certificats. Rejoignez la nouvelle génération de professionnels de l'IA." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data: formations = [] } = useQuery({
    queryKey: ["formations-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("formations")
        .select("id, title, slug, description, image_url, price_amount, currency, duration_weeks")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#formations" className="hover:text-foreground">Formations</a>
            <a href="#about" className="hover:text-foreground">À propos</a>
            <a href="#temoignages" className="hover:text-foreground">Témoignages</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Connexion</Button>
            </Link>
            <a href="#formations">
              <Button size="sm" className="bg-gold text-primary hover:bg-gold/90">S'inscrire</Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--gold-soft),_transparent_50%)]" />
        <div className="container mx-auto max-w-7xl px-4 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center animate-fade-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-premium">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              Nouvelle cohorte ouverte
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              Maîtrisez l'<span className="text-gold">intelligence artificielle</span> avec une académie premium
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Cohortes encadrées, ressources structurées, mentorat de haut niveau. Construisez une carrière dans l'IA avec Nodie.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a href="#formations">
                <Button size="lg" className="bg-gold text-primary hover:bg-gold/90 shadow-gold">
                  Voir les formations <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <Link to="/login">
                <Button size="lg" variant="outline">Espace étudiant</Button>
              </Link>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-6 text-center text-sm">
              {[
                { v: "500+", l: "Étudiants formés" },
                { v: "12", l: "Cohortes lancées" },
                { v: "95%", l: "Taux de satisfaction" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-2xl font-bold text-foreground md:text-3xl">{s.v}</div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-y bg-secondary/30">
        <div className="container mx-auto max-w-7xl px-4 py-24">
          <div className="grid gap-12 md:grid-cols-3">
            {[
              { icon: BookOpen, title: "Contenu structuré", desc: "Modules pédagogiques pensés par des praticiens de l'IA." },
              { icon: Users, title: "Cohortes encadrées", desc: "Apprentissage en groupe avec sessions live et mentorat." },
              { icon: Award, title: "Certification", desc: "Obtenez un certificat reconnu à la fin de votre formation." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-gold/15 text-gold transition group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formations */}
      <section id="formations" className="container mx-auto max-w-7xl px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Nos formations</h2>
          <p className="mt-3 text-muted-foreground">Des parcours conçus pour propulser votre carrière dans l'IA.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {formations.length === 0 ? (
            <Card className="col-span-full p-12 text-center text-muted-foreground">
              Les formations seront bientôt disponibles. Revenez bientôt !
            </Card>
          ) : (
            formations.map((f) => (
              <Card key={f.id} className="group overflow-hidden p-6 transition hover:shadow-premium">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{f.description}</p>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gold">
                    {Number(f.price_amount).toLocaleString()} {f.currency}
                  </span>
                  <Button variant="ghost" size="sm" className="text-gold">
                    En savoir plus <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Témoignages */}
      <section id="temoignages" className="border-y bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-7xl px-4 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Ils nous font confiance</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { name: "Aïcha M.", role: "Data Analyst", quote: "Le parcours Nodie a transformé ma carrière. Le mentorat est exceptionnel." },
              { name: "Kouassi T.", role: "ML Engineer", quote: "Du contenu structuré, du suivi sérieux. Je recommande vivement." },
              { name: "Fatou D.", role: "Entrepreneure", quote: "J'ai intégré l'IA dans mon business grâce à cette académie." },
            ].map((t) => (
              <Card key={t.name} className="border-sidebar-border bg-sidebar-accent p-6 text-sidebar-foreground">
                <MessageSquare className="h-5 w-5 text-gold" />
                <p className="mt-4 text-sm leading-relaxed">"{t.quote}"</p>
                <div className="mt-6">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-sidebar-foreground/60">{t.role}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container mx-auto max-w-3xl px-4 py-24">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Questions fréquentes</h2>
        </div>
        <Accordion type="single" collapsible className="mt-10">
          {[
            { q: "Comment se déroule une cohorte ?", a: "Chaque cohorte est encadrée par des mentors et propose des sessions live, des ressources écrites/vidéo et des exercices pratiques." },
            { q: "Puis-je payer en plusieurs fois ?", a: "Oui, vous pouvez régler en une fois ou en 2 versements. Le mode est choisi à l'inscription." },
            { q: "Que se passe-t-il en cas de retard de paiement ?", a: "L'accès aux ressources est temporairement suspendu jusqu'à régularisation. Vous serez automatiquement réactivé après validation." },
            { q: "Obtient-on un certificat ?", a: "Oui, un certificat est délivré à la fin de chaque parcours validé." },
          ].map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA Footer */}
      <section className="bg-secondary/40">
        <div className="container mx-auto max-w-7xl px-4 py-20 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Prêt à rejoindre la prochaine cohorte ?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Inscrivez-vous dès aujourd'hui et commencez votre parcours dans l'IA.
          </p>
          <div className="mt-8">
            <a href="#formations">
              <Button size="lg" className="bg-gold text-primary hover:bg-gold/90 shadow-gold">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Je m'inscris
              </Button>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <Logo light />
              <p className="mt-3 text-sm text-primary-foreground/70">
                Académie premium dédiée à l'intelligence artificielle.
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold">Plateforme</div>
              <ul className="mt-3 space-y-2 text-sm text-primary-foreground/70">
                <li><a href="#formations" className="hover:text-gold">Formations</a></li>
                <li><a href="#temoignages" className="hover:text-gold">Témoignages</a></li>
                <li><a href="#faq" className="hover:text-gold">FAQ</a></li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-semibold">Compte</div>
              <ul className="mt-3 space-y-2 text-sm text-primary-foreground/70">
                <li><Link to="/login" className="hover:text-gold">Connexion</Link></li>
                <li><Link to="/signup" className="hover:text-gold">Créer un compte</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-primary-foreground/10 pt-6 text-xs text-primary-foreground/50">
            © {new Date().getFullYear()} Nodie IA Academy. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
