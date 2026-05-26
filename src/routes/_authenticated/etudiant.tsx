import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { Home, BookOpen, Video, CreditCard, TrendingUp, Award, LifeBuoy } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/etudiant")({
  component: StudentLayout,
});

const items = [
  { title: "Accueil", url: "/etudiant", icon: Home },
  { title: "Ressources", url: "/etudiant/ressources", icon: BookOpen },
  { title: "Séances live", url: "/etudiant/live", icon: Video },
  { title: "Paiements", url: "/etudiant/paiements", icon: CreditCard },
  { title: "Progression", url: "/etudiant/progression", icon: TrendingUp },
  { title: "Certificat", url: "/etudiant/certificat", icon: Award },
  { title: "Support", url: "/etudiant/support", icon: LifeBuoy },
];

function StudentLayout() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (isAdmin) return <Navigate to="/admin" />;
  return <AppShell items={items}><Outlet /></AppShell>;
}
