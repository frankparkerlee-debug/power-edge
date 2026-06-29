import Link from "next/link";
import { site } from "@/lib/site";

/**
 * Persistent bottom action bar on mobile — Call · Text · Free Quote always one
 * thumb-tap away. Most contractor traffic is mobile, so this is the single
 * biggest on-site lead-capture lever. Hidden on desktop (the floating Text
 * button + sticky header CTA cover desktop).
 */
export function MobileCtaBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t border-line bg-ink/95 backdrop-blur lg:hidden">
      <a
        href={site.phoneHref}
        className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-fg-inv"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
          <path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.25 1l-2.23 2.2z" />
        </svg>
        <span className="text-xs font-bold">Call</span>
      </a>
      <a
        href={site.textHref}
        className="flex flex-col items-center justify-center gap-0.5 border-x border-line py-2.5 text-fg-inv"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
          <path d="M4 4h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1z" />
        </svg>
        <span className="text-xs font-bold">Text</span>
      </a>
      <Link
        href="/contact"
        className="flex flex-col items-center justify-center gap-0.5 bg-bolt py-2.5 text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
          <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" />
        </svg>
        <span className="text-xs font-extrabold">Free Quote</span>
      </Link>
    </div>
  );
}
