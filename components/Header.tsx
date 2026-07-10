"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./Logo";
import { site } from "@/lib/site";

const nav = [
  { href: "/roof-claim-check", label: "Claim Check", accent: true },
  { href: "/financing", label: "Financing", accent: true },
  { href: "/roofing", label: "Roofing" },
  { href: "/solar", label: "Solar" },
  { href: "/commercial", label: "Commercial" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-ink/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo light />

        <nav className="hidden items-center gap-7 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                item.accent
                  ? "text-sm font-bold text-bolt transition-colors hover:text-bolt-hi"
                  : "text-sm font-medium text-fg-inv-dim transition-colors hover:text-fg-inv"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <a
            href={site.phoneHref}
            className="font-display text-sm font-bold text-fg-inv hover:text-bolt"
          >
            {site.phone}
          </a>
          <a
            href={site.textHref}
            className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-fg-inv hover:text-bolt"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
              <path d="M4 4h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1z" />
            </svg>
            Text us
          </a>
          <Link
            href="/free-inspection"
            className="rounded-md bg-bolt px-4 py-2 font-display text-sm font-bold text-ink transition-colors hover:bg-bolt-hi"
          >
            Free inspection
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line text-fg-inv lg:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <div className="space-y-1.5">
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
          </div>
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-line bg-ink lg:hidden">
          <div className="space-y-1 px-5 py-4">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={
                  item.accent
                    ? "block rounded-md px-3 py-2.5 text-base font-bold text-bolt hover:bg-steel"
                    : "block rounded-md px-3 py-2.5 text-base font-medium text-fg-inv-dim hover:bg-steel hover:text-fg-inv"
                }
              >
                {item.label}
              </Link>
            ))}
            <div className="space-y-3 pt-3">
              <div className="flex gap-3">
                <a
                  href={site.phoneHref}
                  className="flex-1 rounded-md border border-line px-4 py-3 text-center font-display font-bold text-fg-inv"
                >
                  Call
                </a>
                <a
                  href={site.textHref}
                  className="flex-1 rounded-md border border-line px-4 py-3 text-center font-display font-bold text-fg-inv"
                >
                  Text us
                </a>
              </div>
              <Link
                href="/free-inspection"
                onClick={() => setOpen(false)}
                className="block rounded-md bg-bolt px-4 py-3 text-center font-display font-bold text-ink"
              >
                Free inspection
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
