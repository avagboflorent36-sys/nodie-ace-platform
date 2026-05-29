import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, MessageCircle } from "lucide-react";


import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/etudiants/")({
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

  const exportCsv = () => {
    const head = ["Prénom", "Nom", "Email", "WhatsApp", "Pays", "Inscrit le"];
    const lines = filtered.map((s: any) => [s.first_name, s.last_name, s.email, s.whatsapp ?? "", s.country ?? "", new Date(s.created_at).toISOString().slice(0, 10)]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [head.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `etudiants-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Étudiants</h1>
        <div className="flex gap-2">
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-1 h-3 w-3" /> Exporter CSV</Button>
        </div>
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
              <TableHead className="text-right">Contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">Aucun étudiant.</TableCell></TableRow>
            ) : (
              filtered.map((s: any) => {
                const digits = String(s.whatsapp ?? "").replace(/\D/g, "");
                const canWhatsApp = digits.length >= 7;
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-accent/40"
                    onClick={() => navigate({ to: "/admin/etudiants/$id", params: { id: s.id } })}
                  >
                    <TableCell className="font-medium text-gold">
                      {s.first_name} {s.last_name}
                    </TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell>{s.whatsapp ?? "—"}</TableCell>
                    <TableCell>{s.country ?? "—"}</TableCell>
                    <TableCell>{new Date(s.created_at).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="text-right">
                      {canWhatsApp ? (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href={`https://wa.me/${digits}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Ouvrir WhatsApp avec ${s.first_name} ${s.last_name}`}
                          >
                            <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground" title="Numéro WhatsApp non disponible">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
