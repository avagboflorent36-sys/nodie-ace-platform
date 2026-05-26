import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/etudiants")({
  component: StudentsPage,
});

function StudentsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: students = [] } = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, whatsapp, country, created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = students.filter((s: any) =>
    !search ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.first_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.last_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Étudiants</h1>
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Pays</TableHead>
              <TableHead>Inscrit le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">Aucun étudiant.</TableCell></TableRow>
            ) : (
              filtered.map((s: any) => (
                <TableRow key={s.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link to="/admin/etudiants/$id" params={{ id: s.id }} className="hover:text-gold hover:underline">
                      {s.first_name} {s.last_name}
                    </Link>
                  </TableCell>
                  <TableCell><Link to="/admin/etudiants/$id" params={{ id: s.id }} className="hover:underline">{s.email}</Link></TableCell>
                  <TableCell>{s.whatsapp ?? "—"}</TableCell>
                  <TableCell>{s.country ?? "—"}</TableCell>
                  <TableCell>{new Date(s.created_at).toLocaleDateString("fr-FR")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
