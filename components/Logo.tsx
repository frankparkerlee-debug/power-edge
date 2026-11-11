import Image from "next/image";
import Link from "next/link";

/**
 * Official PowerEdge mark: charcoal-circle + lime-bolt icon (public/brand/
 * poweredge-icon.png) + the lowercase two-tone "poweredge" wordmark.
 * `light` = on a dark background (header/footer, the portal bar, sign-in).
 * `href` = where it goes: the public site by default, Today in the portal.
 * `compact` = icon only on phones, where the portal bar also needs the title.
 */
export function Logo({
  light = false,
  href = "/",
  compact = false,
  size = 36,
}: {
  light?: boolean;
  href?: string;
  compact?: boolean;
  size?: number;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex shrink-0 items-center gap-2.5"
      aria-label={href === "/" ? "poweredge home" : "poweredge"}
    >
      <Image
        src="/brand/poweredge-icon.png"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        priority
      />
      <span
        className={`font-display text-xl font-extrabold lowercase tracking-tight ${compact ? "hidden sm:inline" : ""}`}
      >
        <span className={light ? "text-fg-inv" : "text-fg"}>power</span>
        <span className={light ? "text-bolt" : "text-bolt-deep"}>edge</span>
      </span>
    </Link>
  );
}
