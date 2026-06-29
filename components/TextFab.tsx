import { site } from "@/lib/site";

/**
 * Floating "Text us" button — fixed bottom-right, always within thumb reach on
 * mobile (where most traffic lands). Opens the device messaging app to the
 * CallRail text line. Pure link, no JS.
 */
export function TextFab() {
  return (
    <a
      href={site.textHref}
      aria-label={`Text us at ${site.textNumber}`}
      className="fixed bottom-5 right-5 z-50 hidden items-center gap-2 rounded-full bg-bolt px-5 py-3.5 font-display text-sm font-bold text-ink shadow-[0_10px_30px_-6px_rgba(127,251,174,0.6)] transition-transform hover:scale-105 active:scale-95 lg:inline-flex"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-ink" aria-hidden>
        <path d="M4 4h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1z" />
      </svg>
      Text us
    </a>
  );
}
