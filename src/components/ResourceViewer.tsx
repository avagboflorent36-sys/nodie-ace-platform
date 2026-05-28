import { useState } from "react";
import { FileText, Video, Link2, BookOpen, ExternalLink, PlayCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

export function ResourceRow({ r }: { r: ResourceItem }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[r.type] ?? BookOpen;
  const hasUrl = !!r.url && r.url.trim().length > 0;
  const canOpenSomething = hasUrl || r.type === "exercise" || !!r.description;

  return (
    <>
      <button
        type="button"
        onClick={() => canOpenSomething && setOpen(true)}
        disabled={!canOpenSomething}
        className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon className="h-4 w-4 text-gold shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{r.title}</div>
          {r.description && <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>}
        </div>
        <span className="text-xs uppercase text-muted-foreground hidden sm:inline">{r.type}</span>
        {canOpenSomething ? (
          <span className="text-xs font-medium text-gold inline-flex items-center gap-1"><PlayCircle className="h-3 w-3" />Ouvrir</span>
        ) : (
          <span className="text-xs text-muted-foreground">Indisponible</span>
        )}
      </button>

      <ResourceViewer open={open} onOpenChange={setOpen} resource={r} />
    </>
  );
}

export function ResourceViewer({ open, onOpenChange, resource }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  resource: ResourceItem;
}) {
  const url = resource.url?.trim() || "";
  const hasUrl = url.length > 0;

  let body: React.ReactNode = null;

  if (resource.type === "video" && hasUrl) {
    const embed = toYouTubeEmbed(url) ?? toVimeoEmbed(url);
    if (embed) {
      body = (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe src={embed} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      );
    } else {
      body = <ExternalFallback url={url} label="Ouvrir la vidéo" />;
    }
  } else if (resource.type === "document" && hasUrl) {
    if (isPdfUrl(url)) {
      body = (
        <div className="h-[70vh] w-full overflow-hidden rounded-lg border">
          <iframe src={url} className="h-full w-full" title={resource.title} />
        </div>
      );
    } else {
      body = <ExternalFallback url={url} label="Ouvrir le document" />;
    }
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="pr-8">{resource.title}</DialogTitle>
        </DialogHeader>
        {resource.description && resource.type !== "exercise" && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{resource.description}</p>
        )}
        {body}
      </DialogContent>
    </Dialog>
  );
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
