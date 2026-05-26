import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, Users, BookOpen, Layers, CreditCard, Bell } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const items = [
  { title: "Vue d'ensemble", url: "/admin", icon: LayoutDashboard },
  { title: "Étudiants", url: "/admin/etudiants", icon: Users },
  { title: "Formations", url: "/admin/formations", icon: BookOpen },
  { title: "Cohortes", url: "/admin/cohortes", icon: Layers },
  { title: "Paiements", url: "/admin/paiements", icon: CreditCard },
  { title: "Notifications", url: "/admin/notifications", icon: Bell },
];

function AdminLayout() {
  const { isAdmin, loading, rolesLoaded } = useAuth();
  if (loading || !rolesLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/etudiant" />;
  return <AppShell items={items}><Outlet /></AppShell>;
}
