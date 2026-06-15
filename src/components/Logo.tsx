import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/logoNODIEIAACADEMY.png.asset.json";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2 font-semibold tracking-tight" aria-label="Nodie IA Academy">
      <img
        src={logoAsset.url}
        alt="Nodie IA Academy"
        className="h-9 w-auto object-contain"
      />
      <span className="sr-only">Nodie IA Academy</span>
      {light ? null : null}
    </Link>
  );
}
