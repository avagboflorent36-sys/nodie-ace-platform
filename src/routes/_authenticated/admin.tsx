import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, Users, BookOpen, Layers, CreditCard, Bell, FolderOpen } from "lucide-react";

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
  { title: "Contenu", url: "/admin/contenu", icon: FolderOpen },
  { title: "Paiements", url: "/admin/paiements", icon: CreditCard },
  { title: "Notifications", url: "/admin/notifications", icon: Bell },
];

function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/etudiant" />;
  return <AppShell items={items}><Outlet /></AppShell>;
}
