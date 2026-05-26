import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { Home, GraduationCap, Video, Award, LifeBuoy } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/etudiant")({
  component: StudentLayout,
});

const items = [
  { title: "Accueil", url: "/etudiant", icon: Home },
  { title: "Formation", url: "/etudiant/formation", icon: GraduationCap },
  { title: "Séances live", url: "/etudiant/live", icon: Video },
  { title: "Certificat", url: "/etudiant/certificat", icon: Award },
  { title: "Support", url: "/etudiant/support", icon: LifeBuoy },
];

function StudentLayout() {
  const { isAdmin, loading, rolesLoaded } = useAuth();
  if (loading || !rolesLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    );
  }
  if (isAdmin) return <Navigate to="/admin" />;
  return <AppShell items={items}><Outlet /></AppShell>;
}
