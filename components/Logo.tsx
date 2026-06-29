import Image from "next/image";
import Link from "next/link";

/**
 * Official PowerEdge mark: charcoal-circle + lime-bolt icon (public/brand/
 * poweredge-icon.png) + the lowercase two-tone "poweredge" wordmark.
 * `light` = on a dark background (header/footer).
 */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2.5"
      aria-label="poweredge home"
    >
      <Image
        src="/brand/poweredge-icon.png"
        alt=""
        width={36}
        height={36}
        className="h-9 w-9"
        priority
      />
      <span className="font-display text-xl font-extrabold lowercase tracking-tight">
        <span className={light ? "text-fg-inv" : "text-fg"}>power</span>
        <span className={light ? "text-bolt" : "text-bolt-deep"}>edge</span>
      </span>
    </Link>
  );
}
