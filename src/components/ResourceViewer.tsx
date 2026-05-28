import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Video, Link2, BookOpen, ExternalLink, PlayCircle, Check, ChevronRight, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type ResourceItem = {
  id: string;
  title: string;
  type: string; // 'video' | 'document' | 'link' | 'exercise'
  url?: string | null;
  description?: string | null;
};

const ICONS: Record<string, any> = { document: FileText, video: Video, link: Link2, exercise: BookOpen };

function toYouTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith("youtube.com")) {
      if (u.pathname === "/watch") {
        const v = u.searchParams.get("v");
        return v ? `https://www.youtube.com/embed/${v}` : null;
      }
      if (u.pathname.startsWith("/embed/") || u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
    return null;
  } catch { return null; }
}

function toVimeoEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("vimeo.com")) return null;
    const id = u.pathname.split("/").filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  } catch { return null; }
}

function isPdfUrl(url: string): boolean {
  try { return new URL(url).pathname.toLowerCase().endsWith(".pdf"); } catch { return false; }
}

export function useResourceProgress() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["resource-progress", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("progress_tracking")
        .select("ressource_id")
        .eq("student_id", user!.id);
      return new Set<string>((data ?? []).map((r: any) => r.ressource_id));
    },
  });
}

export function ResourcePlaylist({ resources }: { resources: ResourceItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { data: readSet } = useResourceProgress();

  return (
    <>
      {resources.map((r, i) => {
        const Icon = ICONS[r.type] ?? BookOpen;
        const canOpen = !!(r.url && r.url.trim()) || r.type === "exercise" || !!r.description;
        const isRead = readSet?.has(r.id) ?? false;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => canOpen && setOpenIndex(i)}
            disabled={!canOpen}
            className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon className="h-4 w-4 text-gold shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate flex items-center gap-2">
                {r.title}
                {isRead && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />}
              </div>
              {r.description && <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>}
            </div>
            <span className="text-xs uppercase text-muted-foreground hidden sm:inline">{r.type}</span>
            {canOpen ? (
              <span className="text-xs font-medium text-gold inline-flex items-center gap-1"><PlayCircle className="h-3 w-3" />Ouvrir</span>
            ) : (
              <span className="text-xs text-muted-foreground">Indisponible</span>
            )}
          </button>
        );
      })}

      {openIndex !== null && (
        <ResourceViewer
          open={openIndex !== null}
          onOpenChange={(o) => { if (!o) setOpenIndex(null); }}
          resource={resources[openIndex]}
          hasNext={openIndex < resources.length - 1}
          onNext={() => setOpenIndex((idx) => (idx !== null && idx < resources.length - 1 ? idx + 1 : idx))}
        />
      )}
    </>
  );
}

export function ResourceViewer({ open, onOpenChange, resource, hasNext, onNext }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  resource: ResourceItem;
  hasNext?: boolean;
  onNext?: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: readSet } = useResourceProgress();
  const isRead = readSet?.has(resource.id) ?? false;

  const toggleRead = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non connecté");
      if (isRead) {
        const { error } = await supabase
          .from("progress_tracking")
          .delete()
          .eq("student_id", user.id)
          .eq("ressource_id", resource.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("progress_tracking")
          .insert({ student_id: user.id, ressource_id: resource.id, completed: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-progress", user?.id] });
      toast.success(isRead ? "Marqué comme non lu" : "Marqué comme lu ✓");
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const url = resource.url?.trim() || "";
  const hasUrl = url.length > 0;

  let body: React.ReactNode = null;

  if (resource.type === "video" && hasUrl) {
    const embed = toYouTubeEmbed(url) ?? toVimeoEmbed(url);
    body = embed ? (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe src={embed} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
    ) : <ExternalFallback url={url} label="Ouvrir la vidéo" />;
  } else if (resource.type === "document" && hasUrl) {
    body = isPdfUrl(url) ? (
      <div className="h-[60vh] w-full overflow-hidden rounded-lg border">
        <iframe src={url} className="h-full w-full" title={resource.title} />
      </div>
    ) : <ExternalFallback url={url} label="Ouvrir le document" />;
  } else if (resource.type === "link" && hasUrl) {
    body = <ExternalFallback url={url} label="Ouvrir le lien" />;
  } else if (resource.type === "exercise") {
    body = (
      <div className="space-y-4">
        {resource.description ? (
          <p className="whitespace-pre-wrap text-sm">{resource.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune consigne fournie pour cet exercice.</p>
        )}
        {hasUrl && <ExternalFallback url={url} label="Ouvrir le support de l'exercice" />}
      </div>
    );
  } else {
    body = <p className="text-sm text-muted-foreground">Ce contenu n'est pas encore disponible.</p>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8 flex items-center gap-2">
            {resource.title}
            {isRead && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          </DialogTitle>
        </DialogHeader>
        {resource.description && resource.type !== "exercise" && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{resource.description}</p>
        )}
        {body}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t">
          <Button
            variant={isRead ? "outline" : "default"}
            onClick={() => toggleRead.mutate()}
            disabled={toggleRead.isPending}
            className={isRead ? "" : "bg-green-600 hover:bg-green-700 text-white"}
          >
            <Check className="h-4 w-4 mr-2" />
            {isRead ? "✓ Déjà lu — annuler" : "Marquer comme lu"}
          </Button>
          {hasNext && (
            <Button
              variant="default"
              onClick={() => { if (!isRead && user) toggleRead.mutate(); onNext?.(); }}
              className="bg-gold text-primary hover:bg-gold/90"
            >
              Ressource suivante <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Backwards-compat: single-row outside a playlist */
export function ResourceRow({ r }: { r: ResourceItem }) {
  return <ResourcePlaylist resources={[r]} />;
}

function ExternalFallback({ url, label }: { url: string; label: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">Ce contenu s'ouvre dans un nouvel onglet.</p>
      <Button asChild className="bg-gold text-primary hover:bg-gold/90">
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
          <ExternalLink className="h-4 w-4" /> {label}
        </a>
      </Button>
      <p className="text-xs text-muted-foreground break-all">{url}</p>
    </div>
  );
}
