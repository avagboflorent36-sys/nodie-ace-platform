import { Link } from "@tanstack/react-router";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span
        className="grid h-8 w-8 place-items-center rounded-lg bg-gold font-bold text-primary"
        aria-hidden
      >
        N
      </span>
      <span className={`${light ? "text-sidebar-foreground" : "text-foreground"} truncate`}>
        Nodie <span className="text-gold">IA</span> Academy
      </span>

    </Link>
  );
}
